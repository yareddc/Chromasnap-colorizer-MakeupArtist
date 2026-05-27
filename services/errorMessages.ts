/**
 * Converts raw technical error messages into user-friendly descriptions.
 * Logs full technical details to console only (visible to devs, not users).
 */

const FRIENDLY_MAP: Array<[RegExp | string, string]> = [
  // Network / connectivity
  [/failed to fetch/i,               'Could not reach the server. Check your internet connection and try again.'],
  [/network request failed/i,        'Network error. Check your internet connection and try again.'],
  [/networkerror/i,                  'Network error. Check your internet connection and try again.'],
  [/load failed/i,                   'Could not connect to the server. Check your internet connection.'],
  [/backend unreachable/i,           'The server is temporarily unavailable. Please try again in a moment.'],
  [/ECONNREFUSED/i,                  'The server is temporarily unavailable. Please try again in a moment.'],
  [/timeout/i,                       'The request took too long. Please check your connection and try again.'],

  // Firebase / Google auth
  [/auth\/invalid-phone-number/i,    'That phone number doesn\'t look right. Please enter it with your country code (e.g. +1 234 567 8900).'],
  [/auth\/too-many-requests/i,       'Too many attempts. Please wait a few minutes before trying again.'],
  [/auth\/quota-exceeded/i,          'Too many requests right now. Please try again later.'],
  [/auth\/invalid-verification-code/i, 'That code is incorrect. Please double-check and try again.'],
  [/auth\/code-expired/i,            'The verification code has expired. Please request a new one.'],
  [/auth\/session-expired/i,         'Your session has expired. Please request a new code.'],
  [/auth\/popup-closed-by-user/i,    'Sign-in was cancelled. Please try again.'],
  [/auth\/cancelled-popup-request/i, 'Sign-in was cancelled. Please try again.'],
  [/auth\/popup-blocked/i,           'Sign-in popup was blocked by your browser. Please allow popups and try again.'],
  [/auth\/account-exists-with-different-credential/i, 'An account already exists with a different sign-in method. Please use your original sign-in method.'],
  [/auth\/user-disabled/i,           'This account has been disabled. Please contact support.'],
  [/auth\/internal-error/i,          'We ran into a technical problem with sign-in. Please try again.'],
  [/auth\/network-request-failed/i,  'Sign-in failed due to a network error. Check your connection and try again.'],
  [/auth\/web-storage-unsupported/i, 'Your browser doesn\'t support the storage needed for sign-in. Try a different browser.'],
  [/invalid or expired social login token/i, 'Sign-in session expired. Please try signing in again.'],

  // OTP / Phone
  [/phone verification timed out/i,  'Verification timed out. Please request a new code.'],
  [/phone verification failed/i,     'Phone verification failed. Please check your number and try again.'],
  [/phone verification completed but no id token/i, 'Verification succeeded but sign-in failed. Please try again.'],
  [/no firebase id token/i,          'Sign-in could not be completed. Please try again.'],

  // Login / Registration
  [/invalid credentials/i,           'Incorrect username or password.'],
  [/invalid username or password/i,  'Incorrect username or password.'],
  [/username.*already.*taken/i,      'That username is already taken. Please choose a different one.'],
  [/username.*not found/i,           'No account found with that username.'],
  [/account.*locked/i,               'Your account has been temporarily locked due to too many failed attempts. Please try again later.'],
  [/captcha/i,                       'Please complete the security check to continue.'],
  [/session expired/i,               'Your session has expired. Please log in again.'],

  // Account / billing
  [/failed to load subscription/i,   'Could not load your subscription details. Please refresh and try again.'],
  [/direct token top-up is disabled in production/i, 'Token top-up is only available through Google Play in production. Use the Android app to purchase token packs.'],
  [/direct token top-up is disabled on android/i, 'Use Google Play Billing in the Android app to purchase token packs.'],
  [/direct subscription changes are disabled in production/i, 'Plan changes are only available through Google Play in production. Use the Android app to manage your subscription.'],
  [/direct subscription changes are disabled on android/i, 'Use Google Play Billing in the Android app to manage your subscription.'],
  [/google play purchase flow/i,      'Use Google Play Billing in the Android app to complete this purchase.'],
  [/failed to delete account/i,      'Account deletion failed. Please try again.'],
  [/password.*incorrect/i,           'Incorrect password.'],
  [/passwords do not match/i,        'The passwords you entered don\'t match.'],

  // Image processing
  [/analysis failed/i,               'Image analysis failed. Please try a different image.'],
  [/failed to colorize/i,            'Colorization failed. Please try again.'],
  [/failed to upscale/i,             'Upscaling failed. Please try again.'],
  [/failed to increase vibrancy/i,   'Vibrancy enhancement failed. Please try again.'],
  [/failed to sharpen/i,             'Sharpening failed. Please try again.'],
  [/usage limit/i,                   'You\'ve reached your usage limit for this month. Upgrade your plan to continue.'],
  [/insufficient tokens?/i,          'You\'re out of tokens. Please top up or upgrade your plan to continue.'],
  [/insufficient token balance/i,    'You\'re out of tokens. Please top up or upgrade your plan to continue.'],
  [/out of tokens?/i,                'You\'re out of tokens. Please top up or upgrade your plan to continue.'],
  [/not enough tokens/i,             'You\'ve used all your tokens for this month. Upgrade your plan to continue.'],

  // Recovery
  [/no usernames found/i,            'No account was found with that recovery email.'],
  [/recovery email/i,                'There was a problem with your recovery email. Please check it and try again.'],
  [/reset token/i,                   'The reset link is invalid or has expired. Please request a new one.'],

  // Generic server errors
  [/500/,                            'Something went wrong on our end. Please try again shortly.'],
  [/503/,                            'The service is temporarily unavailable. Please try again in a moment.'],
  [/rate limit/i,                    'Too many requests. Please slow down and try again.'],
];

export function friendlyError(error: unknown, context?: string): string {
  const raw: string =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error);

  // Always log technical details to console for developer visibility
  console.error(`[ChromaSnap${context ? ' ' + context : ''}]`, raw, error);

  for (const [pattern, friendly] of FRIENDLY_MAP) {
    if (typeof pattern === 'string' ? raw.includes(pattern) : pattern.test(raw)) {
      return friendly;
    }
  }

  // Generic fallback — never leak stack traces or server internals to users
  return 'Something went wrong. Please try again.';
}
