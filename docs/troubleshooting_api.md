# Troubleshooting: Image Generation Model Not Available

If you see the error:
> **"Image generation model (Imagen 3) not available. Please enable Vertex AI or check your API key permissions."**

This means your current Google Cloud Project or API Key does not have access to the **Imagen 3** model required for image colorization.

## Why is this happening?
- The app uses `imagen-3.0-generate-001` for image generation/modification.
- This model is a **Vertex AI** feature and is not always enabled by default on free tier API keys.
- The standard `gemini-2.5-flash` model is for **text and multimodal understanding** (e.g., describing an image), but it cannot **generate** new images.

## How to Fix

### Option 1: Enable Vertex AI (Recommended)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select the project associated with your `GEMINI_API_KEY`.
3. Navigate to **Vertex AI** in the sidebar.
4. Click **Enable All Recommended APIs** (or specifically **Vertex AI API**).
5. Ensure your API Key has permissions to access Vertex AI services.

### Option 2: Use a Different Model (If Available)
If you have access to a different image generation model (e.g., `imagen-3.0-fast-generate-001`), update the model name in `server/src/index.ts`:

```typescript
// server/src/index.ts
response = await ai.models.generateImages({
    model: 'imagen-3.0-fast-generate-001', // Update here
    // ...
});
```

### Option 3: Switch Providers
If you cannot use Google Cloud Vertex AI, you can switch to another provider like OpenAI (DALL-E 3) or Stability AI. This requires:
1. Installing the provider's SDK (e.g., `npm install openai`).
2. Updating `server/src/index.ts` to use the new SDK.
3. Adding the new API key to `.env`.
