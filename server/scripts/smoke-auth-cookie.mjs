import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const baseUrl = process.env.AUTH_SMOKE_BASE_URL || 'http://localhost:3001';
const authCookieName = process.env.AUTH_COOKIE_NAME || 'chromasnap_auth';
const identityToken = (process.env.AUTH_SMOKE_ID_TOKEN || '').trim();
const identityHeaderName = (process.env.AUTH_SMOKE_ID_HEADER || 'X-Serverless-Authorization').trim();

const buildHeaders = (overrides = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...overrides,
  };

  if (identityToken) {
    headers[identityHeaderName] = `Bearer ${identityToken}`;
  }

  return headers;
};

const randomSuffix = Date.now().toString(36);
const username = `smoke_${randomSuffix}`;
const password = `SmokePass123${randomSuffix.slice(-2)}`;
const recoveryEmail = `smoke_${randomSuffix}@example.com`;
const name = `Smoke ${randomSuffix.slice(-4)}`;
const phoneNumber = '+15555550123';

const parseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const getCookieFromResponse = (response, cookieName) => {
  const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
  const setCookies = typeof getSetCookie === 'function'
    ? getSetCookie()
    : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);

  for (const setCookie of setCookies) {
    if (!setCookie) continue;
    const firstPart = setCookie.split(';')[0]?.trim();
    if (!firstPart) continue;
    const separatorIndex = firstPart.indexOf('=');
    if (separatorIndex <= 0) continue;
    const name = firstPart.slice(0, separatorIndex);
    if (name !== cookieName) continue;
    return firstPart;
  }

  return null;
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
  console.log('AUTH_SMOKE_START', JSON.stringify({
    baseUrl,
    username,
    privateInvokerAuth: Boolean(identityToken),
    identityHeaderName: identityToken ? identityHeaderName : undefined,
  }));

  const registerResult = await request(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      username,
      password,
      recoveryEmail,
      email: recoveryEmail,
      name,
      phoneNumber,
    }),
  });

  console.log('STEP_REGISTER', registerResult.status);
  assert(registerResult.status === 201, `Register failed: ${registerResult.status} ${JSON.stringify(registerResult.body)}`);

  const logoutAfterRegister = await request(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: buildHeaders(),
  });
  console.log('STEP_LOGOUT_AFTER_REGISTER', logoutAfterRegister.status);
  assert(logoutAfterRegister.status === 204, `Logout after register failed: ${logoutAfterRegister.status}`);

  const loginResult = await request(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ username, password }),
  });

  console.log('STEP_LOGIN', loginResult.status);
  assert(loginResult.status === 200, `Login failed: ${loginResult.status} ${JSON.stringify(loginResult.body)}`);

  const cookieHeader = getCookieFromResponse(loginResult.response, authCookieName);
  assert(Boolean(cookieHeader), `Auth cookie ${authCookieName} was not returned from login`);
  console.log('STEP_COOKIE_CAPTURED', authCookieName);

  const meAfterLogin = await request(`${baseUrl}/api/auth/me`, {
    headers: buildHeaders({
      Cookie: cookieHeader,
    }),
  });

  console.log('STEP_ME_AUTHENTICATED', meAfterLogin.status);
  assert(meAfterLogin.status === 200, `Authenticated /api/auth/me failed: ${meAfterLogin.status} ${JSON.stringify(meAfterLogin.body)}`);
  assert(meAfterLogin.body?.user?.username === username, 'Authenticated /api/auth/me returned unexpected user');

  const logoutResult = await request(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: buildHeaders({
      Cookie: cookieHeader,
    }),
  });

  console.log('STEP_LOGOUT', logoutResult.status);
  assert(logoutResult.status === 204, `Logout failed: ${logoutResult.status}`);

  const meAfterLogout = await request(`${baseUrl}/api/auth/me`, {
    headers: buildHeaders(),
  });

  console.log('STEP_ME_AFTER_LOGOUT', meAfterLogout.status);
  assert(meAfterLogout.status === 401, `Expected 401 after logout, got ${meAfterLogout.status}`);

  console.log('AUTH_SMOKE_PASSED');
};

run().catch((error) => {
  console.error('AUTH_SMOKE_FAILED', error.message);
  process.exit(1);
});
