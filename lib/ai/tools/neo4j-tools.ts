/**
 * Neo4j Read-Only AI Tools
 * 
 * Provides AI tools for querying Neo4j database.
 * All tools are READ-ONLY for security.
 */

import { tool } from "ai";
import { z } from "zod";
import { executeReadQuery } from "@/lib/db/neo4j";

/**
 * Get Neo4j database schema
 * Returns node labels and relationship types
 */
export const getSchema = tool({
  description:
    "Get the Neo4j database schema including all node labels and relationship types. Use this before writing Cypher queries to understand the graph structure.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const nodeLabels = await executeReadQuery(
        "CALL db.labels() YIELD label RETURN collect(label) as labels"
      );

      const relationshipTypes = await executeReadQuery(
        "CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) as types"
      );

      return {
        nodeLabels: nodeLabels[0]?.labels || [],
        relationshipTypes: relationshipTypes[0]?.types || [],
      };
    } catch (error) {
      return {
        error: `Failed to get schema: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Execute a read-only Cypher query
 * Automatically validates that the query is read-only
 */
export const readCypher = tool({
  description:
    "Execute a read-only Cypher query against the Neo4j database. Only MATCH, RETURN, WHERE, WITH, UNWIND, and other read operations are allowed. Write operations (CREATE, MERGE, DELETE, SET, REMOVE) are blocked.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "The Cypher query to execute. Must be read-only (MATCH, RETURN, etc.)"
      ),
    params: z
      .record(z.any())
      .optional()
      .describe("Optional query parameters as key-value pairs"),
  }),
  execute: async ({ query, params = {} }) => {
    try {
      // The executeReadQuery function will validate that the query is read-only
      const results = await executeReadQuery(query, params);

      return {
        success: true,
        results,
        count: results.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        results: [],
        count: 0,
      };
    }
  },
});

/**
 * List available GDS (Graph Data Science) procedures
 * Only if GDS plugin is installed
 */
export const listGdsProcedures = tool({
  description:
    "List available Neo4j Graph Data Science (GDS) procedures for graph algorithms like centrality, community detection, and path finding. Only works if GDS plugin is installed.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const procedures = await executeReadQuery(
        "CALL gds.list() YIELD name, description RETURN name, description ORDER BY name"
      );

      return {
        success: true,
        procedures,
        count: procedures.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Check if GDS is not installed
      if (errorMessage.includes("gds.list")) {
        return {
          success: false,
          error:
            "GDS plugin is not installed. Please install Neo4j Graph Data Science plugin to use graph algorithms.",
          procedures: [],
          count: 0,
        };
      }

      return {
        success: false,
        error: errorMessage,
        procedures: [],
        count: 0,
      };
    }
  },
});

/**
 * Get database statistics
 * Returns counts of nodes, relationships, and labels
 */
export const getDatabaseStats = tool({
  description:
    "Get Neo4j database statistics including total node count, relationship count, and counts by label/type.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const nodeCount = await executeReadQuery(
        "MATCH (n) RETURN count(n) as count"
      );

      const relationshipCount = await executeReadQuery(
        "MATCH ()-[r]->() RETURN count(r) as count"
      );

      const labelCounts = await executeReadQuery(
        "MATCH (n) RETURN labels(n) as labels, count(*) as count ORDER BY count DESC"
      );

      const relationshipTypeCounts = await executeReadQuery(
        "MATCH ()-[r]->() RETURN type(r) as type, count(*) as count ORDER BY count DESC"
      );

      return {
        success: true,
        totalNodes: nodeCount[0]?.count || 0,
        totalRelationships: relationshipCount[0]?.count || 0,
        labelCounts,
        relationshipTypeCounts,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get database stats: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * All Neo4j tools exported as an object
 */
export const neo4jTools = {
  getSchema,
  readCypher,
  listGdsProcedures,
  getDatabaseStats,
};

