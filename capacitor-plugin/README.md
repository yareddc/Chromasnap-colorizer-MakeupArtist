# ChromaSnap Image Processor Plugin

A native Capacitor plugin for ChromaSnap AI that enables image colorization, enhancement, and animation directly on iOS and Android devices.

## Features

- **Analyze Images**: Detect if image is black & white, check safety (nudity/minors)
- **Colorize**: Convert B&W photos to color with multiple theme palettes
- **Enhance**: Upscale, increase vibrancy, sharpen images
- **Animate**: Generate AI-driven video animations from static images
- **Native**: Runs natively on iOS/Android through Capacitor bridge

## Installation

1. Add to your Capacitor app:

```bash
npm install @chromasnap/image-processor
npx cap sync
```

2. Configure API Key:

Set the `GEMINI_API_KEY` environment variable for native builds:

**iOS** (Xcode Build Settings):
```
GEMINI_API_KEY=your_api_key_here
```

**Android** (build.gradle):
```gradle
buildTypes {
    debug {
        buildConfigField "String", "GEMINI_API_KEY", "\"your_api_key_here\""
    }
}
```

## Usage

```typescript
import { ChromaSnapImageProcessor } from '@chromasnap/image-processor';

// Analyze if image is monochromatic
const isMonochromatic = await ChromaSnapImageProcessor.analyzeMonochromatic({
  image: base64ImageDataUrl,
  apiKey: 'your-gemini-api-key'
});

// Check image safety
const safety = await ChromaSnapImageProcessor.checkSafety({
  image: base64ImageDataUrl,
  apiKey: 'your-gemini-api-key'
});

// Colorize image
const colorized = await ChromaSnapImageProcessor.colorizeImage({
  image: base64ImageDataUrl,
  theme: 'Natural', // Natural | Cinematic | Vivid | Vintage | Technicolor
  apiKey: 'your-gemini-api-key'
});

// Upscale image
const upscaled = await ChromaSnapImageProcessor.upscaleImage({
  image: base64ImageDataUrl,
  apiKey: 'your-gemini-api-key'
});

// Enhance vibrancy
const vibrant = await ChromaSnapImageProcessor.enhanceVibrancy({
  image: base64ImageDataUrl,
  apiKey: 'your-gemini-api-key'
});

// Sharpen image
const sharpened = await ChromaSnapImageProcessor.sharpenImage({
  image: base64ImageDataUrl,
  apiKey: 'your-gemini-api-key'
});

// Animate image
const animation = await ChromaSnapImageProcessor.animateImage({
  image: base64ImageDataUrl,
  apiKey: 'your-gemini-api-key'
});
```

## API Reference

### Methods

#### `analyzeMonochromatic(options: AnalyzeOptions): Promise<MonochromaticCheckResult>`

Determine if an image is black and white (monochromatic).

**Returns:**
```typescript
{
  isMonochromatic: boolean
}
```

#### `checkSafety(options: AnalyzeOptions): Promise<SafetyCheckResult>`

Check image for inappropriate content (nudity, minors, explicit content).

**Returns:**
```typescript
{
  isSafe: boolean;
  containsMinors?: boolean;
  reason?: string;
}
```

#### `colorizeImage(options: ColorizeOptions): Promise<ProcessResult>`

Colorize a black and white image with a specific theme palette.

**Options:**
```typescript
{
  image: string; // base64 data URL
  theme: 'Natural' | 'Cinematic' | 'Vivid' | 'Vintage' | 'Technicolor';
  apiKey: string;
}
```

**Returns:**
```typescript
{
  success: boolean;
  result?: string; // base64 image
  error?: string;
}
```

#### `upscaleImage(options: EnhancementOptions): Promise<ProcessResult>`

Upscale image to 4K resolution with enhanced clarity.

#### `enhanceVibrancy(options: EnhancementOptions): Promise<ProcessResult>`

Increase color vibrancy and saturation.

#### `sharpenImage(options: EnhancementOptions): Promise<ProcessResult>`

Sharpen image details and textures.

#### `animateImage(options: AnimationOptions): Promise<ProcessResult>`

Generate cinematic animation from static image (video generation via Veo model).

## Platform Support

| Feature | iOS | Android | Web |
|---------|-----|---------|-----|
| analyzeMonochromatic | ✅ | ✅ | ✅ |
| checkSafety | ✅ | ✅ | ✅ |
| colorizeImage | ✅ | ✅ | ✅ |
| upscaleImage | ✅ | ✅ | ✅ |
| enhanceVibrancy | ✅ | ✅ | ✅ |
| sharpenImage | ✅ | ✅ | ✅ |
| animateImage | 🚧 | 🚧 | ❌ |

## Architecture

The plugin uses:
- **Native Layer**: Swift (iOS) and Kotlin (Android) for platform-specific optimizations
- **Bridge**: Capacitor for TypeScript/JavaScript communication
- **API**: Direct calls to Google Generative AI (Gemini) API
- **Web Fallback**: Express backend for web builds

## Performance Considerations

- Images are processed natively, reducing mobile data transfer
- Base64 encoding adds ~33% overhead; consider compression before encoding
- Long operations (animation) may take 1-2 minutes; use progress listeners
- Timeouts set to 5-10 minutes for large image processing

## Error Handling

All methods follow a consistent error pattern:

```typescript
try {
  const result = await ChromaSnapImageProcessor.colorizeImage(options);
  if (result.success) {
    // Process result.result
  } else {
    // Handle result.error
  }
} catch (error) {
  // Plugin error
  console.error(error);
}
```

## Development

### Building the Plugin

```bash
cd capacitor-plugin
npm install
npm run build
```

### Testing

For iOS, build and run through Xcode with the ChromaSnap app.
For Android, build and run through Android Studio.

## License

MIT
