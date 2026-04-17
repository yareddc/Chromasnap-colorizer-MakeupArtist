# Native Backend Integration Guide

This guide explains how to use the ChromaSnap Native Image Processor plugin to run image processing natively on iOS and Android devices.

## Overview

The native backend consists of:

1. **Capacitor Plugin** (`capacitor-plugin/`) - Bridge between React and native code
   - TypeScript interfaces and web fallback
   - iOS (Swift) implementation
   - Android (Kotlin) implementation

2. **Native Implementations**
   - **iOS**: Swift classes with URLSession for Gemini API calls
   - **Android**: Kotlin classes with HttpURLConnection and coroutines

3. **Integration Service** - Abstraction layer for the app to use either native or API backend

## Directory Structure

```
capacitor-plugin/
├── src/
│   ├── index.ts                 # Plugin interface definitions
│   ├── web.ts                   # Web fallback implementation
│   └── ...
├── ios/Plugin/
│   ├── ChromaSnapImageProcessorPlugin.swift
│   ├── ChromaSnapImageProcessor.swift
│   └── ...
├── android/src/main/java/
│   └── com/chromasnap/processor/
│       ├── ChromaSnapImageProcessorPlugin.kt
│       ├── ChromaSnapImageProcessor.kt
│       └── ...
├── package.json
├── plugin.xml
├── tsconfig.json
└── README.md

services/
└── nativeImageProcessorService.ts  # App integration service
```

## Installation

### Quick Setup (Recommended)

```bash
cd <project-root>
npm install
node scripts/setup-native-plugin.js
```

This script will:
- Install plugin dependencies
- Build TypeScript
- Sync Capacitor
- Create `.env.local` template
- Print platform-specific instructions

### Manual Setup

1. **Install Dependencies**
   ```bash
   cd capacitor-plugin
   npm install
   npm run build
   ```

2. **Update Environment Variables**
   ```bash
   # Create .env.local in project root
   REACT_APP_GEMINI_API_KEY=your_key_here
   ```

3. **Sync Capacitor**
   ```bash
   npx cap sync
   ```

## Configuration

### Web/Development Build

The plugin uses an Express backend for web builds. Make sure:
1. `.env.local` has `REACT_APP_GEMINI_API_KEY`
2. Backend server is running: `npm run server`

### iOS Build

1. Open Xcode: `npx cap open ios`
2. Navigate to: **App > Build Settings**
3. Search for "User-Defined"
4. Add new setting:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: Your Gemini API key

**Alternative**: Set via environment variable:
```bash
export GEMINI_API_KEY=your_key_here
npx cap build ios
```

### Android Build

1. Open Android Studio: `npx cap open android`
2. Edit `android/app/build.gradle`:
   ```gradle
   buildTypes {
       debug {
           buildConfigField "String", "GEMINI_API_KEY", "\"your_key_here\""
       }
       release {
           buildConfigField "String", "GEMINI_API_KEY", "\"your_key_here\""
       }
   }
   ```

**Alternative**: Set via environment variable:
```bash
export GEMINI_API_KEY=your_key_here
npx cap build android
```

## Usage in the App

The main `App.tsx` already imports from the native service:

```typescript
import {
  colorizeImage,
  animateImage,
  checkImageSafety,
  isBlackAndWhite,
  upscaleImage,
  enhanceVibrancy,
  sharpenImage
} from './services/nativeImageProcessorService';
```

All functions have the same signature as before but now use the native plugin on mobile:

```typescript
// Automatically uses native plugin on iOS/Android, fallback on web
const colorized = await colorizeImage(base64Image, 'Natural');
```

## API Methods

### Analyze Methods

```typescript
// Check if image is monochromatic (B&W)
const isBW = await isBlackAndWhite(base64Image);

// Analyze safety (nudity, minors)
const safety = await checkImageSafety(base64Image);
```

### Processing Methods

```typescript
// Colorize with theme
const colorized = await colorizeImage(base64Image, theme);

// Upscale to 4K
const upscaled = await upscaleImage(base64Image);

// Enhance vibrancy
const vibrant = await enhanceVibrancy(base64Image);

// Sharpen details
const sharp = await sharpenImage(base64Image);

// Generate animation
const video = await animateImage(base64Image);
```

## Performance Considerations

### Advantages of Native Backend

1. **Faster Processing**: Direct native API calls without HTTP overhead
2. **Better Memory Management**: Native memory optimization
3. **Offline-Ready**: Can cache or pre-process locally
4. **Reduced Payload**: No base64 encoding for HTTP transport

### Limitations

1. **API Dependency**: Still requires Gemini API key (cloud processing)
2. **Large Images**: Base64 images can be large; consider compression
3. **Long Operations**: Animation may take 1-2 minutes
4. **Timeout Settings**: Currently set to 5-10 minutes per operation

## Troubleshooting

### "API key not configured"

**iOS**: Ensure `GEMINI_API_KEY` is set in Xcode build settings
**Android**: Ensure `GEMINI_API_KEY` is in `buildConfigField`

### Plugin not found on native

1. Run `npx cap sync` to regenerate native projects
2. Rebuild native app from IDE
3. Ensure `plugin.xml` is properly configured

### Build failures

**TypeScript errors**: `cd capacitor-plugin && npm run build`
**Xcode build**: Clean build folder (Cmd+Shift+K) and rebuild
**Gradle build**: `./gradlew clean` then rebuild in Android Studio

### Timeouts

If operations timeout:
1. Check API rate limits
2. Increase timeout in native code:
   - **iOS**: `ChromaSnapImageProcessor.swift` line 115-116
   - **Android**: `ChromaSnapImageProcessor.kt` line 138-139

## Development Workflow

1. **Make Changes to TypeScript**
   ```bash
   cd capacitor-plugin
   npm run build
   ```

2. **Sync to Native Projects**
   ```bash
   npx cap sync
   ```

3. **Build Native App**
   ```bash
   npx cap open ios  # or android
   ```

4. **Test on Device**
   - iOS: Build and run from Xcode
   - Android: Build and run from Android Studio
   - Web: `npm run dev`

## Plugin Architecture

### TypeScript Layer (`src/index.ts`)
- Defines interfaces for all operations
- Registers Capacitor plugin
- Exports types for type safety

### Web Layer (`src/web.ts`)
- Implements `ChromaSnapImageProcessorWeb` class
- Makes HTTP calls to Express backend
- Used in web builds and as fallback

### iOS Layer (`ios/Plugin/`)
- `ChromaSnapImageProcessorPlugin.swift`: Plugin entry point
- `ChromaSnapImageProcessor.swift`: Implementation with URLSession
- Direct Gemini API calls from device

### Android Layer (`android/src/main/java/`)
- `ChromaSnapImageProcessorPlugin.kt`: Plugin entry point with coroutines
- `ChromaSnapImageProcessor.kt`: Implementation with HttpURLConnection
- Direct Gemini API calls from device

## Future Enhancements

1. **Video Animation**: Complete Veo API integration for native video generation
2. **Local Caching**: Store processed images locally for offline access
3. **Batch Processing**: Process multiple images sequentially
4. **Progress Tracking**: Real-time progress updates via Capacitor events
5. **Advanced Settings**: Expose more Gemini parameters for fine-tuning

## Security Notes

- API keys should **never** be committed to version control
- Use secure environment variables or build-time configuration
- Consider key rotation for production apps
- Implement rate limiting to prevent abuse

## Support

For issues or questions:
1. Check `capacitor-plugin/README.md` for API docs
2. Review native implementation logs in Xcode/Android Studio
3. Test web build first to isolate native issues
4. Run setup script again if plugins get out of sync

---

**Status**: ✅ Complete - Ready for development and testing on native platforms
