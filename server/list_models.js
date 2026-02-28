"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const genai_1 = require("@google/genai");
dotenv_1.default.config();
const apiKey = process.env.GEMINI_API_KEY;

let ai;
if (process.env.GCP_PROJECT_ID && process.env.GCP_LOCATION) {
    console.log("Using Vertex AI (Service Account)...");
    ai = new genai_1.GoogleGenAI({
        vertexAI: {
            project: process.env.GCP_PROJECT_ID,
            location: process.env.GCP_LOCATION,
        }
    });
} else {
    console.log("Using API Key...");
    if (!apiKey) {
        console.error("API Key not found in .env");
        process.exit(1);
    }
    ai = new genai_1.GoogleGenAI({ apiKey });
}
async function listModels() {
    console.log("Listing available models...");
    try {
        const response = await ai.models.list();
        // @ts-ignore
        const models = response.models || response.pageInternal || [];
        console.log(`Found ${models.length} models.`);
        for (const model of models) {
            console.log(`Model: ${model.name}`);
            console.log(`Methods: ${model.supportedGenerationMethods?.join(', ')}`);
            console.log("---");
        }
    }
    catch (error) {
        console.error("Error listing models:", error);
    }
}
listModels();
