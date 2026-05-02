/**
 * Firebase Authentication Service
 * Handles Google Sign-In and Phone/OTP login for both web and native Android.
 *
 * Required env vars (add to .env / Vite):
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_APP_ID
 *
 * For native Android, also add google-services.json to android/app/.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type Auth,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';

type PhoneOtpStartResult =
  | { status: 'code-sent' }
  | { status: 'verified'; idToken: string };

// ---------------------------------------------------------------------------
// Firebase initialisation (lazy, one-time)
// ---------------------------------------------------------------------------

let _firebaseApp: FirebaseApp | null = null;
let _firebaseAuth: Auth | null = null;

const getFirebaseConfig = () => ({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
});

const isFirebaseConfigured = (): boolean => {
  const cfg = getFirebaseConfig();
  return !!(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
};

const getFirebaseApp = (): FirebaseApp => {
  if (_firebaseApp) return _firebaseApp;
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Add VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID to your .env file.'
    );
  }
  const apps = getApps();
  _firebaseApp = apps.length ? apps[0] : initializeApp(getFirebaseConfig());
  return _firebaseApp;
};

const getFirebaseAuth = (): Auth => {
  if (_firebaseAuth) return _firebaseAuth;
  _firebaseAuth = getAuth(getFirebaseApp());
  return _firebaseAuth;
};

export const isFirebaseAvailable = (): boolean => isFirebaseConfigured();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** sessionStorage key set before a redirect so we know to pick up the result on return */
const REDIRECT_PENDING_KEY = '_cs_google_redirect_pending';

/** True when running in a mobile browser (not native Capacitor). */
const isMobileWeb = (): boolean =>
  !Capacitor.isNativePlatform() &&
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

// ---------------------------------------------------------------------------
// Google Sign-In
// ---------------------------------------------------------------------------

/**
 * Sign in with Google.
 * - Native Android: delegates to @capacitor-firebase/authentication.
 * - Mobile web: uses signInWithRedirect (popups are blocked on mobile browsers).
 *               Throws a special '__redirect__' signal — caller must show
 *               "Redirecting…" and wait; result comes back via checkGoogleRedirectResult().
 * - Desktop web: uses signInWithPopup.
 */
export const signInWithGoogle = async (): Promise<string> => {
  if (Capacitor.isNativePlatform()) {
    // Native Android: use Capacitor Firebase Auth plugin
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');

    try {
      await (FirebaseAuthentication as any).signInWithGoogle({
        useCredentialManager: true,
      });
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();
      // Some emulator/device setups return "No credentials available" with
      // Credential Manager even when Google accounts exist.
      if (message.includes('no credentials available')) {
        await (FirebaseAuthentication as any).signInWithGoogle({
          useCredentialManager: false,
        });
      } else {
        throw error;
      }
    }

    const tokenResult = await (FirebaseAuthentication as any).getIdToken().catch(() => null);
    const firebaseIdToken = tokenResult?.token;
    if (firebaseIdToken) {
      return firebaseIdToken as string;
    }

    throw new Error('Google Sign-In succeeded, but no Firebase ID token was available.');
  }

  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  // Use redirect for all web browsers (popups are unreliable: blocked by browsers,
  // affected by cross-site storage restrictions, and fail silently on some setups)
  sessionStorage.setItem(REDIRECT_PENDING_KEY, '1');
  await signInWithRedirect(auth, provider);
  // signInWithRedirect navigates away; this line is never reached
  throw new Error('__redirect__');
};

/**
 * Call once on app load to pick up a pending Google redirect result.
 * Returns a Firebase ID token if the user just completed a redirect sign-in,
 * or null if there is no pending result.
 */
export const checkGoogleRedirectResult = async (): Promise<string | null> => {
  if (Capacitor.isNativePlatform() || !isFirebaseConfigured()) return null;

  const auth = getFirebaseAuth();

  // Always try getRedirectResult first — safe to call on every page load;
  // returns null immediately if no redirect was pending.
  const result = await getRedirectResult(auth);
  if (result) {
    sessionStorage.removeItem(REDIRECT_PENDING_KEY);
    return await result.user.getIdToken();
  }

  // Only use the slower fallbacks if we know a redirect was initiated
  // (sessionStorage key set before signInWithRedirect was called)
  const isRedirectPending = sessionStorage.getItem(REDIRECT_PENDING_KEY);
  if (!isRedirectPending) return null;
  sessionStorage.removeItem(REDIRECT_PENDING_KEY);

  // Fallback: Firebase may have updated auth.currentUser synchronously
  if (auth.currentUser) return await auth.currentUser.getIdToken();

  // Final fallback: wait for onAuthStateChanged (handles cases where
  // getRedirectResult returns null but the browser still sets the user)
  return new Promise((resolve) => {
    const timer = setTimeout(() => { unsubscribe(); resolve(null); }, 8000);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        clearTimeout(timer);
        unsubscribe();
        resolve(await user.getIdToken());
      }
    });
  });
};

// ---------------------------------------------------------------------------
// Phone / OTP Sign-In
// ---------------------------------------------------------------------------

let _confirmationResult: ConfirmationResult | null = null;
let _nativeVerificationId: string | null = null;
let _nativeAutoIdToken: string | null = null;

/**
 * Send a phone verification OTP.
 * - On native Android: uses Capacitor Firebase Auth plugin (no reCAPTCHA needed).
 * - On web: uses Firebase invisible reCAPTCHA + phone auth.
 *
 * @param phoneNumber  E.164 format, e.g. "+12025551234"
 * @param recaptchaContainerId  DOM element id for reCAPTCHA widget on web (default: "recaptcha-container")
 */
export const sendPhoneOtp = async (
  phoneNumber: string,
  recaptchaContainerId = 'recaptcha-container'
): Promise<PhoneOtpStartResult> => {
  if (!phoneNumber.startsWith('+')) {
    throw new Error('Phone number must be in E.164 format (e.g. +12025551234).');
  }

  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    _nativeVerificationId = null;
    _nativeAutoIdToken = null;

    const startPromise = new Promise<PhoneOtpStartResult>(async (resolve, reject) => {
      let settled = false;
      const listenerHandles: Array<{ remove: () => Promise<void> }> = [];

      const cleanup = async () => {
        await Promise.all(listenerHandles.map((h) => h.remove().catch(() => undefined)));
      };

      const resolveOnce = async (value: PhoneOtpStartResult) => {
        if (settled) return;
        settled = true;
        await cleanup();
        resolve(value);
      };

      const rejectOnce = async (error: Error) => {
        if (settled) return;
        settled = true;
        await cleanup();
        reject(error);
      };

      listenerHandles.push(await (FirebaseAuthentication as any).addListener('phoneCodeSent', (event: any) => {
        _nativeVerificationId = event?.verificationId ?? null;
        if (_nativeVerificationId) {
          void resolveOnce({ status: 'code-sent' });
        }
      }));

      listenerHandles.push(await (FirebaseAuthentication as any).addListener('phoneVerificationCompleted', async (event: any) => {
        try {
          // Always fetch the Firebase ID token explicitly after verification
          const tokenResult = await (FirebaseAuthentication as any).getIdToken().catch(() => null);
          const idToken = tokenResult?.token;
          
          if (!idToken) {
            return rejectOnce(new Error('Phone verification completed but no ID token was returned.'));
          }

          _nativeAutoIdToken = idToken;
          void resolveOnce({ status: 'verified', idToken });
        } catch (error: any) {
          void rejectOnce(new Error(`Phone verification completed but failed to retrieve token: ${error?.message}`));
        }
      }));

      listenerHandles.push(await (FirebaseAuthentication as any).addListener('phoneVerificationFailed', (event: any) => {
        const message = event?.message || 'Phone verification failed.';
        void rejectOnce(new Error(message));
      }));

      try {
        await (FirebaseAuthentication as any).signInWithPhoneNumber({ phoneNumber });
      } catch (error: any) {
        void rejectOnce(new Error(error?.message || 'Failed to start phone sign-in.'));
        return;
      }

      setTimeout(() => {
        if (!settled) {
          void rejectOnce(new Error('Phone verification timed out waiting for verification response.'));
        }
      }, 30000);
    });

    return startPromise;
  }

  // Web: wire up invisible reCAPTCHA
  const auth = getFirebaseAuth();
  let container = document.getElementById(recaptchaContainerId);
  if (!container) {
    container = document.createElement('div');
    container.id = recaptchaContainerId;
    document.body.appendChild(container);
  }

  const appVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
  _confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  return { status: 'code-sent' };
};

/**
 * Confirm the OTP code received by SMS.
 * Returns a Firebase ID token to send to the backend.
 */
export const confirmPhoneOtp = async (otpCode: string): Promise<string> => {
  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');

    if (_nativeAutoIdToken) {
      const token = _nativeAutoIdToken;
      _nativeAutoIdToken = null;
      return token;
    }

    if (!_nativeVerificationId) {
      throw new Error('No pending phone verification. Call sendPhoneOtp() first.');
    }
    
    // Verify the OTP code
    await (FirebaseAuthentication as any).confirmVerificationCode({
      verificationId: _nativeVerificationId,
      verificationCode: otpCode,
    });
    _nativeVerificationId = null;

    // Explicitly fetch the Firebase ID token (not credential token) for backend verification
    const tokenResult = await (FirebaseAuthentication as any).getIdToken().catch(() => null);
    const idToken = tokenResult?.token;
    
    if (!idToken) {
      throw new Error('Phone verification succeeded but no Firebase ID token was returned.');
    }
    
    return idToken as string;
  }

  // Web
  if (!_confirmationResult) {
    throw new Error('No pending phone verification. Call sendPhoneOtp() first.');
  }
  const userCredential = await _confirmationResult.confirm(otpCode);
  _confirmationResult = null;
  const idToken = await userCredential.user.getIdToken();
  return idToken;
};
