/**
 * Knowledge Base AI Tools
 *
 * Provides AI tools for accessing knowledge base files stored in Vercel Blob.
 * All knowledge files are stored with the prefix "knowledge/"
 */

import { list } from "@vercel/blob";
import { tool } from "ai";
import { z } from "zod";

const KNOWLEDGE_PREFIX = "knowledge/";

/**
 * List all available knowledge files
 * Returns a list of all markdown files in the knowledge base
 */
export const listKnowledgeFiles = tool({
  description:
    "List all available knowledge base files. Use this to discover what knowledge is available before reading specific files. Returns file names, sizes, and URLs.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const { blobs } = await list({ prefix: KNOWLEDGE_PREFIX });

      if (blobs.length === 0) {
        return {
          success: true,
          files: [],
          count: 0,
          message: "No knowledge files found in the knowledge base.",
        };
      }

      const files = blobs.map((blob) => ({
        name: blob.pathname.replace(KNOWLEDGE_PREFIX, ""),
        size: `${(blob.size / 1024).toFixed(2)} KB`,
        url: blob.url,
        uploadedAt: blob.uploadedAt,
      }));

      return {
        success: true,
        files,
        count: files.length,
        message: `Found ${files.length} knowledge files.`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list knowledge files: ${error instanceof Error ? error.message : "Unknown error"}`,
        files: [],
        count: 0,
      };
    }
  },
});

/**
 * Search for knowledge files by keyword
 * Searches file names for matching keywords
 */
export const searchKnowledgeFiles = tool({
  description:
    "Search for knowledge files by keyword in the file name. Use this to find relevant knowledge files based on topics like '越南', '泰国', '园区', '投资', etc.",
  inputSchema: z.object({
    keyword: z
      .string()
      .describe(
        "The keyword to search for in file names (e.g., '越南', '泰国', '园区')"
      ),
  }),
  execute: async ({ keyword }) => {
    try {
      const { blobs } = await list({ prefix: KNOWLEDGE_PREFIX });

      if (blobs.length === 0) {
        return {
          success: true,
          files: [],
          count: 0,
          message: "No knowledge files found in the knowledge base.",
        };
      }

      // Search for files containing the keyword (case-insensitive)
      const matchingBlobs = blobs.filter((blob) =>
        blob.pathname.toLowerCase().includes(keyword.toLowerCase())
      );

      const files = matchingBlobs.map((blob) => ({
        name: blob.pathname.replace(KNOWLEDGE_PREFIX, ""),
        size: `${(blob.size / 1024).toFixed(2)} KB`,
        url: blob.url,
        uploadedAt: blob.uploadedAt,
      }));

      return {
        success: true,
        files,
        count: files.length,
        message:
          files.length > 0
            ? `Found ${files.length} knowledge file(s) matching "${keyword}".`
            : `No knowledge files found matching "${keyword}".`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search knowledge files: ${error instanceof Error ? error.message : "Unknown error"}`,
        files: [],
        count: 0,
      };
    }
  },
});

/**
 * Read content from a knowledge file
 * Fetches and returns the full content of a specific knowledge file
 */
export const readKnowledgeFile = tool({
  description:
    "Read the full content of a specific knowledge file. Use the exact file name from listKnowledgeFiles or searchKnowledgeFiles results.",
  inputSchema: z.object({
    fileName: z
      .string()
      .describe(
        "The exact file name to read (e.g., '越南.md', '2024 越南投资专题.md')"
      ),
  }),
  execute: async ({ fileName }) => {
    try {
      // List all blobs to find the matching file
      const { blobs } = await list({ prefix: KNOWLEDGE_PREFIX });
      const blob = blobs.find(
        (b) => b.pathname === `${KNOWLEDGE_PREFIX}${fileName}`
      );

      if (!blob) {
        return {
          success: false,
          error: `Knowledge file "${fileName}" not found. Use listKnowledgeFiles or searchKnowledgeFiles to find available files.`,
          content: "",
        };
      }

      // Fetch the file content
      const response = await fetch(blob.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const content = await response.text();

      return {
        success: true,
        fileName,
        content,
        size: `${(blob.size / 1024).toFixed(2)} KB`,
        message: `Successfully read ${fileName} (${(blob.size / 1024).toFixed(2)} KB)`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read knowledge file: ${error instanceof Error ? error.message : "Unknown error"}`,
        content: "",
      };
    }
  },
});

/**
 * All Knowledge tools exported as an object
 */
export const knowledgeTools = {
  listKnowledgeFiles,
  searchKnowledgeFiles,
  readKnowledgeFile,
};
