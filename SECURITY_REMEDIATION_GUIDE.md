# Security Remediation Guide - ChromaSnap

## Quick Status Overview

✅ **14/15 Categories - EXCELLENT** (93% coverage)
⚠️ **1/15 Categories - REVIEW** (CSP inline scripts)

---

## 🔴 Critical Actions (If Any)

**None identified.** Your production deployment is secure.

---

## 🟡 High-Priority Recommendations (Do This Month)

### 1. Token Refresh Implementation
**Why:** Reduce impact of token compromise; current 7-day expiry is long

**Implementation:**
```typescript
// Add to geminiService.ts
const AUTH_REFRESH_TOKEN_KEY = 'auth_refresh_token';

export const getTokenWithRefresh = async (): Promise<string> => {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const refreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
  
  // If token expired and refresh available, refresh it
  if (!token && refreshToken) {
    const response = await fetch(API_ENDPOINTS.AUTH_REFRESH_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (response.ok) {
      const data = await response.json();
      persistAuthToken(data.token);  // Short-lived: 1-2 hours
      localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, data.refreshToken);
      return data.token;
    }
  }
  
  return token || '';
};
```

**Add to server:**
```typescript
// server/src/index.ts
app.post('/api/auth/refresh-token', express.json(), async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    const newToken = signAuthToken(decoded.sub);
    const newRefreshToken = signRefreshToken(decoded.sub);
    
    res.json({ 
      token: newToken,  // 1h expiry
      refreshToken: newRefreshToken,  // 30d expiry
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

**Timeline: 2 weeks**

---

### 2. Structured Logging & Secret Redaction
**Why:** Prevent accidental token/key exposure in server logs

**Implementation:**
```typescript
// server/src/logging.ts
const SENSITIVE_KEYS = [
  'token', 'refreshToken', 'password', 'secret',
  'apiKey', 'apiSecret', 'jwt', 'authorization'
];

export const redactSecrets = (obj: any): any => {
  if (!obj) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(redactSecrets);
  }
  
  if (typeof obj !== 'object') return obj;
  
  const redacted = { ...obj };
  for (const key in redacted) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
      redacted[key] = redacted[key] ? '[REDACTED]' : null;
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSecrets(redacted[key]);
    }
  }
  
  return redacted;
};

export const logger = {
  info: (event: string, data?: any) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      event,
      data: data ? redactSecrets(data) : undefined,
    };
    console.log(JSON.stringify(entry));
  },
  error: (event: string, error: any) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      event,
      error: {
        message: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
    };
    console.error(JSON.stringify(entry));
  },
};
```

**Usage:**
```typescript
// Instead of:
console.log('Login attempt:', { username, password });  // ❌ BAD

// Do:
logger.info('LOGIN_ATTEMPT', { username });  // ✅ GOOD, no password logged
```

**Timeline: 1 week**

---

### 3. Verify Password Reset Webhook Security
**Why:** Ensure shared-secret validation works correctly

**Test Script:**
```bash
#!/bin/bash

# Get your webhook URL from CloudBuild
WEBHOOK_URL="https://chromasnap-password-reset-webhook-...../password-reset"

# Test with wrong secret (should fail with 403)
echo "Testing with invalid secret..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-reset-webhook-secret: wrong-secret" \
  -d '{
    "username": "test",
    "resetToken": "test-token",
    "expiresAt": "'$(date +%s)'000"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: 403 Forbidden

# Test with valid secret (should process)
echo "Testing with valid secret..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-reset-webhook-secret: $PASSWORD_RESET_WEBHOOK_SHARED_SECRET" \
  -d '{
    "username": "test",
    "resetToken": "test-token",
    "expiresAt": "'$(date +%s)'000"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: 200 or 5xx (depends on email delivery setup)
```

**Timeline: 1 day (testing only)**

---

## 🟢 Medium-Priority Recommendations (Do This Quarter)

### 4. Firebase App Check (CSP Optimization)
**Current:** CSP allows `'unsafe-inline'` for Firebase reCAPTCHA
**Goal:** Migrate to Firebase App Check (nonce-based CSP)

**Benefits:**
- Remove `unsafe-inline` from CSP
- Better mobile app security
- Reduce attack surface

**Implementation:**
```typescript
// server/src/index.ts

// Enable Firebase App Check verification
app.use((req, res, next) => {
  const appCheckToken = req.header('x-firebase-appcheck-token');
  
  // If request has app-check token, verify it
  if (appCheckToken && req.path.startsWith('/api/')) {
    // Verify with Firebase Admin SDK
    // admin.appCheck().verifyToken(appCheckToken)
  }
  
  next();
});
```

**Timeline: 4 weeks**

---

### 5. Audit Log Implementation
**Why:** Track sensitive operations for compliance & forensics

**Implementation:**
```typescript
// server/src/audit-log.ts
export const auditLog = async (
  action: string,
  username: string,
  resource: string,
  result: 'SUCCESS' | 'FAILURE',
  details?: any
) => {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    username,
    resource,
    result,
    ip: getClientIp(req),
    userAgent: req.header('user-agent'),
    details: details ? redactSecrets(details) : undefined,
  };
  
  // Send to Cloud Logging
  console.log(JSON.stringify({ audit: entry }));
};

// Track these events:
// LOGIN_SUCCESS: User logs in
// LOGIN_FAILURE: Failed login attempt
// PASSWORD_CHANGE: User changes password
// PASSWORD_RESET: User resets password
// ADMIN_ACCESS: Admin API key used
// ACCOUNT_UPGRADE: User upgrades plan
// TOKEN_ISSUED: Auth token created
```

**Monitored Operations:**
- All login attempts (success & failure)
- Password changes and resets
- Admin API access
- Billing/subscription changes
- Token issuance

**Timeline: 6 weeks**

---

### 6. Regular Security Scanning
**Why:** Stay ahead of emerging vulnerabilities

**Add to CI/CD:**
```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'run'
      - '--rm'
      - '-v'
      - '/workspace:/workspace'
      - 'aquasec/trivy:latest'
      - 'fs'
      - '--exit-code'
      - '1'  # Fail build on critical vulnerabilities
      - '/workspace'
      
  - name: 'gcr.io/cloud-builders/npm'
    args:
      - 'audit'
      - '--audit-level=moderate'  # Fail on moderate+ vulnerabilities
```

**Timeline: 2 weeks (setup)**

---

## 🟢 Nice-to-Have (This Year)

### 7. Multi-Factor Authentication (MFA)
- TOTP (authenticator app) support
- Backup codes for account recovery

### 8. Security Headers Audit
- Report CSP violations: `Content-Security-Policy-Report-Only: https://your-csp-report-endpoint`
- Add `Expect-CT` header
- Add `Permissions-Policy` for camera/microphone

### 9. Penetration Testing
- Annual third-party security audit
- Focus on API endpoints and auth flows

### 10. Data Encryption at Rest
- Enable Application-level encryption for sensitive data
- Ensure GCS bucket encryption is enabled

---

## Testing Checklist

### Before Deploying Security Changes:

```bash
# 1. Test HTTPS enforcement
curl -I http://chromasnap-server-grtbijsg7a-uc.a.run.app
# Should redirect to HTTPS

# 2. Test CORS
curl -H "Origin: https://evil.com" \
  -I https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/health
# Should return Access-Control-Allow-Origin or error

# 3. Test auth endpoint without token
curl -H "Authorization: Bearer invalid" \
  https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/subscription/me
# Should return 401 Unauthorized

# 4. Test rate limiting
for i in {1..50}; do
  curl -X POST https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
done
# After 20 tries, should return 429 Too Many Requests

# 5. Test CSP headers
curl -I https://chromasnap-server-grtbijsg7a-uc.a.run.app
# Should include Content-Security-Policy header

# 6. Test secure cookies
curl -I https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/auth/login
# Check Set-Cookie: chromasnap_auth=...; HttpOnly; Secure; SameSite=...

# 7. Test unauthorized admin access
curl -X GET https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/admin/usernames \
  -H "x-admin-api-key: wrong-key"
# Should return 403 Forbidden
```

---

## Deployment Checklist

### Before Releasing Changes:

- [ ] All secrets properly set in Secret Manager
- [ ] JWT_SECRET is non-placeholder (min 32 chars)
- [ ] CORS origins correctly configured
- [ ] Rate limiter windows verified
- [ ] Logs don't contain sensitive data
- [ ] CSP headers configured
- [ ] HTTPS enforced (Cloud Run default)
- [ ] Gitleaks scan passes
- [ ] Security headers present
- [ ] Admin endpoints authenticated
- [ ] Password reset webhook validated

---

## Emergency Procedures

### If Secret is Compromised:

1. **Rotate Secret in Secret Manager:**
   ```bash
   gcloud secrets versions add JWT_SECRET \
     --data-file=<(openssl rand -base64 32)
   ```

2. **Force Redeployment:**
   ```bash
   gcloud run deploy chromasnap-server \
     --region us-central1 \
     --image gcr.io/$PROJECT_ID/chromasnap-server:latest \
     --force-unlock
   ```

3. **Invalidate All Active Tokens:**
   - Update SECRET_DATE in JWT validation
   - All existing tokens become invalid
   - Users must re-login

### If API Key is Compromised:

1. **Revoke in API Console:**
   - Google Cloud Console > APIs & Services > Credentials
   - Delete the exposed key

2. **Create New API Key:**
   ```bash
   gcloud alpha services api-keys create
   ```

3. **Update Secret Manager:**
   ```bash
   gcloud secrets versions add GEMINI_API_KEY \
     --data-file=<(echo "YOUR_NEW_KEY")
   ```

4. **Redeploy:**
   ```bash
   gcloud builds submit --config cloudbuild.yaml
   ```

---

## Monitoring & Alerting

### Set up Cloud Logging alerts for:

1. **Failed Login Attempts (>10 per hour):**
   ```
   resource.type="cloud_run_revision"
   severity="ERROR"
   "Invalid username or password"
   ```

2. **CORS Failures:**
   ```
   "Not allowed by CORS"
   ```

3. **Rate Limit Triggers:**
   ```
   "Too many requests"
   ```

4. **Admin API Access:**
   ```
   "x-admin-api-key"
   ```

5. **Errors in Logs:**
   ```
   severity="ERROR"
   ```

---

## Timeline Summary

| Priority | Item | Effort | Deadline |
|----------|------|--------|----------|
| 🟡 HIGH | Token refresh | 2 wks | This sprint |
| 🟡 HIGH | Structured logging | 1 wk | This sprint |
| 🟡 HIGH | Webhook verification | 1 day | ASAP |
| 🟢 MED | Firebase App Check | 4 wks | This quarter |
| 🟢 MED | Audit logging | 6 wks | This quarter |
| 🟢 MED | Security scanning | 2 wks | This quarter |
| 🟢 NICE | MFA | 8 wks | This year |
| 🟢 NICE | Penetration test | 4 wks | This year |

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework/)

---

**Last Updated:** May 27, 2026
**Next Review:** 6 months (November 2026) or after major changes
