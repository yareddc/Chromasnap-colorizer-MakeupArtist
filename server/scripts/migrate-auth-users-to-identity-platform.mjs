#!/usr/bin/env node

import path from 'path';
import { execSync } from 'child_process';
import { mkdir } from 'fs/promises';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { Storage } from '@google-cloud/storage';
import { GoogleAuth } from 'google-auth-library';

const argMap = new Map();
for (const arg of process.argv.slice(2)) {
  if (!arg.startsWith('--')) continue;
  const eq = arg.indexOf('=');
  if (eq === -1) {
    argMap.set(arg.slice(2), 'true');
  } else {
    argMap.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
}

const projectId =
  argMap.get('project') ||
  process.env.GCP_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  '';

if (!projectId) {
  console.error('Missing project id. Pass --project=<gcp-project-id>.');
  process.exit(1);
}

const apply = argMap.get('apply') === 'true';
const limit = Number(argMap.get('limit') || '0');
const persistentBucket = argMap.get('bucket') || process.env.USER_DB_GCS_BUCKET || '';
const persistentObject = argMap.get('object') || process.env.USER_DB_GCS_OBJECT || 'usernames.db';
const explicitDbPath = argMap.get('db') || '';

const localDbPath = explicitDbPath
  ? path.resolve(explicitDbPath)
  : persistentBucket
    ? path.resolve('/tmp', 'chromasnap-data', 'usernames.db')
    : path.resolve(process.cwd(), 'data', 'usernames.db');

const endpointBase = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}`;
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

const getAccessToken = async () => {
  try {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (token?.token) return token.token;
  } catch {
    // Fall back to gcloud user credentials when ADC is not configured.
  }

  try {
    const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
    if (token) return token;
  } catch {
    // Continue to final error below.
  }

  throw new Error('Failed to obtain Google access token (ADC and gcloud fallback both unavailable).');
};

const ensureDatabaseAvailable = async () => {
  await mkdir(path.dirname(localDbPath), { recursive: true });

  if (!persistentBucket) return;

  const storage = new Storage();
  const file = storage.bucket(persistentBucket).file(persistentObject);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Database object gs://${persistentBucket}/${persistentObject} does not exist.`);
  }

  await file.download({ destination: localDbPath });
};

const loadAuthUsers = async () => {
  const db = await open({ filename: localDbPath, driver: sqlite3.Database });
  try {
    const rows = await db.all(`
      SELECT
        username,
        password_hash,
        name,
        email,
        phone_number
      FROM auth_users
      ORDER BY created_at ASC
    `);
    return rows;
  } finally {
    await db.close();
  }
};

const apiCall = async (pathname, body) => {
  const token = await getAccessToken();

  const response = await fetch(`${endpointBase}${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-goog-user-project': projectId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`Identity Platform API ${pathname} failed (${response.status}): ${JSON.stringify(json)}`);
  }

  return json;
};

const listIdentityUsers = async () => {
  const byLocalId = new Set();
  const byEmail = new Set();
  let pageToken = undefined;

  while (true) {
    const payload = { maxResults: 1000 };
    if (pageToken) payload.nextPageToken = pageToken;

    const result = await apiCall('/accounts:query', payload);
    const users = result.users || [];

    for (const user of users) {
      if (user.localId) byLocalId.add(String(user.localId).toLowerCase());
      if (user.email) byEmail.add(String(user.email).toLowerCase());
    }

    if (!result.nextPageToken) break;
    pageToken = result.nextPageToken;
  }

  return { byLocalId, byEmail };
};

const sanitizePhone = (phone) => {
  const value = String(phone || '').trim();
  if (!value) return undefined;
  // Identity Platform accepts E.164, keep only clearly valid values.
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : undefined;
};

const buildImportUser = (row) => {
  const username = String(row.username || '').trim();
  const email = String(row.email || '').trim().toLowerCase();
  const name = String(row.name || '').trim();
  const passwordHash = String(row.password_hash || '');
  const phoneNumber = sanitizePhone(row.phone_number);

  if (!username || !email || !passwordHash) return null;

  const user = {
    localId: username,
    email,
    displayName: name || username,
    passwordHash: Buffer.from(passwordHash, 'utf8').toString('base64'),
    emailVerified: true,
  };

  if (phoneNumber) user.phoneNumber = phoneNumber;
  return user;
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const main = async () => {
  console.log(`Project: ${projectId}`);
  console.log(`Source DB: ${localDbPath}`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  await ensureDatabaseAvailable();

  const sourceRows = await loadAuthUsers();
  const source = limit > 0 ? sourceRows.slice(0, limit) : sourceRows;

  console.log(`Found ${sourceRows.length} auth user(s) in source DB${limit > 0 ? ` (limited to ${source.length})` : ''}.`);

  const existing = await listIdentityUsers();
  console.log(`Identity Platform currently has ${existing.byLocalId.size} user(s).`);

  const prepared = [];
  let skippedInvalid = 0;
  let skippedExisting = 0;

  for (const row of source) {
    const user = buildImportUser(row);
    if (!user) {
      skippedInvalid += 1;
      continue;
    }

    const localIdKey = user.localId.toLowerCase();
    const emailKey = user.email.toLowerCase();

    if (existing.byLocalId.has(localIdKey) || existing.byEmail.has(emailKey)) {
      skippedExisting += 1;
      continue;
    }

    prepared.push(user);
  }

  console.log(`Prepared ${prepared.length} user(s) for import.`);
  console.log(`Skipped existing: ${skippedExisting}`);
  console.log(`Skipped invalid: ${skippedInvalid}`);

  if (!prepared.length) {
    console.log('Nothing to import.');
    return;
  }

  if (!apply) {
    console.log('Dry-run complete. Re-run with --apply=true to import users.');
    return;
  }

  const batches = chunk(prepared, 1000);
  let imported = 0;
  let importErrors = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const users = batches[i];
    const result = await apiCall('/accounts:batchCreate', {
      hashAlgorithm: 'BCRYPT',
      users,
    });

    const errors = result.errors || [];
    importErrors += errors.length;
    imported += users.length - errors.length;

    console.log(`Batch ${i + 1}/${batches.length}: imported ${users.length - errors.length}/${users.length}`);

    if (errors.length) {
      for (const err of errors.slice(0, 10)) {
        console.warn(`  index=${err.index} message=${err.message || 'unknown error'}`);
      }
      if (errors.length > 10) {
        console.warn(`  ... ${errors.length - 10} additional errors omitted`);
      }
    }
  }

  console.log(`Import finished. Imported=${imported}, Errors=${importErrors}`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
