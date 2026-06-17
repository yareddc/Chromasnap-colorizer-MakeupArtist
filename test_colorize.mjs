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

const hydrateRuntimeFromServerEnv = () => {
    if (!fs.existsSync(serverEnvPath)) return;
    const envFile = fs.readFileSync(serverEnvPath, 'utf8');

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const rawCredsPath = readEnvValue(envFile, 'GOOGLE_APPLICATION_CREDENTIALS');
        if (rawCredsPath) {
            const configuredPath = stripWrappingQuotes(rawCredsPath);
            const resolvedPath = path.isAbsolute(configuredPath)
                ? configuredPath
                : path.resolve(path.dirname(serverEnvPath), configuredPath);
            if (fs.existsSync(resolvedPath)) {
                process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
            }
        }
    }

    if (!process.env.GCP_PROJECT_ID) {
        const projectId = stripWrappingQuotes(readEnvValue(envFile, 'GCP_PROJECT_ID'));
        if (projectId) {
            process.env.GCP_PROJECT_ID = projectId;
        }
    }
};

hydrateRuntimeFromServerEnv();

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3001';
const E2E_USER_ID = process.env.E2E_USER_ID || 'video-test-user';
const E2E_AUTH_TOKEN = (process.env.E2E_AUTH_TOKEN || '').trim();

const buildAuthHeaders = () => {
    const headers = {
        'Content-Type': 'application/json',
        'x-user-id': E2E_USER_ID,
    };

    if (E2E_AUTH_TOKEN) {
        headers.Authorization = `Bearer ${E2E_AUTH_TOKEN}`;
    }

    return headers;
};

async function testColorize() {
    const imagePath = path.resolve(repoRoot, 'public', 'Eritrean man.jpeg');
    console.log(`Reading image from: ${imagePath}`);

    if (!fs.existsSync(imagePath)) {
        console.error('File not found!');
        return;
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Data = imageBuffer.toString('base64');
    const mimeType = 'image/jpeg';
    const payload = {
        image: `data:${mimeType};base64,${base64Data}`,
        theme: 'Natural'
    };

    console.log(`Sending request to ${API_BASE}/api/process/colorize ...`);
    const startTime = Date.now();

    try {
        const response = await fetch(`${API_BASE}/api/process/colorize`, {
            method: 'POST',
            headers: buildAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`✅ Success! Response took ${Date.now() - startTime}ms`);

            const resultDataUrl = data.result;
            if (resultDataUrl) {
                // The data is in format "data:image/png;base64,..."
                const matches = resultDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

                if (matches && matches.length === 3) {
                    const ext = matches[1].split('/')[1] || 'png';
                    const base64Content = matches[2];

                    const outputPath = path.resolve(repoRoot, 'public', `colorized_eritrean_man.${ext}`);
                    fs.writeFileSync(outputPath, Buffer.from(base64Content, 'base64'));
                    console.log(`💾 Saved colorized image to: ${outputPath}`);
                } else {
                    console.error('❌ Result format not recognized.');
                }
            } else {
                console.error('❌ No result data found in response.');
            }
        } else {
            console.error(`❌ Error response (${response.status}):`, data);
        }
    } catch (error) {
        console.error('❌ Fetch error:', error);
    }
}

testColorize();
