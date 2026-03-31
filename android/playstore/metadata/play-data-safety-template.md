# Google Play Data Safety Template (Fill Before Submission)

Use this as a checklist while completing the Play Console Data safety form.

## Data collected (expected)
- Personal info: Name, email, phone number (account registration/recovery).
- Account identifiers: Username/user ID.
- Financial info: Purchase token/order references from Google Play Billing verification.
- App activity: Token usage events tied to account actions.

## Data processing purpose
- App functionality (authentication, billing verification, token accounting).
- Fraud prevention/security (rate limiting, captcha, login lockouts).
- Account management (recovery, subscriptions, in-app deletion).

## Data sharing
- Google Play Billing verification APIs (Google) for purchase validation.
- No ad SDK sharing is expected unless separately integrated.

## Encryption in transit
- Yes. App is configured for HTTPS transport for Android scheme and cleartext is disabled.

## User controls
- In-app account deletion is supported from Account > Danger Zone.
- Password recovery is supported via configured recovery flow.

## What to verify in console before final submission
- Exact data fields collected today match this template.
- Privacy Policy URL is publicly reachable and reflects real behavior.
- Contact email is monitored and valid.
- If any analytics/crash SDKs are added later, update Data safety immediately.
