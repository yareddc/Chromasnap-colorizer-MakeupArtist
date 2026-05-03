# Firebase Emulator Setup for Phone OTP Testing

This guide enables testing phone OTP authentication locally on **Android Emulator** without external dependencies (no SMS delivery needed).

## Quick Start

### 1. Start Firebase Emulator (Terminal 1)

From the project root:

```bash
npx firebase emulators:start --project chrommasnap-vertex-ai-use
```

**Expected output:**
```
i  emulators: Logging to emulator-debug.log
i  auth: Auth Emulator logging to auth-debug.log
✔  Auth Emulator started at http://127.0.0.1:9099
```

### 2. Build & Deploy to Android Emulator (Terminal 2)

```bash
npm run build
cd android
./gradlew assembleDebug
```

Then deploy to running Android emulator:
```bash
adb install -r build/outputs/apk/debug/app-debug.apk
```

### 3. Open App on Android Emulator

1. Launch the app
2. Check ADB logcat for:
   ```
   ✓ Android Emulator: Connecting to Firebase Auth Emulator at 10.0.2.2:9099
   ✓ Connected to Firebase Auth Emulator | Test phone: +44 1234 567890 | Code: 555555
   ```

## Testing Phone OTP on Android Emulator

**Test Phone Number:** `+44 1234 567890` (only works with emulator running)  
**Auto-Verification Code:** `555555` (auto-fills; just tap OK)

### Flow:
1. Tap "Phone OTP" / "Send OTP" button
2. Enter phone: `+44 1234 567890`
3. Tap "Send Code"
4. When prompted for code, enter: `555555`
5. Should auto-verify and log in

## Web Browser Testing (Optional)

To test via browser while emulator runs:

```bash
npm run dev
```

Navigate to `http://localhost:5173` and repeat the OTP flow. Same test credentials work.

## Important Notes

- ✅ Test phone (`+44 1234 567890`) ONLY works with emulator running
- ✅ No SMS delivery needed (auto-mocked in emulator)
- ✅ No reCAPTCHA required (emulator bypasses this)
- ✅ Android connects via special IP: `10.0.2.2` (emulator's host gateway)
- ⚠️ All emulator data is deleted when emulator stops
- ⚠️ Each time you stop/start emulator, create fresh test users

## Troubleshooting

**Logcat shows "could not connect to emulator"?**
```bash
# Check if Firebase emulator is running
netstat -ano | findstr 9099

# Kill any existing emulator processes and restart
npx firebase emulators:start --project chrommasnap-vertex-ai-use
```

**Android app not connecting to 10.0.2.2:9099?**
- Ensure Android emulator is running (`adb devices` should show it)
- Ensure Firebase emulator is running on port 9099
- Check if firewall is blocking localhost:9099
- Try: `adb shell ping 10.0.2.2` to verify connectivity

**Test phone credentials don't work?**
- Phone MUST be `+44 1234 567890` (exactly as shown)
- Code MUST be `555555` (exactly)
- Emulator must be actively running (`npx firebase emulators:start`)
- If still failing, restart both Firebase emulator and Android emulator

**"Still using production Firebase in logs"?**
- Verify `npm run build` and `./gradlew assembleDebug` used same code (with emulator connection code)
- Check `import.meta.env.DEV` - for native builds, set via Vite ENV variable
- May need to set `DEV=true` explicitly in build: `DEV=true npm run build`

## Environment Variable for Native Builds

For Android native builds, ensure development flag is set:

```bash
# Web (automatic with npm run dev)
npm run dev

# Native (explicit for build-time emulator toggle)
DEV=true npm run build
cd android
./gradlew assembleDebug
```

## For Production Testing on Real Device

When ready to test against real Firebase (requires reCAPTCHA domain whitelisting):
1. Stop the emulator (Ctrl+C)
2. Rebuild without dev flag: `npm run build && npm run build:android`
3. Your app will auto-fallback to production Firebase
4. Use real phone numbers with valid SMS delivery
5. Add your emulator/device domain to Firebase Console → Auth → reCAPTCHA whitelist

