import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3001';
const USER_ID = 'video-test-user';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function testColorizedToVideo() {
  const imagePath = path.resolve('public', 'colorized_eritrean_man.png');
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
      'x-user-id': USER_ID,
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
      headers: { 'x-user-id': USER_ID },
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
        headers: { 'x-user-id': USER_ID },
      });

      if (!resultResponse.ok) {
        const errorText = await resultResponse.text();
        throw new Error(`Result failed (${resultResponse.status}): ${errorText}`);
      }

      const contentType = resultResponse.headers.get('content-type') || '';
      const outputPath = path.resolve('public', `colorized_to_video_${Date.now()}.mp4`);

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
