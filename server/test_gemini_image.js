
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: './.env' });

async function testGeminiImage() {
    console.log("Initializing Vertex AI Client...");
    /*
    const ai = new GoogleGenAI({
        vertexai: true,
        project: process.env.GCP_PROJECT_ID,
        location: process.env.GCP_LOCATION,
    });
    */
    // Try API Key first since standard Gemini API supports image generation easier?
    // But verify if Vertex AI supports it too.
    // The user has Vertex AI set up.

    const ai = new GoogleGenAI({
        vertexai: true,
        project: process.env.GCP_PROJECT_ID,
        location: process.env.GCP_LOCATION,
    });

    const model = 'gemini-2.0-flash-exp'; // Try experimental first as it's more likely to have new features
    console.log(`Testing image generation with ${model}...`);

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: 'Generate a simple image of a red circle.' }
                    ]
                }
            ],
            // Request image output if possible?
            // Usually valid responseSchema or simply asking for it.
            // But for native image generation, it might be separate method or tool.
        });

        console.log("Response received.");
        const candidates = response.candidates;
        if (candidates && candidates.length > 0) {
            const parts = candidates[0].content.parts;
            parts.forEach(part => {
                if (part.inlineData || part.fileData) {
                    console.log("Image generated!");
                } else if (part.text) {
                    console.log("Text response:", part.text.substring(0, 100));
                }
            });
        }

    } catch (error) {
        console.error("Error testing Gemini image:", error);
    }
}

testGeminiImage();
