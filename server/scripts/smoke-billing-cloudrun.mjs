import { execSync, spawnSync } from 'child_process';

const service = process.env.BILLING_SMOKE_SERVICE || process.argv[2] || 'chromasnap-server';
const region = process.env.BILLING_SMOKE_REGION || process.argv[3] || 'us-central1';

const runCommand = (command) => execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

const main = () => {
  try {
    const serviceUrl = runCommand(
      `gcloud run services describe ${service} --region ${region} --format="value(status.url)"`
    );

    if (!serviceUrl) {
      throw new Error('Unable to resolve Cloud Run service URL');
    }

    const identityToken = runCommand('gcloud auth print-identity-token');
    if (!identityToken) {
      throw new Error('Unable to obtain identity token from gcloud');
    }

    console.log('BILLING_SMOKE_CLOUDRUN_START', JSON.stringify({ service, region, serviceUrl }));

    const result = spawnSync('node', ['scripts/smoke-billing.mjs'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        BILLING_SMOKE_BASE_URL: serviceUrl,
        BILLING_SMOKE_ID_TOKEN: identityToken,
        BILLING_EXPECT_DIRECT_MUTATION_BLOCKED: process.env.BILLING_EXPECT_DIRECT_MUTATION_BLOCKED || '1',
      },
    });

    if (result.error) {
      throw result.error;
    }

    if (typeof result.status === 'number' && result.status !== 0) {
      process.exit(result.status);
    }

    console.log('BILLING_SMOKE_CLOUDRUN_PASSED');
  } catch (error) {
    console.error('BILLING_SMOKE_CLOUDRUN_FAILED', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

main();
