# ChromaSnap Native Backend - Architecture Diagrams

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     ChromaSnap React App                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  App.tsx, Components                                       │  │
│  │  • ImageUploader   • ComparisonView   • VideoResult        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            │                                      │
│                            │ imports                              │
│                            ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  nativeImageProcessorService.ts (Abstraction Layer)       │  │
│  │  • colorizeImage()    • analyzeMonochromatic()           │  │
│  │  • upscaleImage()     • checkImageSafety()               │  │
│  │  • enhanceVibrancy()  • sharpenImage()                   │  │
│  │  • animateImage()     • onProcessingProgress()           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            │                                      │
│                            │ uses                                 │
│                            ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  @chromasnap/image-processor (Capacitor Plugin)           │  │
│  │  TypeScript Bridge                                        │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
          │                          │                       │
          │ (on iOS)                 │ (on Android)          │ (on Web)
          ▼                          ▼                       ▼
    ┌──────────────┐           ┌──────────────┐      ┌─────────────┐
    │ iOS (Swift)  │           │Android(Kotlin)│      │ Browser API │
    ├──────────────┤           ├──────────────┤      ├─────────────┤
    │URLSession    │           │HttpURLConnection     │  fetch()    │
    │Direct API    │           │Direct API    │      │ HTTP Call   │
    │ Calls        │           │ Calls        │      │             │
    └──────────────┘           └──────────────┘      └─────────────┘
           │                          │                       │
           └──────────┬───────────────┘                       │
                      │                                       │
                      ▼                                       ▼
         ┌──────────────────────────┐       ┌──────────────────────┐
         │  Gemini API (Cloud)      │       │ Express Backend      │
         │  generativelanguage.     │       │ Node.js Server       │
         │  googleapis.com          │       │ :3001                │
         └──────────────────────────┘       └──────────────────────┘
                      │                                │
                      └────────┬─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Gemini API Models  │
                    │  gemini-2.0-flash   │
                    │  veo-2.0 (video)    │
                    └─────────────────────┘
```

## Request Flow Diagram

### iOS/Android (Native)
```
User clicks "Colorize"
        │
        ▼
App.tsx: handleColorize()
        │
        ▼
nativeImageProcessorService.colorizeImage()
        │
        ▼
Capacitor Plugin Bridge
        │
        ▼ (invoke native)
        │
   ┌────┴───────────────────────────────────────┐
   │                                             │
   ▼ (iOS)                                  ▼ (Android)
Swift Implementation                     Kotlin Implementation
┌──────────────────────┐                ┌──────────────────────┐
│ ChromaSnapImageProcessor              │ ChromaSnapImageProcessor
│ .swift                                │ .kt
│                                       │
│ 1. Extract base64                     │ 1. Extract base64
│ 2. Extract MIME type                  │ 2. Extract MIME type
│ 3. Build JSON request                 │ 3. Build JSON request
│ 4. URLSession.dataTask                │ 4. HttpURLConnection
│ 5. POST to Gemini API                 │ 5. POST to Gemini API
│ 6. Parse response                     │ 6. Parse response
│ 7. Extract image data                 │ 7. Extract image data
│ 8. Return result                      │ 8. Return result
└──────────────────────┘                └──────────────────────┘
        │                                        │
        └────────────┬─────────────────────────┘
                     │
                     ▼
          Gemini API (Direct)
          Returns: base64 image
                     │
                     ▼
         JS Bridge returns result
                     │
                     ▼
         App updates UI with colorized image
```

### Web
```
User clicks "Colorize"
        │
        ▼
App.tsx: handleColorize()
        │
        ▼
nativeImageProcessorService.colorizeImage()
        │ (checks if Capacitor available)
        │ (not available on web)
        ▼
Web Implementation (web.ts)
        │
        ▼
fetch('/api/process/colorize', {
  method: 'POST',
  body: { image, theme }
})
        │
        ▼
Browser HTTP Request
        │
        ▼
Express Backend (server/src/index.ts)
/api/process/colorize endpoint
        │
        ▼
1. Extract base64
2. Build Gemini request
3. Call Gemini API
4. Parse response
5. Extract image data
6. Return to client
        │
        ▼
Browser receives base64 image
        │
        ▼
App updates UI with colorized image
```

## Data Flow: Complete Colorization Process

```
Step 1: Image Selection
┌─────────────────────┐
│ User uploads image  │
│ Format: JPEG/PNG    │
│ Size: typically     │
│ 1-20 MB             │
└────────┬────────────┘
         │ Base64 encode
         ▼
    data:image/png;base64,iVBORw0KG...

Step 2: Theme Selection
┌─────────────────────────┐
│ User selects palette    │
│ • Natural               │
│ • Cinematic             │
│ • Vivid                 │
│ • Vintage               │
│ • Technicolor           │
└────────┬────────────────┘
         │ Selected: "Cinematic"

Step 3: Pre-checks (Parallel)
┌──────────────────┐ ┌──────────────────┐
│ B&W Detection    │ │ Safety Screen    │
│ isMonochromatic  │ │ checkImageSafety │
└────────┬─────────┘ └────────┬─────────┘
         │ true               │ safe ok
         └──────────┬─────────┘
                    │ Both pass
                    ▼
            Proceed to colorization

Step 4: Colorization
┌──────────────────────────────────────────────┐
│ colorizeImage(image, "Cinematic")            │
├──────────────────────────────────────────────┤
│ Platform Routing:                            │
│ • iOS: Use Swift URLSession NATIVE           │
│ • Android: Use Kotlin HttpConnection NATIVE  │
│ • Web: Use fetch() to Express API            │
│                                              │
│ Send to Gemini:                              │
│ {                                            │
│   "contents": [{                             │
│     "parts": [                               │
│       {image base64},                        │
│       {colorization prompt}                  │
│     ]                                        │
│   }],                                        │
│   "generationConfig": {                      │
│     "responseMimeType": "application/json"   │
│   }                                          │
│ }                                            │
└─────────────────┬──────────────────────────┘
                  │ API Call
                  ▼ (5-15 seconds)
         Gemini API Processing

Step 5: Response Processing
┌──────────────────────────────────────┐
│ Parse Gemini Response                │
├──────────────────────────────────────┤
│ {                                    │
│   "candidates": [{                   │
│     "content": {                     │
│       "parts": [{                    │
│         "inlineData": {              │
│           "data": "base64...",       │
│           "mimeType": "image/png"    │
│         }                            │
│       }]                             │
│     }                                │
│   }]                                 │
│ }                                    │
└─────────────────┬────────────────────┘
                  │ Extract image
                  ▼
        data:image/png;base64,...

Step 6: Safety Check (again)
┌──────────────────────────────┐
│ Verify result is safe        │
│ • Check nudity               │
│ • Check minors               │
│ • Store result               │
└──────────────────────────────┘
         │ ✓ Approved
         ▼

Step 7: UI Update
┌─────────────────────────────────────┐
│ Display in ComparisonView           │
│ • Show original (left)              │
│ • Show colorized (right)            │
│ • Enable interactive slider         │
│ • Show enhancement buttons          │
└─────────────────────────────────────┘
```

## Performance Comparison

```
Timeline Comparison (in milliseconds)

API Service (via Express):
┌────┐ ┌────┐ ┌────┐ ┌─────────────────┐ ┌────┐ ┌──┐
│100 │→│50  │→│120 │→│ 5000-15000      │→│200 │→│50│ = 5500-15420ms
│    │ │    │ │    │ │ Gemini Process  │ │    │ │  │
│Prep│ │HTTP│ │Srv │ │                 │ │HTTP│ │UI│

Native Service (iOS/Android):
┌────┐ ┌────┐ ┌─────────────────┐ ┌────┐ ┌──┐
│100 │→│50  │→│ 5000-15000      │→│50  │→│50│ = 5250-15250ms
│    │ │    │ │ Gemini Process  │ │    │ │  │
│Prep│ │API │ │                 │ │Prs │ │UI│

Web Service (HTTP):
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌─────────────────┐ ┌────┐ ┌────┐ ┌──┐
│100 │→│50  │→│120 │→│100 │→│ 5000-15000      │→│200 │→│100 │→│50│ = 5720-15720ms
│    │ │    │ │    │ │Srvr│ │ Gemini Process  │ │    │ │Rtrn│ │  │
│Prep│ │HTTP│ │Req │ │Agt │ │                 │ │Rsp │ │Run │ │UI│

Key: Savings from Native = 200-500ms (mainly HTTP overhead reduction)
```

## Component Communication

```
App Component
├── State Management
│   ├── selectedImage
│   ├── selectedTheme
│   ├── result
│   └── processing
│
├── Event Handlers
│   ├── handleImageSelected
│   ├── handleColorize
│   │   └─→ nativeImageProcessorService.colorizeImage()
│   ├── handleUpscale
│   │   └─→ nativeImageProcessorService.upscaleImage()
│   ├── handleVibrancy
│   │   └─→ nativeImageProcessorService.enhanceVibrancy()
│   ├── handleSharpen
│   │   └─→ nativeImageProcessorService.sharpenImage()
│   ├── handleAnimate
│   │   └─→ nativeImageProcessorService.animateImage()
│   └── handleUndo
│
└── Rendered Components
    ├── ImageUploader
    │   └─→ Camera / File upload
    ├── ComparisonView
    │   └─→ Before/after slider
    ├── VideoResult
    │   └─→ Animation display
    ├── LoadingOverlay
    │   └─→ Progress indicator
    └── EnhancementButtons
        └─→ Upscale, Vibrancy, Sharpen
```

## Error Handling Flow

```
User Action (e.g., Colorize)
        │
        ▼
nativeImageProcessorService
        │
        ▼ Platform Specific Code
   ┌────┴────────────────────┐
   │                         │
   ▼ (iOS)                  ▼ (Android/Web)
Swift Error Handler      Kotlin/JS Handler
   │                         │
   ├─ Network error ─┐   ├─ Network error ─┐
   ├─ Timeout ────┐  │   ├─ Timeout ────┐  │
   ├─ Parse error ┘  │   ├─ Parse error ┘  │
   │                  │   │                  │
   └──────────┬───────┘   └──────────┬───────┘
              │                      │
              └──────────┬───────────┘
                         │
                         ▼
            Catch & Convert to Standard
            Error Message
                         │
                         ▼
              Display in UI ErrorAlert
                         │
                         ▼
            User Sees Friendly Message
                         │
                         ▼
              User Can Retry Operation
```

These diagrams show:
- **System Architecture**: How components fit together
- **Request Flow**: Different paths for each platform
- **Data Flow**: Complete colorization process
- **Performance**: Speed comparison
- **Component Communication**: State and event flow
- **Error Handling**: Exception management

---

*For more details, see the related documentation files.*
