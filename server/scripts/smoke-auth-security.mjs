import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const baseUrl = process.env.AUTH_SMOKE_BASE_URL || 'http://localhost:3001';
const captchaBypassToken = process.env.CAPTCHA_BYPASS_TOKEN || 'dev-captcha-ok';

const randomSuffix = Date.now().toString(36);
const username = `security_${randomSuffix}`;
const password = `SecurePass123${randomSuffix.slice(-2)}`;
const newPassword = `SecurePass456${randomSuffix.slice(-2)}`;
const recoveryEmail = `security_${randomSuffix}@example.com`;
const email = `security-login_${randomSuffix}@example.com`;
const name = `Security Smoke ${randomSuffix.slice(-4)}`;

const parseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const request = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await parseBody(response);
  return { response, status: response.status, body };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = async () => {
  console.log('AUTH_SECURITY_SMOKE_START', JSON.stringify({ baseUrl, username }));

  const register = await request(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, recoveryEmail, email, name }),
  });

  console.log('STEP_REGISTER', register.status);
  assert(register.status === 201, `Register failed: ${register.status} ${JSON.stringify(register.body)}`);

  let thirdAttemptBody = null;
  for (let i = 1; i <= 3; i += 1) {
    const login = await request(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: `${password}_wrong` }),
    });

    console.log(`STEP_LOGIN_WRONG_${i}`, login.status);
    assert(login.status === 401, `Expected 401 on failed login #${i}, got ${login.status}`);
    if (i === 3) {
      thirdAttemptBody = login.body;
      assert(Boolean(login.body?.captchaRequired), 'Expected captchaRequired=true after repeated failed logins');
    }
  }

  const blockedLogin = await request(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  console.log('STEP_LOGIN_BLOCKED_FOR_CAPTCHA', blockedLogin.status);
  assert(blockedLogin.status === 403, `Expected 403 when captcha is required, got ${blockedLogin.status}`);

  const captchaLogin = await request(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, captchaToken: captchaBypassToken }),
  });

  console.log('STEP_LOGIN_WITH_CAPTCHA_TOKEN', captchaLogin.status);
  if (captchaLogin.status !== 200) {
    const providerConfigured = Boolean(blockedLogin.body?.captchaProviderConfigured);
    if (providerConfigured) {
      console.log('INFO_CAPTCHA_PROVIDER_CONFIGURED', 'Skipping bypass-token assert because external captcha verification is enabled.');
    } else {
      throw new Error(`Expected captcha bypass login success in dev mode, got ${captchaLogin.status} ${JSON.stringify(captchaLogin.body)}`);
    }
  }

  const recoverUsername = await request(`${baseUrl}/api/auth/recover/username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recoveryEmail }),
  });

  console.log('STEP_RECOVER_USERNAME', recoverUsername.status);
  assert(recoverUsername.status === 200, `Username recovery failed: ${recoverUsername.status}`);

  const resetInvalidPair = await request(`${baseUrl}/api/auth/recover/password/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, recoveryEmail: `missing_${randomSuffix}@example.com` }),
  });

  console.log('STEP_RESET_REQUEST_INVALID_PAIR', resetInvalidPair.status);
  assert(resetInvalidPair.status === 200, `Expected generic success for invalid recovery pair, got ${resetInvalidPair.status}`);

  const resetValid = await request(`${baseUrl}/api/auth/recover/password/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, recoveryEmail }),
  });

  console.log('STEP_RESET_REQUEST_VALID_PAIR', resetValid.status);
  assert(resetValid.status === 200, `Password reset request failed: ${resetValid.status} ${JSON.stringify(resetValid.body)}`);

  const resetToken = String(resetValid.body?.resetToken || '').trim();
  if (resetToken) {
    const confirm = await request(`${baseUrl}/api/auth/recover/password/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword }),
    });

    console.log('STEP_RESET_CONFIRM', confirm.status);
    assert(confirm.status === 200, `Password reset confirm failed: ${confirm.status} ${JSON.stringify(confirm.body)}`);

    const loginNewPassword = await request(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: newPassword }),
    });

    console.log('STEP_LOGIN_NEW_PASSWORD', loginNewPassword.status);
    assert(loginNewPassword.status === 200, `Login with new password failed: ${loginNewPassword.status}`);
  } else {
    console.log('INFO_NO_RESET_TOKEN', 'No dev resetToken returned (likely production mode).');
  }

  console.log('AUTH_SECURITY_SMOKE_PASSED', JSON.stringify({ thirdAttemptBody }));
};

run().catch((error) => {
  console.error('AUTH_SECURITY_SMOKE_FAILED', error.message);
  process.exit(1);
});
