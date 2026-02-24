/**
 * @deprecated This file is deprecated. Tavily now uses direct API integration via @tavily/ai-sdk.
 * See lib/ai/tools/tavily-tools.ts for the new implementation.
 *
 * This file is kept for reference only and should not be used in new code.
 */

import type { MCPClient } from "@ai-sdk/mcp";
import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

/**
 * @deprecated Use lib/ai/tools/tavily-tools.ts instead
 * Initialize Tavily MCP client for web search
 * Uses stdio transport with npx to run the latest tavily-mcp package
 */
export async function createTavilyMCPClient(): Promise<MCPClient | null> {
  try {
    // Check if Tavily API key is configured
    if (!process.env.TAVILY_API_KEY) {
      console.warn(
        "Tavily MCP: Missing TAVILY_API_KEY environment variable. Skipping initialization."
      );
      return null;
    }

    const transport = new Experimental_StdioMCPTransport({
      command: "npx",
      args: ["-y", "tavily-mcp@latest"],
      env: {
        TAVILY_API_KEY: process.env.TAVILY_API_KEY,
      },
    });

    const client = await createMCPClient({ transport });
    console.log("Tavily MCP client initialized successfully");
    return client;
  } catch (error) {
    console.error("Failed to initialize Tavily MCP client:", error);
    return null;
  }
}

/**
 * Initialize all MCP clients
 * Returns an array of successfully initialized clients
 */
export async function initializeMCPClients(): Promise<MCPClient[]> {
  const clients = await Promise.all([createTavilyMCPClient()]);

  // Filter out null clients (failed initializations)
  return clients.filter((client): client is MCPClient => client !== null);
}

/**
 * Close all MCP clients
 * Should be called when the request is finished to free resources
 */
export async function closeMCPClients(clients: MCPClient[]): Promise<void> {
  await Promise.all(clients.map((client) => client.close()));
}
