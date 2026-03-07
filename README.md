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

## Authentication & Recovery API

The app now supports secure login with hashed passwords and JWT sessions.

- `POST /api/auth/register` - body: `{ "username": string, "password": string, "recoveryEmail": string }`
- `POST /api/auth/login` - body: `{ "username": string, "password": string }`
- `GET /api/auth/me` - requires `Authorization: Bearer <token>`
- `POST /api/auth/recover/username` - body: `{ "recoveryEmail": string }`
- `POST /api/auth/recover/password/request` - body: `{ "username": string, "recoveryEmail": string }`
- `POST /api/auth/recover/password/confirm` - body: `{ "resetToken": string, "newPassword": string }`

Note: In non-production mode, password reset request returns a `resetToken` in the API response for local testing.

Security hardening included:
- Repeated failed logins trigger temporary lockout.
- After multiple failures, login requires CAPTCHA verification (`captchaToken`).
- In local/dev mode without CAPTCHA provider config, use `dev-captcha-ok` as the test token.

Turnstile setup (recommended):
- Set frontend env `REACT_APP_TURNSTILE_SITE_KEY` for the login widget.
- Set backend env `CAPTCHA_SECRET_KEY` for server-side token verification.

## Subscription Management API

All subscription endpoints require the `x-user-id` header to identify the account.

- `GET /api/subscription/plans` - list available plans
- `GET /api/subscription/me` - current account balance and tier
- `POST /api/subscription/subscribe` - body: `{ "tier": "free" | "pro" | "enterprise" }`
- `POST /api/subscription/topup` - body: `{ "tokens": number }`
- `GET /api/subscription/usage` - usage history and account snapshot

Example curl:

```bash
curl -H "x-user-id: demo-user" http://localhost:3001/api/subscription/me

curl -X POST http://localhost:3001/api/subscription/subscribe \
   -H "Content-Type: application/json" \
   -H "x-user-id: demo-user" \
   -d '{"tier":"pro"}'

curl -X POST http://localhost:3001/api/subscription/topup \
   -H "Content-Type: application/json" \
   -H "x-user-id: demo-user" \
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
