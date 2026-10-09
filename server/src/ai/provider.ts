import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

/**
 * AI Provider abstraction.
 *
 * Keeps provider-specific logic out of route handlers so the application can
 * swap image-generation backends (Gemini, Vertex, Replicate, Fal, etc.) without
 * touching the frontend or route layer.
 */

export type FeatureType = 'HAIRSTYLE' | 'BEAUTY' | 'OUTFIT' | 'COMPLETE_LOOK' | 'PHOTO_ENHANCEMENT';

export interface GenerationRequest {
    userId: string;
    featureType: FeatureType;
    sourceImage: string; // base64 data URL or raw base64
    referenceImage?: string;
    prompt: string;
    options?: Record<string, unknown>;
    provider?: string;
}

export interface GenerationResult {
    image?: string; // data URL
    text?: string;
    model: string;
}

export interface AIProvider {
    /** Generate a new image (or edited image) from a source image + prompt. */
    generateImage(req: GenerationRequest): Promise<GenerationResult>;
    /** Generate text from a prompt with optional source image context. */
    generateText(req: GenerationRequest): Promise<GenerationResult>;
}

const createGenaiClient = (): GoogleGenAI => {
    if (process.env.GCP_PROJECT_ID && process.env.GCP_LOCATION) {
        return new GoogleGenAI({
            vertexai: true,
            project: process.env.GCP_PROJECT_ID,
            location: process.env.GCP_LOCATION,
        });
    }
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
};

const normalizeToPngBase64 = async (image: string): Promise<string> => {
    const hasPrefix = typeof image === 'string' && image.includes(',');
    const base64Data = hasPrefix ? image.split(',')[1] : image;
    const inputBuffer = Buffer.from(base64Data, 'base64');
    const normalizedBuffer = await sharp(inputBuffer).rotate().png().toBuffer();
    return normalizedBuffer.toString('base64');
};

const extractInlineImageBase64 = (response: any): string | undefined => {
    const candidateRoots = [
        response?.candidates,
        response?.response?.candidates,
        response?.response?.response?.candidates,
    ];
    for (const candidates of candidateRoots) {
        if (!Array.isArray(candidates)) continue;
        for (const candidate of candidates) {
            const parts = candidate?.content?.parts;
            if (!Array.isArray(parts)) continue;
            for (const part of parts) {
                const data = part?.inlineData?.data;
                if (typeof data === 'string' && data.length > 0) return data;
            }
        }
    }
    return undefined;
};

export class GoogleGeminiProvider implements AIProvider {
    readonly name = 'google-gemini';

    async generateImage(req: GenerationRequest): Promise<GenerationResult> {
        const base64Image = await normalizeToPngBase64(req.sourceImage);
        const ai = createGenaiClient();

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { data: base64Image, mimeType: 'image/png' } },
                    { text: req.prompt },
                ],
            }],
            config: {
                responseModalities: ['IMAGE'],
                temperature: 0.35,
            },
        });

        const imageBase64 = extractInlineImageBase64(response);
        if (!imageBase64) {
            throw new Error('Image generation returned no image');
        }

        return { image: `data:image/png;base64,${imageBase64}`, model: 'gemini-2.5-flash-image' };
    }

    async generateText(req: GenerationRequest): Promise<GenerationResult> {
        const ai = createGenaiClient();
        const parts: Array<Record<string, unknown>> = [{ text: req.prompt }];
        if (req.sourceImage) {
            const base64Image = await normalizeToPngBase64(req.sourceImage);
            parts.push({ inlineData: { data: base64Image, mimeType: 'image/png' } });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts }],
        });

        const text = (response as any)?.text?.()?.trim()
            || (response as any)?.response?.content?.parts?.[0]?.text
            || '';
        return { text, model: 'gemini-2.5-flash' };
    }
}

let defaultProvider: AIProvider | null = null;

export const getProvider = (name?: string): AIProvider => {
    if (defaultProvider) return defaultProvider;
    defaultProvider = new GoogleGeminiProvider();
    return defaultProvider;
};
