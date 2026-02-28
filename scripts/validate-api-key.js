#!/usr/bin/env node

/**
 * Gemini API Key Validator
 * Tests if the API key is valid and working
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocalPath = path.join(__dirname, '..', '.env.local');

// Read .env.local and parse it
let apiKey = process.env.GEMINI_API_KEY;

if (!apiKey && fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  const match = envContent.match(/GEMINI_API_KEY=(.+)/);
  if (match) {
    apiKey = match[1].trim();
  }
}

async function validateApiKey() {
  console.log('🔍 Validating Gemini API Key...\n');
  
  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY not found in environment');
    process.exit(1);
  }

  console.log(`📝 API Key (first 20 chars): ${apiKey.substring(0, 20)}...`);
  console.log(`📝 API Key (last 10 chars): ...${apiKey.substring(apiKey.length - 10)}\n`);

  try {
    console.log('🌐 Testing API connection...\n');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Say "API connection successful" in one sentence.'
            }]
          }],
          generationConfig: {
            maxOutputTokens: 100
          }
        })
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log('✅ API Key is VALID!\n');
      console.log('📄 Response:', data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text');
      console.log('\n✨ Your API key is working correctly!\n');
      process.exit(0);
    } else {
      console.error('❌ API Key is INVALID!\n');
      console.error('Error:', data.error?.message || JSON.stringify(data));
      console.error('\n⚠️  Status:', response.status);
      console.error('💡 Possible issues:');
      console.error('  • Key is expired or revoked');
      console.error('  • Key has insufficient permissions');
      console.error('  • Key is not for Gemini API');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Connection Error:\n');
    console.error(error.message);
    console.error('\n💡 Possible issues:');
    console.error('  • No internet connection');
    console.error('  • Gemini API is unavailable');
    console.error('  • Network firewall blocking');
    process.exit(1);
  }
}

validateApiKey();
