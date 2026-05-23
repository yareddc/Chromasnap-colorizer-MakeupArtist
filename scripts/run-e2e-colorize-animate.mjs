import { spawn } from 'child_process';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3001';
const E2E_USER_ID = process.env.E2E_USER_ID || 'video-test-user';
const ROOT_DIR = process.cwd();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const spawnLogged = (command, args, options = {}) => {
  const child = spawn(command, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  return child;
};

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawnLogged(command, args, options);

    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`));
    });
  });

const waitForHealth = async () => {
  const maxAttempts = 60;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (response.ok) {
        console.log(`Server is healthy at ${API_BASE} (attempt ${attempt}).`);
        return;
      }
    } catch {
      // Server may still be booting.
    }

    await sleep(1000);
  }

  throw new Error(`Server did not become healthy at ${API_BASE}/health within timeout.`);
};

const ensureAuthToken = async () => {
  if ((process.env.E2E_AUTH_TOKEN || '').trim()) {
    return process.env.E2E_AUTH_TOKEN.trim();
  }

  const username = `e2e_${Date.now()}`;
  const password = 'Passw0rd!123';
  const email = `${username}@example.com`;

  const registerPayload = {
    username,
    password,
    recoveryEmail: email,
    email,
    name: 'E2E Tester',
    phoneNumber: '+12025550123',
  };

  const registerResponse = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registerPayload),
  });

  if (registerResponse.ok) {
    const registerData = await registerResponse.json();
    if (!registerData?.token) {
      throw new Error('Register succeeded but token was missing in response.');
    }
    return registerData.token;
  }

  if (registerResponse.status !== 409) {
    const registerBody = await registerResponse.text();
    throw new Error(`Register failed (${registerResponse.status}): ${registerBody}`);
  }

  const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!loginResponse.ok) {
    const loginBody = await loginResponse.text();
    throw new Error(`Login failed (${loginResponse.status}): ${loginBody}`);
  }

  const loginData = await loginResponse.json();
  if (!loginData?.token) {
    throw new Error('Login succeeded but token was missing in response.');
  }

  return loginData.token;
};

const ensureSufficientTokens = async (authToken, minimumBalance = 40) => {
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
    'x-user-id': E2E_USER_ID,
  };

  const meResponse = await fetch(`${API_BASE}/api/subscription/me`, {
    headers: authHeaders,
  });

  if (!meResponse.ok) {
    const body = await meResponse.text();
    throw new Error(`Failed to read subscription balance (${meResponse.status}): ${body}`);
  }

  const meData = await meResponse.json();
  const currentBalance = Number(meData?.tokenBalance ?? 0);

  if (currentBalance >= minimumBalance) {
    return;
  }

  const topupAmount = Math.max(50, minimumBalance - currentBalance);
  console.log(`Token balance ${currentBalance} is low. Topping up by ${topupAmount} tokens...`);

  const topupResponse = await fetch(`${API_BASE}/api/subscription/topup`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ tokens: topupAmount }),
  });

  if (!topupResponse.ok) {
    const body = await topupResponse.text();
    throw new Error(`Token top-up failed (${topupResponse.status}): ${body}`);
  }
};

const stopServer = async (serverProcess) => {
  if (!serverProcess || serverProcess.killed || serverProcess.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(serverProcess.pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: false,
      });
      killer.on('close', () => resolve());
      killer.on('error', () => resolve());
    });
    return;
  }

  serverProcess.kill('SIGTERM');
};

const main = async () => {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const nodeCmd = process.platform === 'win32' ? 'node.exe' : 'node';
  const serverProcess = spawnLogged(npmCmd, ['run', 'server']);

  try {
    await waitForHealth();

    const authToken = await ensureAuthToken();
    await ensureSufficientTokens(authToken, 40);
    const e2eEnv = {
      ...process.env,
      E2E_API_BASE: API_BASE,
      E2E_USER_ID: E2E_USER_ID,
      E2E_AUTH_TOKEN: authToken,
    };

    console.log('Running colorize E2E step...');
    await runCommand(nodeCmd, ['test_colorize.mjs'], { env: e2eEnv });

    console.log('Running animate-from-colorized E2E step...');
    await runCommand(nodeCmd, ['test_colorized_to_video.mjs'], { env: e2eEnv });

    console.log('E2E flow passed: colorize -> animate.');
  } finally {
    await stopServer(serverProcess);
  }
};

main().catch((error) => {
  console.error('E2E runner failed:', error?.message || error);
  process.exit(1);
});
