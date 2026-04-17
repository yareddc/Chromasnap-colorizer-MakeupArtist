
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

async function testUpscale() {
    console.log("Testing Upscale (Gemini Flash) for Image Output...");
    try {
        const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgDNjd8qAAAAAElFTkSuQmCC";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { data: base64Image, mimeType: "image/png" } },
                    { text: 'Upscale this image. Only output the image.' }
                ]
            }
        });

        console.log("Response received.");
        const candidate = response.candidates?.[0];
        // @ts-ignore
        const inlineData = candidate?.content?.parts?.find(p => p.inlineData);

        if (inlineData) {
            console.log("SUCCESS: Image data returned!");
        } else {
            console.log("FAILURE: No image data returned. Gemini Flash likely returned text.");
            // @ts-ignore
            console.log("Text content:", candidate?.content?.parts?.[0]?.text);
        }

    } catch (error: any) {
        console.error("ERROR:", error.message);
    }
}

testUpscale();
