#!/usr/bin/env node

/**
 * Setup script for ChromaSnap Native Plugin
 * 
 * This script automates the plugin integration setup:
 * 1. Installs plugin dependencies
 * 2. Configures platform-specific settings
 * 3. Updates Capacitor configuration
 * 4. Sets up environment variables
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const PLUGIN_DIR = path.join(PROJECT_ROOT, 'capacitor-plugin');
const IOS_DIR = path.join(PROJECT_ROOT, 'ios');
const ANDROID_DIR = path.join(PROJECT_ROOT, 'android');

console.log('🚀 Setting up ChromaSnap Native Image Processor Plugin...\n');

// Step 1: Install plugin dependencies
console.log('📦 Installing plugin dependencies...');
try {
  execSync('npm install', { cwd: PLUGIN_DIR, stdio: 'inherit' });
  console.log('✅ Plugin dependencies installed\n');
} catch (error) {
  console.error('❌ Failed to install plugin dependencies:', error.message);
  process.exit(1);
}

// Step 2: Build TypeScript
console.log('🔨 Building TypeScript plugin...');
try {
  execSync('npm run build', { cwd: PLUGIN_DIR, stdio: 'inherit' });
  console.log('✅ TypeScript built successfully\n');
} catch (error) {
  console.error('❌ Failed to build TypeScript:', error.message);
  process.exit(1);
}

// Step 3: Sync Capacitor
console.log('🔄 Syncing Capacitor platforms...');
try {
  execSync('npx cap sync', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  console.log('✅ Capacitor synced\n');
} catch (error) {
  console.error('❌ Failed to sync Capacitor:', error.message);
  process.exit(1);
}

// Step 4: Create .env.local if it doesn't exist
console.log('📝 Setting up environment variables...');
const envPath = path.join(PROJECT_ROOT, '.env.local');
if (!fs.existsSync(envPath)) {
  const envContent = `# Gemini API Configuration
GEMINI_API_KEY=your_api_key_here

# Backend API Configuration
# Change this to your backend server URL
REACT_APP_API_BASE_URL=http://localhost:3001
`;
  fs.writeFileSync(envPath, envContent);
  console.log('📄 Created .env.local - Please update with your API key\n');
} else {
  console.log('✅ .env.local already exists\n');
}

// Step 5: Log iOS setup instructions
console.log('🍎 iOS Setup Instructions:');
console.log('1. Open ios/App/App.xcworkspace in Xcode');
console.log('2. Go to Build Settings');
console.log('3. Add GEMINI_API_KEY to User-Defined settings');
console.log('4. Set the value to your Gemini API key\n');

// Step 6: Log Android setup instructions
console.log('🤖 Android Setup Instructions:');
console.log('1. Open android/build.gradle');
console.log('2. Add to your buildTypes:');
console.log(`
buildConfigField "String", "GEMINI_API_KEY", "\\"your_api_key_here\\""
`);
console.log('3. Or set as environment variable: GEMINI_API_KEY=your_key\n');

// Step 7: Installation summary
console.log('✨ Setup Complete!\n');
console.log('📋 Next Steps:');
console.log('1. Update .env.local with your Gemini API key');
console.log('2. Run "npm run dev" to test web build');
console.log('3. Run "npx cap open ios" to build for iOS');
console.log('4. Run "npx cap open android" to build for Android\n');

console.log('📚 For more information, see capacitor-plugin/README.md');
