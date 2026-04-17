
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
    try {
        let ai;
        if (process.env.GCP_PROJECT_ID && process.env.GCP_LOCATION) {
            console.log("Using Vertex AI (Service Account)...");
            ai = new GoogleGenAI({
                vertexAI: {
                    project: process.env.GCP_PROJECT_ID,
                    location: process.env.GCP_LOCATION,
                }
            });
        } else {
            console.log("Using API Key...");
            ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        }

        console.log("Listing models...");
        const response = await ai.models.list();
        // @ts-ignore
        const models = response.models || response.pageInternal || [];

        const updateModels = models.map(m => ({
            name: m.name,
            methods: m.supportedGenerationMethods
        }));

        fs.writeFileSync('models_list.json', JSON.stringify(updateModels, null, 2), 'utf8');
        console.log("Models saved to models_list.json");

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
