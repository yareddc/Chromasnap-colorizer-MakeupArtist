import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = __dirname;
const serverEnvPath = path.resolve(repoRoot, 'server', '.env');

const stripWrappingQuotes = (value) => value.replace(/^['"]|['"]$/g, '').trim();

const readEnvValue = (content, key) => {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex <= 0) continue;
        const envKey = trimmed.slice(0, separatorIndex).trim();
        if (envKey !== key) continue;
        return trimmed.slice(separatorIndex + 1).trim();
    }
    return '';
};

const hydrateGoogleCredentialsFromServerEnv = () => {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
    if (!fs.existsSync(serverEnvPath)) return;

    const envFile = fs.readFileSync(serverEnvPath, 'utf8');
    const rawPath = readEnvValue(envFile, 'GOOGLE_APPLICATION_CREDENTIALS');
    if (!rawPath) return;

    const configuredPath = stripWrappingQuotes(rawPath);
    const resolvedPath = path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(path.dirname(serverEnvPath), configuredPath);

    if (fs.existsSync(resolvedPath)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
        console.log('Using credentials from server/.env:', resolvedPath);
    }
};

async function testModes() {
    hydrateGoogleCredentialsFromServerEnv();

    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const at = await client.getAccessToken();
    const token = typeof at === 'string' ? at : at?.token;

    const projectId = process.env.GCP_PROJECT_ID || 'chrommasnap-vertex-ai-use';
    const location = 'us-central1';
    const model = 'imagen-3.0-generate-001';
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

    const inputImagePath = path.resolve(repoRoot, 'public', 'Eritrean man.jpeg');
    const base64Data = fs.readFileSync(inputImagePath).toString('base64');

    const prompt = 'Strictly colorize this black and white image. realistic skin tones, natural lighting, and accurate colors. maintain the exact structure, details, and facial features of the original image. Do not change the content, composition, or add new elements. The output must be a pixel-perfect color overlay of the input. Do not generate a new image.';

    // Mode 3: baseImage with image to image
    const body3 = {
        instances: [{ prompt, baseImage: { bytesBase64Encoded: base64Data } }],
        parameters: { sampleCount: 1, mode: "image-to-image" }
    };
    console.log("Testing Mode 3 (baseImage):");
    const res3 = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body3)
    });
    console.log("Res3 status:", res3.status);
    let j3 = await res3.json();
    if (j3.error) {
        console.log("Res3 error:", j3.error.message);
    } else if (j3.predictions && j3.predictions[0]) {
        console.log("Res3 success, bytes length:", j3.predictions[0].bytesBase64Encoded?.length);
        const outPath3 = path.resolve(repoRoot, 'public', 'test_mode3_baseImage.png');
        fs.writeFileSync(outPath3, Buffer.from(j3.predictions[0].bytesBase64Encoded, 'base64'));
        console.log('Saved to', outPath3);
    }
}

testModes().catch(console.error);
