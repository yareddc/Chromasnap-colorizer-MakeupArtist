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
async function testImagen() {
    console.log("Testing Imagen generation...");
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.0-pro'];
    for (const model of modelsToTry) {
        console.log(`\n--- Testing Model: ${model} ---`);
        try {
            // Minimum valid base64 PNG (1x1 white pixel)
            const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgDNjd8qAAAAAElFTkSuQmCC";
            let response;
            // Always try generateContent for Gemini models as they are multimodal
            response = await ai.models.generateContent({
                model: model,
                contents: {
                    parts: [
                        { text: "Generate an image of a beautiful landscape." }
                    ]
                }
            });
            console.log(`Success with ${model}!`);
            console.log("Response keys:", Object.keys(response || {}));
            if (response.generatedImages?.length)
                console.log("Has generatedImages");
            if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData)
                console.log("Has inlineData image");
            // If success, break
            return;
        }
        catch (error) {
            console.error(`Failed with ${model}:`);
            // console.error(JSON.stringify(error, null, 2)); // Full error might be too big or circular
            console.error("Status:", error.status);
            console.error("Message:", error.message);
        }
    }
}
testImagen();
