#!/usr/bin/env bash

# ChromaSnap Native Backend Setup Verification Script
# This script checks if everything is set up correctly for native builds

echo "🔍 ChromaSnap Native Backend Verification"
echo "=========================================="
echo ""

# Check 1: Plugin directory exists
echo -n "✓ Checking plugin structure... "
if [ -d "capacitor-plugin" ]; then
    if [ -d "capacitor-plugin/ios/Plugin" ] && [ -d "capacitor-plugin/android/src/main/java/com/chromasnap/processor" ]; then
        echo "✅"
    else
        echo "❌ Missing plugin directories"
        exit 1
    fi
else
    echo "❌ capacitor-plugin directory not found"
    exit 1
fi

# Check 2: Node modules
echo -n "✓ Checking plugin dependencies... "
if [ -d "capacitor-plugin/node_modules" ]; then
    echo "✅"
else
    echo "⚠️  Not installed - Run: npm run setup:native"
fi

# Check 3: Built plugin
echo -n "✓ Checking compiled plugin... "
if [ -d "capacitor-plugin/dist" ]; then
    echo "✅"
else
    echo "⚠️  Not built - Run: npm run plugin:build"
fi

# Check 4: Environment file
echo -n "✓ Checking environment setup... "
if [ -f ".env.local" ]; then
    if grep -q "REACT_APP_GEMINI_API_KEY" .env.local; then
        if grep -q "REACT_APP_GEMINI_API_KEY=your_api_key_here" .env.local; then
            echo "⚠️  API key not configured - Update .env.local"
        else
            echo "✅"
        fi
    else
        echo "⚠️  Missing REACT_APP_GEMINI_API_KEY - Update .env.local"
    fi
else
    echo "⚠️  .env.local not found - Run: npm run setup:native"
fi

# Check 5: Capacitor sync
echo -n "✓ Checking Capacitor sync... "
if [ -d "ios/App" ] && [ -d "android/app" ]; then
    echo "✅"
else
    echo "⚠️  Capacitor not synced - Run: npx cap sync"
fi

# Check 6: Service integration
echo -n "✓ Checking service integration... "
if [ -f "services/nativeImageProcessorService.ts" ]; then
    echo "✅"
else
    echo "❌ Missing nativeImageProcessorService.ts"
    exit 1
fi

echo ""
echo "✨ Verification Complete!"
echo ""
echo "Next steps:"
echo "1. npm run setup:native         (if not done)"
echo "2. Update .env.local            (with your API key)"
echo "3. npm run dev                  (test web)"
echo "4. npx cap open ios             (build iOS)"
echo "5. npx cap open android         (build Android)"
echo ""
