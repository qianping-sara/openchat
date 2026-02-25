import { smoothStream, streamText } from "ai";
import { textDocumentPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  onCreateDocument: async ({ title, context, requirements, dataStream }) => {
    let draftContent = "";

    // Build system prompt with context and requirements
    let systemPrompt = textDocumentPrompt;

    if (context) {
      systemPrompt += `\n\n---\n\nCONTEXT PROVIDED:\n${context}\n\nIMPORTANT: Use ONLY the information from the context above. Do not add facts or details from your training data.`;
    }

    if (requirements) {
      systemPrompt += `\n\n---\n\nREQUIREMENTS:\n${requirements}\n\nIMPORTANT: Address ALL requirements listed above. Each requirement must be fulfilled in your output.`;
    }

    const { fullStream } = streamText({
      model: getArtifactModel("text"),
      system: systemPrompt,
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: title,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: "data-textDelta",
          data: text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, context, dataStream }) => {
    let draftContent = "";

    let systemPrompt = updateDocumentPrompt(document.content, "text");

    if (context) {
      systemPrompt += `\n\nAdditional Context:\n${context}`;
    }

    const { fullStream } = streamText({
      model: getArtifactModel("text"),
      system: systemPrompt,
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: description,
      providerOptions: {
        openai: {
          prediction: {
            type: "content",
            content: document.content,
          },
        },
      },
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: "data-textDelta",
          data: text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
});
