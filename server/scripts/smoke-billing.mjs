const baseUrl = process.env.BILLING_SMOKE_BASE_URL || 'http://localhost:3001';
const identityToken = (process.env.BILLING_SMOKE_ID_TOKEN || '').trim();
const identityHeaderName = (process.env.BILLING_SMOKE_ID_HEADER || 'X-Serverless-Authorization').trim();
const expectDirectMutationBlocked = process.env.BILLING_EXPECT_DIRECT_MUTATION_BLOCKED === '1';

const randomSuffix = Date.now().toString(36);
const username = `billing_${randomSuffix}`;
const password = `BillingPass123${randomSuffix.slice(-2)}`;
const email = `billing_${randomSuffix}@example.com`;

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

const buildCookieHeader = () => {
  if (cookieJar.size === 0) return '';
  return Array.from(cookieJar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
};

const buildHeaders = (overrides = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...overrides,
  };

  const cookieHeader = buildCookieHeader();
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  if (identityToken) {
    headers[identityHeaderName] = `Bearer ${identityToken}`;
  }

  return headers;
};

const parseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  updateCookies(response);
  const body = await parseBody(response);
  return {
    status: response.status,
    ok: response.ok,
    body,
  };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = async () => {
  console.log('BILLING_SMOKE_START', JSON.stringify({
    baseUrl,
    username,
    privateInvokerAuth: Boolean(identityToken),
    expectDirectMutationBlocked,
  }));

  const register = await request('/api/auth/register', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      username,
      password,
      recoveryEmail: email,
      email,
      name: 'Billing Smoke',
      phoneNumber: '+15555550125',
    }),
  });
  console.log('STEP_REGISTER', register.status);
  assert(register.status === 201, `Register failed: ${register.status} ${JSON.stringify(register.body)}`);

  const plans = await request('/api/subscription/plans', {
    method: 'GET',
    headers: buildHeaders(),
  });
  console.log('STEP_PLANS', plans.status);
  assert(plans.status === 200, `Plans failed: ${plans.status} ${JSON.stringify(plans.body)}`);
  assert(Array.isArray(plans.body?.plans) && plans.body.plans.length >= 1, 'Plans payload is invalid');

  const me = await request('/api/subscription/me', {
    method: 'GET',
    headers: buildHeaders(),
  });
  console.log('STEP_ME', me.status);
  assert(me.status === 200, `Subscription me failed: ${me.status} ${JSON.stringify(me.body)}`);

  const usage = await request('/api/subscription/usage', {
    method: 'GET',
    headers: buildHeaders(),
  });
  console.log('STEP_USAGE', usage.status);
  assert(usage.status === 200, `Subscription usage failed: ${usage.status} ${JSON.stringify(usage.body)}`);

  const subscribe = await request('/api/subscription/subscribe', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ tier: 'pro' }),
  });
  console.log('STEP_SUBSCRIBE', subscribe.status);
  if (expectDirectMutationBlocked) {
    assert(subscribe.status === 409, `Expected subscribe 409 in hardened mode, got ${subscribe.status}`);
  } else {
    assert(subscribe.status === 200, `Subscribe failed: ${subscribe.status} ${JSON.stringify(subscribe.body)}`);
  }

  const topup = await request('/api/subscription/topup', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ tokens: 100 }),
  });
  console.log('STEP_TOPUP', topup.status);
  if (expectDirectMutationBlocked) {
    assert(topup.status === 409, `Expected topup 409 in hardened mode, got ${topup.status}`);
  } else {
    assert(topup.status === 200, `Topup failed: ${topup.status} ${JSON.stringify(topup.body)}`);
  }

  const verifyDummy = await request('/api/billing/google-play/verify', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      productType: 'inapp',
      productId: 'chromasnap_topup_100',
      purchaseToken: `dummy-${randomSuffix}`,
    }),
  });
  console.log('STEP_VERIFY_DUMMY', verifyDummy.status);
  assert(verifyDummy.status === 400, `Expected verify dummy to fail with 400, got ${verifyDummy.status}`);

  console.log('BILLING_SMOKE_PASSED');
};

run().catch((error) => {
  console.error('BILLING_SMOKE_FAILED', error.message || String(error));
  process.exit(1);
});
