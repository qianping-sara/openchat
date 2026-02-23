/**
 * Neo4j Read-Only Database Access
 *
 * This module provides ONLY read-only access to Neo4j database.
 * All write operations are explicitly blocked for security.
 */

import "server-only";

import neo4j, { type Driver, type Record, type Session } from "neo4j-driver";

// ============================================================================
// Driver Singleton Management
// ============================================================================

let cachedDriver: Driver | null = null;

/**
 * Get Neo4j Driver instance (singleton pattern)
 * The driver is reused across multiple requests in the same Vercel container
 */
export function getNeo4jDriver(): Driver {
  if (!cachedDriver) {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !username || !password) {
      throw new Error(
        "Neo4j credentials not configured. Please set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD environment variables."
      );
    }

    // Determine if encryption is specified in URI (neo4j+s:// or neo4j+ssc://)
    const encryptionInUri = uri.includes("+s://") || uri.includes("+ssc://");

    cachedDriver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
      // Connection pool configuration - optimized for serverless
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 60_000, // 60 seconds
      maxConnectionLifetime: 3_600_000, // 1 hour
      connectionTimeout: 30_000, // 30 seconds

      // Only set encryption config if NOT specified in URI
      // If URI contains +s:// or +ssc://, encryption is handled by the URI
      ...(encryptionInUri
        ? {}
        : {
            encrypted: "ENCRYPTION_ON",
            trust: "TRUST_SYSTEM_CA_SIGNED_CERTIFICATES",
          }),

      // Logging
      logging: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        logger: (level, message) => console.log(`[Neo4j ${level}] ${message}`),
      },
    });

    console.log("Neo4j driver initialized (read-only mode)");
  }

  return cachedDriver;
}

/**
 * Close the driver (usually not needed in serverless, but available for cleanup)
 */
export async function closeNeo4jDriver(): Promise<void> {
  if (cachedDriver) {
    await cachedDriver.close();
    cachedDriver = null;
    console.log("Neo4j driver closed");
  }
}

// ============================================================================
// Read-Only Query Execution
// ============================================================================

/**
 * Validate that a Cypher query is read-only
 * Throws an error if the query contains write operations
 */
function validateReadOnlyQuery(cypher: string): void {
  const upperQuery = cypher.trim().toUpperCase();
  const writeKeywords = [
    "CREATE",
    "MERGE",
    "DELETE",
    "REMOVE",
    "SET",
    "DETACH DELETE",
    "DROP",
  ];

  for (const keyword of writeKeywords) {
    if (upperQuery.includes(keyword)) {
      throw new Error(
        `Write operation detected: "${keyword}". Only read-only queries (MATCH, RETURN, WHERE, etc.) are allowed.`
      );
    }
  }
}

/**
 * Execute a read-only Cypher query
 *
 * @param cypher - The Cypher query to execute (must be read-only)
 * @param params - Query parameters
 * @returns Array of result objects
 * @throws Error if query contains write operations
 */
export async function executeReadQuery<T = any>(
  cypher: string,
  params?: Record<string, any>
): Promise<T[]> {
  // Security check: validate read-only
  validateReadOnlyQuery(cypher);

  const driver = getNeo4jDriver();
  const session: Session = driver.session({
    database: process.env.NEO4J_DATABASE || "neo4j",
    defaultAccessMode: neo4j.session.READ,
  });

  try {
    const result = await session.executeRead(async (tx) => {
      const res = await tx.run(cypher, params || {});
      return res.records;
    });

    return result.map((record) => recordToObject<T>(record));
  } catch (error) {
    console.error("Neo4j read query failed:", error);
    throw error;
  } finally {
    await session.close();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Neo4j Record to plain JavaScript object
 */
function recordToObject<T>(record: Record): T {
  const obj: any = {};
  for (const key of record.keys) {
    const value = record.get(key);
    obj[key] = convertNeo4jValue(value);
  }
  return obj as T;
}

/**
 * Convert Neo4j special types to JavaScript types
 */
function convertNeo4jValue(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  // Neo4j Integer to JavaScript Number
  if (neo4j.isInt(value)) {
    return value.toNumber();
  }

  // Neo4j Node
  if (value.labels !== undefined) {
    return {
      id: value.elementId,
      labels: value.labels,
      properties: convertNeo4jValue(value.properties),
    };
  }

  // Neo4j Relationship
  if (value.type !== undefined && value.start !== undefined) {
    return {
      id: value.elementId,
      type: value.type,
      start: value.start,
      end: value.end,
      properties: convertNeo4jValue(value.properties),
    };
  }

  // Object - recursive conversion
  if (typeof value === "object" && !Array.isArray(value)) {
    const converted: any = {};
    for (const [k, v] of Object.entries(value)) {
      converted[k] = convertNeo4jValue(v);
    }
    return converted;
  }

  // Array - recursive conversion
  if (Array.isArray(value)) {
    return value.map(convertNeo4jValue);
  }

  return value;
}
