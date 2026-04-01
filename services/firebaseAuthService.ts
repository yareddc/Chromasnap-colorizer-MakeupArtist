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
  signInWithPopup,
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
// Google Sign-In
// ---------------------------------------------------------------------------

/**
 * Sign in with Google.
 * - On native Android (Capacitor): delegates to @capacitor-firebase/authentication.
 * - On web: uses Firebase popup flow.
 * Returns a Firebase ID token that can be sent to the backend.
 */
export const signInWithGoogle = async (): Promise<string> => {
  if (Capacitor.isNativePlatform()) {
    // Native Android: use Capacitor Firebase Auth plugin
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await (FirebaseAuthentication as any).signInWithGoogle();

    // Backend verifies Firebase ID tokens via Admin SDK verifyIdToken(),
    // so fetch the Firebase token from the signed-in Firebase user.
    const tokenResult = await (FirebaseAuthentication as any).getIdToken().catch(() => null);
    const firebaseIdToken = tokenResult?.token;
    if (firebaseIdToken) {
      return firebaseIdToken as string;
    }

    throw new Error('Google Sign-In succeeded, but no Firebase ID token was available.');
  }

  // Web: use Firebase JS SDK popup
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  const credential = await signInWithPopup(auth, provider);
  const idToken = await credential.user.getIdToken();
  return idToken;
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
