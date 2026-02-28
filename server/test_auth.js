
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

async function testAuth() {
    console.log("Testing Vertex AI Auth...");
    console.log(`Project: ${process.env.GCP_PROJECT_ID}`);
    console.log(`Location: ${process.env.GCP_LOCATION}`);
    console.log(`Key File: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);

    if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        console.error("ERROR: Key file not found at specified path!");
        return;
    }

    try {
        const ai = new GoogleGenAI({
            vertexai: true,
            project: process.env.GCP_PROJECT_ID,
            location: process.env.GCP_LOCATION,
        });

        const model = 'gemini-2.0-flash';
        console.log(`Attempting to list models or generate content with ${model}...`);

        // Simple generation to test auth
        const response = await ai.models.generateContent({
            model: model,
            contents: 'Hello, are you working?',
        });

        console.log("Success! Response:", response.text ? response.text().substring(0, 50) + "..." : "No text");

    } catch (error) {
        console.error("Auth failed:", error.message);
    }
}

testAuth();
