/**
 * Neo4j Connection Test Endpoint
 * 
 * Test the Neo4j connection and verify read-only functionality
 * Access: GET /api/test-neo4j
 */

import { executeReadQuery, getNeo4jDriver } from "@/lib/db/neo4j";

export async function GET() {
  try {
    // Test 1: Verify driver connectivity
    const driver = getNeo4jDriver();
    await driver.verifyConnectivity();

    // Test 2: Get schema
    const nodeLabels = await executeReadQuery(
      "CALL db.labels() YIELD label RETURN collect(label) as labels"
    );

    const relationshipTypes = await executeReadQuery(
      "CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) as types"
    );

    // Test 3: Get database stats
    const nodeCount = await executeReadQuery(
      "MATCH (n) RETURN count(n) as count"
    );

    const relationshipCount = await executeReadQuery(
      "MATCH ()-[r]->() RETURN count(r) as count"
    );

    // Test 4: Verify read-only protection (should fail)
    let writeProtectionWorks = false;
    try {
      await executeReadQuery("CREATE (n:Test) RETURN n");
    } catch (error) {
      // Expected to fail - write operations are blocked
      writeProtectionWorks = true;
    }

    return Response.json({
      status: "success",
      message: "Neo4j connection successful",
      connection: {
        connected: true,
        readOnly: true,
      },
      schema: {
        nodeLabels: nodeLabels[0]?.labels || [],
        relationshipTypes: relationshipTypes[0]?.types || [],
      },
      stats: {
        totalNodes: nodeCount[0]?.count || 0,
        totalRelationships: relationshipCount[0]?.count || 0,
      },
      security: {
        writeProtectionEnabled: writeProtectionWorks,
        message: writeProtectionWorks
          ? "✅ Write operations are correctly blocked"
          : "⚠️ Warning: Write operations are not blocked!",
      },
    });
  } catch (error) {
    console.error("Neo4j test failed:", error);

    return Response.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        connection: {
          connected: false,
          readOnly: true,
        },
        troubleshooting: {
          checkEnvVars: [
            "NEO4J_URI",
            "NEO4J_USERNAME",
            "NEO4J_PASSWORD",
            "NEO4J_DATABASE (optional)",
          ],
          commonIssues: [
            "Verify Neo4j instance is running and accessible",
            "Check firewall rules allow connections from Vercel",
            "Verify credentials are correct",
            "Ensure Neo4j URI format is correct (neo4j:// or neo4j+s://)",
          ],
        },
      },
      { status: 500 }
    );
  }
}

