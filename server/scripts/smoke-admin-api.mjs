import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const baseUrl = (process.env.ADMIN_SMOKE_BASE_URL || process.env.BASE_URL || 'http://localhost:3001').trim();
const adminKey = (process.env.ADMIN_SMOKE_ADMIN_API_KEY || process.env.ADMIN_API_KEY || '').trim();

if (!adminKey) {
  console.error('Missing admin API key. Set ADMIN_SMOKE_ADMIN_API_KEY or ADMIN_API_KEY.');
  process.exit(1);
}

const headers = {
  'x-admin-api-key': adminKey,
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
};

const run = async () => {
  const testUser = `quick-test-admin-${Date.now()}`;
  console.log('TEST_USER', testUser);

  const before = await requestJson(`${baseUrl}/api/admin/usernames`, { headers });
  console.log('STEP1_LIST_BEFORE', before.status);

  const create = await requestJson(`${baseUrl}/api/admin/usernames/admins`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: testUser }),
  });
  console.log('STEP2_CREATE', create.status, JSON.stringify(create.body));

  const confirm = await requestJson(`${baseUrl}/api/admin/usernames`, { headers });
  const presentAfterCreate = Array.isArray(confirm.body?.admins) && confirm.body.admins.includes(testUser);
  console.log('STEP3_LIST_CONFIRM', confirm.status, 'PRESENT', presentAfterCreate);

  const remove = await requestJson(`${baseUrl}/api/admin/usernames/admins/${encodeURIComponent(testUser)}`, {
    method: 'DELETE',
    headers,
  });
  console.log('STEP4_DELETE', remove.status, JSON.stringify(remove.body));

  const after = await requestJson(`${baseUrl}/api/admin/usernames`, { headers });
  const presentAfterDelete = Array.isArray(after.body?.admins) && after.body.admins.includes(testUser);
  console.log('STEP5_LIST_AFTER', after.status, 'PRESENT', presentAfterDelete);

  const ok = before.status === 200
    && (create.status === 200 || create.status === 201)
    && confirm.status === 200
    && presentAfterCreate
    && (remove.status === 200 || remove.status === 202 || (remove.status >= 500 && !presentAfterDelete))
    && after.status === 200
    && !presentAfterDelete;

  if (!ok) {
    console.error('SMOKE_TEST_FAILED');
    process.exit(1);
  }

  console.log('SMOKE_TEST_PASSED');
};

run().catch((error) => {
  console.error('SMOKE_TEST_ERROR', error.message);
  process.exit(1);
});
