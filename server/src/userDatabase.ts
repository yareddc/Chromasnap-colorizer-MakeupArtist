import { Pool } from 'pg';

export type UsernameRole = 'subscriber' | 'admin';

export type AuthUserRecord = {
    username: string;
    passwordHash: string;
    recoveryEmail: string;
};

export type AuthLoginAttemptState = {
    key: string;
    failureCount: number;
    firstFailedAt: number;
    lastFailedAt: number;
    lockedUntil?: number;
    captchaRequired: boolean;
};

let database: Pool | null = null;

const normalizeUsername = (username: string) => username.trim();

const getDatabase = () => {
    if (!database) {
        throw new Error('Username database has not been initialized');
    }
    return database;
};

const getDatabaseConnectionConfig = () => {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
        throw new Error('DATABASE_URL is required for PostgreSQL connectivity');
    }

    const sslMode = (process.env.PGSSLMODE || '').trim().toLowerCase();
    const ssl = sslMode === 'require'
        ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined;

    return { connectionString, ssl };
};

const getDatabaseIdentifier = () => {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) return 'postgres://(not-configured)';

    try {
        const parsed = new URL(connectionString);
        const databaseName = parsed.pathname.replace(/^\//, '') || '(default)';
        const port = parsed.port || '5432';
        return `postgres://${parsed.hostname}:${port}/${databaseName}`;
    } catch {
        return 'postgres://(configured)';
    }
};

export const initUsernameDatabase = async () => {
    if (database) return database;

    const db = new Pool(getDatabaseConnectionConfig());

    await db.query(`
        CREATE TABLE IF NOT EXISTS usernames (
            id BIGSERIAL PRIMARY KEY,
            username TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('subscriber', 'admin')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS usernames_unique_role_username_ci
        ON usernames (role, LOWER(username));
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS auth_users (
            id BIGSERIAL PRIMARY KEY,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            recovery_email TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS auth_users_username_ci
        ON auth_users (LOWER(username));
    `);

    await db.query(`
        CREATE INDEX IF NOT EXISTS auth_users_recovery_email_idx
        ON auth_users (LOWER(recovery_email));
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            expires_at BIGINT NOT NULL,
            used BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS auth_login_attempts (
            attempt_key TEXT PRIMARY KEY,
            failure_count INT NOT NULL,
            first_failed_at BIGINT NOT NULL,
            last_failed_at BIGINT NOT NULL,
            locked_until BIGINT,
            captcha_required BOOLEAN NOT NULL DEFAULT FALSE
        );
    `);

    database = db;
    return db;
};

export const addUsername = async (role: UsernameRole, username: string) => {
    const normalized = normalizeUsername(username);
    if (!normalized) {
        throw new Error('Username is required');
    }

    const db = getDatabase();
    await db.query(
        'INSERT INTO usernames (username, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [normalized, role]
    );
};

export const listUsernames = async (role: UsernameRole) => {
    const db = getDatabase();
    const result = await db.query<{ username: string }>(
        'SELECT username FROM usernames WHERE role = $1 ORDER BY LOWER(username) ASC, username ASC',
        [role]
    );

    return result.rows.map(row => row.username);
};

export const removeUsername = async (role: UsernameRole, username: string) => {
    const normalized = normalizeUsername(username);
    if (!normalized) {
        throw new Error('Username is required');
    }

    const db = getDatabase();
    const result = await db.query(
        'DELETE FROM usernames WHERE role = $1 AND LOWER(username) = LOWER($2)',
        [role, normalized]
    );

    return (result.rowCount ?? 0) > 0;
};

export const createAuthUser = async (username: string, passwordHash: string, recoveryEmail: string) => {
    const normalizedUsername = normalizeUsername(username);
    const normalizedRecoveryEmail = recoveryEmail.trim().toLowerCase();
    if (!normalizedUsername || !passwordHash || !normalizedRecoveryEmail) {
        throw new Error('username, passwordHash, and recoveryEmail are required');
    }

    const db = getDatabase();
    await db.query(
        'INSERT INTO auth_users (username, password_hash, recovery_email) VALUES ($1, $2, $3)',
        [normalizedUsername, passwordHash, normalizedRecoveryEmail]
    );
};

export const getAuthUserByUsername = async (username: string): Promise<AuthUserRecord | null> => {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) return null;

    const db = getDatabase();
    const result = await db.query<{
        username: string;
        password_hash: string;
        recovery_email: string;
    }>(
        'SELECT username, password_hash, recovery_email FROM auth_users WHERE LOWER(username) = LOWER($1) LIMIT 1',
        [normalizedUsername]
    );

    const row = result.rows[0];

    if (!row) return null;
    return {
        username: row.username,
        passwordHash: row.password_hash,
        recoveryEmail: row.recovery_email,
    };
};

export const listAuthUsernamesByRecoveryEmail = async (recoveryEmail: string): Promise<string[]> => {
    const normalizedRecoveryEmail = recoveryEmail.trim().toLowerCase();
    if (!normalizedRecoveryEmail) return [];

    const db = getDatabase();
    const result = await db.query<{ username: string }>(
        'SELECT username FROM auth_users WHERE LOWER(recovery_email) = LOWER($1) ORDER BY LOWER(username) ASC, username ASC',
        [normalizedRecoveryEmail]
    );

    return result.rows.map(row => row.username);
};

export const createPasswordResetToken = async (token: string, username: string, expiresAt: number) => {
    const normalizedUsername = normalizeUsername(username);
    if (!token || !normalizedUsername || !Number.isFinite(expiresAt)) {
        throw new Error('token, username, and expiresAt are required');
    }

    const db = getDatabase();
    await db.query(
        'INSERT INTO password_reset_tokens (token, username, expires_at, used) VALUES ($1, $2, $3, FALSE)',
        [token, normalizedUsername, expiresAt]
    );
};

export const consumePasswordResetToken = async (token: string): Promise<string | null> => {
    if (!token) return null;

    const db = getDatabase();
    const result = await db.query<{ username: string }>(
        `UPDATE password_reset_tokens
         SET used = TRUE
         WHERE token = $1 AND used = FALSE AND expires_at >= $2
         RETURNING username`,
        [token, Date.now()]
    );

    return result.rows[0]?.username || null;
};

export const updateAuthUserPassword = async (username: string, passwordHash: string) => {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername || !passwordHash) {
        throw new Error('username and passwordHash are required');
    }

    const db = getDatabase();
    const result = await db.query(
        'UPDATE auth_users SET password_hash = $1 WHERE LOWER(username) = LOWER($2)',
        [passwordHash, normalizedUsername]
    );

    return (result.rowCount ?? 0) > 0;
};

export const getAuthLoginAttemptState = async (attemptKey: string): Promise<AuthLoginAttemptState | null> => {
    if (!attemptKey) return null;

    const db = getDatabase();
    const result = await db.query<{
        attempt_key: string;
        failure_count: number;
        first_failed_at: number;
        last_failed_at: number;
        locked_until: number | null;
        captcha_required: boolean;
    }>(
        'SELECT attempt_key, failure_count, first_failed_at, last_failed_at, locked_until, captcha_required FROM auth_login_attempts WHERE attempt_key = $1 LIMIT 1',
        [attemptKey]
    );

    const row = result.rows[0];

    if (!row) return null;

    return {
        key: row.attempt_key,
        failureCount: row.failure_count,
        firstFailedAt: row.first_failed_at,
        lastFailedAt: row.last_failed_at,
        lockedUntil: row.locked_until || undefined,
        captchaRequired: row.captcha_required,
    };
};

export const clearAuthLoginAttempts = async (attemptKey: string) => {
    if (!attemptKey) return;
    const db = getDatabase();
    await db.query('DELETE FROM auth_login_attempts WHERE attempt_key = $1', [attemptKey]);
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
        await db.query(
            `INSERT INTO auth_login_attempts (attempt_key, failure_count, first_failed_at, last_failed_at, locked_until, captcha_required)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT(attempt_key) DO UPDATE SET
               failure_count=excluded.failure_count,
               first_failed_at=excluded.first_failed_at,
               last_failed_at=excluded.last_failed_at,
               locked_until=excluded.locked_until,
               captcha_required=excluded.captcha_required`,
            [attemptKey, 1, now, now, null, captchaRequired]
        );
        return getAuthLoginAttemptState(attemptKey);
    }

    const nextFailureCount = existing.failureCount + 1;
    const lockedUntil = nextFailureCount >= config.lockThreshold ? now + config.lockDurationMs : null;
    const captchaRequired = existing.captchaRequired || nextFailureCount >= config.captchaThreshold;

    await db.query(
        'UPDATE auth_login_attempts SET failure_count = $1, last_failed_at = $2, locked_until = $3, captcha_required = $4 WHERE attempt_key = $5',
        [nextFailureCount, now, lockedUntil, captchaRequired, attemptKey]
    );

    return getAuthLoginAttemptState(attemptKey);
};

export const getUsernameDatabasePath = () => getDatabaseIdentifier();
