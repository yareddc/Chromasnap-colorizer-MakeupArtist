import path from 'path';
import { mkdir, readFile } from 'fs/promises';
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import { Storage } from '@google-cloud/storage';

export type UsernameRole = 'subscriber' | 'admin';

export type AuthUserRecord = {
    username: string;
    passwordHash: string;
    recoveryEmail: string;
    name: string;
    email: string;
    phoneNumber?: string;
};

export type AuthLoginAttemptState = {
    key: string;
    failureCount: number;
    firstFailedAt: number;
    lastFailedAt: number;
    lockedUntil?: number;
    captchaRequired: boolean;
};

let database: Database<sqlite3.Database, sqlite3.Statement> | null = null;

const persistentBucket = (process.env.USER_DB_GCS_BUCKET || '').trim();
const persistentObject = (process.env.USER_DB_GCS_OBJECT || 'usernames.db').trim();
const dataRootPath = persistentBucket ? path.resolve('/tmp', 'chromasnap-data') : path.resolve(process.cwd(), 'data');
const dbFilePath = path.resolve(dataRootPath, 'usernames.db');
const storage = persistentBucket ? new Storage() : null;
let persistQueue: Promise<void> = Promise.resolve();

const normalizeUsername = (username: string) => username.trim();

const getDatabase = () => {
    if (!database) {
        throw new Error('Username database has not been initialized');
    }
    return database;
};

const downloadDatabaseIfNeeded = async () => {
    if (!storage || !persistentBucket) return;

    const file = storage.bucket(persistentBucket).file(persistentObject);
    const [exists] = await file.exists();
    if (!exists) return;

    await file.download({ destination: dbFilePath });
};

const persistDatabase = async () => {
    if (!storage || !persistentBucket) return;

    const fileBytes = await readFile(dbFilePath);
    const file = storage.bucket(persistentBucket).file(persistentObject);
    await file.save(fileBytes, {
        resumable: false,
        contentType: 'application/x-sqlite3',
    });
};

const queuePersistDatabase = async () => {
    persistQueue = persistQueue.then(() => persistDatabase());
    await persistQueue;
};

export const initUsernameDatabase = async () => {
    if (database) return database;

    await mkdir(path.dirname(dbFilePath), { recursive: true });
    await downloadDatabaseIfNeeded();

    const db = await open({
        filename: dbFilePath,
        driver: sqlite3.Database,
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS usernames (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL COLLATE NOCASE,
            role TEXT NOT NULL CHECK(role IN ('subscriber', 'admin')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(username, role)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS auth_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            recovery_email TEXT NOT NULL COLLATE NOCASE,
            name TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            phone_number TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const authUserColumns = await db.all<{ name: string }[]>(`PRAGMA table_info(auth_users)`);
    const authUserColumnNames = new Set(authUserColumns.map((column) => String(column.name).toLowerCase()));

    if (!authUserColumnNames.has('name')) {
        await db.exec(`ALTER TABLE auth_users ADD COLUMN name TEXT NOT NULL DEFAULT ''`);
    }

    if (!authUserColumnNames.has('email')) {
        await db.exec(`ALTER TABLE auth_users ADD COLUMN email TEXT NOT NULL DEFAULT '' COLLATE NOCASE`);
    }

    if (!authUserColumnNames.has('phone_number')) {
        await db.exec(`ALTER TABLE auth_users ADD COLUMN phone_number TEXT`);
    }

    await db.run(`UPDATE auth_users SET email = recovery_email WHERE email IS NULL OR TRIM(email) = ''`);
    await db.run(`UPDATE auth_users SET name = username WHERE name IS NULL OR TRIM(name) = ''`);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL COLLATE NOCASE,
            expires_at INTEGER NOT NULL,
            used INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS auth_login_attempts (
            attempt_key TEXT PRIMARY KEY,
            failure_count INTEGER NOT NULL,
            first_failed_at INTEGER NOT NULL,
            last_failed_at INTEGER NOT NULL,
            locked_until INTEGER,
            captcha_required INTEGER NOT NULL DEFAULT 0
        );
    `);

    database = db;

    if (persistentBucket) {
        try {
            await queuePersistDatabase();
        } catch (error) {
            console.error('Failed to persist user database on init:', error);
        }
    }

    return db;
};

export const addUsername = async (role: UsernameRole, username: string) => {
    const normalized = normalizeUsername(username);
    if (!normalized) {
        throw new Error('Username is required');
    }

    const db = getDatabase();
    await db.run(
        'INSERT OR IGNORE INTO usernames (username, role) VALUES (?, ?)',
        normalized,
        role
    );
    await queuePersistDatabase();
};

export const listUsernames = async (role: UsernameRole) => {
    const db = getDatabase();
    const rows = await db.all<{ username: string }[]>(
        'SELECT username FROM usernames WHERE role = ? ORDER BY username COLLATE NOCASE ASC',
        role
    );

    return rows.map(row => row.username);
};

export const removeUsername = async (role: UsernameRole, username: string) => {
    const normalized = normalizeUsername(username);
    if (!normalized) {
        throw new Error('Username is required');
    }

    const db = getDatabase();
    const result = await db.run(
        'DELETE FROM usernames WHERE role = ? AND username = ?',
        role,
        normalized
    );

    if ((result.changes || 0) > 0) {
        await queuePersistDatabase();
    }

    return (result.changes || 0) > 0;
};

export const createAuthUser = async (
    username: string,
    passwordHash: string,
    recoveryEmail: string,
    name: string,
    email: string,
    phoneNumber?: string
) => {
    const normalizedUsername = normalizeUsername(username);
    const normalizedRecoveryEmail = recoveryEmail.trim().toLowerCase();
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhoneNumber = (phoneNumber || '').trim();

    if (!normalizedUsername || !passwordHash || !normalizedRecoveryEmail || !normalizedName || !normalizedEmail) {
        throw new Error('username, passwordHash, recoveryEmail, name, and email are required');
    }

    const db = getDatabase();
    await db.run(
        'INSERT INTO auth_users (username, password_hash, recovery_email, name, email, phone_number) VALUES (?, ?, ?, ?, ?, ?)',
        normalizedUsername,
        passwordHash,
        normalizedRecoveryEmail,
        normalizedName,
        normalizedEmail,
        normalizedPhoneNumber || null
    );
    await queuePersistDatabase();
};

export const getAuthUserByUsername = async (username: string): Promise<AuthUserRecord | null> => {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) return null;

    const db = getDatabase();
    const row = await db.get<{
        username: string;
        password_hash: string;
        recovery_email: string;
        name: string;
        email: string;
        phone_number: string | null;
    }>(
        'SELECT username, password_hash, recovery_email, name, email, phone_number FROM auth_users WHERE username = ?',
        normalizedUsername
    );

    if (!row) return null;
    return {
        username: row.username,
        passwordHash: row.password_hash,
        recoveryEmail: row.recovery_email,
        name: row.name,
        email: row.email,
        phoneNumber: row.phone_number || undefined,
    };
};

export const listAuthUsernamesByRecoveryEmail = async (recoveryEmail: string): Promise<string[]> => {
    const normalizedRecoveryEmail = recoveryEmail.trim().toLowerCase();
    if (!normalizedRecoveryEmail) return [];

    const db = getDatabase();
    const rows = await db.all<{ username: string }[]>(
        'SELECT username FROM auth_users WHERE recovery_email = ? ORDER BY username COLLATE NOCASE ASC',
        normalizedRecoveryEmail
    );

    return rows.map(row => row.username);
};

export const createPasswordResetToken = async (token: string, username: string, expiresAt: number) => {
    const normalizedUsername = normalizeUsername(username);
    if (!token || !normalizedUsername || !Number.isFinite(expiresAt)) {
        throw new Error('token, username, and expiresAt are required');
    }

    const db = getDatabase();
    await db.run(
        'INSERT INTO password_reset_tokens (token, username, expires_at, used) VALUES (?, ?, ?, 0)',
        token,
        normalizedUsername,
        expiresAt
    );
    await queuePersistDatabase();
};

export const consumePasswordResetToken = async (token: string): Promise<string | null> => {
    if (!token) return null;

    const db = getDatabase();
    const row = await db.get<{ username: string; expires_at: number; used: number }>(
        'SELECT username, expires_at, used FROM password_reset_tokens WHERE token = ?',
        token
    );

    if (!row || row.used || Date.now() > row.expires_at) {
        return null;
    }

    await db.run('UPDATE password_reset_tokens SET used = 1 WHERE token = ?', token);
    await queuePersistDatabase();
    return row.username;
};

export const updateAuthUserPassword = async (username: string, passwordHash: string) => {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername || !passwordHash) {
        throw new Error('username and passwordHash are required');
    }

    const db = getDatabase();
    const result = await db.run(
        'UPDATE auth_users SET password_hash = ? WHERE username = ?',
        passwordHash,
        normalizedUsername
    );

    if ((result.changes || 0) > 0) {
        await queuePersistDatabase();
    }

    return (result.changes || 0) > 0;
};

export const getAuthLoginAttemptState = async (attemptKey: string): Promise<AuthLoginAttemptState | null> => {
    if (!attemptKey) return null;

    const db = getDatabase();
    const row = await db.get<{
        attempt_key: string;
        failure_count: number;
        first_failed_at: number;
        last_failed_at: number;
        locked_until: number | null;
        captcha_required: number;
    }>(
        'SELECT attempt_key, failure_count, first_failed_at, last_failed_at, locked_until, captcha_required FROM auth_login_attempts WHERE attempt_key = ?',
        attemptKey
    );

    if (!row) return null;

    return {
        key: row.attempt_key,
        failureCount: row.failure_count,
        firstFailedAt: row.first_failed_at,
        lastFailedAt: row.last_failed_at,
        lockedUntil: row.locked_until || undefined,
        captchaRequired: Boolean(row.captcha_required),
    };
};

export const clearAuthLoginAttempts = async (attemptKey: string) => {
    if (!attemptKey) return;
    const db = getDatabase();
    const result = await db.run('DELETE FROM auth_login_attempts WHERE attempt_key = ?', attemptKey);
    if ((result.changes || 0) > 0) {
        await queuePersistDatabase();
    }
};

export const recordAuthLoginFailure = async (
    attemptKey: string,
    config: {
        windowMs: number;
        lockThreshold: number;
        lockDurationMs: number;
        captchaThreshold: number;
    }
) => {
    const db = getDatabase();
    const now = Date.now();

    const existing = await getAuthLoginAttemptState(attemptKey);
    if (!existing || (now - existing.firstFailedAt) > config.windowMs) {
        const captchaRequired = config.captchaThreshold <= 1;
        await db.run(
            `INSERT INTO auth_login_attempts (attempt_key, failure_count, first_failed_at, last_failed_at, locked_until, captcha_required)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(attempt_key) DO UPDATE SET
               failure_count=excluded.failure_count,
               first_failed_at=excluded.first_failed_at,
               last_failed_at=excluded.last_failed_at,
               locked_until=excluded.locked_until,
               captcha_required=excluded.captcha_required`,
            attemptKey,
            1,
            now,
            now,
            null,
            captchaRequired ? 1 : 0
        );
        await queuePersistDatabase();
        return getAuthLoginAttemptState(attemptKey);
    }

    const nextFailureCount = existing.failureCount + 1;
    const lockedUntil = nextFailureCount >= config.lockThreshold ? now + config.lockDurationMs : null;
    const captchaRequired = existing.captchaRequired || nextFailureCount >= config.captchaThreshold;

    await db.run(
        'UPDATE auth_login_attempts SET failure_count = ?, last_failed_at = ?, locked_until = ?, captcha_required = ? WHERE attempt_key = ?',
        nextFailureCount,
        now,
        lockedUntil,
        captchaRequired ? 1 : 0,
        attemptKey
    );
    await queuePersistDatabase();

    return getAuthLoginAttemptState(attemptKey);
};

export const getUsernameDatabasePath = () => dbFilePath;
