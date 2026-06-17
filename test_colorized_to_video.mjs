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
const USER_ID = process.env.E2E_USER_ID || 'video-test-user';
const E2E_AUTH_TOKEN = (process.env.E2E_AUTH_TOKEN || '').trim();

const buildAuthHeaders = () => {
  const headers = {
    'x-user-id': USER_ID,
  };

  if (E2E_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${E2E_AUTH_TOKEN}`;
  }

  return headers;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function testColorizedToVideo() {
  const imagePath = path.resolve(repoRoot, 'public', 'colorized_eritrean_man.png');
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Missing input image: ${imagePath}. Run test_colorize.mjs first.`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

  console.log('Starting animation job using colorized image...');
  const startResponse = await fetch(`${API_BASE}/api/process/animate/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({ image: imageDataUrl }),
  });

  const startText = await startResponse.text();
  if (!startResponse.ok) {
    throw new Error(`Start failed (${startResponse.status}): ${startText}`);
  }

  const startData = JSON.parse(startText || '{}');
  const jobId = startData.jobId;
  if (!jobId) {
    throw new Error(`No jobId returned. Response: ${startText}`);
  }

  console.log(`Job created: ${jobId}`);

  const maxAttempts = 72;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await sleep(5000);

    const statusResponse = await fetch(`${API_BASE}/api/process/animate/status/${jobId}`, {
      headers: buildAuthHeaders(),
    });

    const statusBody = await statusResponse.text();
    if (!statusResponse.ok) {
      throw new Error(`Status failed (${statusResponse.status}): ${statusBody}`);
    }

    const statusData = JSON.parse(statusBody || '{}');
    console.log(`Poll ${attempt}/${maxAttempts}: ${statusData.status}`);

    if (statusData.status === 'error') {
      throw new Error(`Animation job failed: ${statusData.error || 'Unknown error'}`);
    }

    if (statusData.status === 'done') {
      const resultResponse = await fetch(`${API_BASE}/api/process/animate/result/${jobId}`, {
        headers: buildAuthHeaders(),
      });

      if (!resultResponse.ok) {
        const errorText = await resultResponse.text();
        throw new Error(`Result failed (${resultResponse.status}): ${errorText}`);
      }

      const contentType = resultResponse.headers.get('content-type') || '';
      const outputPath = path.resolve(repoRoot, 'public', `colorized_to_video_${Date.now()}.mp4`);

      if (contentType.includes('video/')) {
        const videoBuffer = Buffer.from(await resultResponse.arrayBuffer());
        fs.writeFileSync(outputPath, videoBuffer);
        console.log(`✅ Video created from colorized image and saved to: ${outputPath}`);
      } else {
        const payload = await resultResponse.text();
        console.log('Result is not direct video bytes. Payload:', payload.slice(0, 500));
      }

      return;
    }
  }

  throw new Error('Timed out waiting for animation job completion.');
}

testColorizedToVideo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error.message || error);
    process.exit(1);
  });
