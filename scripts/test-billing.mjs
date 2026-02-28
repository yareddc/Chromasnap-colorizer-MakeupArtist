const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
const userId = process.env.USER_ID || `debug-${Date.now()}`;
const headers = {
  'Content-Type': 'application/json',
  'x-user-id': userId,
};

const logSection = (title) => {
  console.log(`\n=== ${title} ===`);
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
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
  logSection('Health');
  const health = await fetchJson(`${baseUrl}/api/health`, { headers });
  console.log(health);

  logSection('Plans');
  const plans = await fetchJson(`${baseUrl}/api/subscription/plans`, { headers });
  console.log(plans);

  logSection('Account');
  const account = await fetchJson(`${baseUrl}/api/subscription/me`, { headers });
  console.log(account);

  if (process.env.RUN_CHARGE === '1') {
    logSection('Charge Test (vibrancy)');
    const payload = {
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0mQAAAAASUVORK5CYII=',
    };
    const charge = await fetchJson(`${baseUrl}/api/process/vibrancy`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    console.log(charge.ok ? 'Charge succeeded' : 'Charge failed');
  }

  logSection('Usage');
  const usage = await fetchJson(`${baseUrl}/api/subscription/usage`, { headers });
  console.log(usage);

  console.log(`\nUser id: ${userId}`);
};

run().catch((error) => {
  console.error('Billing smoke test failed:', error);
  process.exit(1);
});
