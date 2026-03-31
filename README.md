<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1MD2ENi1y0WEdwjwd_Wyzmrax4vDJivbf

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Copy [server/.env.example](server/.env.example) to `server/.env` and fill values (including `JWT_SECRET` and `ADMIN_API_KEY`)
4. Run the app:
   `npm run dev`

## Secret Hygiene & Incident Response

This repo includes automated secret scanning and local pre-commit protection.

Setup (one time):

```bash
npm run git-hooks:install
```

Manual scans:

```bash
npm run secrets:scan
npm run secrets:scan:staged
npm run secrets:scan:all-files
```

If a secret is exposed, follow this checklist:

1. Revoke/rotate the exposed secret in provider console.
2. Remove secret from source files and move it to Secret Manager/runtime env injection.
   - Untrack env files if needed: `git rm --cached .env server/.env`
3. Review audit logs for suspicious use during exposure window.
4. Restrict blast radius (least privilege IAM, API key restrictions, private service access).
5. Invalidate active sessions/tokens if auth material was exposed.
6. Re-run `npm run secrets:scan` before merge/deploy.

For full git history purge + rollback steps, see [docs/history-secret-cleanup-runbook.md](docs/history-secret-cleanup-runbook.md).

## Authentication & Recovery API

The app now supports secure login with hashed passwords and JWT sessions.

Auth sessions are now transported via `HttpOnly` auth cookies (not localStorage tokens).

- `POST /api/auth/register` - body: `{ "username": string, "password": string, "recoveryEmail": string }`
- `POST /api/auth/login` - body: `{ "username": string, "password": string }`
- `GET /api/auth/me` - requires authenticated session (HttpOnly cookie or Bearer token)
- `POST /api/auth/logout` - clears auth cookie session
- `DELETE /api/auth/account` - body: `{ "password": string, "confirmUsername": string }` (permanently deletes account + billing data)
- `POST /api/auth/recover/username` - body: `{ "recoveryEmail": string }`
- `POST /api/auth/recover/password/request` - body: `{ "username": string, "recoveryEmail": string }`
- `POST /api/auth/recover/password/confirm` - body: `{ "resetToken": string, "newPassword": string }`

Note: In non-production mode, password reset request returns a `resetToken` in the API response for local testing.
In production, password reset delivery must be configured with `PASSWORD_RESET_WEBHOOK_URL`.
Optional hardening: set `PASSWORD_RESET_WEBHOOK_SHARED_SECRET` to send `x-reset-webhook-secret` on delivery requests.
Reference deployment example: `docs/password-reset-webhook-receiver.md`.

Security hardening included:
- Repeated failed logins trigger temporary lockout.
- After multiple failures, login requires CAPTCHA verification (`captchaToken`).
- In local/dev mode without CAPTCHA provider config, use `dev-captcha-ok` as the test token.

Turnstile setup (recommended):
- Set frontend env `REACT_APP_TURNSTILE_SITE_KEY` for the login widget.
- Set backend env `CAPTCHA_SECRET_KEY` for server-side token verification.

## Subscription Management API

All subscription endpoints except `GET /api/subscription/plans` require an authenticated session (HttpOnly auth cookie or Bearer token).

Android billing compliance mode:
- Direct `POST /api/subscription/subscribe` and `POST /api/subscription/topup` are blocked for Android clients.
- Android must verify Google Play purchases via `POST /api/billing/google-play/verify`.

- `GET /api/subscription/plans` - list available plans
- `GET /api/subscription/me` - current account balance and tier
- `POST /api/subscription/subscribe` - body: `{ "tier": "free" | "pro" | "enterprise" }`
- `POST /api/subscription/topup` - body: `{ "tokens": number }`
- `GET /api/subscription/usage` - usage history and account snapshot
- `POST /api/billing/google-play/verify` - body: `{ "productType": "subs" | "inapp", "productId": string, "purchaseToken": string }`

Example curl:

```bash
TOKEN="your-jwt-token"

curl http://localhost:3001/api/subscription/me \
   -H "Authorization: Bearer $TOKEN"

curl -X POST http://localhost:3001/api/subscription/subscribe \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer $TOKEN" \
   -d '{"tier":"pro"}'

curl -X POST http://localhost:3001/api/subscription/topup \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer $TOKEN" \
   -d '{"tokens":50}'
```

## Admin Usernames Database API

Set `ADMIN_API_KEY` in your server environment to protect these endpoints.

- `GET /api/admin/usernames` - list all subscriber and admin usernames
- `POST /api/admin/usernames/admins` - body: `{ "username": "adminName" }`
- `DELETE /api/admin/usernames/admins/:username` - delete an admin username
- `DELETE /api/admin/usernames/subscribers/:username` - delete a subscriber username

Example curl:

```bash
curl http://localhost:3001/api/admin/usernames \
   -H "x-admin-api-key: your-admin-key"

curl -X POST http://localhost:3001/api/admin/usernames/admins \
   -H "Content-Type: application/json" \
   -H "x-admin-api-key: your-admin-key" \
   -d '{"username":"dawit-admin"}'

curl -X DELETE http://localhost:3001/api/admin/usernames/admins/dawit-admin \
   -H "x-admin-api-key: your-admin-key"

curl -X DELETE http://localhost:3001/api/admin/usernames/subscribers/demo-user \
   -H "x-admin-api-key: your-admin-key"
```

## Admin API Quick Test

Use this sequence to verify admin auth and username create/list/delete in under a minute.

```bash
# 1) Set your admin key (PowerShell)
$env:ADMIN_KEY="your-admin-key"

# 2) List current usernames
curl http://localhost:3001/api/admin/usernames \
   -H "x-admin-api-key: $env:ADMIN_KEY"

# 3) Add a test admin username
curl -X POST http://localhost:3001/api/admin/usernames/admins \
   -H "Content-Type: application/json" \
   -H "x-admin-api-key: $env:ADMIN_KEY" \
   -d '{"username":"quick-test-admin"}'

# 4) Confirm it appears
curl http://localhost:3001/api/admin/usernames \
   -H "x-admin-api-key: $env:ADMIN_KEY"

# 5) Delete the test username
curl -X DELETE http://localhost:3001/api/admin/usernames/admins/quick-test-admin \
   -H "x-admin-api-key: $env:ADMIN_KEY"
```

## Cloud Run Deployment

This repo includes production container/deploy files for Cloud Run:

- `Dockerfile`
- `.dockerignore`
- `cloudbuild.yaml` (public service)
- `cloudbuild.private.yaml` (private service + Secret Manager wiring)

### First-time setup

1. Enable required APIs:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com
```

2. Create/add secrets (Windows PowerShell):

```bash
npm run gcp:secrets:ps1 -- -ProjectId YOUR_PROJECT_ID -RuntimeServiceAccount YOUR_RUNTIME_SA_EMAIL
```

or Bash:

```bash
npm run gcp:secrets:sh -- YOUR_PROJECT_ID YOUR_RUNTIME_SA_EMAIL
```

### Deploy

Public Cloud Run service:

```bash
npm run gcp:deploy:public
```

Private Cloud Run service:

```bash
npm run gcp:deploy:private
```

Override service/region values when needed:

```bash
gcloud builds submit --config cloudbuild.private.yaml --substitutions _SERVICE=chromasnap-server,_REGION=us-central1,_GCP_LOCATION=us-central1
```

### Troubleshooting

`Permission denied` when reading secrets at runtime:

```bash
gcloud run services describe chromasnap-server --region us-central1 --format='value(spec.template.spec.serviceAccountName)'
gcloud secrets add-iam-policy-binding GEMINI_API_KEY --member="serviceAccount:YOUR_RUNTIME_SA_EMAIL" --role="roles/secretmanager.secretAccessor"
```

`Container failed to start` / port errors:

- Cloud Run injects `PORT`; this server already binds `PORT` on `0.0.0.0`.
- Verify logs:

```bash
gcloud run services logs read chromasnap-server --region us-central1 --limit 200
```

`Unauthenticated` when calling private service:

```bash
gcloud run services add-iam-policy-binding chromasnap-server --region us-central1 --member="user:you@example.com" --role="roles/run.invoker"
```

`Build failed` due to API not enabled:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com
```

Wrong region/project in deploy:

- Re-run with explicit substitutions:

```bash
gcloud builds submit --config cloudbuild.private.yaml --substitutions _SERVICE=chromasnap-server,_REGION=us-central1,_GCP_LOCATION=us-central1
```

Canonical domain behavior:

- `www.chromasnap.app` is configured to permanently redirect (`308`) to `https://chromasnap.app` while preserving path and query.
- Use `https://chromasnap.app` as the primary frontend URL.

DNS go-live checklist (`chromasnap.app`):

1. Apex (`@`) records:

- `A` → `216.239.32.21`
- `A` → `216.239.34.21`
- `A` → `216.239.36.21`
- `A` → `216.239.38.21`
- `AAAA` → `2001:4860:4802:32::15`
- `AAAA` → `2001:4860:4802:34::15`
- `AAAA` → `2001:4860:4802:36::15`
- `AAAA` → `2001:4860:4802:38::15`

2. `www` record:

- `CNAME` → `ghs.googlehosted.com`

3. Verify propagation:

```bash
nslookup -type=A chromasnap.app 8.8.8.8
nslookup -type=AAAA chromasnap.app 8.8.8.8
nslookup -type=CNAME www.chromasnap.app 8.8.8.8
```

4. Verify live app/API:

```bash
curl -I https://www.chromasnap.app
curl https://chromasnap.app/api/healthz
```

PowerShell one-liner (DNS + redirect + health):

```powershell
$a=(Resolve-DnsName chromasnap.app -Type A -ErrorAction SilentlyContinue).IPAddress; $aaaa=(Resolve-DnsName chromasnap.app -Type AAAA -ErrorAction SilentlyContinue).IPAddress; $www=(Resolve-DnsName www.chromasnap.app -Type CNAME -ErrorAction SilentlyContinue).NameHost; $redir=(Invoke-WebRequest https://www.chromasnap.app -Method GET -MaximumRedirection 0 -ErrorAction SilentlyContinue).Headers.Location; $health=(Invoke-WebRequest https://chromasnap.app/api/healthz -UseBasicParsing -ErrorAction SilentlyContinue).StatusCode; [pscustomobject]@{ A=($a -join ','); AAAA=($aaaa -join ','); WWW_CNAME=$www; WWW_Redirect=$redir; HealthStatus=$health } | Format-List
```

### Post-deploy smoke test

1. Get your service URL:

```bash
gcloud run services describe chromasnap-server --region us-central1 --format='value(status.url)'
```

2. Health check:

```bash
curl https://YOUR_SERVICE_URL/api/healthz
```

Note: This service is currently validated on `/api/*` routes; use `/api/healthz` for uptime checks.

3. Public service quick check:

```bash
curl https://YOUR_SERVICE_URL/api/subscription/plans
```

4. Private service quick check (identity token):

```bash
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://YOUR_SERVICE_URL/api/subscription/plans
```

5. Optional auth endpoint check:

```bash
curl -X POST https://YOUR_SERVICE_URL/api/auth/login \
   -H "Content-Type: application/json" \
   -d '{"username":"demo","password":"wrong-pass"}'
```

6. Full cookie-session smoke test (private Cloud Run):

PowerShell:

```bash
$env:AUTH_SMOKE_BASE_URL="https://YOUR_SERVICE_URL"
$env:AUTH_SMOKE_ID_TOKEN="$(gcloud auth print-identity-token)"
npm run server:smoke:auth-cookie:cloudrun
```

Bash:

```bash
AUTH_SMOKE_BASE_URL="https://YOUR_SERVICE_URL" AUTH_SMOKE_ID_TOKEN="$(gcloud auth print-identity-token)" npm run server:smoke:auth-cookie:cloudrun
```

7. One-command auto-discovery smoke test (uses `gcloud` to resolve URL + token):

```bash
npm run server:smoke:auth-cookie:cloudrun
```

Optional service/region override:

```bash
cd server
AUTH_SMOKE_SERVICE=chromasnap-server AUTH_SMOKE_REGION=us-central1 npm run smoke:auth-cookie:cloudrun
```

## Android Test Checklist

Use these commands to run Android instrumentation checks from `android/`.

1. Set Java (PowerShell session):

```bash
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
```

2. Verify connected device:

```bash
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
Write-Host "Using adb: $adb"; & $adb version
& $adb devices -l
```

3. Run app instrumentation test:

```bash
cd android
.\gradlew.bat :app:connectedDebugAndroidTest --console=plain
```

4. Run full connected checks (all modules):

```bash
cd android
.\gradlew.bat connectedCheck --console=plain
```

Note: `:app:connectedDebugAndroidTest` validates only the app module tests. `connectedCheck` runs connected tests/checks across all Android modules (including Capacitor/Cordova plugin modules), so dependency conflicts can appear there even when app-only instrumentation passes.

## Android Play Upload Checklist

Use these settings before uploading to Google Play internal testing.

1. Configure upload-signing credentials (PowerShell example):

```bash
$env:ANDROID_UPLOAD_STORE_FILE="C:\path\to\upload-keystore.jks"
$env:ANDROID_UPLOAD_STORE_PASSWORD="<store-password>"
$env:ANDROID_UPLOAD_KEY_ALIAS="<key-alias>"
$env:ANDROID_UPLOAD_KEY_PASSWORD="<key-password>"
```

Optional local file workflow:

1. Copy `android/key.properties.example` to `android/key.properties`.
2. Fill values from your Play upload keystore.
3. Export the same values into env vars before release build.

2. Build release app bundle:

```bash
cd android
.\gradlew.bat bundleRelease
```

3. Upload artifact:

`android/app/build/outputs/bundle/release/app-release.aab`

4. Security baseline now enforced in app config:

- Android manifest uses `android:usesCleartextTraffic="false"`
- Capacitor Android scheme is `https`
- App version is now `versionCode 2`, `versionName 1.1.0`

5. Policy baseline now available:

- In-app account deletion flow is wired to `DELETE /api/auth/account` and removes account+billing records.

If the device is not detected, restart adb and re-run:

```bash
& $adb kill-server
& $adb start-server
& $adb devices -l
```

Bash / WSL equivalent:

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export PATH="$JAVA_HOME/bin:$PATH"

# Resolve Windows LocalAppData from WSL/Git Bash if LOCALAPPDATA is not set
if [ -z "$LOCALAPPDATA" ]; then
   WIN_LOCALAPPDATA="$(powershell.exe -NoProfile -Command "[Environment]::GetFolderPath('LocalApplicationData')" 2>/dev/null | tr -d '\r')"
   if [ -n "$WIN_LOCALAPPDATA" ]; then
      LOCALAPPDATA="$(wslpath -u "$WIN_LOCALAPPDATA" 2>/dev/null || echo "")"
   fi
fi

if [ -z "$LOCALAPPDATA" ]; then
   LOCALAPPDATA="/mnt/c/Users/$USER/AppData/Local"
fi

ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"

if [ ! -f "$ADB" ]; then
   echo "adb not found at: $ADB"
   echo "Set LOCALAPPDATA or edit ADB path in this snippet."
   exit 1
fi

echo "Using adb: $ADB"; "$ADB" version

"$ADB" devices -l

cd android
./gradlew.bat :app:connectedDebugAndroidTest --console=plain
./gradlew.bat connectedCheck --console=plain

"$ADB" kill-server
"$ADB" start-server
"$ADB" devices -l
```
