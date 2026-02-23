import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  ToolLoopAgent,
} from "ai";
import { createBashTool, experimental_createSkillTool } from "bash-tool";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { cleanupMCPClients, getMCPTools } from "@/lib/ai/mcp/tools";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { neo4jTools } from "@/lib/ai/tools/neo4j-tools";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { OpenChatError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

// Tool-loop (MCP, skills) can run multiple steps in one request; allow enough time.
export const maxDuration = 300;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new OpenChatError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const session = await auth();

    if (!session?.user) {
      return new OpenChatError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new OpenChatError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new OpenChatError("forbidden:chat").toResponse();
      }
      if (!isToolApprovalFlow) {
        messagesFromDb = await getMessagesByChatId({ id });
      }
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    const uiMessages = isToolApprovalFlow
      ? (messages as ChatMessage[])
      : [...convertToUIMessages(messagesFromDb), message as ChatMessage];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const isReasoningModel =
      selectedChatModel.includes("reasoning") ||
      selectedChatModel.includes("thinking");

    // Check if it's a Gemini 3 model (supports thinking via thinkingConfig)
    const isGemini3Model = selectedChatModel.startsWith("google/gemini-3");

    const modelMessages = await convertToModelMessages(uiMessages);

    // Load bash-tool skills so agent can call skills via bashtools
    // See: https://ai-sdk.dev/cookbook/guides/agent-skills
    let skillTool:
      | Awaited<ReturnType<typeof experimental_createSkillTool>>["skill"]
      | null = null;
    let bashTools: Awaited<ReturnType<typeof createBashTool>>["tools"] | null =
      null;
    let skillsInstructions = "";
    try {
      // Check if skills directory exists
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const skillsPath = path.join(process.cwd(), "lib/ai/skills");

      try {
        await fs.access(skillsPath);
        console.log("[Skills] Skills directory exists at:", skillsPath);
      } catch {
        console.error("[Skills] Skills directory NOT found at:", skillsPath);
        console.error("[Skills] Current working directory:", process.cwd());
        throw new Error("Skills directory not found");
      }

      // Discover skills and get files to upload
      const { skill, files, instructions } = await experimental_createSkillTool(
        {
          skillsDirectory: "lib/ai/skills",
        }
      );
      skillTool = skill;
      skillsInstructions = instructions;

      // Create bash tool with skill files
      // DON'T pass instructions to extraInstructions - it adds misleading text
      // about running scripts. Instead, we'll add instructions to system prompt.
      const { tools } = await createBashTool({
        files,
      });
      bashTools = tools;
      console.log(
        "[Skills] Successfully loaded",
        Object.keys(tools || {}).length,
        "bash tools"
      );
    } catch (error) {
      // Skills optional; agent still has MCP + built-in tools
      console.error("[Skills] Failed to load skills:", error);
    }

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        // Load MCP tools
        const { tools: mcpTools, clients: mcpClients } = await getMCPTools();

        // Combine MCP tools, built-in tools, skill tool, bash tools, and Neo4j tools
        const allTools = {
          ...(skillTool ? { skill: skillTool } : {}),
          ...(bashTools || {}),
          ...mcpTools,
          ...neo4jTools,
          getWeather,
          createDocument: createDocument({ session, dataStream }),
          updateDocument: updateDocument({ session, dataStream }),
          requestSuggestions: requestSuggestions({ session, dataStream }),
        };

        try {
          // Multi-step loop: each step runs until model finishes; tool results are sent as
          // tool-result/tool-error so the next step runs. The SDK passes tool results back
          // into context (toResponseMessages + streamStep), so the model sees prior thoughts.
          // stopWhen: stepCountIs(20) allows up to 20 steps (e.g. Sequential Thinking 5/5).
          // MCP tools are wrapped to never reject so stepToolOutputs always gets an entry.
          const agent = new ToolLoopAgent({
            model: getLanguageModel(selectedChatModel),
            instructions:
              systemPrompt({ selectedChatModel, requestHints }) +
              (skillsInstructions ? `\n\n${skillsInstructions}` : ""),
            tools: allTools,
            stopWhen: stepCountIs(20),
            experimental_telemetry: isProductionEnvironment
              ? {
                  isEnabled: true,
                  functionId: "tool-loop-agent",
                }
              : undefined,
            providerOptions: isReasoningModel
              ? {
                  anthropic: {
                    thinking: { type: "enabled", budgetTokens: 10_000 },
                  },
                }
              : isGemini3Model
                ? {
                    google: {
                      thinkingConfig: {
                        thinkingLevel: "high",
                        includeThoughts: true,
                      },
                    },
                  }
                : undefined,
          });

          const result = await agent.stream({
            messages: modelMessages,
          });

          // Merge first so the client receives reasoning/tool chunks immediately.
          dataStream.merge(result.toUIMessageStream({ sendReasoning: true }));

          if (titlePromise) {
            titlePromise
              .then((title) => {
                dataStream.write({ type: "data-chat-title", data: title });
                updateChatTitleById({ chatId: id, title });
              })
              .catch(() => {
                // ignore title generation failure
              });
          }
        } catch (error) {
          const errorId = generateUUID();
          const message =
            error instanceof Error ? error.message : String(error);
          dataStream.write({ type: "text-start", id: errorId });
          dataStream.write({
            type: "text-delta",
            id: errorId,
            delta: `\n\nSomething went wrong and the response stopped: ${message}`,
          });
          dataStream.write({ type: "text-end", id: errorId });
        } finally {
          // Run cleanup in background so execute() can return and stream stays responsive.
          cleanupMCPClients(mcpClients).catch((err) => {
            console.error("Error during MCP client cleanup:", err);
          });
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        return `Something went wrong (response stopped): ${message}`;
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          // ignore redis errors
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof OpenChatError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new OpenChatError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new OpenChatError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new OpenChatError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new OpenChatError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new OpenChatError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
