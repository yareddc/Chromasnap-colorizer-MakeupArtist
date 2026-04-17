
require('dotenv').config({ path: './.env' });
const { GoogleGenAI } = require('@google/genai');

async function listModels() {
    console.log("Initializing Vertex AI...");
    const ai = new GoogleGenAI({
        vertexai: true,
        project: process.env.GCP_PROJECT_ID,
        location: process.env.GCP_LOCATION,
    });

    try {
        console.log("Listing models...");
        const response = await ai.models.list();

        const models = response.models || [];
        console.log(`Found ${models.length} models.`);

        const imagenModels = models.filter(m => m.name.includes('image'));
        const geminiModels = models.filter(m => m.name.includes('gemini'));
        const veoModels = models.filter(m => m.name.includes('veo'));

        console.log("\n--- Imagen Models ---");
        imagenModels.forEach(m => console.log(`- ${m.name} (${m.version})`));

        console.log("\n--- Gemini Models (Potential for Image Gen) ---");
        geminiModels.forEach(m => {
            if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateImages')) {
                console.log(`- ${m.name} [SUPPORTS IMAGE GEN]`);
            } else {
                console.log(`- ${m.name}`);
            }
        });

        console.log("\n--- Veo Models ---");
        veoModels.forEach(m => console.log(`- ${m.name}`));

        // Check for specific edit capability if possible (methods are not always explicit)
        console.log("\n--- Full Model Dump (First 5) ---");
        console.log(JSON.stringify(models.slice(0, 5), null, 2));

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
