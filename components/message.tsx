"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "./elements/tool";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";

/** Sequential Thinking MCP returns { thoughtNumber, totalThoughts, nextThoughtNeeded }. Show a short summary so "Completed" isn't misleading when nextThoughtNeeded is true. */
function SequentialThinkingSummary({ output }: { output: unknown }) {
  if (
    output == null ||
    typeof output !== "object" ||
    !("thoughtNumber" in output) ||
    !("totalThoughts" in output) ||
    !("nextThoughtNeeded" in output)
  ) {
    return null;
  }
  const o = output as {
    thoughtNumber: number;
    totalThoughts: number;
    nextThoughtNeeded: boolean;
  };
  return (
    <p className="mb-2 border-b border-muted pb-2 text-muted-foreground text-xs">
      Thought {o.thoughtNumber}/{o.totalThoughts}
      {" · "}
      Next thought needed: {o.nextThoughtNeeded ? "yes" : "no"}
    </p>
  );
}

import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { Weather } from "./weather";

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  return (
    <div
      className="group/message fade-in w-full animate-in duration-200"
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn("flex w-full items-start gap-2 md:gap-3", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        {message.role === "assistant" && (
          <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <SparklesIcon size={14} />
          </div>
        )}

        <div
          className={cn("flex flex-col", {
            "gap-2 md:gap-4": message.parts?.some(
              (p) => p.type === "text" && p.text?.trim()
            ),
            "w-full":
              (message.role === "assistant" &&
                (message.parts?.some(
                  (p) => p.type === "text" && p.text?.trim()
                ) ||
                  message.parts?.some((p) => p.type.startsWith("tool-")))) ||
              mode === "edit",
            "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {message.parts?.map((part, index) => {
            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            if (type === "reasoning") {
              const hasContent = part.text?.trim().length > 0;
              const isStreaming = "state" in part && part.state === "streaming";
              if (hasContent || isStreaming) {
                return (
                  <MessageReasoning
                    isLoading={isLoading || isStreaming}
                    key={key}
                    reasoning={part.text || ""}
                  />
                );
              }
            }

            if (type === "text") {
              if (mode === "view") {
                return (
                  <div key={key}>
                    <MessageContent
                      className={cn({
                        "wrap-break-word w-fit rounded-2xl px-3 py-2 text-right text-white":
                          message.role === "user",
                        "bg-transparent px-0 py-0 text-left":
                          message.role === "assistant",
                      })}
                      data-testid="message-content"
                      style={
                        message.role === "user"
                          ? { backgroundColor: "#006cff" }
                          : undefined
                      }
                    >
                      <Response>{sanitizeText(part.text)}</Response>
                    </MessageContent>
                  </div>
                );
              }

              if (mode === "edit") {
                return (
                  <div
                    className="flex w-full flex-row items-start gap-3"
                    key={key}
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        regenerate={regenerate}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  </div>
                );
              }
            }

            if (type === "tool-getWeather") {
              const { toolCallId, state } = part;
              const approvalId = (part as { approval?: { id: string } })
                .approval?.id;
              const isDenied =
                state === "output-denied" ||
                (state === "approval-responded" &&
                  (part as { approval?: { approved?: boolean } }).approval
                    ?.approved === false);
              const widthClass = "w-[min(100%,450px)]";

              if (state === "output-available") {
                return (
                  <div className={widthClass} key={toolCallId}>
                    <Weather weatherAtLocation={part.output} />
                  </div>
                );
              }

              if (isDenied) {
                return (
                  <div className={widthClass} key={toolCallId}>
                    <Tool className="w-full" defaultOpen={true}>
                      <ToolHeader
                        state="output-denied"
                        type="tool-getWeather"
                      />
                      <ToolContent>
                        <div className="px-4 py-3 text-muted-foreground text-sm">
                          Weather lookup was denied.
                        </div>
                      </ToolContent>
                    </Tool>
                  </div>
                );
              }

              if (state === "approval-responded") {
                return (
                  <div className={widthClass} key={toolCallId}>
                    <Tool className="w-full" defaultOpen={true}>
                      <ToolHeader state={state} type="tool-getWeather" />
                      <ToolContent>
                        <ToolInput input={part.input} />
                      </ToolContent>
                    </Tool>
                  </div>
                );
              }

              return (
                <div className={widthClass} key={toolCallId}>
                  <Tool className="w-full" defaultOpen={true}>
                    <ToolHeader state={state} type="tool-getWeather" />
                    <ToolContent>
                      {(state === "input-available" ||
                        state === "approval-requested") && (
                        <ToolInput input={part.input} />
                      )}
                      {state === "approval-requested" && approvalId && (
                        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                          <button
                            className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                            onClick={() => {
                              addToolApprovalResponse({
                                id: approvalId,
                                approved: false,
                                reason: "User denied weather lookup",
                              });
                            }}
                            type="button"
                          >
                            Deny
                          </button>
                          <button
                            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                            onClick={() => {
                              addToolApprovalResponse({
                                id: approvalId,
                                approved: true,
                              });
                            }}
                            type="button"
                          >
                            Allow
                          </button>
                        </div>
                      )}
                    </ToolContent>
                  </Tool>
                </div>
              );
            }

            if (type === "tool-createDocument") {
              const { toolCallId } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error creating document: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <DocumentPreview
                  isReadonly={isReadonly}
                  key={toolCallId}
                  result={part.output}
                />
              );
            }

            if (type === "tool-updateDocument") {
              const { toolCallId } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error updating document: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <div className="relative" key={toolCallId}>
                  <DocumentPreview
                    args={{ ...part.output, isUpdate: true }}
                    isReadonly={isReadonly}
                    result={part.output}
                  />
                </div>
              );
            }

            if (type === "tool-requestSuggestions") {
              const { toolCallId, state } = part;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-requestSuggestions" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={
                          "error" in part.output ? (
                            <div className="rounded border p-2 text-red-500">
                              Error: {String(part.output.error)}
                            </div>
                          ) : (
                            <DocumentToolResult
                              isReadonly={isReadonly}
                              result={part.output}
                              type="request-suggestions"
                            />
                          )
                        }
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            // MCP / dynamic tools: SDK sends type "dynamic-tool" with toolName, not "tool-xxx"
            if (type === "dynamic-tool") {
              const dynamicPart = part as {
                toolCallId: string;
                toolName: string;
                state: string;
                input?: unknown;
                output?: unknown;
                errorText?: string;
              };
              const { toolCallId, toolName, state: toolState } = dynamicPart;
              const displayState = toolState as
                | "input-streaming"
                | "input-available"
                | "approval-requested"
                | "approval-responded"
                | "output-available"
                | "output-error"
                | "output-denied";
              const headerType = `tool-${toolName}`;

              return (
                <div className="w-[min(100%,450px)]" key={key}>
                  <Tool defaultOpen={false}>
                    <ToolHeader
                      state={displayState}
                      type={headerType as `tool-${string}`}
                    />
                    <ToolContent>
                      {(displayState === "input-available" ||
                        displayState === "approval-requested" ||
                        displayState === "approval-responded") &&
                        dynamicPart.input !== undefined && (
                          <ToolInput input={dynamicPart.input} />
                        )}
                      {displayState === "output-available" &&
                        dynamicPart.output !== undefined && (
                          <ToolOutput
                            errorText={undefined}
                            output={
                              <div className="max-h-[50vh] overflow-x-auto overflow-y-auto rounded-md bg-muted/50 p-3">
                                <SequentialThinkingSummary
                                  output={dynamicPart.output}
                                />
                                {typeof dynamicPart.output === "string" ? (
                                  <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                                    {dynamicPart.output}
                                  </pre>
                                ) : (
                                  <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                                    {JSON.stringify(
                                      dynamicPart.output,
                                      null,
                                      2
                                    )}
                                  </pre>
                                )}
                              </div>
                            }
                          />
                        )}
                      {displayState === "output-error" && (
                        <ToolOutput
                          errorText={
                            dynamicPart.errorText ??
                            (dynamicPart.output &&
                            typeof dynamicPart.output === "object" &&
                            "error" in dynamicPart.output
                              ? String(
                                  (dynamicPart.output as { error: unknown })
                                    .error
                                )
                              : "Tool failed")
                          }
                          output={null}
                        />
                      )}
                      {displayState === "output-denied" && (
                        <div className="px-4 py-3 text-muted-foreground text-sm">
                          Tool execution was denied.
                        </div>
                      )}
                    </ToolContent>
                  </Tool>
                </div>
              );
            }

            // Generic fallback for static tool-* types not explicitly handled above
            // Skip tools that are already handled specifically (createDocument, updateDocument, etc.)
            const isGenericTool =
              type.startsWith("tool-") &&
              !["tool-createDocument", "tool-updateDocument"].includes(
                type as string
              );

            if (isGenericTool) {
              const genericPart = part as unknown as {
                toolCallId: string;
                state: string;
                input?: unknown;
                output?: unknown;
                errorText?: string;
              };
              const { toolCallId, state: toolState } = genericPart;
              const displayState = toolState as
                | "input-streaming"
                | "input-available"
                | "approval-requested"
                | "approval-responded"
                | "output-available"
                | "output-error"
                | "output-denied";

              return (
                <div className="w-[min(100%,450px)]" key={toolCallId}>
                  <Tool defaultOpen={false}>
                    <ToolHeader
                      state={displayState}
                      type={type as `tool-${string}`}
                    />
                    <ToolContent>
                      {(displayState === "input-available" ||
                        displayState === "approval-requested" ||
                        displayState === "approval-responded") &&
                        genericPart.input !== undefined && (
                          <ToolInput input={genericPart.input} />
                        )}
                      {displayState === "output-available" &&
                        genericPart.output !== undefined && (
                          <ToolOutput
                            errorText={undefined}
                            output={
                              <div className="max-h-[50vh] overflow-x-auto overflow-y-auto rounded-md bg-muted/50 p-3">
                                <SequentialThinkingSummary
                                  output={genericPart.output}
                                />
                                {typeof genericPart.output === "string" ? (
                                  <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                                    {genericPart.output}
                                  </pre>
                                ) : (
                                  <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                                    {JSON.stringify(
                                      genericPart.output,
                                      null,
                                      2
                                    )}
                                  </pre>
                                )}
                              </div>
                            }
                          />
                        )}
                      {displayState === "output-error" && (
                        <ToolOutput
                          errorText={
                            genericPart.errorText
                              ? String(genericPart.errorText)
                              : genericPart.output &&
                                  typeof genericPart.output === "object" &&
                                  "error" in genericPart.output
                                ? String(
                                    (genericPart.output as { error: unknown })
                                      .error
                                  )
                                : "Tool failed"
                          }
                          output={null}
                        />
                      )}
                      {displayState === "output-denied" && (
                        <div className="px-4 py-3 text-muted-foreground text-sm">
                          Tool execution was denied.
                        </div>
                      )}
                    </ToolContent>
                  </Tool>
                </div>
              );
            }

            return null;
          })}

          {!isReadonly && (
            <MessageActions
              chatId={chatId}
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              setMode={setMode}
              vote={vote}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message fade-in w-full animate-in duration-300"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <div className="animate-pulse">
            <SparklesIcon size={14} />
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="flex items-center gap-1 p-0 text-muted-foreground text-sm">
            <span className="animate-pulse">Thinking</span>
            <span className="inline-flex">
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
