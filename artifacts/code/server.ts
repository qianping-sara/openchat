import { streamObject } from "ai";
import { z } from "zod";
import { codePrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const codeDocumentHandler = createDocumentHandler<"code">({
  kind: "code",
  onCreateDocument: async ({ title, context, requirements, dataStream }) => {
    let draftContent = "";

    let systemPrompt = codePrompt;

    if (context) {
      systemPrompt += `\n\nBackground Knowledge and Context:\n${context}`;
    }

    if (requirements) {
      systemPrompt += `\n\nSpecific Requirements:\n${requirements}`;
    }

    const { fullStream } = streamObject({
      model: getArtifactModel("code"),
      system: systemPrompt,
      prompt: title,
      schema: z.object({
        code: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.write({
            type: "data-codeDelta",
            data: code ?? "",
            transient: true,
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, context, dataStream }) => {
    let draftContent = "";

    let systemPrompt = updateDocumentPrompt(document.content, "code");

    if (context) {
      systemPrompt += `\n\nAdditional Context:\n${context}`;
    }

    const { fullStream } = streamObject({
      model: getArtifactModel("code"),
      system: systemPrompt,
      prompt: description,
      schema: z.object({
        code: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.write({
            type: "data-codeDelta",
            data: code ?? "",
            transient: true,
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
});
