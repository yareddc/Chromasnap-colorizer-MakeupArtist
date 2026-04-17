# Play Internal Testing Submission Checklist

## Required artifacts
- [ ] AAB generated: `android/app/build/outputs/bundle/release/app-release.aab`
- [ ] App icon prepared: `android/playstore/icon.png`
- [ ] Short description pasted from `listing-short-description-en-US.txt`
- [ ] Full description pasted from `listing-full-description-en-US.txt`
- [ ] Release notes pasted from `release-notes-internal-testing-en-US.txt`

## Store listing / policy fields
- [ ] App category selected (Photography recommended)
- [ ] Contact email added
- [x] Privacy Policy URL added: https://chromasnap.app/privacy
- [ ] Data Safety form completed using `play-data-safety-template.md`
- [ ] Content rating completed using `play-content-rating-notes.md`

## App access and account
- [ ] Test credentials provided in Play Console if login is required for review
- [ ] Account deletion path verified in app: Account > Account Details > Danger Zone
- [ ] Recovery flow verified (username/password recovery)

## Billing and compliance
- [ ] Google Play products (subs/inapp) created and active in Play Console
- [ ] App product IDs match backend mappings and app env values
- [ ] Purchase verification endpoint deployed and healthy
- [ ] Internal tester account can complete a test purchase flow

## Final checks
- [ ] Internal testing track selected
- [ ] Testers list/group configured
- [ ] Rollout started
- [ ] Install via opt-in link validated on tester device
