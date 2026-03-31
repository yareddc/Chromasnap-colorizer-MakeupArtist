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

export type SocialAuthProvider = 'google' | 'phone';

export type AuthLoginAttemptState = {
    key: string;
    failureCount: number;
    firstFailedAt: number;
    lastFailedAt: number;
    lockedUntil?: number;
    captchaRequired: boolean;
};

export type BillingTier = 'free' | 'pro' | 'enterprise';

export type BillingAccountRecord = {
    userId: string;
    tier: BillingTier;
    tokenBalance: number;
    monthlyRemainingTopUp: number;
    cycleStartedAt: number;
};

export type BillingUsageEventRecord = {
    id: string;
    userId: string;
    timestamp: number;
    action: string;
    tokens: number;
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

        if (!authUserColumnNames.has('firebase_uid')) {
            await db.exec(`ALTER TABLE auth_users ADD COLUMN firebase_uid TEXT`);
            await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_firebase_uid ON auth_users(firebase_uid) WHERE firebase_uid IS NOT NULL`);
        }

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

    await db.exec(`
        CREATE TABLE IF NOT EXISTS billing_accounts (
            user_id TEXT PRIMARY KEY COLLATE NOCASE,
            tier TEXT NOT NULL CHECK(tier IN ('free', 'pro', 'enterprise')),
            token_balance INTEGER NOT NULL,
            monthly_remaining_top_up INTEGER NOT NULL,
            cycle_started_at INTEGER NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS billing_usage_events (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL COLLATE NOCASE,
            timestamp INTEGER NOT NULL,
            action TEXT NOT NULL,
            tokens INTEGER NOT NULL
        );
    `);

    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_billing_usage_user_timestamp
        ON billing_usage_events(user_id, timestamp DESC);
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS billing_consumed_play_tokens (
            purchase_token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL COLLATE NOCASE,
            product_id TEXT NOT NULL,
            product_type TEXT NOT NULL CHECK(product_type IN ('subs', 'inapp')),
            order_id TEXT,
            purchase_time_millis INTEGER,
            consumed_at INTEGER NOT NULL
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

export const getAuthUserByFirebaseUid = async (firebaseUid: string): Promise<AuthUserRecord | null> => {
    if (!firebaseUid) return null;
    const db = getDatabase();
    const row = await db.get<{
        username: string;
        password_hash: string;
        recovery_email: string;
        name: string;
        email: string;
        phone_number: string | null;
    }>(
        'SELECT username, password_hash, recovery_email, name, email, phone_number FROM auth_users WHERE firebase_uid = ?',
        firebaseUid
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

export const createOrGetFirebaseSocialUser = async (params: {
    firebaseUid: string;
    provider: SocialAuthProvider;
    email?: string;
    name?: string;
    phoneNumber?: string;
}): Promise<AuthUserRecord> => {
    const db = getDatabase();
    const { firebaseUid, provider, email = '', name = '', phoneNumber = '' } = params;

    const existing = await getAuthUserByFirebaseUid(firebaseUid);
    if (existing) return existing;

    const baseUsername = email
        ? email.replace(/@.*$/, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20)
        : `${provider}_${firebaseUid.slice(0, 10)}`;

    let username = baseUsername;
    let suffix = 1;
    while (await getAuthUserByUsername(username)) {
        username = `${baseUsername}_${suffix++}`;
    }

    const resolvedName = name.trim() || username;
    const resolvedEmail = email.trim().toLowerCase() || `${firebaseUid}@social.chromasnap.internal`;
    const resolvedPhone = phoneNumber.trim() || undefined;

    const { randomUUID } = await import('crypto');
    const bcryptModule = await import('bcryptjs');
    const hashFn = (bcryptModule as any).hash || (bcryptModule as any).default?.hash;
    if (typeof hashFn !== 'function') {
        throw new Error('bcrypt hash function is unavailable in runtime module format.');
    }
    const unusablePasswordHash = await hashFn(randomUUID(), 12);

    await db.run(
        `INSERT INTO auth_users
            (username, password_hash, recovery_email, name, email, phone_number, firebase_uid)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        username,
        unusablePasswordHash,
        resolvedEmail,
        resolvedName,
        resolvedEmail,
        resolvedPhone || null,
        firebaseUid
    );
    await addUsername('subscriber', username);
    await queuePersistDatabase();

    return (await getAuthUserByUsername(username))!;
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

export const deleteAuthUserAndBillingData = async (username: string): Promise<boolean> => {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
        throw new Error('username is required');
    }

    const db = getDatabase();
    const attemptKeyPrefix = `${normalizedUsername.toLowerCase()}::%`;
    let authUserDeleted = false;

    await db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
        const authUserDeleteResult = await db.run(
            'DELETE FROM auth_users WHERE username = ?',
            normalizedUsername
        );
        authUserDeleted = (authUserDeleteResult.changes || 0) > 0;

        await db.run('DELETE FROM usernames WHERE username = ?', normalizedUsername);
        await db.run('DELETE FROM billing_accounts WHERE user_id = ?', normalizedUsername);
        await db.run('DELETE FROM billing_usage_events WHERE user_id = ?', normalizedUsername);
        await db.run('DELETE FROM billing_consumed_play_tokens WHERE user_id = ?', normalizedUsername);
        await db.run('DELETE FROM password_reset_tokens WHERE username = ?', normalizedUsername);
        await db.run('DELETE FROM auth_login_attempts WHERE attempt_key LIKE ?', attemptKeyPrefix);

        await db.exec('COMMIT');
    } catch (error) {
        await db.exec('ROLLBACK');
        throw error;
    }

    await queuePersistDatabase();
    return authUserDeleted;
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

const mapBillingAccountRow = (row: {
    user_id: string;
    tier: BillingTier;
    token_balance: number;
    monthly_remaining_top_up: number;
    cycle_started_at: number;
}): BillingAccountRecord => ({
    userId: row.user_id,
    tier: row.tier,
    tokenBalance: Number(row.token_balance || 0),
    monthlyRemainingTopUp: Number(row.monthly_remaining_top_up || 0),
    cycleStartedAt: Number(row.cycle_started_at || 0),
});

export const getBillingAccountByUserId = async (userId: string): Promise<BillingAccountRecord | null> => {
    const normalizedUserId = normalizeUsername(userId);
    if (!normalizedUserId) return null;

    const db = getDatabase();
    const row = await db.get<{
        user_id: string;
        tier: BillingTier;
        token_balance: number;
        monthly_remaining_top_up: number;
        cycle_started_at: number;
    }>(
        `SELECT user_id, tier, token_balance, monthly_remaining_top_up, cycle_started_at
         FROM billing_accounts WHERE user_id = ?`,
        normalizedUserId
    );

    if (!row) return null;
    return mapBillingAccountRow(row);
};

export const upsertBillingAccount = async (account: BillingAccountRecord) => {
    const normalizedUserId = normalizeUsername(account.userId);
    if (!normalizedUserId) {
        throw new Error('Billing userId is required');
    }

    const db = getDatabase();
    await db.run(
        `INSERT INTO billing_accounts (user_id, tier, token_balance, monthly_remaining_top_up, cycle_started_at, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
            tier=excluded.tier,
            token_balance=excluded.token_balance,
            monthly_remaining_top_up=excluded.monthly_remaining_top_up,
            cycle_started_at=excluded.cycle_started_at,
            updated_at=CURRENT_TIMESTAMP`,
        normalizedUserId,
        account.tier,
        Math.floor(account.tokenBalance),
        Math.floor(account.monthlyRemainingTopUp),
        Math.floor(account.cycleStartedAt)
    );
    await queuePersistDatabase();
};

export const listBillingUsageEvents = async (userId: string, limit: number = 200): Promise<BillingUsageEventRecord[]> => {
    const normalizedUserId = normalizeUsername(userId);
    if (!normalizedUserId) return [];

    const db = getDatabase();
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 200;
    const rows = await db.all<{
        id: string;
        user_id: string;
        timestamp: number;
        action: string;
        tokens: number;
    }[]>(
        `SELECT id, user_id, timestamp, action, tokens
         FROM billing_usage_events
         WHERE user_id = ?
         ORDER BY timestamp DESC
         LIMIT ?`,
        normalizedUserId,
        normalizedLimit
    );

    return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        timestamp: Number(row.timestamp || 0),
        action: row.action,
        tokens: Number(row.tokens || 0),
    }));
};

export const addBillingUsageEvent = async (event: BillingUsageEventRecord) => {
    const normalizedUserId = normalizeUsername(event.userId);
    if (!event.id || !normalizedUserId) {
        throw new Error('Billing usage event id and userId are required');
    }

    const db = getDatabase();
    await db.run(
        'INSERT INTO billing_usage_events (id, user_id, timestamp, action, tokens) VALUES (?, ?, ?, ?, ?)',
        event.id,
        normalizedUserId,
        Math.floor(event.timestamp),
        event.action,
        Math.floor(event.tokens)
    );

    await db.run(
        `DELETE FROM billing_usage_events
         WHERE user_id = ?
           AND id NOT IN (
             SELECT id FROM billing_usage_events
             WHERE user_id = ?
             ORDER BY timestamp DESC
             LIMIT 200
           )`,
        normalizedUserId,
        normalizedUserId
    );

    await queuePersistDatabase();
};

export const markGooglePlayTokenConsumed = async (payload: {
    purchaseToken: string;
    userId: string;
    productId: string;
    productType: 'subs' | 'inapp';
    orderId?: string;
    purchaseTimeMillis?: number;
}) => {
    const purchaseToken = String(payload.purchaseToken || '').trim();
    const userId = normalizeUsername(payload.userId);
    const productId = String(payload.productId || '').trim();
    const productType = payload.productType;

    if (!purchaseToken || !userId || !productId || (productType !== 'subs' && productType !== 'inapp')) {
        throw new Error('purchaseToken, userId, productId, and a valid productType are required');
    }

    const db = getDatabase();
    const result = await db.run(
        `INSERT OR IGNORE INTO billing_consumed_play_tokens
         (purchase_token, user_id, product_id, product_type, order_id, purchase_time_millis, consumed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        purchaseToken,
        userId,
        productId,
        productType,
        payload.orderId || null,
        Number.isFinite(payload.purchaseTimeMillis) ? Math.floor(payload.purchaseTimeMillis as number) : null,
        Date.now()
    );

    if ((result.changes || 0) > 0) {
        await queuePersistDatabase();
        return true;
    }

    return false;
};
