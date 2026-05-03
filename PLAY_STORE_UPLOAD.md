# End-to-End Test & Play Store Upload Guide

## Option 1: Build Signed AAB via GitHub Actions (RECOMMENDED)

### Step 1: Trigger the Workflow

1. Go to: https://github.com/yareddc/ChromaSnap-ai/actions
2. Find: **"Android Signed AAB"** workflow
3. Click **"Run workflow"** → **"Run workflow"**

The workflow will:
- ✅ Build web assets with production Firebase
- ✅ Sync Capacitor Android assets  
- ✅ Decode signing keystore from secrets
- ✅ Decode google-services.json
- ✅ Build release AAB (signed)
- ✅ Upload as artifact

**Expected duration:** ~10 minutes

### Step 2: Download the Signed AAB

1. Wait for workflow to complete (green checkmark)
2. Click on the completed run
3. Scroll to **"Artifacts"** section
4. Download **"app-release-aab"** → contains `app-release.aab`

### Step 3: Upload to Google Play Console

1. Go to: https://play.google.com/console
2. Select **"ChromaSnap"** project
3. Navigate: **Release** → **Production** (or **Internal Testing**)
4. Click **"Create new release"**
5. Upload the `app-release.aab` file
6. Add release notes:
   ```
   Bug fixes:
   - Fixed Google Sign-In on real Android devices
   - Fixed system keystore/Credential Manager fallback
   - Fixed API connectivity for production environment
   - Improved OTP verification on Firebase
   
   Features:
   - Phone OTP authentication with production Firebase
   - Google Sign-In with Credential Manager support
   ```
7. Review & submit for review (or Internal Testing)

---

## Option 2: Build Locally

If you have the keystore passwords, you can build locally:

```bash
npm run build

cd android

# Set these environment variables:
$env:KEYSTORE_PATH = "app/chromasnap-upload-key.jks"
$env:KEYSTORE_PASSWORD = "your-password-here"
$env:KEY_ALIAS = "your-key-alias"
$env:KEY_PASSWORD = "your-key-password"

./gradlew :app:bundleRelease --no-daemon

# Output: app/build/outputs/bundle/release/app-release.aab
```

---

## Quick Verification Before Upload

### Test on Device/Emulator:
1. Install debug APK: `adb install android/app/build/outputs/apk/debug/app-debug.apk`
2. Test flows:
   - ✅ Account creation
   - ✅ Google Sign-In (Continue with Google)
   - ✅ Phone OTP (via Firebase)
   - ✅ Image upload & colorization

### Logs to Check:
```bash
adb logcat | Select-String "gmail|firebase|error"
```

---

## Play Console Upload Checklist

- [ ] Reviewed app privacy policy
- [ ] Production Firebase credentials are correct
- [ ] Google Play Billing configured
- [ ] Valid signing certificate
- [ ] Content rating filled out
- [ ] Store listing updated
- [ ] Pricing & distribution set

---

## After Upload

1. Wait for Google Play review (~24-48 hours for Play Store)
2. For internal testing, release is immediate
3. Monitor crash reports in Play Console
4. Push beta versions for testing before production

---

## Troubleshooting

**GitHub workflow fails?**
- Check secrets in Settings → Secrets and variables → Actions
- Verify keystore base64 is properly encoded
- Check action logs for specific errors

**Play Console upload fails?**
- AAB might older format - use latest
- Signing cert must match existing app cert
- Version code must be higher than previous release

**App crashes after upload?**
- Check Play Console → Android Vitals → Crashes
- Use Firebase Console → Crashlytics
- Check logcat from real device

