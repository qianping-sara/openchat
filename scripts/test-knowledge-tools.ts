#!/usr/bin/env tsx
/**
 * Test Knowledge Tools
 *
 * Tests the three knowledge tools to ensure they work correctly
 */

import dotenv from "dotenv";
import {
  listKnowledgeFiles,
  readKnowledgeFile,
  searchKnowledgeFiles,
} from "../lib/ai/tools/knowledge-tools";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function testKnowledgeTools() {
  console.log("🧪 Testing Knowledge Tools...\n");

  // Check token
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("❌ BLOB_READ_WRITE_TOKEN not found");
    process.exit(1);
  }

  try {
    // Test 1: List all knowledge files
    console.log("📋 Test 1: List all knowledge files");
    console.log("Calling listKnowledgeFiles.execute()...");
    // @ts-expect-error - Tool execute function exists at runtime
    const listResult: any = await listKnowledgeFiles.execute(
      {},
      {
        toolCallId: "test-1",
        messages: [],
      }
    );

    console.log("Result:", JSON.stringify(listResult, null, 2));
    console.log("");

    if (!listResult.success || listResult.count === 0) {
      console.error("❌ No files found or error occurred");
      return;
    }

    console.log(`✅ Found ${listResult.count} files\n`);

    // Test 2: Search for files with keyword "越南"
    console.log('🔍 Test 2: Search for files with keyword "越南"');
    console.log('Calling searchKnowledgeFiles.execute({ keyword: "越南" })...');
    // @ts-expect-error - Tool execute function exists at runtime
    const searchResult: any = await searchKnowledgeFiles.execute(
      {
        keyword: "越南",
      },
      {
        toolCallId: "test-2",
        messages: [],
      }
    );

    console.log("Result:", JSON.stringify(searchResult, null, 2));
    console.log("");

    if (!searchResult.success) {
      console.error("❌ Search failed");
      return;
    }

    console.log(`✅ Found ${searchResult.count} matching files\n`);

    // Test 3: Read a specific file
    if (listResult.files && listResult.files.length > 0) {
      const firstFile = listResult.files[0];
      console.log(`📖 Test 3: Read file "${firstFile.name}"`);
      console.log(
        `Calling readKnowledgeFile.execute({ fileName: "${firstFile.name}" })...`
      );
      // @ts-expect-error - Tool execute function exists at runtime
      const readResult: any = await readKnowledgeFile.execute(
        {
          fileName: firstFile.name,
        },
        {
          toolCallId: "test-3",
          messages: [],
        }
      );

      if (!readResult.success) {
        console.error("❌ Read failed:", readResult.error);
        return;
      }

      console.log("✅ Successfully read file");
      console.log(`   File: ${readResult.fileName}`);
      console.log(`   Size: ${readResult.size}`);
      console.log("   Content preview (first 200 chars):");
      console.log(`   ${readResult.content.substring(0, 200)}...`);
      console.log("");
    }

    console.log("🎉 All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testKnowledgeTools();
