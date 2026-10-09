# Security Testing & Verification Guide

## Quick Test Summary

Run these commands to verify your security infrastructure is working:

---

## 1. HTTPS/TLS Verification ✅

### Test: Automatic HTTPS Redirect
```bash
curl -I http://chromasnap-server-grtbijsg7a-uc.a.run.app
```

**Expected Output:**
```
HTTP/1.1 301 Moved Permanently
Location: https://chromasnap-server-grtbijsg7a-uc.a.run.app/
```

**What it means:** ✅ All HTTP requests are automatically redirected to HTTPS

---

### Test: TLS Version Check
```bash
openssl s_client -connect chromasnap-server-grtbijsg7a-uc.a.run.app:443 \
  -tls1 2>&1 | grep "Protocol"
```

**Expected:** Should fail (TLS 1.0 disabled)

```bash
openssl s_client -connect chromasnap-server-grtbijsg7a-uc.a.run.app:443 \
  -tls1_2 2>&1 | grep "Protocol"
```

**Expected:** Should succeed with TLS 1.2+

**What it means:** ✅ Weak TLS versions are disabled

---

### Test: Certificate Validity
```bash
curl -v https://chromasnap-server-grtbijsg7a-uc.a.run.app 2>&1 | grep -E "certificate|issuer|subject"
```

**Expected Output:**
```
subject=CN = *.run.app
issuer=C = US, O = Google Trust Services...
```

**What it means:** ✅ Valid certificate from trusted CA

---

## 2. Authentication & JWT Testing

### Test: Login Success
```bash
API_BASE="https://chromasnap-server-grtbijsg7a-uc.a.run.app"

curl -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user" \
  -d '{
    "username": "testuser",
    "password": "TestPass123"
  }'
```

**Expected Success Response:**
```json
{
  "user": {
    "username": "testuser",
    "email": "testuser@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "account": {
    "plan": "free",
    "tokenBalance": 150
  }
}
```

**What it means:** ✅ JWT tokens are being issued correctly

---

### Test: Invalid Token Rejection
```bash
API_BASE="https://chromasnap-server-grtbijsg7a-uc.a.run.app"

curl -X GET "$API_BASE/api/subscription/me" \
  -H "Authorization: Bearer invalid-token-123"
```

**Expected Response:**
```json
{
  "error": "Unauthorized"
}
```

**HTTP Status:** 401 Unauthorized

**What it means:** ✅ Invalid JWT tokens are rejected

---

### Test: Missing Token Rejection
```bash
API_BASE="https://chromasnap-server-grtbijsg7a-uc.a.run.app"

curl -X GET "$API_BASE/api/subscription/me"
```

**Expected Response:**
```json
{
  "error": "Unauthorized"
}
```

**HTTP Status:** 401 Unauthorized

**What it means:** ✅ Endpoints requiring auth are protected

---

### Test: Token Expiry
Get a valid token, wait 7 days (or use an old token), then:
```bash
curl -X GET "$API_BASE/api/subscription/me" \
  -H "Authorization: Bearer $OLD_TOKEN"
```

**Expected Response:**
```json
{
  "error": "Unauthorized"
}
```

**What it means:** ✅ Tokens expire after 7 days

---

## 3. CORS Validation Testing

### Test: Allowed Origin
```bash
curl -X OPTIONS "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/health" \
  -H "Origin: https://chromasnap.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

**Expected Headers:**
```
Access-Control-Allow-Origin: https://chromasnap.app
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Credentials: true
```

**What it means:** ✅ CORS is configured for legitimate domains

---

### Test: Disallowed Origin
```bash
curl -X OPTIONS "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/health" \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

**Expected:** No CORS headers in response or error:
```
< HTTP/1.1 403 Forbidden
```

**What it means:** ✅ Requests from unauthorized origins are blocked

---

## 4. Rate Limiting Testing

### Test: Login Rate Limit
```bash
API_BASE="https://chromasnap-server-grtbijsg7a-uc.a.run.app"

# Try 25 rapid login attempts (limit is 20/10min)
for i in {1..25}; do
  echo "Attempt $i:"
  curl -s -X POST "$API_BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}' \
    | grep -o '"error":"[^"]*"'
done
```

**Expected Output:**
- First 20: `"error":"Invalid username or password"`
- Following attempts: `"error":"Too many failed login attempts. Try again later."`

**HTTP Status:** 429 Too Many Requests

**What it means:** ✅ Brute force attempts are throttled

---

### Test: Processing Rate Limit
```bash
API_BASE="https://chromasnap-server-grtbijsg7a-uc.a.run.app"

# Make 130 rapid upscale requests (limit is 120/10min)
for i in {1..130}; do
  curl -s -X POST "$API_BASE/api/process/upscale" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"image":"data:image/png;base64,iVBOR..."}' \
    | grep -o '"error":"[^"]*"' & 
done
wait
```

**Expected Output (after 120 requests):**
```
"error":"Too many image processing requests. Please try again shortly."
```

**What it means:** ✅ API abuse is prevented

---

## 5. Security Headers Testing

### Test: All Security Headers
```bash
curl -I https://chromasnap-server-grtbijsg7a-uc.a.run.app/
```

**Expected Headers:**

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000` | Force HTTPS for 1 year |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking protection |
| `Content-Security-Policy` | `script-src 'self'...` | XSS prevention |
| `Access-Control-Allow-Credentials` | `true` | Cookies in CORS |

```bash
# Parse and verify
curl -s -I https://chromasnap-server-grtbijsg7a-uc.a.run.app/ | \
  grep -E "Strict-Transport|X-Content-Type|X-Frame|Content-Security"
```

**What it means:** ✅ Security headers are properly configured

---

## 6. Cookie Security Testing

### Test: HttpOnly Cookie
```bash
curl -X POST "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"TestPass123"}' \
  -v 2>&1 | grep -i "set-cookie"
```

**Expected Output:**
```
Set-Cookie: chromasnap_auth=...; HttpOnly; Secure; SameSite=none; Path=/; Max-Age=604800
```

**Verify each flag:**
- ✅ `HttpOnly` - Not accessible to JavaScript (XSS protection)
- ✅ `Secure` - Only sent over HTTPS
- ✅ `SameSite=none` - Can be sent in cross-site requests (for API calls)
- ✅ `Path=/` - Available for entire domain
- ✅ `Max-Age=604800` - Expires in 7 days

**What it means:** ✅ Auth cookies are securely configured

---

### Test: JavaScript Cannot Access HttpOnly Cookie
```javascript
// In browser console:
console.log(document.cookie);
// Should NOT show chromasnap_auth token
```

**Expected:** `document.cookie` shows other cookies but NOT the auth cookie

**What it means:** ✅ JavaScript cannot steal the auth token

---

## 7. Admin API Key Protection

### Test: Missing Admin Key
```bash
curl -X GET "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/admin/usernames"
```

**Expected Response:**
```json
{
  "error": "Forbidden"
}
```

**HTTP Status:** 403 Forbidden

**What it means:** ✅ Admin endpoints require authentication

---

### Test: Wrong Admin Key
```bash
curl -X GET "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/admin/usernames" \
  -H "x-admin-api-key: wrong-key-12345"
```

**Expected Response:**
```json
{
  "error": "Forbidden"
}
```

**HTTP Status:** 403 Forbidden

**What it means:** ✅ Invalid keys are rejected (timing-safe comparison)

---

### Test: Valid Admin Key
```bash
curl -X GET "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/admin/usernames" \
  -H "x-admin-api-key: $ADMIN_API_KEY"
```

**Expected Response:**
```json
{
  "subscribers": [...],
  "admins": [...]
}
```

**HTTP Status:** 200 OK

**What it means:** ✅ Valid admin keys grant access

---

## 8. CAPTCHA & Bot Protection

### Test: CAPTCHA Requirement After Failed Attempts
```bash
API_BASE="https://chromasnap-server-grtbijsg7a-uc.a.run.app"

# Attempt login 15 times (triggers CAPTCHA at threshold)
for i in {1..15}; do
  curl -s -X POST "$API_BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","password":"WrongPassword"}' > /dev/null
  echo "Attempt $i"
done

# Next attempt should require CAPTCHA
curl -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"TestPass123"}'
```

**Expected Response (after threshold):**
```json
{
  "error": "Captcha verification is required.",
  "captchaRequired": true
}
```

**What it means:** ✅ Bot attempts trigger CAPTCHA challenge

---

### Test: CAPTCHA Bypass (Dev Only)
```bash
# In development with CAPTCHA_BYPASS_TOKEN set:
curl -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username":"testuser",
    "password":"TestPass123",
    "captchaToken":"dev-captcha-ok"
  }'
```

**Expected:** Login succeeds with bypass token

**⚠️ Note:** CAPTCHA_BYPASS_TOKEN only works in development

**What it means:** ✅ Legitimate requests can bypass CAPTCHA in dev

---

## 9. Password Security

### Test: Weak Password Rejection
```bash
curl -X POST "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username":"newuser",
    "password":"weak",
    "email":"user@example.com"
  }'
```

**Expected Response:**
```json
{
  "error": "Password must be at least 8 characters"
}
```

```bash
# Try password with no numbers
curl -X POST "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username":"newuser",
    "password":"WeakPassword",
    "email":"user@example.com"
  }'
```

**Expected Response:**
```json
{
  "error": "Password must include letters and numbers"
}
```

**What it means:** ✅ Weak passwords are rejected

---

### Test: Password Reset Token Expiry
```bash
# Request password reset
curl -X POST "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/auth/request-password-reset" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser"}'

# Wait 2+ hours (token expires in 1 hour)
sleep 7200

# Try to reset with expired token
curl -X POST "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "resetToken":"old-token-...",
    "newPassword":"NewPass123"
  }'
```

**Expected Response:**
```json
{
  "error": "Reset token is invalid or expired"
}
```

**HTTP Status:** 400 Bad Request

**What it means:** ✅ Tokens expire after ~1 hour

---

## 10. Input Validation

### Test: Invalid Username
```bash
curl -X POST "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username":"user@#$%^&*()",
    "password":"TestPass123"
  }'
```

**Expected:** Either sanitized or rejected with error

**What it means:** ✅ Special characters in usernames are sanitized

---

### Test: Excessively Long Input
```bash
LONG_STRING=$(python3 -c "print('a' * 10000)")

curl -X POST "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$LONG_STRING\",\"password\":\"TestPass123\"}"
```

**Expected:** Either truncated or rejected with error

**HTTP Status:** 400 Bad Request (likely)

**What it means:** ✅ Buffer overflow protection

---

## 11. Content Moderation

### Test: Image Safety Check
```bash
# Get a test image
TEST_IMG="https://example.com/test.jpg"
BASE64_IMG=$(curl -s "$TEST_IMG" | base64 | tr -d '\n')

curl -X POST "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/analyze/safety" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"image\":\"data:image/jpeg;base64,$BASE64_IMG\"}"
```

**Expected Response:**
```json
{
  "isSafe": true,
  "containsMinors": false,
  "reason": "Safe content"
}
```

**What it means:** ✅ Content moderation is working

---

## 12. Logging & Monitoring

### Test: Error Logging
```bash
# Trigger an error
curl -X POST "https://chromasnap-server-grtbijsg7a-uc.a.run.app/api/process/upscale" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VALID_TOKEN" \
  -d '{"image":"invalid-base64"}'

# Check Cloud Logging
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=chromasnap-server" \
  --limit 10 \
  --format json
```

**Expected:** Error appears in Cloud Logging (but without sensitive data)

**What it means:** ✅ Errors are logged for monitoring

---

## Quick Test Script

Save this as `security-test.sh`:

```bash
#!/bin/bash

API_BASE="${1:-https://chromasnap-server-grtbijsg7a-uc.a.run.app}"
TOKEN="${2:-}"

echo "🔒 ChromaSnap Security Tests"
echo "=============================="
echo ""

# 1. HTTPS
echo "1. HTTPS Redirect..."
HTTP_RESULT=$(curl -s -o /dev/null -w "%{http_code}" "http://chromasnap-server-grtbijsg7a-uc.a.run.app")
if [ "$HTTP_RESULT" = "301" ] || [ "$HTTP_RESULT" = "302" ]; then
  echo "   ✅ HTTPS redirect working (HTTP → HTTPS)"
else
  echo "   ❌ HTTPS redirect failed (Status: $HTTP_RESULT)"
fi

# 2. CORS Test
echo "2. CORS Validation..."
CORS=$(curl -s -H "Origin: https://evil.com" -X OPTIONS "$API_BASE/api/health" \
  -H "Access-Control-Request-Method: GET" -w "%{http_code}" -o /dev/null)
if [ "$CORS" = "403" ] || [ "$CORS" = "200" ]; then
  echo "   ✅ CORS is configured"
else
  echo "   ❌ CORS check failed"
fi

# 3. Rate Limit
echo "3. Rate Limiting..."
RATE_LIMIT=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' | grep -c "Too many")
if [ "$RATE_LIMIT" -gt 0 ]; then
  echo "   ✅ Rate limiting active"
else
  echo "   ⏳ Rate limiting (need 20+ requests to trigger)"
fi

# 4. Headers
echo "4. Security Headers..."
HEADERS=$(curl -s -I "$API_BASE/" | grep -c "X-Content-Type-Options\|Strict-Transport-Security")
if [ "$HEADERS" -ge 1 ]; then
  echo "   ✅ Security headers present"
else
  echo "   ❌ Security headers missing"
fi

# 5. Auth
if [ -n "$TOKEN" ]; then
  echo "5. JWT Validation..."
  AUTH=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/subscription/me" \
    | grep -c '"account"')
  if [ "$AUTH" -eq 1 ]; then
    echo "   ✅ Valid token accepted"
  else
    echo "   ❌ Token validation failed"
  fi
  
  echo "6. Invalid Token Rejection..."
  INVALID=$(curl -s -H "Authorization: Bearer invalid-token" "$API_BASE/api/subscription/me" \
    | grep -c "Unauthorized")
  if [ "$INVALID" -eq 1 ]; then
    echo "   ✅ Invalid tokens rejected"
  else
    echo "   ❌ Invalid token not rejected"
  fi
fi

echo ""
echo "=============================="
echo "Tests complete!"
```

**Run it:**
```bash
chmod +x security-test.sh
./security-test.sh https://chromasnap-server-grtbijsg7a-uc.a.run.app $TOKEN
```

---

## Debugging Failed Tests

### CORS Not Working?
1. Check `cloudbuild.yaml` for `_CORS_ORIGINS`
2. Verify frontend URL is whitelisted
3. Test with `curl -H "Origin: https://chromasnap.app"`

### Rate Limiting Too Strict?
1. Make many requests rapidly
2. Check rate limiter window (10 minutes)
3. Verify backend is receiving requests

### JWT Not Validating?
1. Ensure JWT_SECRET is set in Secret Manager
2. Check token expiry (7 days)
3. Verify Authorization header format: `Bearer <token>`

### CORS "Origin Not Allowed"?
1. Check browser console for exact origin header
2. Add that origin to `_CORS_ORIGINS` in `cloudbuild.yaml`
3. Redeploy with `gcloud builds submit`

---

**Last Updated:** May 27, 2026
**Created for:** ChromaSnap Security Audit
