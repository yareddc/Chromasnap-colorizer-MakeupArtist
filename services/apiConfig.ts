/**
 * API Configuration
 * Centralized place to manage API base URL and endpoints
 */

// Get the API base URL from environment variables.
// In deployed web builds, default to same-origin so API calls target the Cloud Run host.
const resolveDefaultApiBaseUrl = (): string => '';

const API_BASE_URL = (import.meta.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  resolveDefaultApiBaseUrl()) as string;

/**
 * API Endpoints
 * All API endpoints relative to the base URL
 */
export const API_ENDPOINTS = {
  // Analysis endpoints
  ANALYZE_MONOCHROMATIC: `${API_BASE_URL}/api/analyze/monochromatic`,
  ANALYZE_SAFETY: `${API_BASE_URL}/api/analyze/safety`,

  // Image processing endpoints
  PROCESS_COLORIZE: `${API_BASE_URL}/api/process/colorize`,
  PROCESS_UPSCALE: `${API_BASE_URL}/api/process/upscale`,
  PROCESS_VIBRANCY: `${API_BASE_URL}/api/process/vibrancy`,
  PROCESS_SHARPEN: `${API_BASE_URL}/api/process/sharpen`,
  PROCESS_ANIMATE: `${API_BASE_URL}/api/process/animate`,
  PROCESS_ANIMATE_START: `${API_BASE_URL}/api/process/animate/start`,
  PROCESS_ANIMATE_STATUS: `${API_BASE_URL}/api/process/animate/status`,
  PROCESS_ANIMATE_RESULT: `${API_BASE_URL}/api/process/animate/result`,

  // Subscription endpoints
  SUBSCRIPTION_PLANS: `${API_BASE_URL}/api/subscription/plans`,
  SUBSCRIPTION_ME: `${API_BASE_URL}/api/subscription/me`,
  SUBSCRIPTION_SUBSCRIBE: `${API_BASE_URL}/api/subscription/subscribe`,
  SUBSCRIPTION_TOPUP: `${API_BASE_URL}/api/subscription/topup`,
  SUBSCRIPTION_USAGE: `${API_BASE_URL}/api/subscription/usage`,
  BILLING_GOOGLE_PLAY_VERIFY: `${API_BASE_URL}/api/billing/google-play/verify`,

  // Auth endpoints
  AUTH_REGISTER: `${API_BASE_URL}/api/auth/register`,
  AUTH_LOGIN: `${API_BASE_URL}/api/auth/login`,
  AUTH_ME: `${API_BASE_URL}/api/auth/me`,
  AUTH_LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  AUTH_DELETE_ACCOUNT: `${API_BASE_URL}/api/auth/account`,
  AUTH_RECOVER_USERNAME: `${API_BASE_URL}/api/auth/recover/username`,
  AUTH_RECOVER_PASSWORD_REQUEST: `${API_BASE_URL}/api/auth/recover/password/request`,
  AUTH_RECOVER_PASSWORD_CONFIRM: `${API_BASE_URL}/api/auth/recover/password/confirm`,

  AUTH_SOCIAL_LOGIN: `${API_BASE_URL}/api/auth/social-login`,

  // Admin endpoints
  ADMIN_USERNAMES: `${API_BASE_URL}/api/admin/usernames`,
} as const;

/**
 * Get the base URL for API calls
 * @returns The API base URL
 */
export const getApiBaseUrl = (): string => {
  return API_BASE_URL;
};

/**
 * Build a full API URL from an endpoint key
 * @param endpoint - The endpoint key from API_ENDPOINTS
 * @returns The full URL
 */
export const buildApiUrl = (endpoint: string): string => {
  return endpoint;
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  getApiBaseUrl,
  buildApiUrl,
};
