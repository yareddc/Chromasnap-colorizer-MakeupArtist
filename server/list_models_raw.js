
const { GoogleAuth } = require('google-auth-library');
// const fetch = require('node-fetch'); // Native fetch in Node 18+
require('dotenv').config({ path: './.env' });

async function listModelsRaw() {
    console.log("Getting Access Token...");
    try {
        const auth = new GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });

        const client = await auth.getClient();
        const token = (await client.getAccessToken()).token;
        const project = process.env.GCP_PROJECT_ID;
        const location = process.env.GCP_LOCATION;

        console.log(`Listing models for project ${project} in ${location}...`);

        // List Publishers (Model Garden)
        // List Publishers (Model Garden) - Correct Endpoint
        const url = `https://${location}-aiplatform.googleapis.com/v1/publishers/google/models`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            console.error(await response.text());
            return;
        }

        const data = await response.json();
        console.log("Raw Response Data:", JSON.stringify(data, null, 2));

        if (data.models) {
            console.log(`Found ${data.models.length} models.`);
            data.models.forEach(m => {
                // Log everything to be sure
                console.log(`- ${m.name}`);
            });
        } else {
            console.log("No models found in response.");
        }

    } catch (error) {
        console.error("Error listing models raw:", error);
    }
}

listModelsRaw();
