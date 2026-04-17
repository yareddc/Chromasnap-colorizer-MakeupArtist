const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
const identityToken = (process.env.API_ID_TOKEN || '').trim();
const identityHeaderName = (process.env.API_ID_HEADER || 'X-Serverless-Authorization').trim();
const expectDirectMutationBlocked = process.env.BILLING_EXPECT_DIRECT_MUTATION_BLOCKED === '1';

const randomSuffix = Date.now().toString(36);
const username = `billing_debug_${randomSuffix}`;
const password = `BillingDebug123${randomSuffix.slice(-2)}`;
const email = `${username}@example.com`;

const cookieJar = new Map();

const updateCookies = (response) => {
  const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
  const setCookies = typeof getSetCookie === 'function'
    ? getSetCookie()
    : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);

  for (const setCookie of setCookies) {
    if (!setCookie) continue;
    const firstPart = setCookie.split(';')[0]?.trim();
    if (!firstPart) continue;
    const [name, ...valueParts] = firstPart.split('=');
    if (!name || valueParts.length === 0) continue;
    cookieJar.set(name, valueParts.join('='));
  }
};

const buildHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (cookieJar.size > 0) {
    headers.Cookie = Array.from(cookieJar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
  }

  if (identityToken) {
    headers[identityHeaderName] = `Bearer ${identityToken}`;
  }

  return headers;
};

const logSection = (title) => {
  console.log(`\n=== ${title} ===`);
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  updateCookies(response);
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { ok: response.ok, status: response.status, data: parsed };
};

const run = async () => {
  logSection('Register');
  const register = await fetchJson(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      username,
      password,
      recoveryEmail: email,
      email,
      name: 'Billing Debug',
      phoneNumber: '+15555550126',
    }),
  });
  console.log(register);

  logSection('Health');
  const health = await fetchJson(`${baseUrl}/api/health`, { headers: buildHeaders() });
  console.log(health);

  logSection('Plans');
  const plans = await fetchJson(`${baseUrl}/api/subscription/plans`, { headers: buildHeaders() });
  console.log(plans);

  logSection('Account');
  const account = await fetchJson(`${baseUrl}/api/subscription/me`, { headers: buildHeaders() });
  console.log(account);

  logSection('Subscribe Pro');
  const subscribe = await fetchJson(`${baseUrl}/api/subscription/subscribe`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ tier: 'pro' }),
  });
  console.log(subscribe);

  logSection('Top-up 100');
  const topUp = await fetchJson(`${baseUrl}/api/subscription/topup`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ tokens: 100 }),
  });
  console.log(topUp);

  if (expectDirectMutationBlocked) {
    if (subscribe.status !== 409 || topUp.status !== 409) {
      throw new Error(`Expected hardened mode with 409s, got subscribe=${subscribe.status}, topup=${topUp.status}`);
    }
  }

  if (process.env.RUN_CHARGE === '1') {
    logSection('Charge Test (vibrancy)');
    const payload = {
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0mQAAAAASUVORK5CYII=',
    };
    const charge = await fetchJson(`${baseUrl}/api/process/vibrancy`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });
    console.log(charge.ok ? 'Charge succeeded' : 'Charge failed');
  }

  logSection('Usage');
  const usage = await fetchJson(`${baseUrl}/api/subscription/usage`, { headers: buildHeaders() });
  console.log(usage);

  console.log(`\nUsername: ${username}`);
};

run().catch((error) => {
  console.error('Billing smoke test failed:', error);
  process.exit(1);
});
