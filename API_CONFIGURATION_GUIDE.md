# API Configuration Guide

## Overview

Your ChromaSnap application now uses **absolute URLs** for all API calls, making it flexible and production-ready. All API endpoints are configured via environment variables, so you can easily switch between different backend servers without code changes.

## Environment Variables

### Primary Configuration

**`.env.local`** - Local development configuration:

```env
# Gemini API Key
GEMINI_API_KEY=your_api_key_here

# Backend API Base URL
REACT_APP_API_BASE_URL=http://localhost:3001

# Optional: Cloudflare Turnstile site key for login CAPTCHA UI
REACT_APP_TURNSTILE_SITE_KEY=your_turnstile_site_key
```

**`server/.env`** - Backend server configuration:

```env
PORT=3001
GEMINI_API_KEY=your_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=./config/your-service-account.json
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=us-central1
ADMIN_API_KEY=replace-with-a-strong-random-secret
```

### How Environment Variables Work

1. **Development**: Variables from `.env.local` are loaded by Vite
2. **Build Time**: Environment variables are embedded via `vite.config.ts`
3. **Runtime**: Apps detect the URL from `import.meta.env` (Vite) or `process.env`

## API Configuration Files

### 1. **`services/apiConfig.ts`** (Centralized Configuration)

This file is your single source of truth for all API endpoints:

```typescript
import { API_ENDPOINTS, getApiBaseUrl } from './services/apiConfig';

// Get the base URL
const baseUrl = getApiBaseUrl();
// Result: http://localhost:3001

// Use specific endpoints
const colorizeUrl = API_ENDPOINTS.PROCESS_COLORIZE;
// Result: http://localhost:3001/api/process/colorize
```

**Available Endpoints:**
- `API_ENDPOINTS.ANALYZE_MONOCHROMATIC` - Check if image is B&W
- `API_ENDPOINTS.ANALYZE_SAFETY` - Safety check (nudity, minors)
- `API_ENDPOINTS.PROCESS_COLORIZE` - Colorize black & white images
- `API_ENDPOINTS.PROCESS_UPSCALE` - Upscale to higher resolution
- `API_ENDPOINTS.PROCESS_VIBRANCY` - Enhance color vibrancy
- `API_ENDPOINTS.PROCESS_SHARPEN` - Sharpen image details
- `API_ENDPOINTS.PROCESS_ANIMATE` - Generate animation

### 2. **`services/geminiService.ts`** (Web API Service)

All API calls now use absolute URLs from `apiConfig.ts`:

```typescript
import { API_ENDPOINTS } from './apiConfig';

export const colorizeImage = async (base64Image: string, theme: string = 'Natural'): Promise<string> => {
  const response = await fetch(API_ENDPOINTS.PROCESS_COLORIZE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, theme }),
  });
  // ...
};
```

### 3. **`capacitor-plugin/src/web.ts`** (Web Plugin Layer)

The Capacitor plugin also uses absolute URLs for web builds:

```typescript
export class ChromaSnapImageProcessorWeb {
  private apiBaseUrl = (import.meta.env.REACT_APP_API_BASE_URL || 
                        process.env.REACT_APP_API_BASE_URL || 
                        'http://localhost:3001') as string;
  
  async colorizeImage(options: ColorizeOptions) {
    const response = await fetch(`${this.apiBaseUrl}/api/process/colorize`, {
      // ...
    });
  }
}
```

### 4. **`vite.config.ts`** (Build Configuration)

Environment variables are exposed to the frontend during build:

```typescript
define: {
  'process.env.REACT_APP_API_BASE_URL': JSON.stringify(env.REACT_APP_API_BASE_URL || 'http://localhost:3001')
}
```

## Configuration for Different Environments

### Development (Local)

```env
# .env.local
REACT_APP_API_BASE_URL=http://localhost:3001
GEMINI_API_KEY=your_dev_key
```

**Start servers:**
```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
npm run dev
```

### Production

```env
# .env.production (or CI/CD variable)
REACT_APP_API_BASE_URL=https://api.chromasnap.com
GEMINI_API_KEY=your_prod_key
```

### Staging

```env
# .env.staging
REACT_APP_API_BASE_URL=https://staging-api.chromasnap.com
GEMINI_API_KEY=your_staging_key
```

### Docker / Container

```bash
# Set at runtime
docker run -e REACT_APP_API_BASE_URL=http://api:3001 chromasnap
```

## Using Different Backend Servers

### Quick Switch

To use a different backend without rebuilding:

```bash
# Change .env.local
REACT_APP_API_BASE_URL=http://192.168.1.100:3001

# Restart dev server
npm run dev
```

### Multiple Backends

For services running on different servers:

```env
# .env.local
REACT_APP_API_BASE_URL=http://localhost:3001
REACT_APP_IMAGE_SERVICE_URL=http://image-service:8080
REACT_APP_VIDEO_SERVICE_URL=http://video-service:8081
```

Then in code:
```typescript
// services/multiBackendConfig.ts
export const API_URLS = {
  imageProcessing: process.env.REACT_APP_API_BASE_URL,
  videoGeneration: process.env.REACT_APP_VIDEO_SERVICE_URL,
};
```

## Fallback Behavior

The application has intelligent fallbacks:

1. **Environment Variable** → Specific `REACT_APP_API_BASE_URL`
2. **Default Value** → `http://localhost:3001`
3. **Web Plugin** → Capacitor plugin routes to native on mobile
4. **Error Handling** → Helpful messages if backend is unavailable

## Debugging API Configuration

### Check Current Configuration

```typescript
// In browser console or app code
import { getApiBaseUrl, API_ENDPOINTS } from './services/apiConfig';

console.log('API Base URL:', getApiBaseUrl());
console.log('Colorize Endpoint:', API_ENDPOINTS.PROCESS_COLORIZE);
```

### Verify Environment Variables

```bash
# Check what Vite sees
npm run -- -c vite.config.ts

# Or check in browser DevTools
console.log(import.meta.env.REACT_APP_API_BASE_URL);
```

### Test API Connectivity

```bash
# Test if backend is reachable
curl -X POST http://localhost:3001/api/analyze/monochromatic \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/png;base64,..."}'
```

## Best Practices

### ✅ DO

- Store API URLs in environment variables
- Use `apiConfig.ts` as your single source of truth
- Keep `.env.local` out of version control (use `.env.example` instead)
- Use absolute URLs in production
- Test different backend URLs in development

### ❌ DON'T

- Hardcode API URLs in source code
- Commit `.env.local` to git
- Use relative paths for cross-origin requests
- Mix absolute and relative URLs
- Forget to update environment variables when deploying

## Native Platform Configuration

For native builds, API configuration is handled differently:

### iOS (Xcode)

```swift
// Info.plist or build settings
GEMINI_API_KEY = your_key
API_BASE_URL = http://localhost:3001  // for testing
```

### Android (build.gradle)

```gradle
buildTypes {
    debug {
        buildConfigField "String", "GEMINI_API_KEY", "\"your_key\""
        buildConfigField "String", "API_BASE_URL", "\"http://localhost:3001\""
    }
}
```

For **native platforms**, API calls go directly to Gemini, so `API_BASE_URL` is only for web builds.

## Migration Check

If you were using relative paths before:

### Old Code ❌
```typescript
const response = await fetch('/api/process/colorize', { ... });
```

### New Code ✅
```typescript
import { API_ENDPOINTS } from './services/apiConfig';
const response = await fetch(API_ENDPOINTS.PROCESS_COLORIZE, { ... });
```

## Troubleshooting

### "Backend is not responding"

1. Check `.env.local` has correct `REACT_APP_API_BASE_URL`
2. Verify backend server is running: `curl http://localhost:3001/api`
3. Check firewall/network connectivity
4. Look at browser Network tab to see actual requests

### "API key not found"

1. Ensure `.env.local` has `GEMINI_API_KEY`
2. Restart dev server after changing `.env.local`
3. Check `process.env.GEMINI_API_KEY` in browser console

### "Mixed content blocked" (HTTPS warning)

If frontend is HTTPS but backend is HTTP:
```env
# Production .env
REACT_APP_API_BASE_URL=https://api.chromasnap.com
```

## Next Steps

1. Verify `.env.local` is configured correctly
2. Start backend: `cd server && npm run dev`
3. Start frontend: `npm run dev`
4. Test API calls in browser console
5. Deploy with appropriate environment variables

---

**For more information:**
- See [NATIVE_BACKEND_GUIDE.md](./NATIVE_BACKEND_GUIDE.md) for native platform setup
- Check [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for switching from old API
- Review [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md) for system architecture
