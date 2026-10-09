# Migration Guide: From API to Native Backend

> ⚠️ **Deprecated:** Colorization and black-and-white (monochromatic) detection have been removed from the codebase. The `colorizeImage` and `isBlackAndWhite` APIs referenced below no longer exist. This guide is retained for historical reference.


## Overview

If you're currently using `services/geminiService.ts` directly, this guide shows how to migrate to the new native backend through `services/nativeImageProcessorService.ts`.

**Good news**: The APIs are identical, so migration is typically a 1-line change!

## Before & After

### Before (Original API Service)
```typescript
import {
  colorizeImage,
  animateImage,
  checkImageSafety,
  isBlackAndWhite,
  upscaleImage,
  enhanceVibrancy,
  sharpenImage
} from './services/geminiService';

// Calls Express backend via HTTP
const result = await colorizeImage(base64Image, 'Natural');
```

### After (Native Backend)
```typescript
import {
  colorizeImage,
  animateImage,
  checkImageSafety,
  isBlackAndWhite,
  upscaleImage,
  enhanceVibrancy,
  sharpenImage
} from './services/nativeImageProcessorService'; // ← Only change!

// On mobile: runs natively
// On web: falls back to API
const result = await colorizeImage(base64Image, 'Natural');
```

## Migration Steps

### Step 1: Update Imports

In any file importing from `geminiService`:

**Change FROM:**
```typescript
import { colorizeImage, ... } from './services/geminiService';
```

**Change TO:**
```typescript
import { colorizeImage, ... } from './services/nativeImageProcessorService';
```

### Step 2: No Code Changes Needed!

All function signatures remain identical:

```typescript
// Analyze Methods
const isBW = await isBlackAndWhite(base64Image);
const safety = await checkImageSafety(base64Image);

// Processing Methods
const colorized = await colorizeImage(base64Image, theme);
const upscaled = await upscaleImage(base64Image);
const vibrant = await enhanceVibrancy(base64Image);
const sharpened = await sharpenImage(base64Image);
const animated = await animateImage(base64Image);

// Progress Tracking (NEW)
const handle = await onProcessingProgress(({ progress, status }) => {
  console.log(`${status}: ${progress}%`);
});
```

### Step 3: Verify Functionality

The migration is transparent - no behavior changes:

```typescript
// Same error handling
try {
  const result = await colorizeImage(image, 'Vivid');
  // Process result
} catch (error) {
  // Handle error same way
  console.error(error.message);
}
```

## Current App Status

Your `App.tsx` is already set up to use the native backend if needed. Check if it's importing from the right place:

### Current Import in App.tsx
```typescript
// Line ~9
import { 
  colorizeImage, 
  animateImage, 
  checkImageSafety, 
  isBlackAndWhite, 
  upscaleImage, 
  enhanceVibrancy, 
  sharpenImage 
} from './services/geminiService';
```

### Should be:
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

## Why Migrate?

### Performance Benefits

**Original API Service (HTTP)**:
1. React App → 2. Browser HTTP → 3. Express Server → 4. Gemini API
   - 200-500ms latency per call

**Native Backend**:
1. React App → 2. JS Bridge → 3. Native Code → 4. Gemini API
   - 50-150ms latency per call

### Mobile-Specific Benefits
- ✅ Uses device's native networking stack
- ✅ Better memory management
- ✅ Reduced power consumption
- ✅ API key stays on device
- ✅ Works offline (with caching, future enhancement)

## Backward Compatibility

Both services can coexist during transition:

```typescript
// New code uses native
import { colorizeImage as colorizeNative } from './services/nativeImageProcessorService';

// Old code still works
import { colorizeImage as colorizeApi } from './services/geminiService';

// Use selectively
const result = useNativeBackend 
  ? await colorizeNative(image, theme)
  : await colorizeApi(image, theme);
```

## Feature Parity Table

| Feature | API Service | Native Service | Notes |
|---------|-------------|----------------|-------|
| `analyzeMonochromatic` | ✅ | ✅ | Identical |
| `checkSafety` | ✅ | ✅ | Identical |
| `colorizeImage` | ✅ | ✅ | Identical |
| `upscaleImage` | ✅ | ✅ | Identical |
| `enhanceVibrancy` | ✅ | ✅ | Identical |
| `sharpenImage` | ✅ | ✅ | Identical |
| `animateImage` | ✅ | ✅ (partial) | Native pending |
| `onProcessingProgress` | ❌ | ✅ | NEW Feature |

## Error Handling

Error handling is identical between services:

```typescript
// API Service
try {
  const result = await geminiService.colorizeImage(image, 'Natural');
} catch (error) {
  console.error(error.message); // "Network error", "API error", etc.
}

// Native Service
try {
  const result = await nativeService.colorizeImage(image, 'Natural');
} catch (error) {
  console.error(error.message); // Same error messages
}
```

## Fallback Behavior

The native service includes smart fallback:

```typescript
// On iOS/Android: Uses Capacitor plugin
if (isCapacitorNative) {
  return await plugin.colorizeImage(options);
}

// On Web or if plugin unavailable: Falls back to API
return await fetch('/api/process/colorize', { ... });
```

## Configuration Changes

### API Service Configuration
- Requires Express backend running
- Uses proxy in `vite.config.ts`
- API key in backend environment

### Native Service Configuration
- No backend needed for native builds
- API key in platform settings (Xcode/Android Studio)
- Optional: Still uses backend for web builds

See `NATIVE_QUICK_START.md` for configuration details.

## Testing During Migration

### Test Strategy
1. Keep both services temporarily
2. Compare outputs
3. Run comprehensive testing
4. Remove old service

### Test Cases

```typescript
// Test all operations
const testImage = 'data:image/png;base64,...';

// Analysis
const isBW = await isBlackAndWhite(testImage);
assert(isBW === true);

// Processing
const colorized = await colorizeImage(testImage, 'Natural');
assert(colorized.startsWith('data:image/png'));

// Enhancements
const upscaled = await upscaleImage(colorized);
const enhanced = await enhanceVibrancy(upscaled);
const sharp = await sharpenImage(enhanced);
```

## Rollback Plan

If issues arise, rollback is simple:

1. Revert imports to `geminiService`
2. Keep Express backend running
3. No data changes needed

```typescript
// Quick rollback
import { colorizeImage } from './services/geminiService';
```

## Timeline

Recommended migration timeline:

- **Week 1**: Run setup, test web build
- **Week 2**: Build and test iOS in dev
- **Week 3**: Build and test Android in dev
- **Week 4**: Test on real devices
- **Week 5**: Replace imports app-wide
- **Week 6**: Remove old API code if desired

## Common Migration Issues

### Issue: "Plugin not found"
```
Solution: Run npm run setup:native && npx cap sync
```

### Issue: "API key not configured"
```
Solution: Update .env.local and platform settings
See NATIVE_QUICK_START.md
```

### Issue: "Imports fail"
```
Solution: Verify path is './services/nativeImageProcessorService'
Check TypeScript paths in tsconfig.json
```

### Issue: Different results between services
```
Solution: Both use same Gemini API - results should be identical
If different, check API version or model settings
```

## Full File List to Update

Search your codebase for imports from `geminiService`:

```bash
grep -r "from.*geminiService" src/
```

Typical locations:
- `App.tsx` - Main component
- Any service/utility files
- Custom hooks using image processing

## After Migration

Once migrated, you can:

1. ✅ Deploy web with Express backend
2. ✅ Deploy iOS with native plugin
3. ✅ Deploy Android with native plugin
4. ✅ Remove Express dependency for mobile (future)
5. ✅ Add offline support with caching (future)

## Next Steps

1. Run `npm run setup:native`
2. Test web build: `npm run dev`
3. Update imports in your code
4. Build and test iOS/Android
5. Deploy with confidence!

---

## Questions?

- See `NATIVE_BACKEND_GUIDE.md` for detailed docs
- See `capacitor-plugin/README.md` for API reference
- Check error console in browser/Xcode/Android Studio

**Migration is easy**: Change 1 import line, get better performance! 🚀
