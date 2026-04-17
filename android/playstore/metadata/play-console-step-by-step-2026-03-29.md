# Play Console Step-by-Step (Internal Testing)

Use this sequence in Google Play Console from top to bottom.

## 1) Open app and verify baseline
1. Open Play Console.
2. Select app: ChromaSnap.
3. Confirm package name matches app id: com.chromasnap.app.

## 2) Store listing
1. Go to Store presence > Main store listing.
2. Paste short description from:
   - android/playstore/metadata/listing-short-description-en-US.txt
3. Paste full description from:
   - android/playstore/metadata/listing-full-description-en-US.txt
4. Set app category to Photography.
5. Add support contact email (monitored inbox).
6. Add Privacy Policy URL (public HTTPS URL, not localhost).
7. Save.

## 3) App content
1. Go to Policy and programs > App content.
2. Complete Privacy Policy section using your public URL.
3. Complete Data safety using:
   - android/playstore/metadata/play-data-safety-template.md
4. Complete Content rating questionnaire using:
   - android/playstore/metadata/play-content-rating-notes.md
5. Complete App access section:
   - If login required for reviewer, provide test username and password.
6. Save each section and mark as complete.

## 4) Monetization setup
1. Go to Monetize with Play > Products.
2. Verify these product ids exist and are active:
   - chromasnap_pro
   - chromasnap_enterprise
   - chromasnap_topup_100
   - chromasnap_topup_500
   - chromasnap_topup_1000
3. If any missing, create and activate before release.

## 5) Internal testing release
1. Go to Testing > Internal testing.
2. Create new release.
3. Upload AAB:
   - android/app/build/outputs/bundle/release/app-release.aab
4. Paste release notes from:
   - android/playstore/metadata/release-notes-internal-testing-en-US.txt
5. Save.

## 6) Testers
1. In Internal testing, open Testers tab.
2. Add tester email list or Google Group.
3. Save changes.

## 7) Review and rollout
1. Return to release overview.
2. Resolve any blocking warnings.
3. Start rollout to Internal testing.

## 8) Post-rollout validation
1. Open opt-in link from Internal testing page.
2. Install app on tester Android device.
3. Verify:
   - Login and recovery flows work.
   - Account deletion works in Account Details > Danger Zone.
   - Purchase flow completes and backend verification succeeds.

## 9) Final evidence checklist
Use this file as your completion tracker:
- android/playstore/metadata/pre-upload-go-no-go-2026-03-27.md

When all unresolved items are complete, decision moves to GO.
