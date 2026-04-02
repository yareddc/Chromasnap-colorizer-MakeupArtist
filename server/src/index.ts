import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs, { existsSync } from 'fs';
import path from 'path';
import { randomUUID, timingSafeEqual } from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import {
    addUsername,
    addBillingUsageEvent,
    clearAuthLoginAttempts,
    createAuthUser,
    createOrGetFirebaseSocialUser,
    deleteAuthUserAndBillingData,
    createPasswordResetToken,
    consumePasswordResetToken,
    getBillingAccountByUserId,
    getAuthLoginAttemptState,
    getAuthUserByUsername,
    getUsernameDatabasePath,
    initUsernameDatabase,
    listAuthUsernamesByRecoveryEmail,
    listBillingUsageEvents,
    listUsernames,
    markGooglePlayTokenConsumed,
    recordAuthLoginFailure,
    removeUsername,
    upsertBillingAccount,
    updateAuthUserPassword,
} from './userDatabase';
import type { App as FirebaseAdminApp } from 'firebase-admin/app';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

type SubscriptionTier = 'free' | 'pro' | 'enterprise';

type PlanConfig = {
    id: SubscriptionTier;
    name: string;
    monthlyTokens: number;
    maxTopUpPerMonth: number;
};

type UserAccount = {
    userId: string;
    tier: SubscriptionTier;
    tokenBalance: number;
    monthlyRemainingTopUp: number;
    cycleStartedAt: number;
};

// Firebase Admin (lazy - only initialized when FIREBASE_PROJECT_ID is set)
let _firebaseAdminApp: FirebaseAdminApp | null = null;

const getFirebaseAdmin = async (): Promise<import('firebase-admin/auth').Auth> => {
    if (!_firebaseAdminApp) {
        const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID || '').trim();
        if (!projectId) {
            throw new Error('FIREBASE_PROJECT_ID (or GCP_PROJECT_ID) is not configured on the server.');
        }
        const { initializeApp, cert, getApps } = await import('firebase-admin/app');
        const { getAuth } = await import('firebase-admin/auth');
        const existingApps = getApps();
        if (existingApps.length) {
            _firebaseAdminApp = existingApps[0];
        } else {
            const credentialJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
            if (credentialJson) {
                const serviceAccount = JSON.parse(credentialJson);
                _firebaseAdminApp = initializeApp({ credential: cert(serviceAccount), projectId });
            } else {
                // Fall back to Application Default Credentials (works on Cloud Run automatically)
                _firebaseAdminApp = initializeApp({ projectId });
            }
        }
        return getAuth(_firebaseAdminApp);
    }
    const { getAuth } = await import('firebase-admin/auth');
    return getAuth(_firebaseAdminApp);
};

const PLAN_CONFIG: Record<SubscriptionTier, PlanConfig> = {
    free: {
        id: 'free',
        name: 'Free',
        monthlyTokens: 50,
        maxTopUpPerMonth: 100,
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        monthlyTokens: 1000,
        maxTopUpPerMonth: 5000,
    },
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        monthlyTokens: 10000,
        maxTopUpPerMonth: 50000,
    },
};

const ACTION_TOKEN_COST: Record<string, number> = {
    colorize: 8,
    upscale: 5,
    vibrancy: 2,
    sharpen: 2,
    animate_start: 20,
};

const BILLING_HEADER = 'x-user-id';
const CLIENT_PLATFORM_HEADER = 'x-client-platform';
const ADMIN_API_KEY_HEADER = 'x-admin-api-key';
const AUTH_HEADER = 'authorization';
const AUTH_TOKEN_LIFETIME = '7d';
const isProduction = process.env.NODE_ENV === 'production';
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'chromasnap_auth';
const AUTH_COOKIE_SAME_SITE = (process.env.AUTH_COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax')) as 'lax' | 'strict' | 'none';

const JWT_SECRET = process.env.JWT_SECRET || (!isProduction ? process.env.ADMIN_API_KEY || 'dev-only-secret-change-me' : '');

if (isProduction && !JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured in production');
}

const isPlaceholderLikeSecret = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return true;

    const weakMarkers = [
        'change-me',
        'replace',
        'your_',
        'your-',
        'example',
        'test',
        'password',
        'secret',
        'dev-only-secret-change-me',
        'dev-captcha-ok',
        'succ-prob',
    ];

    return weakMarkers.some((marker) => normalized.includes(marker));
};

const looksLikeGoogleApiKey = (value: string) => /^AIza[0-9A-Za-z\-_]{20,}$/.test(value.trim());

const validateProductionSecret = (name: string, value: string | undefined, minLength: number) => {
    const rawValue = (value || '').trim();
    if (!rawValue) {
        throw new Error(`${name} must be configured in production`);
    }
    if (rawValue.length < minLength) {
        throw new Error(`${name} must be at least ${minLength} characters in production`);
    }
    if (isPlaceholderLikeSecret(rawValue)) {
        throw new Error(`${name} appears to be a placeholder or weak value in production`);
    }
};

if (isProduction) {
    validateProductionSecret('JWT_SECRET', process.env.JWT_SECRET, 32);
    validateProductionSecret('ADMIN_API_KEY', process.env.ADMIN_API_KEY, 24);

    const adminUiToggleEnabled = process.env.REACT_APP_ENABLE_ADMIN_PAGE === 'true'
        || process.env.VITE_ENABLE_ADMIN_PAGE === 'true'
        || process.env.ENABLE_ADMIN_PAGE === 'true';

    if (adminUiToggleEnabled) {
        throw new Error('Admin UI toggle env vars are not allowed in production');
    }

    if (looksLikeGoogleApiKey(process.env.JWT_SECRET || '')) {
        throw new Error('JWT_SECRET cannot be a Google API key in production');
    }

    if (looksLikeGoogleApiKey(process.env.ADMIN_API_KEY || '')) {
        throw new Error('ADMIN_API_KEY cannot be a Google API key in production');
    }
}

const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_THRESHOLD = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;
const CAPTCHA_TRIGGER_THRESHOLD = 3;
const CAPTCHA_BYPASS_TOKEN = process.env.CAPTCHA_BYPASS_TOKEN || 'dev-captcha-ok';
const CAPTCHA_VERIFY_URL = process.env.CAPTCHA_VERIFY_URL || 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CAPTCHA_SECRET_KEY = process.env.CAPTCHA_SECRET_KEY || '';
const PASSWORD_RESET_WEBHOOK_URL = (process.env.PASSWORD_RESET_WEBHOOK_URL || '').trim();
const PASSWORD_RESET_WEBHOOK_TIMEOUT_MS = Number.parseInt(process.env.PASSWORD_RESET_WEBHOOK_TIMEOUT_MS || '10000', 10) || 10000;
const PASSWORD_RESET_WEBHOOK_SHARED_SECRET = (process.env.PASSWORD_RESET_WEBHOOK_SHARED_SECRET || '').trim();

const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
const ENFORCE_GOOGLE_PLAY_FOR_ANDROID = isProduction || process.env.ENFORCE_GOOGLE_PLAY_FOR_ANDROID === 'true';
const DISABLE_DIRECT_BILLING_MUTATIONS = isProduction || process.env.DISABLE_DIRECT_BILLING_MUTATIONS === 'true';
const PLAY_PACKAGE_NAME = (process.env.PLAY_PACKAGE_NAME || process.env.ANDROID_APPLICATION_ID || 'com.chromasnap.app').trim();
const PLAY_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

const playSubscriptionProductToTier: Record<string, SubscriptionTier> = {
    [process.env.PLAY_PRODUCT_SUBSCRIPTION_PRO || 'chromasnap_pro']: 'pro',
    [process.env.PLAY_PRODUCT_SUBSCRIPTION_ENTERPRISE || 'chromasnap_enterprise']: 'enterprise',
};

const playTopupProductToTokens: Record<string, number> = {
    [process.env.PLAY_PRODUCT_TOPUP_100 || 'chromasnap_topup_100']: 100,
    [process.env.PLAY_PRODUCT_TOPUP_500 || 'chromasnap_topup_500']: 500,
    [process.env.PLAY_PRODUCT_TOPUP_1000 || 'chromasnap_topup_1000']: 1000,
};

type GooglePlayProductType = 'subs' | 'inapp';

const isAndroidClient = (req: express.Request) => {
    const platformHeader = (req.header(CLIENT_PLATFORM_HEADER) || req.header(CLIENT_PLATFORM_HEADER.toUpperCase()) || '').toLowerCase();
    if (platformHeader === 'android') return true;

    const userAgent = String(req.header('user-agent') || '').toLowerCase();
    return userAgent.includes('android');
};

const playAuth = new GoogleAuth({ scopes: [PLAY_PUBLISHER_SCOPE] });

const getPlayAccessToken = async () => {
    const client = await playAuth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse?.token || '';
    if (!token) throw new Error('Failed to obtain Google Play access token');
    return token;
};

const callGooglePlayApi = async (url: string, init?: { method?: string; body?: any }) => {
    const token = await getPlayAccessToken();
    const response = await fetch(url, {
        method: init?.method || 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.error?.message || data?.message || 'Google Play API request failed';
        throw new Error(message);
    }

    return data;
};

const verifyGooglePlayPurchase = async (productType: GooglePlayProductType, productId: string, purchaseToken: string) => {
    const packageName = encodeURIComponent(PLAY_PACKAGE_NAME);
    const encodedProductId = encodeURIComponent(productId);
    const encodedToken = encodeURIComponent(purchaseToken);

    if (productType === 'subs') {
        const subscriptionUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${encodedProductId}/tokens/${encodedToken}`;
        const data = await callGooglePlayApi(subscriptionUrl);

        const expiryMs = Number(data.expiryTimeMillis || 0);
        const isExpired = Number.isFinite(expiryMs) && expiryMs > 0 ? expiryMs <= Date.now() : false;
        if (isExpired) {
            throw new Error('Google Play subscription is expired');
        }

        if (Number(data.cancelReason || 0) !== 0) {
            throw new Error('Google Play subscription is canceled');
        }

        if (Number(data.acknowledgementState || 0) === 0) {
            const ackUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${encodedProductId}/tokens/${encodedToken}:acknowledge`;
            await callGooglePlayApi(ackUrl, {
                method: 'POST',
                body: { developerPayload: 'chromasnap-server' },
            });
        }

        return {
            orderId: String(data.orderId || ''),
            purchaseTimeMillis: Number(data.startTimeMillis || 0),
        };
    }

    const inAppUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${encodedProductId}/tokens/${encodedToken}`;
    const data = await callGooglePlayApi(inAppUrl);
    if (Number(data.purchaseState || 1) !== 0) {
        throw new Error('Google Play in-app product is not purchased');
    }

    if (Number(data.acknowledgementState || 0) === 0) {
        const ackUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${encodedProductId}/tokens/${encodedToken}:acknowledge`;
        await callGooglePlayApi(ackUrl, {
            method: 'POST',
            body: { developerPayload: 'chromasnap-server' },
        });
    }

    return {
        orderId: String(data.orderId || ''),
        purchaseTimeMillis: Number(data.purchaseTimeMillis || 0),
    };
};

const resetCycleIfNeeded = async (account: UserAccount) => {
    if (Date.now() - account.cycleStartedAt >= thirtyDaysMs) {
        const plan = PLAN_CONFIG[account.tier];
        account.cycleStartedAt = Date.now();
        account.tokenBalance = plan.monthlyTokens;
        account.monthlyRemainingTopUp = plan.maxTopUpPerMonth;
        await upsertBillingAccount({
            userId: account.userId,
            tier: account.tier,
            tokenBalance: account.tokenBalance,
            monthlyRemainingTopUp: account.monthlyRemainingTopUp,
            cycleStartedAt: account.cycleStartedAt,
        });
    }
};

const getUserIdFromRequest = (req: express.Request) => {
    const authUserId = (req as BillingRequest).authUser?.username?.trim();
    if (authUserId) return authUserId;

    const allowHeaderBillingId = process.env.ALLOW_HEADER_BILLING_ID === 'true' || !isProduction;
    if (!allowHeaderBillingId) return '';

    const rawHeader = req.header(BILLING_HEADER) || req.header(BILLING_HEADER.toUpperCase());
    const userId = (rawHeader || '').trim();
    return userId.length > 0 ? userId : '';
};

const getOrCreateUserAccount = async (userId: string): Promise<UserAccount> => {
    const existing = await getBillingAccountByUserId(userId);
    if (existing) {
        const account: UserAccount = {
            userId: existing.userId,
            tier: existing.tier,
            tokenBalance: existing.tokenBalance,
            monthlyRemainingTopUp: existing.monthlyRemainingTopUp,
            cycleStartedAt: existing.cycleStartedAt,
        };
        await resetCycleIfNeeded(account);
        return account;
    }

    const plan = PLAN_CONFIG.free;
    const created: UserAccount = {
        userId,
        tier: 'free',
        tokenBalance: plan.monthlyTokens,
        monthlyRemainingTopUp: plan.maxTopUpPerMonth,
        cycleStartedAt: Date.now(),
    };
    await upsertBillingAccount({
        userId: created.userId,
        tier: created.tier,
        tokenBalance: created.tokenBalance,
        monthlyRemainingTopUp: created.monthlyRemainingTopUp,
        cycleStartedAt: created.cycleStartedAt,
    });
    void addUsername('subscriber', userId).catch((error) => {
        console.error('Failed to persist subscriber username:', error);
    });

    return created;
};

const chargeTokens = async (account: UserAccount, action: string, cost: number) => {
    await resetCycleIfNeeded(account);
    if (account.tokenBalance < cost) {
        const error: any = new Error('Insufficient tokens');
        error.statusCode = 402;
        error.details = {
            required: cost,
            available: account.tokenBalance,
            action,
            tier: account.tier,
        };
        throw error;
    }

    account.tokenBalance -= cost;
    await upsertBillingAccount({
        userId: account.userId,
        tier: account.tier,
        tokenBalance: account.tokenBalance,
        monthlyRemainingTopUp: account.monthlyRemainingTopUp,
        cycleStartedAt: account.cycleStartedAt,
    });
    await addBillingUsageEvent({
        id: randomUUID(),
        userId: account.userId,
        timestamp: Date.now(),
        action,
        tokens: cost,
    });
};

const publicAccountView = (account: UserAccount) => ({
    userId: account.userId,
    tier: account.tier,
    tokenBalance: account.tokenBalance,
    monthlyRemainingTopUp: account.monthlyRemainingTopUp,
    cycleStartedAt: new Date(account.cycleStartedAt).toISOString(),
    cycleEndsAt: new Date(account.cycleStartedAt + thirtyDaysMs).toISOString(),
});

const handleBillingError = (res: express.Response, error: any) => {
    if (error?.statusCode) {
        res.status(error.statusCode).json({
            error: error.message || 'Billing error',
            details: error.details,
        });
        return true;
    }
    return false;
};

type BillingRequest = express.Request & {
    billingUserId?: string;
    authUser?: {
        username: string;
    };
};

const getAccountUsage = async (account: UserAccount) => {
    const usage = await listBillingUsageEvents(account.userId, 200);
    return usage
        .filter((item) => item.timestamp >= account.cycleStartedAt)
        .map((item) => ({
            id: item.id,
            timestamp: item.timestamp,
            action: item.action,
            tokens: item.tokens,
        }));
};

const sanitizeUsername = (username: string) => username.trim();

const sanitizeEmail = (email: string) => email.trim().toLowerCase();

const validateEmailFormat = (email: string) => {
    const normalizedEmail = sanitizeEmail(email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return emailRegex.test(normalizedEmail);
};

const sanitizePhoneNumber = (phoneNumber: string) => phoneNumber.trim();

const validatePhoneNumber = (phoneNumber: string) => {
    const normalizedPhone = sanitizePhoneNumber(phoneNumber);
    if (!normalizedPhone) return true;
    return /^\+?[0-9()\-\s]{7,20}$/.test(normalizedPhone);
};

const validatePasswordStrength = (password: string) => {
    if (!password || password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must include letters and numbers';
    return null;
};

const signAuthToken = (username: string) => jwt.sign({ sub: username }, JWT_SECRET, { expiresIn: AUTH_TOKEN_LIFETIME });

const setAuthCookie = (res: express.Response, token: string) => {
    res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: AUTH_COOKIE_SAME_SITE,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
    });
};

const clearAuthCookie = (res: express.Response) => {
    res.clearCookie(AUTH_COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction,
        sameSite: AUTH_COOKIE_SAME_SITE,
        path: '/',
    });
};

const getCookieValue = (cookieHeader: string | undefined, cookieName: string): string | null => {
    if (!cookieHeader) return null;
    const pieces = cookieHeader.split(';');
    for (const piece of pieces) {
        const [name, ...valueParts] = piece.trim().split('=');
        if (name !== cookieName) continue;
        const rawValue = valueParts.join('=');
        if (!rawValue) return null;
        try {
            return decodeURIComponent(rawValue);
        } catch {
            return rawValue;
        }
    }
    return null;
};

const attachAuthUser = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const rawAuth = req.header(AUTH_HEADER) || '';
    const bearerToken = rawAuth.startsWith('Bearer ') ? rawAuth.slice(7).trim() : '';
    const cookieToken = getCookieValue(req.header('cookie') || undefined, AUTH_COOKIE_NAME) || '';
    const token = bearerToken || cookieToken;

    if (!token) return next();

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        const username = String(decoded.sub || '').trim();
        if (username) {
            (req as BillingRequest).authUser = { username };
        }
    } catch {
        // Requests without a valid auth token can still access public endpoints.
    }

    next();
};

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authUser = (req as BillingRequest).authUser;
    if (!authUser) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

const getClientIp = (req: express.Request) => req.ip || req.socket.remoteAddress || 'unknown-ip';

const getLoginAttemptKey = (req: express.Request, username: string) => {
    return `${username.toLowerCase()}::${getClientIp(req)}`;
};

const registerFailedLoginAttempt = async (key: string) => {
    return recordAuthLoginFailure(key, {
        windowMs: LOGIN_LOCK_WINDOW_MS,
        lockThreshold: LOGIN_LOCK_THRESHOLD,
        lockDurationMs: LOGIN_LOCK_DURATION_MS,
        captchaThreshold: CAPTCHA_TRIGGER_THRESHOLD,
    });
};

const verifyCaptchaToken = async (captchaToken: string | undefined, clientIp?: string) => {
    const token = (captchaToken || '').trim();
    if (!token) return false;

    if (!CAPTCHA_SECRET_KEY) {
        return process.env.NODE_ENV !== 'production' && token === CAPTCHA_BYPASS_TOKEN;
    }

    try {
        const body = new URLSearchParams();
        body.set('secret', CAPTCHA_SECRET_KEY);
        body.set('response', token);
        if (clientIp) body.set('remoteip', clientIp);

        const response = await fetch(CAPTCHA_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        const parsed = await response.json().catch(() => ({}));
        return Boolean(parsed.success);
    } catch {
        return false;
    }
};

const authWriteLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth requests. Please try again shortly.' },
});

const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again shortly.' },
});

const adminLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many admin requests. Please try again shortly.' },
});

const genericRecoveryMessage = 'If the account details are valid, recovery instructions have been sent.';

const dispatchPasswordReset = async (payload: {
    username: string;
    recoveryEmail: string;
    resetToken: string;
    expiresAt: number;
}) => {
    if (!isProduction) return;

    if (!PASSWORD_RESET_WEBHOOK_URL) {
        throw new Error('PASSWORD_RESET_WEBHOOK_URL is required in production for password reset delivery');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PASSWORD_RESET_WEBHOOK_TIMEOUT_MS);

    try {
        const response = await fetch(PASSWORD_RESET_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(PASSWORD_RESET_WEBHOOK_SHARED_SECRET
                    ? { 'x-reset-webhook-secret': PASSWORD_RESET_WEBHOOK_SHARED_SECRET }
                    : {}),
            },
            signal: controller.signal,
            body: JSON.stringify({
                event: 'password_reset_requested',
                username: payload.username,
                recoveryEmail: payload.recoveryEmail,
                resetToken: payload.resetToken,
                expiresAt: payload.expiresAt,
                generatedAt: Date.now(),
            }),
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Password reset delivery webhook failed (${response.status})${body ? `: ${body.slice(0, 200)}` : ''}`);
        }
    } finally {
        clearTimeout(timeoutId);
    }
};

const checkLoginLock = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { username } = req.body as { username?: string };
    const normalizedUsername = sanitizeUsername(username || '');
    if (!normalizedUsername) return next();

    const key = getLoginAttemptKey(req, normalizedUsername);
    const state = await getAuthLoginAttemptState(key);
    const now = Date.now();

    if (state?.lockedUntil && state.lockedUntil > now) {
        const retryAfterSeconds = Math.ceil((state.lockedUntil - now) / 1000);
        return res.status(429).json({
            error: 'Too many failed login attempts. Try again later.',
            retryAfterSeconds,
            captchaRequired: state.captchaRequired,
        });
    }

    if (state?.captchaRequired) {
        const { captchaToken } = req.body as { captchaToken?: string };
        const captchaValid = await verifyCaptchaToken(captchaToken, getClientIp(req));
        if (!captchaValid) {
            return res.status(403).json({
                error: 'Captcha verification is required.',
                captchaRequired: true,
                captchaProviderConfigured: Boolean(CAPTCHA_SECRET_KEY),
            });
        }
    }

    next();
};

const attachBillingAccount = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const userId = getUserIdFromRequest(req);
    const billingReq = req as BillingRequest;
    if (!userId) {
        billingReq.billingUserId = undefined;
        return next();
    }

    billingReq.billingUserId = userId;
    next();
};

const requireBilling = (action: keyof typeof ACTION_TOKEN_COST) => (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    (async () => {
        const billingReq = req as BillingRequest;
        const userId = billingReq.authUser?.username?.trim() || billingReq.billingUserId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const account = await getOrCreateUserAccount(userId);
        const cost = ACTION_TOKEN_COST[action] ?? 1;
        await chargeTokens(account, action, cost);
        billingReq.billingUserId = userId;
        next();
    })().catch((error: any) => {
        if (handleBillingError(res, error)) return;
        next(error);
    });
};

type AnimationJob = {
    status: 'pending' | 'done' | 'error';
    createdAt: number;
    videoUrl?: string;
    error?: string;
    userId: string;
};

const animationJobs = new Map<string, AnimationJob>();

const configuredCorsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const canonicalWebOrigins = ['https://chromasnap.app', 'https://www.chromasnap.app'];

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }

        if (canonicalWebOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        if (configuredCorsOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        if (!isProduction && configuredCorsOrigins.length === 0) {
            callback(null, true);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', BILLING_HEADER, ADMIN_API_KEY_HEADER, CLIENT_PLATFORM_HEADER],
    credentials: true,
    optionsSuccessStatus: 204,
};

const processingLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many image processing requests. Please try again shortly.' },
});

const cspDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();
cspDirectives['script-src'] = ["'self'", 'https://cdn.tailwindcss.com'];
cspDirectives['media-src'] = ["'self'", 'blob:'];

// Middleware
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: cspDirectives,
        },
    })
);
app.use(cors(corsOptions));
app.use(express.json({ limit: '20mb' }));

app.use((req, res, next) => {
    const host = (req.headers.host || '').toLowerCase();
    if (host === 'www.chromasnap.app') {
        return res.redirect(308, `https://chromasnap.app${req.originalUrl || '/'}`);
    }
    next();
});

app.use(attachAuthUser);
app.use(attachBillingAccount);
app.use('/api/analyze', processingLimiter);
app.use('/api/process', processingLimiter);
app.use('/api/colorize', processingLimiter);

/**
 * AI Client Factory
 * Configures either Vertex AI (Service Account) or Google AI Studio (API Key)
 */
const createAI = () => {
    if (process.env.GCP_PROJECT_ID && process.env.GCP_LOCATION) {
        return new GoogleGenAI({
            vertexai: true,
            project: process.env.GCP_PROJECT_ID,
            location: process.env.GCP_LOCATION,
        });
    }
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
};

const getCloudAccessToken = async (): Promise<string | undefined> => {
    try {
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        const client = await auth.getClient();
        const at = await client.getAccessToken();
        return typeof at === 'string' ? at : at?.token || undefined;
    } catch {
        return undefined;
    }
};

const normalizeAnimationImage = async (base64Data: string) => {
    const inputBuffer = Buffer.from(base64Data, 'base64');
    const inputSharp = sharp(inputBuffer).rotate();
    const meta = await inputSharp.metadata();

    if (!meta.width || !meta.height) {
        throw new Error('Invalid image data: unable to read image dimensions');
    }

    let transformed = inputSharp;
    if (meta.width < 256 || meta.height < 256) {
        transformed = transformed.resize({
            width: Math.max(meta.width, 256),
            height: Math.max(meta.height, 256),
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 1 }
        });
    } else {
        transformed = transformed.resize({
            width: 1280,
            height: 1280,
            fit: 'inside',
            withoutEnlargement: true
        });
    }

    const normalizedBuffer = await transformed.png().toBuffer();
    return {
        imageBytes: normalizedBuffer.toString('base64'),
        mimeType: 'image/png'
    };
};

const normalizeImageToPngBase64 = async (image: string): Promise<string> => {
    const hasPrefix = typeof image === 'string' && image.includes(',');
    const base64Data = hasPrefix ? image.split(',')[1] : image;

    const inputBuffer = Buffer.from(base64Data, 'base64');
    const normalizedBuffer = await sharp(inputBuffer)
        .rotate()
        .png()
        .toBuffer();

    return normalizedBuffer.toString('base64');
};

const extractVideoUriFromOperation = (operation: any): string | undefined => {
    const candidates = [
        operation?.response?.generatedVideos?.[0]?.video?.uri,
        operation?.response?.generatedVideos?.[0]?.video,
        operation?.response?.generatedVideos?.[0]?.uri,
        operation?.response?.videos?.[0]?.video?.uri,
        operation?.response?.videos?.[0]?.video,
        operation?.response?.videos?.[0]?.uri,
        operation?.generatedVideos?.[0]?.video?.uri,
        operation?.generatedVideos?.[0]?.video,
        operation?.generatedVideos?.[0]?.uri,
        operation?.result?.generatedVideos?.[0]?.video?.uri,
        operation?.result?.generatedVideos?.[0]?.video,
        operation?.result?.generatedVideos?.[0]?.uri,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.length > 0) return candidate;
    }

    const visited = new Set<any>();
    const stack: any[] = [operation?.response, operation?.result, operation];
    while (stack.length) {
        const current = stack.pop();
        if (!current || typeof current !== 'object' || visited.has(current)) continue;
        visited.add(current);

        for (const [key, value] of Object.entries(current)) {
            if (typeof value === 'string' && (key.toLowerCase().includes('uri') || key.toLowerCase().includes('url'))) {
                if (/^(https?:\/\/|gs:\/\/)/i.test(value)) {
                    return value;
                }
            }
            if (value && typeof value === 'object') {
                stack.push(value);
            }
        }
    }

    return undefined;
};

const getAnimationModelCandidates = () => {
    const configured = (process.env.VIDEO_MODEL_CANDIDATES || '')
        .split(',')
        .map(model => model.trim())
        .filter(Boolean);

    if (configured.length > 0) return configured;

    const hasVertexConfig = Boolean(process.env.GCP_PROJECT_ID && process.env.GCP_LOCATION);

    if (hasVertexConfig) {
        return [
            'veo-3.1-fast-generate-preview',
            'veo-3.1-generate-preview',
            'veo-3.0-fast-generate-001',
            'veo-3.0-generate-001',
            'veo-2.0-generate-001',
        ];
    }

    return [
        'veo-3.1-fast-preview',
        'veo-3.1-standard-preview',
        'veo-2.0-generate-001',
    ];
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const animationPollIntervalMs = parsePositiveInt(process.env.ANIMATION_POLL_INTERVAL_MS, 3000);
const animationMaxWaitMsPerModel = parsePositiveInt(process.env.ANIMATION_MAX_WAIT_MS_PER_MODEL, 180000);
const animationMaxTotalWaitMs = parsePositiveInt(process.env.ANIMATION_MAX_TOTAL_WAIT_MS, 300000);

const extractUriFromObject = (input: any): string | undefined => {
    if (!input || typeof input !== 'object') return undefined;

    const visited = new Set<any>();
    const stack: any[] = [input];

    while (stack.length) {
        const current = stack.pop();
        if (!current || typeof current !== 'object' || visited.has(current)) continue;
        visited.add(current);

        for (const [key, value] of Object.entries(current)) {
            if (typeof value === 'string' && (key.toLowerCase().includes('uri') || key.toLowerCase().includes('url'))) {
                if (/^(https?:\/\/|gs:\/\/)/i.test(value)) {
                    return value;
                }
            }
            if (value && typeof value === 'object') {
                stack.push(value);
            }
        }
    }

    return undefined;
};

const generateVeo31VideoUri = async (model: string, base64Data: string, mimeType: string): Promise<string> => {
    const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!geminiApiKey) {
        throw new Error(`${model}: GEMINI_API_KEY is required for Gemini inlineData flow`);
    }

    const geminiClient = new GoogleGenAI({ apiKey: geminiApiKey });
    const response = await geminiClient.models.generateContent({
        model,
        contents: [{
            parts: [{
                inlineData: { data: base64Data, mimeType }
            }]
        }],
    });

    const directUri = (response as any)?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (typeof directUri === 'string' && directUri.length > 0) {
        return directUri;
    }

    const discovered = extractUriFromObject(response);
    if (discovered) {
        return discovered;
    }

    throw new Error(`${model}: no video URI returned`);
};

const generateVeoVertexVideoUri = async (model: string, base64Data: string, mimeType: string): Promise<string> => {
    if (!process.env.GCP_PROJECT_ID || !process.env.GCP_LOCATION) {
        throw new Error(`${model}: GCP_PROJECT_ID and GCP_LOCATION are required for Vertex predict flow`);
    }

    const token = await getCloudAccessToken();
    if (!token) {
        throw new Error(`${model}: unable to obtain cloud access token`);
    }

    const endpoint = `https://${process.env.GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION}/publishers/google/models/${model}:predictLongRunning`;
    const body = {
        instances: [{
            prompt: 'Animate this exact image. Keep subject identity/background/details consistent. Add subtle natural motion only. High-definition, photorealistic.',
            image: {
                bytesBase64Encoded: base64Data,
                mimeType,
            }
        }],
        parameters: {
            aspectRatio: '16:9',
            resolution: '720p',
        }
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const responseText = await response.text();
    if (!response.ok) {
        throw new Error(`${model}: predictLongRunning failed (${response.status}) ${responseText.slice(0, 300)}`);
    }

    let operation: any = null;
    try {
        operation = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new Error(`${model}: predictLongRunning returned non-JSON response`);
    }

    const operationName = operation?.name;
    if (!operationName || typeof operationName !== 'string') {
        throw new Error(`${model}: predictLongRunning did not return operation name`);
    }

    const fetchOperationEndpoint = `https://${process.env.GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION}/publishers/google/models/${model}:fetchPredictOperation`;
    const modelStartTime = Date.now();

    while (!operation?.done && (Date.now() - modelStartTime) < animationMaxWaitMsPerModel) {
        await new Promise(resolve => setTimeout(resolve, animationPollIntervalMs));
        const opResponse = await fetch(fetchOperationEndpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ operationName }),
        });

        const opText = await opResponse.text();
        if (!opResponse.ok) {
            throw new Error(`${model}: fetchPredictOperation failed (${opResponse.status}) ${opText.slice(0, 300)}`);
        }

        try {
            operation = opText ? JSON.parse(opText) : operation;
        } catch {
            throw new Error(`${model}: operation poll returned non-JSON response`);
        }
    }

    if (!operation?.done) {
        throw new Error(`${model}: timed out after ${Math.round(animationMaxWaitMsPerModel / 1000)}s waiting for completion`);
    }

    const operationError = operation?.error?.message || operation?.error?.status;
    if (operationError) {
        throw new Error(`${model}: ${operationError}`);
    }

    // Try to extract URI first (for newer API versions)
    const directUri =
        operation?.response?.generatedVideos?.[0]?.video?.uri ||
        operation?.response?.generatedVideos?.[0]?.videoUri ||
        operation?.response?.generatedVideos?.[0]?.uri ||
        operation?.response?.videos?.[0]?.video?.uri ||
        operation?.response?.videos?.[0]?.videoUri ||
        operation?.response?.videos?.[0]?.uri;

    if (typeof directUri === 'string' && directUri.length > 0) {
        return directUri;
    }

    // If no URI found, check for base64-encoded video bytes
    const base64Video = operation?.response?.videos?.[0]?.bytesBase64Encoded;
    if (typeof base64Video === 'string' && base64Video.length > 0) {
        // Generate a unique filename for this video
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 9);
        const videoFileName = `video_${timestamp}_${randomId}.mp4`;
        const videoPath = path.resolve(process.cwd(), 'public', videoFileName);

        // Ensure the public directory exists
        const publicDir = path.resolve(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }

        // Decode and save the video
        const videoBuffer = Buffer.from(base64Video, 'base64');
        fs.writeFileSync(videoPath, videoBuffer);

        // Return same-origin path so frontend CSP default-src 'self' permits playback.
        return `/videos/${videoFileName}`;
    }

    const discovered = extractUriFromObject(operation);
    if (discovered) {
        return discovered;
    }

    console.warn(`${model}: Operation completed but no video URI found. Response structure:`, JSON.stringify({
        operationName: operation?.name,
        done: operation?.done,
        responseKeys: Object.keys(operation?.response || {}),
        responseKeysDeep: operation?.response ? Object.keys(operation.response).map(k => `${k}:${typeof operation.response[k]}`) : [],
        fullResponse: JSON.stringify(operation?.response || {}).slice(0, 500)
    }, null, 2));

    throw new Error(`${model}: no video URI returned`);

};

const generateAnimationVideoUri = async (base64Data: string, mimeType: string): Promise<string> => {
    const normalized = await normalizeAnimationImage(base64Data);
    const modelCandidates = getAnimationModelCandidates();
    const errors: string[] = [];
    const totalStartTime = Date.now();

    for (const model of modelCandidates) {
        if ((Date.now() - totalStartTime) >= animationMaxTotalWaitMs) {
            errors.push(`global timeout reached after ${Math.round(animationMaxTotalWaitMs / 1000)}s`);
            break;
        }

        try {
            if (model === 'veo-2.0-generate-001' || /veo-3\.1-.*-001/.test(model) || /veo-3\.1-.*-preview/.test(model) || /veo-3\.0-.*/.test(model)) {
                const uri = await generateVeoVertexVideoUri(model, normalized.imageBytes, normalized.mimeType);
                if (uri) return uri;
            } else if (model.startsWith('veo-3.1')) {
                const uri = await generateVeo31VideoUri(model, normalized.imageBytes, normalized.mimeType);
                if (uri) return uri;
            } else {
                const ai = createAI();
                let operation = await ai.models.generateVideos({
                    model,
                    prompt: 'Animate this exact image. Keep subject identity/background/details consistent. Add subtle natural motion only. High-definition, photorealistic.',
                    image: {
                        imageBytes: normalized.imageBytes,
                        mimeType: normalized.mimeType,
                    },
                    config: { numberOfVideos: 1 }
                });

                const modelStartTime = Date.now();
                while (!operation.done && (Date.now() - modelStartTime) < animationMaxWaitMsPerModel) {
                    await new Promise(resolve => setTimeout(resolve, animationPollIntervalMs));
                    operation = await (ai.operations as any).getVideosOperation({ operation });
                }

                if (!operation.done) {
                    errors.push(
                        `${model}: timed out after ${Math.round(animationMaxWaitMsPerModel / 1000)}s waiting for completion`
                    );
                    continue;
                }

                const opErr = (operation as any)?.error?.message || (operation as any)?.response?.error?.message;
                const videoUri = extractVideoUriFromOperation(operation);
                if (videoUri) return videoUri;

                const responseShape = {
                    operationName: (operation as any)?.name,
                    done: (operation as any)?.done,
                    hasResponse: Boolean((operation as any)?.response),
                    responseKeys: Object.keys((operation as any)?.response || {}),
                    generatedVideosCount: ((operation as any)?.response?.generatedVideos || []).length,
                    videosCount: ((operation as any)?.response?.videos || []).length,
                    raiMediaFilteredCount: (operation as any)?.response?.raiMediaFilteredCount ?? null,
                    error: opErr || null,
                };
                console.warn(`Video operation completed without URI for model ${model}:`, JSON.stringify(responseShape));

                errors.push(`${model}: ${opErr || 'no video URI returned'}`);


            }
        } catch (error: any) {
            errors.push(`${model}: ${error?.message || String(error)}`);
        }
    }

    throw new Error(`Video generation failed. ${errors.join(' | ')}`);
};

/**
 * Colorization Core Logic
 * Prioritizes Imagen 3 Capability for structure-locked editing.
 * Failsafe: Gemini 2.5 Flash Image for robust multimodal editing.
 */
const callColorizationAPI = async (base64Image: string) => {
    if (!process.env.GCP_PROJECT_ID || !process.env.GCP_LOCATION) {
        throw new Error('GCP_PROJECT_ID and GCP_LOCATION are required for Vertex colorization');
    }

    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const at = await client.getAccessToken();
    const token = typeof at === 'string' ? at : at?.token;

    const postPredict = async (model: string, body: any) => {
        const url = `https://${process.env.GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION}/publishers/google/models/${model}:predict`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        const text = await response.text();
        let parsed: any = {};
        try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
        return { response, parsed, rawText: text, model };
    };

    // 1. PRIMARY ATTEMPT: Imagen 3 Capability (Structure-Preserving Colorization)
    const capabilityBody = {
        instances: [{
            prompt: 'Colorize this photo naturally. Maintain 100% original texture and subject detail.',
            referenceImages: [{
                referenceId: 1,
                referenceType: 'REFERENCE_TYPE_RAW',
                image: {
                    bytesBase64Encoded: base64Image,
                    mimeType: 'image/png'
                }
            }]
        }],
        parameters: {
            sampleCount: 1,
            editConfig: {
                editMode: 'EDIT_MODE_INPAINT_INSERTION',
                guidanceScale: 70 // High guidance prevents random generations
            }
        }
    };

    const capabilityResult = await postPredict('imagen-3.0-capability-001', capabilityBody);
    if (capabilityResult.response.ok) return capabilityResult;

    // 2. FAILSAFE ATTEMPT: Gemini 2.5 Flash Image (Multimodal "Vision-to-Vision")
    // Replaces the random-generating fallback with a model that respects input pixels.
    console.log('Imagen capability failed, falling back to Gemini 2.5 Flash Image...');
    const ai = createAI();
    const geminiResult = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{
            role: 'user',
            parts: [
                { inlineData: { data: base64Image, mimeType: 'image/png' } },
                { text: "INSTRUCTION: Colorize this specific B&W photo. Do not change the subjects. Preserve 100% structural consistency." }
            ]
        }],
        config: {
            responseModalities: ["IMAGE"], // Correct camelCase property
            temperature: 0.3
        }
    });

    return geminiResult;
};

const runColorization = async (image: string): Promise<string> => {
    const normalizedPngBase64 = await normalizeImageToPngBase64(image);
    const result = await callColorizationAPI(normalizedPngBase64);

    if ((result as any).candidates) {
        const part = (result as any).candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        const data = part?.inlineData?.data;
        if (!data) throw new Error('No image returned from Gemini response');
        return `data:image/png;base64,${data}`;
    }

    const imgBase64 = (result as any).parsed?.predictions?.[0]?.bytesBase64Encoded;
    if (!imgBase64) throw new Error('No image returned from AI');
    return `data:image/png;base64,${imgBase64}`;
};

// --- Endpoints ---

app.post('/api/auth/register', authWriteLimiter, async (req, res) => {
    try {
        const { username, password, recoveryEmail, email, name, phoneNumber } = req.body as {
            username?: string;
            password?: string;
            recoveryEmail?: string;
            email?: string;
            name?: string;
            phoneNumber?: string;
        };

        const normalizedUsername = sanitizeUsername(username || '');
        const normalizedEmail = sanitizeEmail(email || recoveryEmail || '');
        const normalizedRecoveryEmail = normalizedEmail;
        const normalizedName = (name || '').trim();
        const normalizedPhoneNumber = sanitizePhoneNumber(phoneNumber || '');

        if (!normalizedUsername || normalizedUsername.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }

        const passwordError = validatePasswordStrength(password || '');
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }

        if (!normalizedRecoveryEmail || !normalizedRecoveryEmail.includes('@')) {
            return res.status(400).json({ error: 'Valid email is required' });
        }

        if (!validateEmailFormat(normalizedEmail)) {
            return res.status(400).json({ error: 'Email format is invalid' });
        }

        if (!normalizedName || normalizedName.length < 2) {
            return res.status(400).json({ error: 'Name must be at least 2 characters' });
        }

        if (!validatePhoneNumber(normalizedPhoneNumber)) {
            return res.status(400).json({ error: 'Phone number format is invalid' });
        }

        const existing = await getAuthUserByUsername(normalizedUsername);
        if (existing) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const passwordHash = await bcrypt.hash(password as string, 12);
        await createAuthUser(
            normalizedUsername,
            passwordHash,
            normalizedRecoveryEmail,
            normalizedName,
            normalizedEmail,
            normalizedPhoneNumber || undefined
        );
        await addUsername('subscriber', normalizedUsername);

        const token = signAuthToken(normalizedUsername);
        setAuthCookie(res, token);
        const account = await getOrCreateUserAccount(normalizedUsername);

        res.status(201).json({
            token,
            user: {
                username: normalizedUsername,
                name: normalizedName,
                email: normalizedEmail,
                phoneNumber: normalizedPhoneNumber || null,
            },
            account: publicAccountView(account),
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to register user' });
    }
});

app.post('/api/auth/login', loginLimiter, checkLoginLock, async (req, res) => {
    try {
        const { username, password } = req.body as { username?: string; password?: string };
        const normalizedUsername = sanitizeUsername(username || '');
        const attemptKey = normalizedUsername ? getLoginAttemptKey(req, normalizedUsername) : null;

        if (!normalizedUsername || !password) {
            return res.status(400).json({ error: 'username and password are required' });
        }

        const authUser = await getAuthUserByUsername(normalizedUsername);
        if (!authUser) {
            if (attemptKey) {
                const state = await registerFailedLoginAttempt(attemptKey);
                return res.status(401).json({
                    error: 'Invalid username or password',
                    captchaRequired: state?.captchaRequired || false,
                });
            }
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const validPassword = await bcrypt.compare(password, authUser.passwordHash);
        if (!validPassword) {
            if (attemptKey) {
                const state = await registerFailedLoginAttempt(attemptKey);
                return res.status(401).json({
                    error: 'Invalid username or password',
                    captchaRequired: state?.captchaRequired || false,
                });
            }
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        if (attemptKey) await clearAuthLoginAttempts(attemptKey);

        const token = signAuthToken(authUser.username);
        setAuthCookie(res, token);
        const account = await getOrCreateUserAccount(authUser.username);

        res.json({
            token,
            user: {
                username: authUser.username,
                name: authUser.name,
                email: authUser.email,
                phoneNumber: authUser.phoneNumber || null,
            },
            account: publicAccountView(account),
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Login failed' });
    }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
    const authUser = (req as BillingRequest).authUser!;
    const userRecord = await getAuthUserByUsername(authUser.username);
    if (!userRecord) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = signAuthToken(userRecord.username);
    setAuthCookie(res, token);

    res.json({
        token,
        user: {
            username: userRecord.username,
            name: userRecord.name,
            email: userRecord.email,
            phoneNumber: userRecord.phoneNumber || null,
        }
    });
});

app.post('/api/auth/logout', (_req, res) => {
    clearAuthCookie(res);
    res.status(204).send();
});

app.delete('/api/auth/account', requireAuth, authWriteLimiter, async (req, res) => {
    try {
        const authUser = (req as BillingRequest).authUser!;
        const { password, confirmUsername } = req.body as {
            password?: string;
            confirmUsername?: string;
        };

        const userRecord = await getAuthUserByUsername(authUser.username);
        if (!userRecord) {
            return res.status(404).json({ error: 'Account not found' });
        }

        if (!password) {
            return res.status(400).json({ error: 'password is required' });
        }

        const validPassword = await bcrypt.compare(password, userRecord.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const normalizedConfirmUsername = sanitizeUsername(confirmUsername || '');
        if (normalizedConfirmUsername && normalizedConfirmUsername !== userRecord.username) {
            return res.status(400).json({ error: 'confirmUsername does not match current account username' });
        }

        const deleted = await deleteAuthUserAndBillingData(userRecord.username);
        clearAuthCookie(res);

        if (!deleted) {
            return res.status(404).json({ error: 'Account not found' });
        }

        return res.status(204).send();
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Failed to delete account' });
    }
});


app.post('/api/auth/social-login', authWriteLimiter, async (req, res) => {
    try {
        const { idToken, provider } = req.body as { idToken?: string; provider?: string };

        if (!idToken || !idToken.trim()) {
            return res.status(400).json({ error: 'idToken is required' });
        }
        if (provider !== 'google' && provider !== 'phone') {
            return res.status(400).json({ error: 'provider must be "google" or "phone"' });
        }

        const adminAuth = await getFirebaseAdmin();
        let decodedToken: import('firebase-admin/auth').DecodedIdToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken.trim());
        } catch {
            return res.status(401).json({ error: 'Invalid or expired social login token' });
        }

        const { uid, email, name, phone_number: phoneNumber } = decodedToken;

        const userRecord = await createOrGetFirebaseSocialUser({
            firebaseUid: uid,
            provider: provider as 'google' | 'phone',
            email: email || '',
            name: (name as string | undefined) || '',
            phoneNumber: (phoneNumber as string | undefined) || '',
        });

        const token = signAuthToken(userRecord.username);
        setAuthCookie(res, token);
        const account = await getOrCreateUserAccount(userRecord.username);

        return res.json({
            token,
            user: {
                username: userRecord.username,
                name: userRecord.name,
                email: userRecord.email,
                phoneNumber: userRecord.phoneNumber || null,
            },
            account: publicAccountView(account),
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Social login failed' });
    }
});
app.post('/api/auth/recover/username', authWriteLimiter, async (req, res) => {
    try {
        const { recoveryEmail } = req.body as { recoveryEmail?: string };
        const normalizedRecoveryEmail = (recoveryEmail || '').trim().toLowerCase();

        if (!validateEmailFormat(normalizedRecoveryEmail)) {
            return res.status(400).json({ error: 'Valid recoveryEmail is required' });
        }

        const usernames = await listAuthUsernamesByRecoveryEmail(normalizedRecoveryEmail);

        if (isProduction) {
            return res.json({
                usernames: [],
                message: genericRecoveryMessage,
            });
        }

        res.json({
            usernames,
            message: usernames.length
                ? 'Usernames recovered successfully'
                : 'No usernames found for this recovery email',
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Username recovery failed' });
    }
});

app.post('/api/auth/recover/password/request', authWriteLimiter, async (req, res) => {
    try {
        const { username, recoveryEmail } = req.body as { username?: string; recoveryEmail?: string };
        const normalizedUsername = sanitizeUsername(username || '');
        const normalizedRecoveryEmail = (recoveryEmail || '').trim().toLowerCase();

        if (!normalizedUsername || !normalizedRecoveryEmail) {
            return res.status(400).json({ error: 'username and recoveryEmail are required' });
        }

        if (!validateEmailFormat(normalizedRecoveryEmail)) {
            return res.status(400).json({ error: 'Valid recoveryEmail is required' });
        }

        if (isProduction && !PASSWORD_RESET_WEBHOOK_URL) {
            return res.status(503).json({ error: 'Password reset delivery is not configured' });
        }

        const authUser = await getAuthUserByUsername(normalizedUsername);
        const hasMatchingAccount = Boolean(authUser && authUser.recoveryEmail === normalizedRecoveryEmail);

        if (!hasMatchingAccount) {
            return res.json({ message: genericRecoveryMessage });
        }

        const resetToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
        const expiresAt = Date.now() + 15 * 60 * 1000;
        await createPasswordResetToken(resetToken, authUser!.username, expiresAt);
        await dispatchPasswordReset({
            username: authUser!.username,
            recoveryEmail: authUser!.recoveryEmail,
            resetToken,
            expiresAt,
        });

        res.json({
            message: genericRecoveryMessage,
            resetToken: isProduction ? undefined : resetToken,
            expiresAt,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Password reset request failed' });
    }
});

app.post('/api/auth/recover/password/confirm', authWriteLimiter, async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body as { resetToken?: string; newPassword?: string };
        if (!resetToken) {
            return res.status(400).json({ error: 'resetToken is required' });
        }

        const passwordError = validatePasswordStrength(newPassword || '');
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }

        const username = await consumePasswordResetToken(resetToken);
        if (!username) {
            return res.status(400).json({ error: 'Reset token is invalid or expired' });
        }

        const newPasswordHash = await bcrypt.hash(newPassword as string, 12);
        const updated = await updateAuthUserPassword(username, newPasswordHash);
        if (!updated) {
            return res.status(404).json({ error: 'User not found for this token' });
        }

        res.json({ message: 'Password reset successful' });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Password reset failed' });
    }
});

// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        service: 'chromasnap-server',
        vertexConfigured: Boolean(process.env.GCP_PROJECT_ID),
        timestamp: new Date().toISOString()
    });
});

app.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true });
});

app.get('/api/healthz', (_req, res) => {
    res.status(200).json({ ok: true });
});

app.get('/api/subscription/plans', (_req, res) => {
    res.json({ plans: Object.values(PLAN_CONFIG) });
});

app.post('/api/billing/google-play/verify', requireAuth, async (req, res) => {
    try {
        const { productType, productId, purchaseToken } = req.body as {
            productType?: GooglePlayProductType;
            productId?: string;
            purchaseToken?: string;
        };

        if (productType !== 'subs' && productType !== 'inapp') {
            return res.status(400).json({ error: 'productType must be subs or inapp' });
        }

        const normalizedProductId = String(productId || '').trim();
        const normalizedToken = String(purchaseToken || '').trim();
        if (!normalizedProductId || !normalizedToken) {
            return res.status(400).json({ error: 'productId and purchaseToken are required' });
        }

        if (productType === 'subs') {
            const tier = playSubscriptionProductToTier[normalizedProductId];
            if (!tier) {
                return res.status(400).json({ error: 'Unmapped Google Play subscription productId' });
            }
        } else {
            const topUpTokens = playTopupProductToTokens[normalizedProductId];
            if (!topUpTokens || topUpTokens <= 0) {
                return res.status(400).json({ error: 'Unmapped Google Play top-up productId' });
            }

            const userId = (req as BillingRequest).authUser!.username;
            const account = await getOrCreateUserAccount(userId);

            if (topUpTokens > account.monthlyRemainingTopUp) {
                return res.status(400).json({
                    error: 'Top-up limit exceeded for current billing cycle',
                    remaining: account.monthlyRemainingTopUp,
                });
            }
        }

        const verification = await verifyGooglePlayPurchase(productType, normalizedProductId, normalizedToken);
        const userId = (req as BillingRequest).authUser!.username;
        const account = await getOrCreateUserAccount(userId);

        const marked = await markGooglePlayTokenConsumed({
            purchaseToken: normalizedToken,
            userId: account.userId,
            productId: normalizedProductId,
            productType,
            orderId: verification.orderId,
            purchaseTimeMillis: verification.purchaseTimeMillis,
        });
        if (!marked) {
            return res.status(409).json({ error: 'Purchase token already processed' });
        }

        if (productType === 'subs') {
            const tier = playSubscriptionProductToTier[normalizedProductId] as SubscriptionTier;
            const plan = PLAN_CONFIG[tier];
            account.tier = tier;
            account.tokenBalance = plan.monthlyTokens;
            account.monthlyRemainingTopUp = plan.maxTopUpPerMonth;
            account.cycleStartedAt = Date.now();
            await upsertBillingAccount({
                userId: account.userId,
                tier: account.tier,
                tokenBalance: account.tokenBalance,
                monthlyRemainingTopUp: account.monthlyRemainingTopUp,
                cycleStartedAt: account.cycleStartedAt,
            });
        } else {
            const topUpTokens = playTopupProductToTokens[normalizedProductId] as number;

            account.tokenBalance += topUpTokens;
            account.monthlyRemainingTopUp -= topUpTokens;
            await upsertBillingAccount({
                userId: account.userId,
                tier: account.tier,
                tokenBalance: account.tokenBalance,
                monthlyRemainingTopUp: account.monthlyRemainingTopUp,
                cycleStartedAt: account.cycleStartedAt,
            });
            await addBillingUsageEvent({
                id: randomUUID(),
                userId: account.userId,
                timestamp: Date.now(),
                action: 'play_topup',
                tokens: topUpTokens,
            });
        }

        res.json({
            account: publicAccountView(account),
            verification: {
                orderId: verification.orderId,
                purchaseTimeMillis: verification.purchaseTimeMillis,
                productId: normalizedProductId,
                productType,
            },
        });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Google Play purchase verification failed' });
    }
});

app.get('/api/subscription/me', requireAuth, async (req, res) => {
    const userId = (req as BillingRequest).authUser!.username;
    const account = await getOrCreateUserAccount(userId);
    res.json({ account: publicAccountView(account) });
});

app.post('/api/subscription/subscribe', requireAuth, async (req, res) => {
    try {
        if (DISABLE_DIRECT_BILLING_MUTATIONS) {
            return res.status(409).json({
                error: 'Direct subscription changes are disabled in production. Complete payment via Google Play purchase flow and /api/billing/google-play/verify.',
            });
        }

        if (ENFORCE_GOOGLE_PLAY_FOR_ANDROID && isAndroidClient(req)) {
            return res.status(409).json({
                error: 'Direct subscription changes are disabled on Android. Use Google Play Billing purchase flow and /api/billing/google-play/verify.',
            });
        }

        const { tier } = req.body as { tier?: SubscriptionTier };
        if (!tier || !PLAN_CONFIG[tier]) {
            return res.status(400).json({ error: 'Valid tier is required (free, pro, enterprise)' });
        }

        const userId = (req as BillingRequest).authUser!.username;
        const account = await getOrCreateUserAccount(userId);
        const plan = PLAN_CONFIG[tier];

        account.tier = tier;
        account.tokenBalance = plan.monthlyTokens;
        account.monthlyRemainingTopUp = plan.maxTopUpPerMonth;
        account.cycleStartedAt = Date.now();
        await upsertBillingAccount({
            userId: account.userId,
            tier: account.tier,
            tokenBalance: account.tokenBalance,
            monthlyRemainingTopUp: account.monthlyRemainingTopUp,
            cycleStartedAt: account.cycleStartedAt,
        });

        res.json({ account: publicAccountView(account), message: `Subscribed to ${plan.name}` });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to change subscription' });
    }
});

app.post('/api/subscription/topup', requireAuth, async (req, res) => {
    try {
        if (DISABLE_DIRECT_BILLING_MUTATIONS) {
            return res.status(409).json({
                error: 'Direct token top-up is disabled in production. Complete payment via Google Play purchase flow and /api/billing/google-play/verify.',
            });
        }

        if (ENFORCE_GOOGLE_PLAY_FOR_ANDROID && isAndroidClient(req)) {
            return res.status(409).json({
                error: 'Direct token top-up is disabled on Android. Use Google Play Billing purchase flow and /api/billing/google-play/verify.',
            });
        }

        const { tokens } = req.body as { tokens?: number };
        const topUp = Number(tokens);
        if (!Number.isFinite(topUp) || topUp <= 0) {
            return res.status(400).json({ error: 'tokens must be a positive number' });
        }

        const userId = (req as BillingRequest).authUser!.username;
        const account = await getOrCreateUserAccount(userId);

        if (topUp > account.monthlyRemainingTopUp) {
            return res.status(400).json({
                error: 'Top-up limit exceeded for current billing cycle',
                remaining: account.monthlyRemainingTopUp,
            });
        }

        account.tokenBalance += Math.floor(topUp);
        account.monthlyRemainingTopUp -= Math.floor(topUp);
        await upsertBillingAccount({
            userId: account.userId,
            tier: account.tier,
            tokenBalance: account.tokenBalance,
            monthlyRemainingTopUp: account.monthlyRemainingTopUp,
            cycleStartedAt: account.cycleStartedAt,
        });
        await addBillingUsageEvent({
            id: randomUUID(),
            userId: account.userId,
            timestamp: Date.now(),
            action: 'manual_topup',
            tokens: Math.floor(topUp),
        });

        res.json({ account: publicAccountView(account) });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to top up tokens' });
    }
});

app.get('/api/subscription/usage', requireAuth, async (req, res) => {
    const userId = (req as BillingRequest).authUser!.username;
    const account = await getOrCreateUserAccount(userId);
    const usage = await getAccountUsage(account);
    res.json({
        account: publicAccountView(account),
        usage,
    });
});

const safeConstantTimeCompare = (a: string, b: string) => {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
};

const requireAdminAccess = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const expectedAdminApiKey = process.env.ADMIN_API_KEY;
    if (!expectedAdminApiKey) {
        return res.status(500).json({ error: 'ADMIN_API_KEY is not configured on the server' });
    }

    const providedApiKey = req.header(ADMIN_API_KEY_HEADER) || req.header(ADMIN_API_KEY_HEADER.toUpperCase());
    if (!providedApiKey || !safeConstantTimeCompare(providedApiKey, expectedAdminApiKey)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    next();
};

app.get('/api/admin/usernames', adminLimiter, requireAdminAccess, async (_req, res) => {
    try {
        const [subscribers, admins] = await Promise.all([
            listUsernames('subscriber'),
            listUsernames('admin'),
        ]);

        res.json({ subscribers, admins });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to load usernames' });
    }
});

app.post('/api/admin/usernames/admins', adminLimiter, requireAdminAccess, async (req, res) => {
    try {
        const { username } = req.body as { username?: string };
        if (!username || !username.trim()) {
            return res.status(400).json({ error: 'username is required' });
        }

        await addUsername('admin', username);
        const admins = await listUsernames('admin');
        res.json({ admins });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to store admin username' });
    }
});

app.delete('/api/admin/usernames/:role/:username', adminLimiter, requireAdminAccess, async (req, res) => {
    try {
        const roleParam = req.params.role;
        const role = roleParam === 'admins'
            ? 'admin'
            : roleParam === 'subscribers'
                ? 'subscriber'
                : null;

        if (!role) {
            return res.status(400).json({ error: 'role must be admins or subscribers' });
        }

        const decodedUsername = decodeURIComponent(req.params.username || '').trim();
        if (!decodedUsername) {
            return res.status(400).json({ error: 'username is required' });
        }

        const removed = await removeUsername(role, decodedUsername);
        const [subscribers, admins] = await Promise.all([
            listUsernames('subscriber'),
            listUsernames('admin'),
        ]);

        res.json({ removed, username: decodedUsername, subscribers, admins });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to delete username' });
    }
});

// Compatibility analysis endpoint used by frontend
app.post('/api/analyze/monochromatic', async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data required' });

        const ai = createAI();
        const base64Data = await normalizeImageToPngBase64(image);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { data: base64Data, mimeType: 'image/png' } },
                    { text: 'Is this image black and white (monochromatic)? Respond strictly in JSON with key isMonochromatic.' }
                ]
            }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { isMonochromatic: { type: Type.BOOLEAN } },
                    required: ['isMonochromatic']
                }
            }
        });

        const anyResp = response as any;
        const text = typeof anyResp.text === 'function'
            ? (anyResp.text()?.trim() || '{}')
            : (response as any).candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        const parsed = JSON.parse(text);
        res.json({ isMonochromatic: Boolean(parsed.isMonochromatic) });
    } catch (error: any) {
        console.error('Monochromatic check failed:', error);
        res.status(500).json({ error: error.message || 'Analysis failed' });
    }
});

// Compatibility safety endpoint used by frontend
app.post('/api/analyze/safety', async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data required' });

        const ai = createAI();
        const base64Data = await normalizeImageToPngBase64(image);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { data: base64Data, mimeType: 'image/png' } },
                    { text: 'Check this image for nudity/sexually explicit content and minors. Return JSON: isSafe(boolean), containsMinors(boolean), reason(string).' }
                ]
            }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isSafe: { type: Type.BOOLEAN },
                        containsMinors: { type: Type.BOOLEAN },
                        reason: { type: Type.STRING }
                    },
                    required: ['isSafe', 'containsMinors', 'reason']
                }
            }
        });

        const anyResp = response as any;
        const text = typeof anyResp.text === 'function'
            ? (anyResp.text()?.trim() || '{"isSafe":true,"containsMinors":false,"reason":""}')
            : (response as any).candidates?.[0]?.content?.parts?.[0]?.text || '{"isSafe":true,"containsMinors":false,"reason":""}';

        const parsed = JSON.parse(text);
        res.json({
            isSafe: Boolean(parsed.isSafe),
            containsMinors: Boolean(parsed.containsMinors),
            reason: String(parsed.reason || '')
        });
    } catch (error: any) {
        console.error('Safety check failed:', error);
        res.status(500).json({ error: error.message || 'Safety check failed' });
    }
});

// Main Colorization Endpoint
app.post('/api/colorize', requireBilling('colorize'), async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data required' });
        const dataUrl = await runColorization(image);
        res.json({ image: dataUrl });
    } catch (error: any) {
        console.error("Colorization failed:", error);
        res.status(500).json({ error: error.message || 'Colorization failed' });
    }
});

// Frontend-compatible processing route
app.post('/api/process/colorize', requireBilling('colorize'), async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data required' });
        const dataUrl = await runColorization(image);
        res.json({ result: dataUrl });
    } catch (error: any) {
        console.error('Colorization failed:', error);
        res.status(500).json({ error: error.message || 'Colorization failed' });
    }
});

app.post('/api/process/upscale', requireBilling('upscale'), async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data required' });

        const hasPrefix = typeof image === 'string' && image.includes(',');
        const base64Data = hasPrefix ? image.split(',')[1] : image;
        const mimeType = hasPrefix
            ? image.split(';')[0].split(':')[1] || 'image/png'
            : 'image/png';

        const inputBuffer = Buffer.from(base64Data, 'base64');
        const metadata = await sharp(inputBuffer).metadata();
        if (!metadata.width || !metadata.height) {
            return res.status(400).json({ error: 'Invalid image data' });
        }

        const upscaleFactor = 2;
        const maxDimension = 4096;
        const targetWidth = Math.min(Math.round(metadata.width * upscaleFactor), maxDimension);
        const targetHeight = Math.min(Math.round(metadata.height * upscaleFactor), maxDimension);

        let pipeline = sharp(inputBuffer)
            .resize({
                width: targetWidth,
                height: targetHeight,
                fit: 'inside',
                kernel: sharp.kernel.lanczos3,
                withoutEnlargement: false,
            })
            .sharpen({ sigma: 1.1, m1: 1, m2: 2 });

        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
            pipeline = pipeline.jpeg({ quality: 92 });
        } else if (mimeType === 'image/webp') {
            pipeline = pipeline.webp({ quality: 92 });
        } else {
            pipeline = pipeline.png();
        }

        const outputBuffer = await pipeline.toBuffer();
        const resultBase64 = outputBuffer.toString('base64');
        res.json({ result: `data:${mimeType};base64,${resultBase64}` });
    } catch (error: any) {
        console.error('Upscaling failed:', error);
        res.status(500).json({ error: error.message || 'Upscaling failed' });
    }
});

app.post('/api/process/vibrancy', requireBilling('vibrancy'), async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data required' });

        const hasPrefix = typeof image === 'string' && image.includes(',');
        const base64Data = hasPrefix ? image.split(',')[1] : image;
        const mimeType = hasPrefix
            ? image.split(';')[0].split(':')[1] || 'image/png'
            : 'image/png';

        const inputBuffer = Buffer.from(base64Data, 'base64');
        const outputBuffer = await sharp(inputBuffer)
            .modulate({ saturation: 1.5 })
            .toBuffer();

        const resultBase64 = outputBuffer.toString('base64');
        res.json({ result: `data:${mimeType};base64,${resultBase64}` });
    } catch (error: any) {
        console.error('Vibrancy enhancement failed:', error);
        res.status(500).json({ error: error.message || 'Vibrancy failed' });
    }
});

app.post('/api/process/sharpen', requireBilling('sharpen'), async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data required' });

        const hasPrefix = typeof image === 'string' && image.includes(',');
        const base64Data = hasPrefix ? image.split(',')[1] : image;
        const mimeType = hasPrefix
            ? image.split(';')[0].split(':')[1] || 'image/png'
            : 'image/png';

        const inputBuffer = Buffer.from(base64Data, 'base64');
        const outputBuffer = await sharp(inputBuffer)
            .sharpen()
            .toBuffer();

        const resultBase64 = outputBuffer.toString('base64');
        res.json({ result: `data:${mimeType};base64,${resultBase64}` });
    } catch (error: any) {
        console.error('Sharpening failed:', error);
        res.status(500).json({ error: error.message || 'Sharpening failed' });
    }
});

app.post('/api/process/animate/start', requireBilling('animate_start'), async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data required' });

        const userId = getUserIdFromRequest(req);

        const hasPrefix = typeof image === 'string' && image.includes(',');
        const base64Data = hasPrefix ? image.split(',')[1] : image;
        const mimeType = hasPrefix ? (image.split(';')[0].split(':')[1] || 'image/png') : 'image/png';

        const jobId = randomUUID();
        animationJobs.set(jobId, { status: 'pending', createdAt: Date.now(), userId });

        void (async () => {
            try {
                const videoUri = await generateAnimationVideoUri(base64Data, mimeType);
                animationJobs.set(jobId, { status: 'done', createdAt: Date.now(), videoUrl: videoUri, userId });
            } catch (error: any) {
                animationJobs.set(jobId, {
                    status: 'error',
                    createdAt: Date.now(),
                    error: error?.message || 'Animation failed',
                    userId
                });
            }
        })();

        res.json({ jobId, status: 'pending' });
    } catch (error: any) {
        console.error('Animation start failed:', error);
        res.status(500).json({ error: error.message || 'Failed to start animation' });
    }
});

app.get('/api/process/animate/status/:jobId', (req, res) => {
    const job = animationJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Animation job not found' });
    const userId = getUserIdFromRequest(req);
    if (job.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    res.json({
        jobId: req.params.jobId,
        status: job.status,
        error: job.error,
        videoUrl: job.videoUrl
    });
});

app.get('/api/process/animate/result/:jobId', async (req, res) => {
    const job = animationJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Animation job not found' });
    const userId = getUserIdFromRequest(req);
    if (job.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (job.status === 'pending') return res.status(409).json({ error: 'Animation is still processing' });
    if (job.status === 'error') return res.status(500).json({ error: job.error || 'Animation failed' });
    if (!job.videoUrl) return res.status(500).json({ error: 'Animation result URL missing' });

    try {
        if (job.videoUrl.startsWith('/videos/')) {
            const filename = job.videoUrl.slice('/videos/'.length);
            if (!/^[\w\-\.]+\.mp4$/.test(filename)) {
                return res.status(500).json({ error: 'Invalid local animation result path' });
            }

            const videoPath = path.resolve(process.cwd(), 'public', filename);
            const publicDir = path.resolve(process.cwd(), 'public');
            if (!videoPath.startsWith(publicDir) || !existsSync(videoPath)) {
                return res.status(404).json({ error: 'Generated video file not found' });
            }

            res.setHeader('Content-Type', 'video/mp4');
            return res.sendFile(videoPath);
        }

        let videoResponse = await fetch(job.videoUrl);
        if (!videoResponse.ok) {
            const token = await getCloudAccessToken();
            if (token) {
                videoResponse = await fetch(job.videoUrl, { headers: { Authorization: `Bearer ${token}` } });
            }
        }

        if (!videoResponse.ok) {
            return res.status(502).json({ error: 'Failed to fetch generated video from provider' });
        }

        const buffer = Buffer.from(await videoResponse.arrayBuffer());
        res.setHeader('Content-Type', videoResponse.headers.get('content-type') || 'video/mp4');
        return res.send(buffer);
    } catch (error: any) {
        console.error('Animation result fetch failed:', error);
        return res.status(500).json({ error: error.message || 'Failed to fetch animation result' });
    }
});

app.get('/videos/:filename', (req, res) => {
    const filename = req.params.filename;
    // Security: only allow alphanumeric, underscore, and dot
    if (!/^[\w\-\.]+\.mp4$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const videoPath = path.resolve(process.cwd(), 'public', filename);
    const publicDir = path.resolve(process.cwd(), 'public');
    
    // Security: ensure the path is within public directory
    if (!videoPath.startsWith(publicDir)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video not found' });
    }
    
    res.setHeader('Content-Type', 'video/mp4');
    return res.sendFile(videoPath);
});

app.post('/api/process/animate', requireBilling('animate_start'), async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data required' });

        const hasPrefix = typeof image === 'string' && image.includes(',');
        const base64Data = hasPrefix ? image.split(',')[1] : image;
        const mimeType = hasPrefix ? (image.split(';')[0].split(':')[1] || 'image/png') : 'image/png';

        const videoUri = await generateAnimationVideoUri(base64Data, mimeType);

        let videoResponse = await fetch(videoUri);
        if (!videoResponse.ok) {
            const token = await getCloudAccessToken();
            if (token) {
                videoResponse = await fetch(videoUri, { headers: { Authorization: `Bearer ${token}` } });
            }
        }

        if (videoResponse.ok) {
            const buffer = Buffer.from(await videoResponse.arrayBuffer());
            res.setHeader('Content-Type', videoResponse.headers.get('content-type') || 'video/mp4');
            return res.send(buffer);
        }

        return res.json({ videoUrl: videoUri });
    } catch (error: any) {
        console.error('Animation failed:', error);
        res.status(500).json({ error: error.message || 'Animation failed' });
    }
});

// Animation / Motion Endpoint
app.post('/api/animate', requireBilling('animate_start'), async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data required' });

        const hasPrefix = typeof image === 'string' && image.includes(',');
        const base64Data = hasPrefix ? image.split(',')[1] : image;
        const mimeType = hasPrefix ? (image.split(';')[0].split(':')[1] || 'image/png') : 'image/png';

        const videoLink = await generateAnimationVideoUri(base64Data, mimeType);
        res.json({ videoUrl: videoLink });
    } catch (error: any) {
        console.error("Animation failed:", error);
        res.status(500).json({ error: error.message || 'Animation failed' });
    }
});

const frontendBuildPath = path.resolve(__dirname, '../public');
const frontendIndexPath = path.join(frontendBuildPath, 'index.html');

if (existsSync(frontendIndexPath)) {
    app.use(express.static(frontendBuildPath));

    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
        res.sendFile(frontendIndexPath);
    });
}

const startServer = async () => {
    await initUsernameDatabase();
    console.log(`Username database initialized at ${getUsernameDatabasePath()}`);

    app.listen(Number(PORT), HOST, () => console.log(`ChromaSnap Production Server running on http://${HOST}:${PORT}`));
};

startServer().catch((error) => {
    console.error('Server startup failed:', error);
    process.exit(1);
});
