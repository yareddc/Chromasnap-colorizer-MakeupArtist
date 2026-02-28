"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const genai_1 = require("@google/genai");
dotenv_1.default.config();
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("API Key not found in .env");
    process.exit(1);
}
const ai = new genai_1.GoogleGenAI({ apiKey });
async function verifyImagenAccess() {
    console.log("Verifying access to imagen-3.0-generate-001...");
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
        console.log("VERIFICATION_RESULT: SUCCESS");
        console.log("Your API key has access to Imagen 3.");
    }
    catch (error) {
        console.log("VERIFICATION_RESULT: FAILED");
        if (error.message && (error.message.includes('404') || error.message.toLowerCase().includes('not found'))) {
            console.log("REASON: 404_NOT_FOUND (Vertex AI not enabled or model missing)");
            console.log("Please check: docs/troubleshooting_api.md");
        }
        else if (error.message && error.message.includes('403')) {
            console.log("REASON: 403_PERMISSION_DENIED");
        }
        else {
            const errMsg = error.message ? error.message.substring(0, 150) : "Unknown error";
            console.log("REASON: " + errMsg);
        }
    }
}
verifyImagenAccess();
