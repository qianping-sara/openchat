import { streamObject } from "ai";
import { z } from "zod";
import { sheetPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const sheetDocumentHandler = createDocumentHandler<"sheet">({
  kind: "sheet",
  onCreateDocument: async ({ title, context, requirements, dataStream }) => {
    let draftContent = "";

    let systemPrompt = sheetPrompt;

    if (context) {
      systemPrompt += `\n\n---\n\nCONTEXT PROVIDED:\n${context}\n\nIMPORTANT: Use the data from the context exactly as provided. Do not invent or modify data.`;
    }

    if (requirements) {
      systemPrompt += `\n\n---\n\nREQUIREMENTS:\n${requirements}\n\nIMPORTANT: Follow the structure and column requirements precisely.`;
    }

    const { fullStream } = streamObject({
      model: getArtifactModel("sheet"),
      system: systemPrompt,
      prompt: title,
      schema: z.object({
        csv: z.string().describe("CSV data"),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { csv } = object;

        if (csv) {
          dataStream.write({
            type: "data-sheetDelta",
            data: csv,
            transient: true,
          });

          draftContent = csv;
        }
      }
    }

    dataStream.write({
      type: "data-sheetDelta",
      data: draftContent,
      transient: true,
    });

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, context, dataStream }) => {
    let draftContent = "";

    let systemPrompt = updateDocumentPrompt(document.content, "sheet");

    if (context) {
      systemPrompt += `\n\n---\n\nADDITIONAL CONTEXT:\n${context}\n\nIMPORTANT: Use this new context to update the spreadsheet data accurately.`;
    }

    const { fullStream } = streamObject({
      model: getArtifactModel("sheet"),
      system: systemPrompt,
      prompt: description,
      schema: z.object({
        csv: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { csv } = object;

        if (csv) {
          dataStream.write({
            type: "data-sheetDelta",
            data: csv,
            transient: true,
          });

          draftContent = csv;
        }
      }
    }

    return draftContent;
  },
});
