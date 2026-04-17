# ChromaSnap Play Internal Testing Go/No-Go (2026-03-27)

## Decision
NO-GO until all unresolved items below are completed in Play Console.

## Unresolved blockers (complete all)

1. ✅ Privacy Policy URL confirmed: https://chromasnap.app/privacy
- Requirement: Publicly accessible URL (not localhost) that matches current app behavior.

2. Store listing contact email not yet confirmed in Play Console.
- Requirement: Monitored support email entered in Store listing.

3. Data Safety form not yet submitted in Play Console.
- Use: android/playstore/metadata/play-data-safety-template.md

4. Content rating questionnaire not yet submitted in Play Console.
- Use: android/playstore/metadata/play-content-rating-notes.md

5. App access/reviewer credentials not yet configured in Play Console (if required).
- Requirement: Provide working login details/instructions if reviewer needs account access.

6. Google Play Billing catalog activation not yet verified in Play Console.
- Requirement: Subscriptions and in-app products are created, active, and match app/backend IDs.
- Expected IDs:
  - chromasnap_pro
  - chromasnap_enterprise
  - chromasnap_topup_100
  - chromasnap_topup_500
  - chromasnap_topup_1000

7. Internal testing track setup not yet verified in Play Console.
- Requirement: Tester list/group configured and rollout started.

8. Opt-in install validation not yet completed.
- Requirement: At least one tester installs from opt-in link and confirms purchase verification flow.

9. Upload keystore long-term retention not yet confirmed.
- Requirement: Keep the upload keystore and credentials in secure storage for all future updates.

## Evidence already ready (no action needed unless changed)
- Release AAB exists: android/app/build/outputs/bundle/release/app-release.aab
- Metadata files prepared under: android/playstore/metadata/
- Account deletion API and in-app flow implemented.
- Android cleartext disabled and HTTPS scheme configured.
- Version bumped to 2 / 1.1.0.
