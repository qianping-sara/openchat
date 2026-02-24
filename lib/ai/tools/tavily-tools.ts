import { tavilyExtract, tavilySearch } from "@tavily/ai-sdk";

/**
 * Tavily Web Search and Extract Tools
 *
 * Official Tavily AI SDK integration for Vercel AI SDK.
 * Replaces the previous MCP-based implementation with direct API calls.
 *
 * @see https://docs.tavily.com/documentation/integrations/vercel
 */

/**
 * Tavily Search Tool
 * Performs real-time web search optimized for AI agents and RAG workflows.
 *
 * Features:
 * - Real-time web search with LLM-optimized results
 * - Configurable search depth (basic/advanced)
 * - Domain filtering (include/exclude)
 * - Time range filtering
 * - Image search support
 */
export const tavilySearchTool = tavilySearch({
  apiKey: process.env.TAVILY_API_KEY,
  // Optional: Configure default search parameters
  // maxResults: 5,
  // searchDepth: 'advanced', // 'basic' | 'advanced'
  // includeDomains: [],
  // excludeDomains: [],
  // includeImages: false,
  // includeAnswer: false,
});

/**
 * Tavily Extract Tool
 * Extracts clean, structured content from web pages.
 *
 * Features:
 * - Clean content extraction from URLs
 * - Removes ads, navigation, and boilerplate
 * - Returns structured, LLM-ready content
 */
export const tavilyExtractTool = tavilyExtract({
  apiKey: process.env.TAVILY_API_KEY,
});

/**
 * Export all Tavily tools as a single object
 * for easy integration into the AI SDK tools configuration
 */
export const tavilyTools = {
  tavilySearch: tavilySearchTool,
  tavilyExtract: tavilyExtractTool,
};

