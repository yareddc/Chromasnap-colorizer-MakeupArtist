
/**
 * API Service for communicating with the backend
 */
import { API_ENDPOINTS } from './apiConfig';
import type { AuthUser, StripeTokenPack, SubscriptionAccount, SubscriptionBillingConfig, SubscriptionUsageItem } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const USER_ID_STORAGE_KEY = 'chromasnap_user_id';
const AUTH_TOKEN_STORAGE_KEY = 'chromasnap_auth_token';

const getUserId = (): string => {
  const existing = localStorage.getItem(USER_ID_STORAGE_KEY);
  if (existing) return existing;

  const generated = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
    ? globalThis.crypto.randomUUID()
    : `user_${Date.now()}`;
  localStorage.setItem(USER_ID_STORAGE_KEY, generated);
  return generated;
};

export const getCurrentUserId = (): string => getUserId();

export const setCurrentUserId = (userId: string): string => {
  const trimmed = userId.trim();
  if (!trimmed) return getUserId();
  localStorage.setItem(USER_ID_STORAGE_KEY, trimmed);
  return trimmed;
};

const getJsonHeaders = () => {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  return {
    'Content-Type': 'application/json',
    'x-user-id': getUserId(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const setAuthToken = (token: string) => {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
};

export const clearAuthToken = () => {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
};

export const hasAuthToken = (): boolean => Boolean(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));

const parseJsonResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error("Backend unreachable (HTML received). Make sure the API URL points to the host computer's IP address.");
  }
  return response.json();
};

export const isBlackAndWhite = async (base64Image: string): Promise<boolean> => {
  try {
    const response = await fetch(API_ENDPOINTS.ANALYZE_MONOCHROMATIC, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      console.error(`Backend error (${response.status}): Is the server running?`);
      throw new Error('Analysis failed');
    }
    const result = await parseJsonResponse(response);
    return !!result.isMonochromatic;
  } catch (error) {
    console.error("Monochromatic check failed:", error);
    return true; // Default fail-safe
  }
};

export const colorizeImage = async (base64Image: string, theme: string = 'Natural'): Promise<string> => {
  try {
    const response = await fetch(API_ENDPOINTS.PROCESS_COLORIZE, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ image: base64Image, theme }),
    });

    if (!response.ok) {
      let errorMessage = 'Colorization failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        if (errorData.details) errorMessage += `: ${errorData.details}`;
      } catch {
        errorMessage = `Server error (${response.status}): Is the backend running?`;
      }
      throw new Error(errorMessage);
    }

    const data = await parseJsonResponse(response);
    return data.result;
  } catch (error: any) {
    console.error("Colorization API Error:", error);
    throw new Error(error.message || "Failed to colorize image.");
  }
};

export const upscaleImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await fetch(API_ENDPOINTS.PROCESS_UPSCALE, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      let errorMessage = 'Upscaling failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = `Server error (${response.status}): Is the backend running?`;
      }
      throw new Error(errorMessage);
    }

    const data = await parseJsonResponse(response);
    return data.result;
  } catch (error: any) {
    console.error("Upscale API Error:", error);
    throw new Error(error.message || "Failed to upscale image.");
  }
};

export const enhanceVibrancy = async (base64Image: string): Promise<string> => {
  try {
    const response = await fetch(API_ENDPOINTS.PROCESS_VIBRANCY, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      let errorMessage = 'Enhancement failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = `Server error (${response.status}): Is the backend running?`;
      }
      throw new Error(errorMessage);
    }

    const data = await parseJsonResponse(response);
    return data.result;
  } catch (error: any) {
    console.error("Vibrancy API Error:", error);
    throw new Error(error.message || "Failed to increase vibrancy.");
  }
};

export const sharpenImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await fetch(API_ENDPOINTS.PROCESS_SHARPEN, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      let errorMessage = 'Sharpening failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = `Server error (${response.status}): Is the backend running?`;
      }
      throw new Error(errorMessage);
    }

    const data = await parseJsonResponse(response);
    return data.result;
  } catch (error: any) {
    console.error("Sharpen API Error:", error);
    throw new Error(error.message || "Failed to sharpen image.");
  }
};

export const checkImageSafety = async (base64Image: string): Promise<{ isSafe: boolean; containsMinors?: boolean; reason?: string }> => {
  try {
    const response = await fetch(API_ENDPOINTS.ANALYZE_SAFETY, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      console.error(`Backend error (${response.status}): Is the server running?`);
      throw new Error('Safety check failed');
    }
    return await parseJsonResponse(response);
  } catch (error) {
    console.error("Safety check API failed:", error);
    return { isSafe: true, containsMinors: false, reason: "" };
  }
};

export const animateImage = async (
  base64Image: string,
  onProgress?: (message: string) => void
): Promise<string> => {
  try {
    onProgress?.('Queueing animation job...');
    const startResponse = await fetch(API_ENDPOINTS.PROCESS_ANIMATE_START, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ image: base64Image }),
    });

    if (startResponse.ok) {
      const startData = await startResponse.json().catch(() => ({}));
      const jobId = startData.jobId as string | undefined;

      if (jobId) {
        const maxPolls = 120;
        const pollIntervalMs = 5000;

        for (let attempt = 0; attempt < maxPolls; attempt += 1) {
          onProgress?.(`Generating animation... (${attempt + 1}/${maxPolls})`);
          const statusResponse = await fetch(`${API_ENDPOINTS.PROCESS_ANIMATE_STATUS}/${jobId}`, {
            headers: getJsonHeaders(),
          });
          if (statusResponse.ok) {
            const statusData = await statusResponse.json().catch(() => ({}));

            if (statusData.status === 'done') {
              const resultResponse = await fetch(`${API_ENDPOINTS.PROCESS_ANIMATE_RESULT}/${jobId}`, {
                headers: getJsonHeaders(),
              });
              if (resultResponse.ok) {
                const blob = await resultResponse.blob();
                return URL.createObjectURL(blob);
              }

              const resultError = await resultResponse.json().catch(() => ({}));
              if (statusData.videoUrl) return statusData.videoUrl;
              throw new Error(resultError.error || 'Failed to fetch animation result');
            }

            if (statusData.status === 'error') {
              throw new Error(statusData.error || 'Animation failed');
            }
          }

          await sleep(pollIntervalMs);
        }

        throw new Error('Animation timed out. Please try again.');
      }
    }

    onProgress?.('Generating animation...');
    const response = await fetch(API_ENDPOINTS.PROCESS_ANIMATE, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Animation failed');
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json().catch(() => ({}));
      if (data.videoUrl) return data.videoUrl;
      throw new Error(data.error || 'Animation failed');
    }

    if (contentType && contentType.includes('text/html')) {
      throw new Error("Backend unreachable (HTML received). Make sure the API URL points to the host computer's IP address.");
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error: any) {
    console.error("Animation API Error:", error);
    throw new Error(error.message || "Failed to animate image.");
  }
};

export const fetchSubscriptionPlans = async (): Promise<SubscriptionBillingConfig> => {
  const response = await fetch(API_ENDPOINTS.SUBSCRIPTION_PLANS, {
    headers: getJsonHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to load billing config');
  }
  return parseJsonResponse(response) as Promise<SubscriptionBillingConfig>;
};

export const fetchSubscriptionMe = async (): Promise<SubscriptionAccount> => {
  const response = await fetch(API_ENDPOINTS.SUBSCRIPTION_ME, {
    headers: getJsonHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to load account');
  }
  const data = await parseJsonResponse(response);
  return data.account as SubscriptionAccount;
};

export const fetchSubscriptionUsage = async (): Promise<{ account: SubscriptionAccount; usage: SubscriptionUsageItem[] }> => {
  const response = await fetch(API_ENDPOINTS.SUBSCRIPTION_USAGE, {
    headers: getJsonHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to load usage');
  }
  return parseJsonResponse(response);
};

export const registerUser = async (payload: { username: string; password: string; recoveryEmail: string }): Promise<{ user: AuthUser; account: SubscriptionAccount }> => {
  const response = await fetch(API_ENDPOINTS.AUTH_REGISTER, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to register');
  }

  if (data.token) {
    setAuthToken(String(data.token));
    setCurrentUserId(String(data.user?.username || payload.username));
  }

  return {
    user: data.user as AuthUser,
    account: data.account as SubscriptionAccount,
  };
};

export const loginUser = async (payload: { username: string; password: string; captchaToken?: string }): Promise<{ user: AuthUser; account: SubscriptionAccount }> => {
  const response = await fetch(API_ENDPOINTS.AUTH_LOGIN, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(data.error || 'Failed to login');
    error.data = data;
    throw error;
  }

  if (data.token) {
    setAuthToken(String(data.token));
    setCurrentUserId(String(data.user?.username || payload.username));
  }

  return {
    user: data.user as AuthUser,
    account: data.account as SubscriptionAccount,
  };
};

export const fetchAuthMe = async (): Promise<AuthUser | null> => {
  if (!hasAuthToken()) return null;

  const response = await fetch(API_ENDPOINTS.AUTH_ME, {
    headers: getJsonHeaders(),
  });
  if (!response.ok) {
    clearAuthToken();
    return null;
  }

  const data = await parseJsonResponse(response);
  return data.user as AuthUser;
};

export const recoverUsername = async (recoveryEmail: string): Promise<string[]> => {
  const response = await fetch(API_ENDPOINTS.AUTH_RECOVER_USERNAME, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify({ recoveryEmail }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to recover username');
  }
  return (data.usernames || []) as string[];
};

export const requestPasswordReset = async (payload: { username: string; recoveryEmail: string }): Promise<{ expiresAt?: number; resetToken?: string }> => {
  const response = await fetch(API_ENDPOINTS.AUTH_RECOVER_PASSWORD_REQUEST, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to request password reset');
  }
  return {
    expiresAt: data.expiresAt,
    resetToken: data.resetToken,
  };
};

export const confirmPasswordReset = async (payload: { resetToken: string; newPassword: string }): Promise<void> => {
  const response = await fetch(API_ENDPOINTS.AUTH_RECOVER_PASSWORD_CONFIRM, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to reset password');
  }
};

export const topUpTokens = async (tokens: number): Promise<SubscriptionAccount> => {
  const response = await fetch(API_ENDPOINTS.SUBSCRIPTION_TOPUP, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify({ tokens }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to top up tokens');
  }
  return data.account as SubscriptionAccount;
};

export const fetchStripeTokenPacks = async (): Promise<{ enabled: boolean; packs: StripeTokenPack[] }> => {
  const response = await fetch(API_ENDPOINTS.STRIPE_PAYMENT_PACKS, {
    headers: getJsonHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to load Stripe token packs');
  }
  const data = await parseJsonResponse(response);
  return {
    enabled: Boolean(data.enabled),
    packs: (data.packs || []) as StripeTokenPack[],
  };
};

export const createStripeCheckoutSession = async (packId: string): Promise<{ checkoutUrl: string; sessionId: string }> => {
  const response = await fetch(API_ENDPOINTS.STRIPE_CHECKOUT_SESSION, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify({ packId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to create Stripe checkout session');
  }
  return {
    checkoutUrl: String(data.checkoutUrl || ''),
    sessionId: String(data.sessionId || ''),
  };
};

export const confirmStripeCheckoutSession = async (sessionId: string): Promise<{ account: SubscriptionAccount; credited: boolean; tokensAdded?: number; message?: string }> => {
  const response = await fetch(API_ENDPOINTS.STRIPE_CONFIRM_SESSION, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify({ sessionId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to confirm Stripe payment');
  }
  return {
    account: data.account as SubscriptionAccount,
    credited: Boolean(data.credited),
    tokensAdded: typeof data.tokensAdded === 'number' ? data.tokensAdded : undefined,
    message: data.message,
  };
};

