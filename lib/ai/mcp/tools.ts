import type { MCPClient } from "@ai-sdk/mcp";
import { closeMCPClients, initializeMCPClients } from "./clients";

/** Cached MCP clients and tools, reused for the process lifetime to avoid spawning subprocesses on every request. */
let cached: { tools: Record<string, unknown>; clients: MCPClient[] } | null =
  null;

const MCP_TOOL_TIMEOUT_MS = 90_000;

/**
 * Wraps a tool's execute so the agent multi-step loop can run multiple steps in one request:
 * - Never rejects: on error or timeout we return { error: string } so the SDK
 *   gets a tool-result (and can continue to the next step). Rejection would send
 *   type 'error' and stepToolOutputs would stay 0, so the loop would stop after one step.
 * - AsyncIterable: returned as-is so the SDK consumes the full stream; the loop only
 *   continues when it receives a non-preliminary tool-result for each tool call.
 */
function wrapExecuteWithErrorIsolation(
  tool: Record<string, unknown>,
  name: string
): Record<string, unknown> {
  const originalExecute = tool.execute;
  if (typeof originalExecute !== "function") {
    return tool;
  }

  const wrappedExecute = (...args: unknown[]): Promise<unknown> => {
    const run = async (): Promise<unknown> => {
      const raw = (originalExecute as (...a: unknown[]) => unknown).apply(
        tool,
        args
      );
      const resultPromise = Promise.resolve(raw);
      const rawObj = raw as Record<string | symbol, unknown> | null;
      const isStream =
        rawObj != null &&
        typeof rawObj === "object" &&
        (typeof rawObj[Symbol.asyncIterator] === "function" ||
          typeof rawObj[Symbol.iterator] === "function");
      if (isStream) {
        return raw as AsyncIterable<unknown>;
      }
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `MCP tool "${name}" timed out after ${MCP_TOOL_TIMEOUT_MS / 1000}s`
              )
            ),
          MCP_TOOL_TIMEOUT_MS
        );
      });
      return await Promise.race([resultPromise, timeoutPromise]);
    };
    // Ensure the Promise never rejects: runToolsTransformation only gets
    // tool-result when this resolves; if it rejects, stepToolOutputs stays 0
    // and the agent stops after one step (user has to say "继续" for next).
    return run().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return { error: message };
    });
  };

  return { ...tool, execute: wrappedExecute };
}

/**
 * Get all tools from MCP clients. Clients are initialized once per process and reused.
 * Each MCP tool's execute is wrapped so errors/timeouts return { error } and never kill the stream.
 *
 * @returns Object containing all MCP tools and an empty clients array (caller should not close; clients are reused).
 */
export async function getMCPTools(): Promise<{
  tools: Record<string, unknown>;
  clients: MCPClient[];
}> {
  if (cached) {
    return { tools: cached.tools, clients: [] };
  }

  try {
    const clients = await initializeMCPClients();

    if (clients.length === 0) {
      return { tools: {}, clients: [] };
    }

    const toolSets = await Promise.all(
      clients.map(async (client) => {
        try {
          return await client.tools();
        } catch {
          return {};
        }
      })
    );

    const merged = toolSets.reduce<Record<string, unknown>>(
      (acc, toolSet) => ({ ...acc, ...toolSet }),
      {}
    );

    const wrappedTools: Record<string, unknown> = {};
    for (const [name, tool] of Object.entries(merged)) {
      const t =
        tool && typeof tool === "object"
          ? wrapExecuteWithErrorIsolation(tool as Record<string, unknown>, name)
          : tool;
      wrappedTools[name] = t;
    }

    cached = { tools: wrappedTools, clients };
    return { tools: wrappedTools, clients: [] };
  } catch {
    return { tools: {}, clients: [] };
  }
}

/**
 * Get names of all MCP tools for experimental_activeTools
 *
 * @param tools - The tools object returned from getMCPTools
 * @returns Array of tool names
 */
export function getMCPToolNames(tools: Record<string, any>): string[] {
  return Object.keys(tools);
}

/**
 * Cleanup MCP clients. No-op when using process-scoped cache (getMCPTools returns empty clients array).
 * Only closes clients that were explicitly passed (e.g. from a non-cached path).
 *
 * @param clients - Array of MCP clients to close; empty when tools were from cache
 */
export async function cleanupMCPClients(clients: MCPClient[]): Promise<void> {
  if (clients.length === 0) {
    return;
  }
  try {
    await closeMCPClients(clients);
  } catch {
    // ignore close errors
  }
}
