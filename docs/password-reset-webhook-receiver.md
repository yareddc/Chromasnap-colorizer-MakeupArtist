# Password Reset Webhook Receiver (Cloud Run Example)

This example receiver accepts the `password_reset_requested` webhook emitted by the auth API in production.

Files:
- `server/scripts/password-reset-webhook-receiver.mjs`
- `server/scripts/password-reset-webhook-receiver.Dockerfile`

## Local run

From repo root:

```powershell
$env:PASSWORD_RESET_WEBHOOK_PATH="/password-reset"
$env:PASSWORD_RESET_WEBHOOK_SHARED_SECRET="replace-with-a-long-random-secret"
$env:PASSWORD_RESET_EMAIL_PROVIDER="auto"
$env:SENDGRID_API_KEY="SG.xxxxx"
$env:SENDGRID_FROM_EMAIL="no-reply@yourdomain.com"
$env:PASSWORD_RESET_LINK_TEMPLATE="https://chromasnap.app/reset-password?token={{token}}"
node server/scripts/password-reset-webhook-receiver.mjs
```

Health check:

```powershell
curl http://localhost:8080/healthz
```

## Cloud Run deploy (example)

```powershell
gcloud builds submit . `
  --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/chromasnap/password-reset-webhook:latest `
  --project YOUR_PROJECT_ID `
  --file server/scripts/password-reset-webhook-receiver.Dockerfile

gcloud run deploy chromasnap-password-reset-webhook `
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/chromasnap/password-reset-webhook:latest `
  --region us-central1 `
  --allow-unauthenticated `
  --set-env-vars PASSWORD_RESET_WEBHOOK_PATH=/password-reset,PASSWORD_RESET_WEBHOOK_SHARED_SECRET=replace-with-a-long-random-secret,PASSWORD_RESET_EMAIL_PROVIDER=auto,SENDGRID_FROM_EMAIL=no-reply@yourdomain.com,PASSWORD_RESET_LINK_TEMPLATE=https://chromasnap.app/reset-password?token={{token}} `
  --set-secrets SENDGRID_API_KEY=SENDGRID_API_KEY:latest
```

Copy deployed URL and set in server env:

```text
PASSWORD_RESET_WEBHOOK_URL=https://YOUR_SERVICE_URL/password-reset
```

If `PASSWORD_RESET_WEBHOOK_SHARED_SECRET` is set in receiver, add matching secret header from backend by placing a reverse proxy in front OR extending backend dispatch to include `x-reset-webhook-secret`.
Backend support is already implemented. Set the same value in server env:

```text
PASSWORD_RESET_WEBHOOK_SHARED_SECRET=replace-with-a-long-random-secret
```

## Payload format

```json
{
  "event": "password_reset_requested",
  "username": "alice",
  "recoveryEmail": "alice@example.com",
  "resetToken": "...",
  "expiresAt": 1764000000000,
  "generatedAt": 1763999100000
}
```

## Next step

This receiver supports SendGrid and Mailgun. Provider selection:

```text
PASSWORD_RESET_EMAIL_PROVIDER=auto  # auto | sendgrid | mailgun
```

In `auto`, it prefers SendGrid when configured, then Mailgun.

SendGrid required env vars:

```text
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=no-reply@yourdomain.com
```

Mailgun required env vars:

```text
MAILGUN_API_KEY=key-xxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM_EMAIL=no-reply@yourdomain.com
```

Optional reset-link vars:

```text
PASSWORD_RESET_LINK_TEMPLATE=https://chromasnap.app/reset-password?token={{token}}
# or
PASSWORD_RESET_LINK_BASE_URL=https://chromasnap.app/reset-password
```

If neither reset-link var is provided, the raw reset token is emailed.

For integration smoke testing without sending real emails:

```text
PASSWORD_RESET_WEBHOOK_DRY_RUN=true
```

Run the built-in smoke check for both providers:

```powershell
npm --prefix server run smoke:webhook-receiver
```

## Smoke test cleanup utility

This repo includes a helper to remove smoke-test users (`smoke_*`, `security_*`) from the auth DB:

```powershell
npm --prefix server run smoke:auth-cleanup:dry-run
npm --prefix server run smoke:auth-cleanup
```
