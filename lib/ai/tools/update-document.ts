import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { documentHandlersByArtifactKind } from "@/lib/artifacts/server";
import { getDocumentById } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";

type UpdateDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const updateDocument = ({ session, dataStream }: UpdateDocumentProps) =>
  tool({
    description: `Update a document with the given description.

You can provide:
- id: The ID of the document to update
- description: The description of changes that need to be made
- context: (OPTIONAL) Additional context or information to help with the update

IMPORTANT: If you have gathered new information through knowledge search or other tools, pass that information in the 'context' parameter.`,
    inputSchema: z.object({
      id: z.string().describe("The ID of the document to update"),
      description: z
        .string()
        .describe("The description of changes that need to be made"),
      context: z
        .string()
        .optional()
        .describe(
          "Additional context or information to help with the update. Include any new information you gathered from knowledge search or other sources."
        ),
    }),
    execute: async ({ id, description, context }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: "Document not found",
        };
      }

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        context,
        dataStream,
        session,
      });

      dataStream.write({
        type: "data-finish",
        data: null,
        transient: true,
      });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: "The document has been updated successfully.",
      };
    },
  });
