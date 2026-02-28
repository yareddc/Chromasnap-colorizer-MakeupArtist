import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("API Key not found in .env");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function verifyAccess() {
    console.log("=== STARTING API VERIFICATION ===");
    console.log(`API Key present: ${apiKey.substring(0, 5)}...`);

    // 1. Test Gemini Flash (Text)
    console.log("\n1. Testing Gemini 2.5 Flash (Text Generation)...");
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: "Hello" }] }
        });
        console.log("   [SUCCESS] Gemini Flash is working.");
    } catch (error: any) {
        console.error("   [FAILED] Gemini Flash failed.");
        console.error(`   Error: ${error.message}`);
    }

    // 2. Test Imagen 3 (Image Generation)
    console.log("\n2. Testing Imagen 3 (Image Generation)...");
    try {
        const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgDNjd8qAAAAAElFTkSuQmCC";
        // @ts-ignore
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-001',
            prompt: "A test image",
            image: {
                imageBytes: base64Image,
                mimeType: "image/png"
            },
            config: {
                numberOfImages: 1
            }
        });
        console.log("   [SUCCESS] Imagen 3 is working.");
    } catch (error: any) {
        console.error("   [FAILED] Imagen 3 failed.");
        console.error(`   Error: ${error.message}`);

        if (error.message.includes('401') || error.message.includes('API keys are not supported')) {
            console.log("   -> ANALYSIS: This project/key likely does not have access to Imagen 3 via API Key, or Imagen 3 requires OAuth for this endpoint.");
        }
    }
    console.log("\n=== VERIFICATION COMPLETE ===");
}

verifyAccess();
