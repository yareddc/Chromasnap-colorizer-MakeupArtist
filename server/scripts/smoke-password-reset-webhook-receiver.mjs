#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const waitForHealth = async (baseUrl, timeoutMs = 10000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Receiver health check timed out for ${baseUrl}`);
};

const runCase = async (provider, port) => {
  const secret = `test-secret-${provider}`;
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, [path.resolve(__dirname, 'password-reset-webhook-receiver.mjs')], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      PASSWORD_RESET_WEBHOOK_PATH: '/password-reset',
      PASSWORD_RESET_WEBHOOK_SHARED_SECRET: secret,
      PASSWORD_RESET_WEBHOOK_DRY_RUN: 'true',
      PASSWORD_RESET_EMAIL_PROVIDER: provider,
      PASSWORD_RESET_LINK_TEMPLATE: 'https://chromasnap.app/reset-password?token={{token}}',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });

  try {
    await waitForHealth(baseUrl);

    const payload = {
      event: 'password_reset_requested',
      username: `smoke_${provider}`,
      recoveryEmail: `smoke_${provider}@example.com`,
      resetToken: `${provider}-token-1234567890`,
      expiresAt: Date.now() + 15 * 60 * 1000,
      generatedAt: Date.now(),
    };

    const response = await fetch(`${baseUrl}/password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-reset-webhook-secret': secret,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`${provider} receiver call failed (${response.status}): ${JSON.stringify(body)}`);
    }

    if (!body.accepted || body.provider !== provider || body.dryRun !== true) {
      throw new Error(`${provider} receiver response invalid: ${JSON.stringify(body)}`);
    }

    console.log(`WEBHOOK_RECEIVER_CASE_PASSED ${provider}`);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (!child.killed) {
      child.kill('SIGKILL');
    }
    if (stderr.trim()) {
      // Only print stderr if there was actual diagnostic output.
      console.log(`WEBHOOK_RECEIVER_STDERR_${provider} ${stderr.trim()}`);
    }
  }
};

const run = async () => {
  console.log('WEBHOOK_RECEIVER_SMOKE_START');
  await runCase('sendgrid', 18080);
  await runCase('mailgun', 18081);
  console.log('WEBHOOK_RECEIVER_SMOKE_PASSED');
};

run().catch((error) => {
  console.error('WEBHOOK_RECEIVER_SMOKE_FAILED', error.message);
  process.exit(1);
});
