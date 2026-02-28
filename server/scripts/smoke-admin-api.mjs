import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const baseUrl = 'http://localhost:3001';
const adminKey = process.env.ADMIN_API_KEY;

if (!adminKey) {
  console.error('Missing ADMIN_API_KEY in server/.env');
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
    && remove.status === 200
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
