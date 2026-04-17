
const { GoogleAuth } = require('google-auth-library');
// const fetch = require('node-fetch'); // Native fetch in Node 18+
require('dotenv').config({ path: './.env' });
const fs = require('fs');
const path = require('path');

const sharp = require('sharp');

async function testEditRaw() {
    console.log("Getting Access Token...");
    const auth = new GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const token = (await client.getAccessToken()).token;
    const project = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION;
    const modelId = 'imagen-3.0-generate-001';
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${modelId}:predict`;

    console.log(`Generating dummy image...`);
    const buffer = await sharp({
        create: {
            width: 100,
            height: 100,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
    }).png().toBuffer();
    const validBase64 = buffer.toString('base64');

    console.log(`Testing edit on ${modelId}...`);

    const payload = {
        instances: [
            {
                prompt: "Colorize this image strictly.",
                context_image: {
                    bytesBase64Encoded: validBase64
                }
            }
        ],
        parameters: {
            sampleCount: 1,
            editConfig: {
                editMode: "EDIT_MODE_INPAINT_INSERTION"
            }
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            const text = await response.text();
            console.error(text);
            fs.writeFileSync('error.log', text);
        } else {
            console.log("Success! Response received.");
            const data = await response.json();
            // console.log(JSON.stringify(data, null, 2));
            if (data.predictions) {
                console.log("Predictions found.");
            }
        }

    } catch (error) {
        console.error("Error testing edit raw:", error);
    }
}

testEditRaw();
