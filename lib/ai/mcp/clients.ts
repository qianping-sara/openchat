import type { MCPClient } from "@ai-sdk/mcp";
import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

/**
 * Initialize Neo4j MCP client for database access (optional).
 * Uses stdio transport to communicate with the neo4j-mcp server.
 *
 * Only loads when NEO4J_MCP_ENABLED is 'true' or '1'. This avoids Neo4j/GDS
 * errors affecting other MCPs (Tavily, Sequential Thinking) when Neo4j is not needed.
 * To fix "Unknown function 'gds.version'" when enabling Neo4j: install the Neo4j
 * Graph Data Science (GDS) plugin, or use a Neo4j instance that has GDS installed.
 */
export async function createNeo4jMCPClient(): Promise<MCPClient | null> {
  const enabled =
    process.env.NEO4J_MCP_ENABLED === "true" ||
    process.env.NEO4J_MCP_ENABLED === "1";
  if (!enabled) {
    return null;
  }

  try {
    if (
      !process.env.NEO4J_URI ||
      !process.env.NEO4J_USERNAME ||
      !process.env.NEO4J_PASSWORD
    ) {
      console.warn(
        "Neo4j MCP: Missing required environment variables. Skipping initialization."
      );
      return null;
    }

    const transport = new Experimental_StdioMCPTransport({
      command: "neo4j-mcp",
      args: [],
      env: {
        NEO4J_URI: process.env.NEO4J_URI,
        NEO4J_USERNAME: process.env.NEO4J_USERNAME,
        NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
        NEO4J_DATABASE: process.env.NEO4J_DATABASE || "neo4j",
        NEO4J_READ_ONLY: process.env.NEO4J_READ_ONLY || "true",
      },
    });

    const client = await createMCPClient({ transport });
    console.log("Neo4j MCP client initialized successfully");
    return client;
  } catch (error) {
    console.error("Failed to initialize Neo4j MCP client:", error);
    return null;
  }
}

/**
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
  const clients = await Promise.all([
    createNeo4jMCPClient(),
    createTavilyMCPClient(),
  ]);

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
