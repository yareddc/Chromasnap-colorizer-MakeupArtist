# API Configuration - Quick Reference

## Files Changed

| File | What Changed | Why |
|------|-------------|-----|
| `.env.local` | ✅ Added `REACT_APP_API_BASE_URL` | Centralized configuration |
| `vite.config.ts` | ✅ Exposed `REACT_APP_API_BASE_URL` to frontend | Build-time environment variable |
| `services/apiConfig.ts` | ✅ **NEW FILE** | Single source of truth for all endpoints |
| `services/geminiService.ts` | ✅ Uses `API_ENDPOINTS` | Absolute URLs instead of relative paths |
| `capacitor-plugin/src/web.ts` | ✅ Uses environment variable | Absolute URLs for web builds |

## Quick Start

### 1. Verify Configuration

```bash
# Check .env.local exists
cat .env.local

# Expected output:
# GEMINI_API_KEY=AIzaSyDV...
# REACT_APP_API_BASE_URL=http://localhost:3001
```

### 2. Start Backend

```bash
cd server
npm run dev
# Should print: Server running on http://localhost:3001
```

### 3. Start Frontend

```bash
npm run dev
# Should print: Local: http://localhost:3000
```

### 4. Test in Browser

```javascript
// Open DevTools Console and paste:
import { API_ENDPOINTS, getApiBaseUrl } from './services/apiConfig.js';

console.log('Base URL:', getApiBaseUrl());
console.log('Colorize Endpoint:', API_ENDPOINTS.PROCESS_COLORIZE);

// Expected:
// Base URL: http://localhost:3001
// Colorize Endpoint: http://localhost:3001/api/process/colorize
```

## Environment Variables

| Variable | Location | Purpose | Example |
|----------|----------|---------|---------|
| `GEMINI_API_KEY` | `.env.local` | Google Gemini API key | `AIzaSyDV...` |
| `REACT_APP_API_BASE_URL` | `.env.local` | Backend server URL | `http://localhost:3001` |

## API Endpoints

All available endpoints (auto-constructed from `REACT_APP_API_BASE_URL`):

```javascript
// Analysis
POST {BASE_URL}/api/analyze/monochromatic
POST {BASE_URL}/api/analyze/safety

// Image Processing
POST {BASE_URL}/api/process/colorize
POST {BASE_URL}/api/process/upscale
POST {BASE_URL}/api/process/vibrancy
POST {BASE_URL}/api/process/sharpen
POST {BASE_URL}/api/process/animate
```

## Using in Code

### ✅ Recommended

```typescript
import { API_ENDPOINTS } from './services/apiConfig';

fetch(API_ENDPOINTS.PROCESS_COLORIZE, { ... });
```

### ❌ Avoid

```typescript
// Old relative paths (don't use)
fetch('/api/process/colorize', { ... });

// Hardcoded URLs (don't use)
fetch('http://localhost:3001/api/process/colorize', { ... });
```

## Changing Backend URL

### Development (Local Change)

Edit `.env.local`:
```env
# Local machine
REACT_APP_API_BASE_URL=http://localhost:3001

# Or another machine on network
REACT_APP_API_BASE_URL=http://192.168.1.100:3001

# Or remote server
REACT_APP_API_BASE_URL=https://api.example.com
```

Then restart: `npm run dev`

### Production (Deploy-Time Change)

```bash
# Docker
docker run -e REACT_APP_API_BASE_URL=https://api.prod.com myapp

# Or CI/CD
REACT_APP_API_BASE_URL=https://api.prod.com npm run build
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot POST /api..." | Backend not running. Run `cd server && npm run dev` |
| "API base URL is undefined" | Add `REACT_APP_API_BASE_URL` to `.env.local` |
| "API is unreachable" | Check URL in `.env.local` matches running backend |
| "Port 3001 already in use" | Kill process: `pkill node` or `lsof -ti:3001 \| xargs kill -9` |
| "Mixed content error" (HTTPS frontend, HTTP backend) | Use HTTPS backend URL in production |

## Files to Review

1. **[API_CONFIGURATION_GUIDE.md](./API_CONFIGURATION_GUIDE.md)** - Comprehensive guide
2. **[services/apiConfig.ts](./services/apiConfig.ts)** - Configuration source code
3. **[services/geminiService.ts](./services/geminiService.ts)** - API service using config
4. **[capacitor-plugin/src/web.ts](./capacitor-plugin/src/web.ts)** - Web plugin implementation
5. **[vite.config.ts](./vite.config.ts)** - Build configuration

## Next Steps

✅ Verify `.env.local` is configured  
✅ Start backend server  
✅ Start frontend server  
✅ Test API calls  
✅ Deploy with environment variables  

---

**For detailed information, see [API_CONFIGURATION_GUIDE.md](./API_CONFIGURATION_GUIDE.md)**
