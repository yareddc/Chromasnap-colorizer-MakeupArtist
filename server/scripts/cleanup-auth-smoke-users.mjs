#!/usr/bin/env node

import path from 'path';
import { mkdir } from 'fs/promises';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { Storage } from '@google-cloud/storage';

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

const persistentBucket = argMap.get('bucket') || process.env.USER_DB_GCS_BUCKET || '';
const persistentObject = argMap.get('object') || process.env.USER_DB_GCS_OBJECT || 'usernames.db';
const explicitDbPath = argMap.get('db') || '';
const localDbPath = explicitDbPath
  ? path.resolve(explicitDbPath)
  : persistentBucket
    ? path.resolve('/tmp', 'chromasnap-data', 'usernames.db')
    : path.resolve(process.cwd(), 'data', 'usernames.db');

const dryRun = argMap.get('dryRun') === 'true' || argMap.get('dry-run') === 'true';

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

const persistDatabaseIfNeeded = async () => {
  if (!persistentBucket || dryRun) return;
  const storage = new Storage();
  const file = storage.bucket(persistentBucket).file(persistentObject);
  await file.save(await (await import('fs/promises')).readFile(localDbPath), {
    resumable: false,
    contentType: 'application/x-sqlite3',
  });
};

const run = async () => {
  await ensureDatabaseAvailable();

  const db = await open({ filename: localDbPath, driver: sqlite3.Database });
  try {
    const patterns = ['smoke_%', 'security_%'];

    const candidates = await db.all(
      `SELECT username FROM auth_users WHERE username LIKE ? COLLATE NOCASE OR username LIKE ? COLLATE NOCASE`,
      patterns[0],
      patterns[1],
    );

    const usernames = candidates.map((row) => String(row.username));

    const likePatternsForAttempts = patterns.map((p) => `${p}::%`);

    const resetTokenRows = await db.get(
      `SELECT COUNT(*) AS count FROM password_reset_tokens WHERE username LIKE ? COLLATE NOCASE OR username LIKE ? COLLATE NOCASE`,
      patterns[0],
      patterns[1],
    );

    const attemptRows = await db.get(
      `SELECT COUNT(*) AS count FROM auth_login_attempts WHERE attempt_key LIKE ? COLLATE NOCASE OR attempt_key LIKE ? COLLATE NOCASE`,
      likePatternsForAttempts[0],
      likePatternsForAttempts[1],
    );

    console.log(`Target DB: ${localDbPath}`);
    console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}`);
    console.log(`Matched auth_users: ${usernames.length}`);
    console.log(`Matched password_reset_tokens: ${Number(resetTokenRows?.count || 0)}`);
    console.log(`Matched auth_login_attempts: ${Number(attemptRows?.count || 0)}`);

    if (!usernames.length && !Number(resetTokenRows?.count || 0) && !Number(attemptRows?.count || 0)) {
      console.log('No smoke-test auth artifacts found.');
      return;
    }

    if (dryRun) {
      console.log('Dry-run complete. Re-run without --dryRun=true to apply cleanup.');
      return;
    }

    await db.exec('BEGIN');
    try {
      await db.run(
        `DELETE FROM password_reset_tokens WHERE username LIKE ? COLLATE NOCASE OR username LIKE ? COLLATE NOCASE`,
        patterns[0],
        patterns[1],
      );

      await db.run(
        `DELETE FROM auth_login_attempts WHERE attempt_key LIKE ? COLLATE NOCASE OR attempt_key LIKE ? COLLATE NOCASE`,
        likePatternsForAttempts[0],
        likePatternsForAttempts[1],
      );

      await db.run(
        `DELETE FROM usernames WHERE username LIKE ? COLLATE NOCASE OR username LIKE ? COLLATE NOCASE`,
        patterns[0],
        patterns[1],
      );

      await db.run(
        `DELETE FROM auth_users WHERE username LIKE ? COLLATE NOCASE OR username LIKE ? COLLATE NOCASE`,
        patterns[0],
        patterns[1],
      );

      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }

    console.log('Smoke-test auth artifacts cleaned.');
  } finally {
    await db.close();
  }

  await persistDatabaseIfNeeded();
};

run().catch((error) => {
  console.error(`Cleanup failed: ${error.message || error}`);
  process.exit(1);
});
