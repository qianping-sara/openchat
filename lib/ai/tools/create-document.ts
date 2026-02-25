import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "@/lib/artifacts/server";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type CreateDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description: `Create a document for writing or content creation activities.
This tool will generate the contents of the document based on the title, kind, and optional context.

You should provide:
- title: A clear, descriptive title for the document
- kind: The type of document (text, code, or sheet)
- context: (OPTIONAL) Any background knowledge, research findings, or relevant information that should inform the document content
- requirements: (OPTIONAL) Specific requirements, constraints, or focus areas for the document

IMPORTANT: If you have gathered information through knowledge search or other tools, pass that information in the 'context' parameter.
If the user has specific requirements or focus areas, pass them in the 'requirements' parameter.`,
    inputSchema: z.object({
      title: z.string().describe("The title of the document"),
      kind: z.enum(artifactKinds).describe("The type of document to create"),
      context: z
        .string()
        .optional()
        .describe(
          "Background knowledge, research findings, or relevant information that should inform the document content. Include any information you gathered from knowledge search or other sources."
        ),
      requirements: z
        .string()
        .optional()
        .describe(
          "Specific requirements, constraints, or focus areas for the document. Include user's detailed requests or preferences."
        ),
    }),
    execute: async ({ title, kind, context, requirements }) => {
      const id = generateUUID();

      dataStream.write({
        type: "data-kind",
        data: kind,
        transient: true,
      });

      dataStream.write({
        type: "data-id",
        data: id,
        transient: true,
      });

      dataStream.write({
        type: "data-title",
        data: title,
        transient: true,
      });

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      await documentHandler.onCreateDocument({
        id,
        title,
        context,
        requirements,
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
        title,
        kind,
        content: "A document was created and is now visible to the user.",
      };
    },
  });
