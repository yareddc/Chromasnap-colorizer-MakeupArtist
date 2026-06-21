import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3001';
const randomSuffix = Date.now().toString(36);
const username = `style_e2e_${randomSuffix}`;
const password = `StylePass123${randomSuffix.slice(-2)}`;
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

const buildCookieHeader = () => {
  if (!cookieJar.size) return '';
  return Array.from(cookieJar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
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

const request = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const cookieHeader = buildCookieHeader();
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

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

const asDataUrl = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  const base64 = fs.readFileSync(filePath).toString('base64');
  return `data:${mimeType};base64,${base64}`;
};

const saveDataUrl = (dataUrl, outputPath) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return false;
  const matches = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return false;
  fs.writeFileSync(outputPath, Buffer.from(matches[2], 'base64'));
  return true;
};

const step = async (name, fn) => {
  console.log(`\n=== ${name} ===`);
  try {
    await fn();
    console.log(`STEP_PASS ${name}`);
    return { name, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`STEP_FAIL ${name}: ${message}`);
    return { name, ok: false, error: message };
  }
};

const run = async () => {
  console.log('STYLE_STUDIOS_E2E_START', JSON.stringify({ API_BASE, username }));
  const stepResults = [];

  const selfiePath = path.resolve(repoRoot, 'public', 'Eritrean man.jpeg');
  assert(fs.existsSync(selfiePath), `Missing selfie test image: ${selfiePath}`);
  const selfie = asDataUrl(selfiePath);

  const registerResult = await step('Register test user', async () => {
    const register = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        recoveryEmail: email,
        email,
        name: 'Style Studio E2E',
        phoneNumber: '+15555550127',
      }),
    });

    console.log('REGISTER', register.status);
    assert(register.status === 201, `Register failed: ${register.status} ${JSON.stringify(register.body)}`);
  });
  stepResults.push(registerResult);
  assert(registerResult.ok, 'Registration failed, cannot continue style studio E2E flow');

  stepResults.push(await step('Beauty Lab: Occasion recommendations', async () => {
    const response = await request('/api/recommend/occasion-look', {
      method: 'POST',
      body: JSON.stringify({
        selfie,
        occasion: 'wedding',
      }),
    });

    console.log('BEAUTY_RECOMMEND', response.status);
    assert(response.status === 200, `Beauty recommendations failed: ${response.status} ${JSON.stringify(response.body)}`);
    const recommendations = Array.isArray(response.body?.recommendations) ? response.body.recommendations : [];
    assert(recommendations.length >= 1, 'Beauty recommendations returned no looks');
  }));

  stepResults.push(await step('Beauty Lab: Beauty advisor consult', async () => {
    const response = await request('/api/consult/beauty-advisor', {
      method: 'POST',
      body: JSON.stringify({
        selfie,
        notes: 'Client wants a polished evening look with natural finish and minimal shimmer.',
        service: 'soft-day',
      }),
    });

    console.log('BEAUTY_CONSULT', response.status);
    assert(response.status === 200, `Beauty consult failed: ${response.status} ${JSON.stringify(response.body)}`);
    assert(typeof response.body?.advice === 'string' && response.body.advice.trim().length > 0, 'Beauty consult advice is empty');
  }));

  stepResults.push(await step('Beauty Lab: Virtual makeup generation', async () => {
    const response = await request('/api/generate/virtual-makeup', {
      method: 'POST',
      body: JSON.stringify({
        selfie,
        makeupStyle: 'soft glam',
        hairStyle: 'long layered waves',
        occasion: 'wedding evening reception',
        styleIntensity: 'balanced',
        cameraView: 'front',
        generateImage: true,
      }),
    });

    console.log('BEAUTY_VIRTUAL_MAKEUP', response.status);
    assert(response.status === 200, `Virtual makeup failed: ${response.status} ${JSON.stringify(response.body)}`);
    assert(typeof response.body?.description === 'string', 'Virtual makeup description missing');

    const outPath = path.resolve(repoRoot, 'public', 'e2e_beauty_virtual_makeup.png');
    const saved = saveDataUrl(response.body?.editedImage, outPath);
    console.log('BEAUTY_IMAGE_SAVED', saved);
  }));

  stepResults.push(await step('Barbershop: Recommendations', async () => {
    const response = await request('/api/recommend/occasion-look', {
      method: 'POST',
      body: JSON.stringify({
        selfie,
        occasion: 'barbershop visit',
      }),
    });

    console.log('BARBERSHOP_RECOMMEND', response.status);
    assert(response.status === 200, `Barbershop recommendations failed: ${response.status} ${JSON.stringify(response.body)}`);
    const recommendations = Array.isArray(response.body?.recommendations) ? response.body.recommendations : [];
    assert(recommendations.length >= 1, 'Barbershop recommendations returned no looks');
  }));

  stepResults.push(await step('Barbershop: Generate look', async () => {
    const response = await request('/api/generate/virtual-makeup', {
      method: 'POST',
      body: JSON.stringify({
        selfie,
        makeupStyle: 'natural',
        hairStyle: 'taper fade with clean lineup',
        occasion: 'barbershop visit | clean precision lineup with subtle skin finish',
        styleIntensity: 'balanced',
        cameraView: 'front',
        generateImage: true,
      }),
    });

    console.log('BARBERSHOP_GENERATE', response.status);
    assert(response.status === 200, `Barbershop generate failed: ${response.status} ${JSON.stringify(response.body)}`);

    const outPath = path.resolve(repoRoot, 'public', 'e2e_barbershop_after.png');
    const saved = saveDataUrl(response.body?.editedImage, outPath);
    console.log('BARBERSHOP_IMAGE_SAVED', saved);
  }));

  stepResults.push(await step('Outfit Studio: Generate try-on looks', async () => {
    const response = await request('/api/generate/outfit-tryon', {
      method: 'POST',
      body: JSON.stringify({
        selfie,
        outfitPrompt: 'An oversized emerald green blazer over a black silk turtleneck with tapered black trousers.',
        outfitStyle: 'smart casual layered streetwear',
        occasion: 'night out',
        colorPalette: 'black, charcoal, cream',
        salonContext: 'fresh fade and subtle natural makeup finish',
        mode: 'style',
        matchCurrentSalonLook: true,
        batchCount: 2,
        generateImage: true,
      }),
    });

    console.log('OUTFIT_TRYON', response.status);
    assert(response.status === 200, `Outfit try-on failed: ${response.status} ${JSON.stringify(response.body)}`);

    const looks = Array.isArray(response.body?.looks) ? response.body.looks : [];
    assert(looks.length >= 1, 'Outfit try-on returned no looks');

    const primaryPath = path.resolve(repoRoot, 'public', 'e2e_outfit_primary.png');
    const primarySaved = saveDataUrl(response.body?.editedImage, primaryPath);
    console.log('OUTFIT_PRIMARY_IMAGE_SAVED', primarySaved);

    const look1Path = path.resolve(repoRoot, 'public', 'e2e_outfit_look1.png');
    const look1Saved = saveDataUrl(looks[0]?.editedImage, look1Path);
    console.log('OUTFIT_LOOK1_IMAGE_SAVED', look1Saved);
  }));

  stepResults.push(await step('Account usage snapshot', async () => {
    const response = await request('/api/subscription/usage', {
      method: 'GET',
    });

    console.log('USAGE', response.status);
    assert(response.status === 200, `Usage lookup failed: ${response.status} ${JSON.stringify(response.body)}`);

    const balance = response.body?.account?.tokenBalance;
    console.log('TOKEN_BALANCE_AFTER_TEST', balance);
  }));

  const failures = stepResults.filter((item) => !item.ok);
  if (failures.length > 0) {
    console.error('\nSTYLE_STUDIOS_E2E_FAILED_SUMMARY');
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.error || 'Unknown error'}`);
    }
    process.exit(1);
  }

  console.log('\nSTYLE_STUDIOS_E2E_PASSED');
};

run().catch((error) => {
  console.error('STYLE_STUDIOS_E2E_FAILED', error.message || String(error));
  process.exit(1);
});
