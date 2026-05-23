import fs from 'fs';
import path from 'path';

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
    const imagePath = path.resolve('public', 'Eritrean man.jpeg');
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

                    const outputPath = path.resolve('public', `colorized_eritrean_man.${ext}`);
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
