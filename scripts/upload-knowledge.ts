#!/usr/bin/env tsx
/**
 * Upload Knowledge markdown files to Vercel Blob Storage
 *
 * Usage:
 *   pnpm tsx scripts/upload-knowledge.ts
 *
 * Environment variables required:
 *   BLOB_READ_WRITE_TOKEN - Vercel Blob storage token
 */

import { del, list, put } from "@vercel/blob";
import dotenv from "dotenv";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const KNOWLEDGE_DIR = "Knowledge";
const BLOB_PREFIX = "knowledge/";

async function uploadKnowledgeFiles() {
  console.log("🚀 Starting Knowledge files upload to Vercel Blob...\n");

  // Check if BLOB_READ_WRITE_TOKEN is set
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      "❌ Error: BLOB_READ_WRITE_TOKEN environment variable is not set"
    );
    console.error("Please add it to your .env.local file");
    process.exit(1);
  }

  try {
    // Read all markdown files from Knowledge directory
    const files = await readdir(KNOWLEDGE_DIR);
    const mdFiles = files.filter((file) => file.endsWith(".md"));

    if (mdFiles.length === 0) {
      console.log("⚠️  No markdown files found in Knowledge directory");
      return;
    }

    console.log(`📁 Found ${mdFiles.length} markdown files:\n`);
    mdFiles.forEach((file) => console.log(`   - ${file}`));
    console.log("");

    // Upload each file
    let successCount = 0;
    let errorCount = 0;

    for (const file of mdFiles) {
      try {
        const filePath = join(KNOWLEDGE_DIR, file);
        const content = await readFile(filePath, "utf-8");

        // Upload to Vercel Blob with knowledge/ prefix
        const blob = await put(`${BLOB_PREFIX}${file}`, content, {
          access: "public",
          contentType: "text/markdown",
          addRandomSuffix: false, // Keep original filename
        });

        console.log(`✅ Uploaded: ${file}`);
        console.log(`   URL: ${blob.url}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to upload ${file}:`, error);
        errorCount++;
      }
    }

    console.log("\n📊 Upload Summary:");
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📝 Total: ${mdFiles.length}`);

    // List all uploaded files
    console.log("\n📋 Listing all knowledge files in Blob storage:");
    const { blobs } = await list({ prefix: BLOB_PREFIX });
    console.log(`   Found ${blobs.length} files in storage:`);
    blobs.forEach((blob) => {
      const fileName = blob.pathname.replace(BLOB_PREFIX, "");
      console.log(`   - ${fileName} (${(blob.size / 1024).toFixed(2)} KB)`);
    });
  } catch (error) {
    console.error("❌ Error during upload:", error);
    process.exit(1);
  }
}

// Optional: Clear all existing knowledge files before upload
async function clearKnowledgeFiles() {
  console.log("🗑️  Clearing existing knowledge files from Blob storage...\n");

  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX });

    if (blobs.length === 0) {
      console.log("   No existing files to clear");
      return;
    }

    for (const blob of blobs) {
      await del(blob.url);
      console.log(`   Deleted: ${blob.pathname}`);
    }

    console.log(`\n✅ Cleared ${blobs.length} files\n`);
  } catch (error) {
    console.error("❌ Error clearing files:", error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const shouldClear = args.includes("--clear");

  if (shouldClear) {
    await clearKnowledgeFiles();
  }

  await uploadKnowledgeFiles();
}

main();
