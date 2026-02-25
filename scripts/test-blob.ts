#!/usr/bin/env tsx
/**
 * Test Vercel Blob connection
 */

import { put, list } from '@vercel/blob';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testBlob() {
  console.log('🧪 Testing Vercel Blob connection...\n');

  // Check token
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('❌ BLOB_READ_WRITE_TOKEN not found');
    process.exit(1);
  }

  console.log(`✅ Token found: ${token.substring(0, 20)}...`);
  console.log(`   Token length: ${token.length} characters\n`);

  try {
    // Test 1: List existing blobs
    console.log('📋 Test 1: Listing existing blobs...');
    const { blobs } = await list();
    console.log(`✅ Success! Found ${blobs.length} blobs\n`);
    
    if (blobs.length > 0) {
      console.log('   First few blobs:');
      blobs.slice(0, 3).forEach(blob => {
        console.log(`   - ${blob.pathname}`);
      });
      console.log('');
    }

    // Test 2: Upload a test file
    console.log('📤 Test 2: Uploading test file...');
    const testContent = 'This is a test file from openchat';
    const blob = await put('test/test.txt', testContent, {
      access: 'public',
      contentType: 'text/plain',
    });
    console.log(`✅ Upload successful!`);
    console.log(`   URL: ${blob.url}\n`);

    console.log('🎉 All tests passed! Your Blob storage is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testBlob();

