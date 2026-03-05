import type { MCPClient } from "@ai-sdk/mcp";
import { createMCPClient } from "@ai-sdk/mcp";

/**
 * Initialize PageIndex MCP client (HTTP transport)
 * Uses https://api.pageindex.ai/mcp with Bearer token from PAGEINDEX_API_KEY
 */
export async function createPageIndexMCPClient(): Promise<MCPClient | null> {
  const apiKey = process.env.PAGEINDEX_API_KEY;
  if (!apiKey) {
    console.warn(
      "PageIndex MCP: Missing PAGEINDEX_API_KEY. Skipping initialization."
    );
    return null;
  }

  try {
    const client = await createMCPClient({
      transport: {
        type: "http",
        url: "https://api.pageindex.ai/mcp",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    });
    console.log("PageIndex MCP client initialized");
    return client;
  } catch (error) {
    console.error("Failed to initialize PageIndex MCP client:", error);
    return null;
  }
}

/**
 * Initialize all MCP clients
 * Returns an array of successfully initialized clients
 */
export async function initializeMCPClients(): Promise<MCPClient[]> {
  const clients = await Promise.all([createPageIndexMCPClient()]);
  return clients.filter((client): client is MCPClient => client !== null);
}

/**
 * Close all MCP clients
 * Should be called when the request is finished to free resources
 */
export async function closeMCPClients(clients: MCPClient[]): Promise<void> {
  await Promise.all(clients.map((client) => client.close()));
}
