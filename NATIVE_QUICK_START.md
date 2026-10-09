# ChromaSnap Native Backend - Quick Start

> ⚠️ **Deprecated:** Colorization and black-and-white detection have been removed. The `colorizeImage` and `isBlackAndWhite` APIs referenced below no longer exist.


## What's New?

Your ChromaSnap app now has a **native backend** that runs image processing directly on iOS and Android devices, without relying on an external server for every operation.

## Key Benefits

✅ **Faster**: Direct native API calls from device  
✅ **More Reliable**: Reduced network dependency  
✅ **Better UX**: Lower latency for image processing  
✅ **Scalable**: Less server load  

## One-Command Setup

```bash
npm run setup:native
```

This will:
1. Install plugin dependencies
2. Build TypeScript
3. Sync Capacitor platforms
4. Create `.env.local` template
5. Print platform-specific config steps

## What Gets Installed?

```
capacitor-plugin/          # Capacitor plugin (bridge to native)
├── src/                   # TypeScript interfaces & web fallback
├── ios/Plugin/            # Swift implementation
├── android/.../           # Kotlin implementation
└── dist/                  # Compiled output

services/
└── nativeImageProcessorService.ts  # App integration
```

## Configuration (30 seconds each)

### Get Your API Key
1. Go to [Google AI Studio](https://ai.google.dev)
2. Create a project (or use existing)
3. Get your Gemini API key

### Update `.env.local`
```bash
REACT_APP_GEMINI_API_KEY=your_key_here
```

### iOS (Xcode)
1. Run: `npx cap open ios`
2. Xcode → App → Build Settings
3. Add `GEMINI_API_KEY` = your_key

### Android (Android Studio)
1. Run: `npx cap open android`
2. Edit `android/app/build.gradle`:
```gradle
buildConfigField "String", "GEMINI_API_KEY", "\"your_key_here\""
```

## Test It

**Web**:
```bash
npm run dev
# Visit http://localhost:3000
```

**iOS**:
```bash
npx cap open ios
# Build & run in Xcode
```

**Android**:
```bash
npx cap open android
# Build & run in Android Studio
```

## What Changed in Your App?

✨ **Automatic Integration** - Your existing `App.tsx` already uses the native backend!

The service layer (`services/nativeImageProcessorService.ts`) now handles:
- Native execution on iOS/Android
- Fallback to Express API on web
- Same function signatures = no code changes needed

## File Structure

```
project-root/
├── capacitor-plugin/          ← NEW: Native plugin
│   ├── src/
│   │   ├── index.ts          (Plugin interface & registration)
│   │   ├── web.ts             (Web/fallback implementation)
│   │   └── ...
│   ├── ios/Plugin/             (Swift implementation)
│   ├── android/.../            (Kotlin implementation)
│   ├── package.json
│   ├── plugin.xml
│   └── README.md
│
├── services/
│   ├── geminiService.ts        (Original - for reference)
│   └── nativeImageProcessorService.ts  ← NEW: Use this!
│
├── scripts/
│   └── setup-native-plugin.js  ← Run this first!
│
└── NATIVE_BACKEND_GUIDE.md     ← Full documentation
```

## Key Methods

All these automatically use native code on mobile:

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

// Same API as before, but native on mobile!
const result = await colorizeImage(base64Image, 'Natural');
```

## Supported Platforms

| Feature | iOS | Android | Web |
|---------|-----|---------|-----|
| Colorize | ✅ | ✅ | ✅ |
| Analyze | ✅ | ✅ | ✅ |
| Upscale | ✅ | ✅ | ✅ |
| Enhance | ✅ | ✅ | ✅ |
| Sharpen | ✅ | ✅ | ✅ |
| Animate | 🚧 | 🚧 | ✅ |

## Troubleshooting

### Plugin Not Found?
```bash
npm run setup:native
npx cap sync
```

### Build Errors?
- **iOS**: `npx cap sync`, then rebuild in Xcode
- **Android**: `./gradlew clean`, then rebuild in Android Studio

### API Key Issues?
- Check `.env.local` exists
- Verify key in platform settings (Xcode/Android Studio)
- Test in browser first: `npm run dev`

## Next Steps

1. ✅ Run `npm run setup:native`
2. ✅ Get Gemini API key from [ai.google.dev](https://ai.google.dev)
3. ✅ Update `.env.local` with your key
4. ✅ Configure iOS/Android (see above)
5. ✅ Test on web: `npm run dev`
6. ✅ Build for iOS: `npx cap open ios`
7. ✅ Build for Android: `npx cap open android`

## Documentation

- **Detailed Setup**: See [NATIVE_BACKEND_GUIDE.md](./NATIVE_BACKEND_GUIDE.md)
- **Plugin API**: See [capacitor-plugin/README.md](./capacitor-plugin/README.md)
- **Code Examples**: Check [App.tsx](./App.tsx) for usage

## Support

Any issues? Check:
1. `.env.local` has correct API key
2. Platform-specific settings (see above)
3. Run `npm run setup:native` again
4. Check console for error messages

---

🎉 **You're all set!** Your ChromaSnap app now runs natively on iOS and Android.

Start with web testing, then build for native platforms. Happy colorizing!
