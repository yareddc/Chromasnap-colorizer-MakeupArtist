
/**
 * API Service for communicating with the backend
 */
import { API_ENDPOINTS } from './apiConfig';
import type { AuthUser, SubscriptionAccount, SubscriptionPlan, SubscriptionUsageItem } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const USER_ID_STORAGE_KEY = 'chromasnap_user_id';
const AUTH_TOKEN_STORAGE_KEY = 'chromasnap_auth_token';

const getClientPlatform = (): 'android' | 'ios' | 'web' => {
  const userAgent = String(globalThis.navigator?.userAgent || '').toLowerCase();
  if (userAgent.includes('android')) return 'android';
  if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ipod')) return 'ios';
  return 'web';
};

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
  const authToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  return {
    'Content-Type': 'application/json',
    'x-user-id': getUserId(),
    'x-client-platform': getClientPlatform(),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
};

const withAuthCredentials: RequestCredentials = 'include';

const shouldSkipBootstrapAuthRequest = (): boolean => {
  const authToken = String(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '').trim();
  if (authToken) return false;

  const clientHost = String(globalThis.location?.hostname || '').toLowerCase();
  if (clientHost !== 'localhost') return false;

  try {
    const authMeUrl = new URL(API_ENDPOINTS.AUTH_ME, globalThis.location?.origin || undefined);
    return authMeUrl.origin !== globalThis.location?.origin;
  } catch {
    return false;
  }
};

const fetchWithTimeout = (url: string, options: RequestInit = {}, timeoutMs: number = 60000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
};

export const clearAuthToken = async () => {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  await fetchWithTimeout(API_ENDPOINTS.AUTH_LOGOUT, {
    method: 'POST',
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
  }).catch(() => undefined);
};

const persistAuthToken = (token: string | undefined) => {
  const normalized = String(token || '').trim();
  if (!normalized) return;
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, normalized);
};

const parseJsonResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error("Backend unreachable (HTML received). Make sure the API URL points to the host computer's IP address.");
  }
  return response.json();
};

export const isBlackAndWhite = async (base64Image: string): Promise<boolean> => {
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.ANALYZE_MONOCHROMATIC, {
      method: 'POST',
      credentials: withAuthCredentials,
      headers: getJsonHeaders(),
      body: JSON.stringify({ image: base64Image }),
    }, 30000);

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
    const endpoint = API_ENDPOINTS.PROCESS_COLORIZE;
    console.debug(`Colorization request to: ${endpoint}`);
    
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      credentials: withAuthCredentials,
      headers: getJsonHeaders(),
      body: JSON.stringify({ image: base64Image, theme }),
    }, 120000);

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
    const msg = error?.message || String(error);
    console.error("Colorization API Error:", msg);
    
    // Provide more helpful error messages
    if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('AbortError')) {
      throw new Error('Backend unreachable. Ensure the server is running and CORS is configured correctly.');
    }
    if (msg.includes('Unauthorized')) {
      throw new Error('Session expired. Please refresh the page.');
    }
    throw new Error(msg || "Failed to colorize image.");
  }
};

export const upscaleImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await fetch(API_ENDPOINTS.PROCESS_UPSCALE, {
      method: 'POST',
      credentials: withAuthCredentials,
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
      credentials: withAuthCredentials,
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
      credentials: withAuthCredentials,
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
      credentials: withAuthCredentials,
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
      credentials: withAuthCredentials,
      headers: getJsonHeaders(),
      body: JSON.stringify({ image: base64Image }),
    });

    if (startResponse.ok) {
      const startData = await startResponse.json().catch(() => ({}));
      const jobId = startData.jobId as string | undefined;

      if (jobId) {
        const maxPolls = 90;
        const pollIntervalMs = 3000;

        for (let attempt = 0; attempt < maxPolls; attempt += 1) {
          onProgress?.(`Generating animation... (${attempt + 1}/${maxPolls})`);
          const statusResponse = await fetch(`${API_ENDPOINTS.PROCESS_ANIMATE_STATUS}/${jobId}`, {
            credentials: withAuthCredentials,
            headers: getJsonHeaders(),
          });
          if (statusResponse.ok) {
            const statusData = await statusResponse.json().catch(() => ({}));

            if (statusData.status === 'done') {
              const resultResponse = await fetch(`${API_ENDPOINTS.PROCESS_ANIMATE_RESULT}/${jobId}`, {
                credentials: withAuthCredentials,
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

        throw new Error('Animation timed out after about 4.5 minutes. Please try again.');
      }
    }

    onProgress?.('Generating animation...');
    const response = await fetch(API_ENDPOINTS.PROCESS_ANIMATE, {
      method: 'POST',
      credentials: withAuthCredentials,
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

export const fetchSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  const response = await fetch(API_ENDPOINTS.SUBSCRIPTION_PLANS, {
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to load plans');
  }
  const data = await parseJsonResponse(response);
  return data.plans || [];
};

export const fetchSubscriptionMe = async (): Promise<SubscriptionAccount> => {
  const response = await fetch(API_ENDPOINTS.SUBSCRIPTION_ME, {
    credentials: withAuthCredentials,
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
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to load usage');
  }
  return parseJsonResponse(response);
};

export const subscribeToPlan = async (tier: SubscriptionPlan['id']): Promise<SubscriptionAccount> => {
  const response = await fetch(API_ENDPOINTS.SUBSCRIPTION_SUBSCRIBE, {
    method: 'POST',
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
    body: JSON.stringify({ tier }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to change subscription');
  }
  return data.account as SubscriptionAccount;
};

export const registerUser = async (payload: { username: string; password: string; name: string; email: string; phoneNumber?: string }): Promise<{ user: AuthUser; account: SubscriptionAccount }> => {
  const response = await fetch(API_ENDPOINTS.AUTH_REGISTER, {
    method: 'POST',
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to register');
  }

  persistAuthToken(data.token);
  setCurrentUserId(String(data.user?.username || payload.username));

  return {
    user: data.user as AuthUser,
    account: data.account as SubscriptionAccount,
  };
};

export const loginUser = async (payload: { username: string; password: string; captchaToken?: string }): Promise<{ user: AuthUser; account: SubscriptionAccount }> => {
  const response = await fetch(API_ENDPOINTS.AUTH_LOGIN, {
    method: 'POST',
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(data.error || 'Failed to login');
    error.data = data;
    throw error;
  }

  persistAuthToken(data.token);
  setCurrentUserId(String(data.user?.username || payload.username));

  return {
    user: data.user as AuthUser,
    account: data.account as SubscriptionAccount,
  };
};

export const fetchAuthMe = async (): Promise<AuthUser | null> => {
  if (shouldSkipBootstrapAuthRequest()) {
    return null;
  }

  try {
    const response = await fetch(API_ENDPOINTS.AUTH_ME, {
      credentials: withAuthCredentials,
      headers: getJsonHeaders(),
    });
    if (!response.ok) {
      return null;
    }

    const data = await parseJsonResponse(response);
    persistAuthToken(data.token);
    return data.user as AuthUser;
  } catch (error) {
    // Fail open during bootstrap when the auth endpoint is unreachable (CORS/network).
    console.warn('Skipping auth bootstrap: auth endpoint unreachable.', error);
    return null;
  }
};

export const deleteAuthAccount = async (payload: { password: string; confirmUsername?: string }): Promise<void> => {
  const response = await fetch(API_ENDPOINTS.AUTH_DELETE_ACCOUNT, {
    method: 'DELETE',
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (response.status === 204) {
    return;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to delete account');
  }
};

export const socialLogin = async (payload: {
  idToken: string;
  provider: 'google' | 'phone';
}): Promise<{ user: import('../types').AuthUser }> => {
  const response = await fetchWithTimeout(API_ENDPOINTS.AUTH_SOCIAL_LOGIN, {
    method: 'POST',
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  }, 30000);

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || 'Social login failed');
  }
  persistAuthToken(data.token);
  return data as { user: import('../types').AuthUser };
};

export const recoverUsername = async (recoveryEmail: string): Promise<string[]> => {
  const response = await fetch(API_ENDPOINTS.AUTH_RECOVER_USERNAME, {
    method: 'POST',
    credentials: withAuthCredentials,
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
    credentials: withAuthCredentials,
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
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to reset password');
  }
};

export const consultBeautyAdvisor = async (
  selfieBase64: string,
  consultationNotes: string,
  selectedService: string
): Promise<{ advice: string; recommendations: string[] }> => {
  const response = await fetchWithTimeout(API_ENDPOINTS.CONSULT_BEAUTY_ADVISOR, {
    method: 'POST',
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
    body: JSON.stringify({
      selfie: selfieBase64,
      notes: consultationNotes,
      service: selectedService,
    }),
  }, 120000);

  if (!response.ok) {
    console.error(`Beauty consultant error (${response.status})`);
    throw new Error('Beauty advisor consultation failed');
  }
  const result = await parseJsonResponse(response);
  const advice = typeof result?.advice === 'string'
    ? result.advice
    : typeof result?.message === 'string'
      ? result.message
      : '';
  const recommendations = Array.isArray(result?.recommendations)
    ? result.recommendations.filter((item: unknown) => typeof item === 'string')
    : [];

  return { advice, recommendations };
};

export const generateVirtualMakeup = async (
  selfieBase64: string,
  makeupStyle: string,
  hairStyle: string,
  occasion: string,
  options?: { generateImage?: boolean; styleIntensity?: 'subtle' | 'balanced' | 'dramatic' }
): Promise<{ editedImage: string; description: string }> => {
  const response = await fetchWithTimeout(API_ENDPOINTS.GENERATE_VIRTUAL_MAKEUP, {
    method: 'POST',
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
    body: JSON.stringify({
      selfie: selfieBase64,
      makeupStyle,
      hairStyle,
      occasion,
      generateImage: options?.generateImage ?? true,
      styleIntensity: options?.styleIntensity || 'balanced',
    }),
  }, 120000);

  if (!response.ok) {
    console.error(`Virtual makeup generation error (${response.status})`);
    throw new Error('Virtual makeup generation failed');
  }
  const result = await parseJsonResponse(response);
  const editedImage = typeof result?.editedImage === 'string'
    ? result.editedImage
    : typeof result?.result === 'string'
      ? result.result
      : typeof result?.image === 'string'
        ? result.image
        : typeof result?.afterImage === 'string'
          ? result.afterImage
          : selfieBase64;

  const description = typeof result?.description === 'string'
    ? result.description
    : typeof result?.advice === 'string'
      ? result.advice
      : '';

  return { editedImage, description };
};

export const recommendOccasionLook = async (
  selfieBase64: string,
  occasion: string
): Promise<{
  recommendations: Array<{ style: string; makeup: string; hair: string; description: string }>;
  message?: string;
  fallback?: boolean;
}> => {
  const response = await fetchWithTimeout(API_ENDPOINTS.RECOMMEND_OCCASION_LOOK, {
    method: 'POST',
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
    body: JSON.stringify({
      selfie: selfieBase64,
      occasion,
    }),
  }, 120000);

  if (!response.ok) {
    console.error(`Occasion recommendation error (${response.status})`);
    throw new Error('Occasion recommendation failed');
  }
  const result = await parseJsonResponse(response);
  const rawRecommendations = Array.isArray(result?.recommendations)
    ? result.recommendations
    : Array.isArray(result?.looks)
      ? result.looks
      : [];

  const recommendations = rawRecommendations
    .filter((item: unknown) => !!item && typeof item === 'object')
    .map((item: any, index: number) => ({
      style: typeof item.style === 'string' && item.style.trim() ? item.style : `Look ${index + 1}`,
      makeup: typeof item.makeup === 'string' ? item.makeup : '',
      hair: typeof item.hair === 'string' ? item.hair : 'Natural/Current style',
      description: typeof item.description === 'string' ? item.description : '',
    }));

  return {
    recommendations,
    message: typeof result?.message === 'string' ? result.message : undefined,
    fallback: result?.fallback === true,
  };
};

export const analyzeBeautyProfile = async (
  selfieBase64: string
): Promise<BeautyProfileAnalysis> => {
  const response = await fetchWithTimeout(API_ENDPOINTS.ANALYZE_BEAUTY_PROFILE, {
    method: 'POST',
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
    body: JSON.stringify({ selfie: selfieBase64 }),
  }, 120000);

  if (!response.ok) {
    console.error(`Beauty profile analysis error (${response.status})`);
    throw new Error('Beauty profile analysis failed');
  }
  const result = await parseJsonResponse(response);

  return {
    skinTone: {
      undertone: String(result?.skinTone?.undertone || 'Unknown'),
      overtone: String(result?.skinTone?.overtone || 'Unknown'),
      description: String(result?.skinTone?.description || ''),
    },
    faceShape: {
      shape: String(result?.faceShape?.shape || 'Unknown'),
      characteristics: Array.isArray(result?.faceShape?.characteristics)
        ? result.faceShape.characteristics.filter((item: unknown) => typeof item === 'string')
        : [],
    },
    eyes: {
      color: String(result?.eyes?.color || 'Unknown'),
      shape: String(result?.eyes?.shape || 'Unknown'),
      techniques: Array.isArray(result?.eyes?.techniques)
        ? result.eyes.techniques.filter((item: unknown) => typeof item === 'string')
        : [],
    },
    hair: {
      length: String(result?.hair?.length || 'Unknown'),
      texture: String(result?.hair?.texture || 'Unknown'),
      color: String(result?.hair?.color || 'Unknown'),
      condition: String(result?.hair?.condition || ''),
    },
    makeupRecommendation: {
      foundationShades: Array.isArray(result?.makeupRecommendation?.foundationShades)
        ? result.makeupRecommendation.foundationShades.filter((item: unknown) => typeof item === 'string')
        : [],
      blushShades: Array.isArray(result?.makeupRecommendation?.blushShades)
        ? result.makeupRecommendation.blushShades.filter((item: unknown) => typeof item === 'string')
        : [],
      lipstickShades: Array.isArray(result?.makeupRecommendation?.lipstickShades)
        ? result.makeupRecommendation.lipstickShades.filter((item: unknown) => typeof item === 'string')
        : [],
      colorTheory: Array.isArray(result?.makeupRecommendation?.colorTheory)
        ? result.makeupRecommendation.colorTheory.filter((item: unknown) => typeof item === 'string')
        : [],
      dailyLook: Array.isArray(result?.makeupRecommendation?.dailyLook)
        ? result.makeupRecommendation.dailyLook.filter((item: unknown) => typeof item === 'string')
        : [],
      glamLook: Array.isArray(result?.makeupRecommendation?.glamLook)
        ? result.makeupRecommendation.glamLook.filter((item: unknown) => typeof item === 'string')
        : [],
    },
    hairTransformation: {
      styles: Array.isArray(result?.hairTransformation?.styles)
        ? result.hairTransformation.styles
            .filter((style: unknown) => !!style && typeof style === 'object')
            .map((style: any) => ({
              name: String(style?.name || 'Recommended style'),
              whyItWorks: String(style?.whyItWorks || ''),
              cutDescription: String(style?.cutDescription || ''),
            }))
        : [],
      colorSuggestions: Array.isArray(result?.hairTransformation?.colorSuggestions)
        ? result.hairTransformation.colorSuggestions.filter((item: unknown) => typeof item === 'string')
        : [],
      highlightSuggestions: Array.isArray(result?.hairTransformation?.highlightSuggestions)
        ? result.hairTransformation.highlightSuggestions.filter((item: unknown) => typeof item === 'string')
        : [],
    },
    safety: {
      disclaimer: String(result?.safety?.disclaimer || ''),
      dermatologistNote: String(result?.safety?.dermatologistNote || ''),
    },
    recommendations: Array.isArray(result?.recommendations)
      ? result.recommendations.filter((item: unknown) => typeof item === 'string')
      : [],
  };
};

export type BeautyProfileAnalysis = {
  skinTone: { undertone: string; overtone: string; description: string };
  faceShape: { shape: string; characteristics: string[] };
  eyes: { color: string; shape: string; techniques: string[] };
  hair: { length: string; texture: string; color: string; condition: string };
  makeupRecommendation: {
    foundationShades: string[];
    blushShades: string[];
    lipstickShades: string[];
    colorTheory: string[];
    dailyLook: string[];
    glamLook: string[];
  };
  hairTransformation: {
    styles: Array<{
      name: string;
      whyItWorks: string;
      cutDescription: string;
    }>;
    colorSuggestions: string[];
    highlightSuggestions: string[];
  };
  safety: {
    disclaimer: string;
    dermatologistNote: string;
  };
  recommendations: string[];
};

export const topUpTokens = async (tokens: number): Promise<SubscriptionAccount> => {
  const response = await fetch(API_ENDPOINTS.SUBSCRIPTION_TOPUP, {
    method: 'POST',
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
    body: JSON.stringify({ tokens }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to top up tokens');
  }
  return data.account as SubscriptionAccount;
};

export type GooglePlayProductType = 'subs' | 'inapp';

export const verifyGooglePlayPurchase = async (
  productType: GooglePlayProductType,
  productId: string,
  purchaseToken: string,
): Promise<SubscriptionAccount> => {
  const response = await fetch(API_ENDPOINTS.BILLING_GOOGLE_PLAY_VERIFY, {
    method: 'POST',
    credentials: withAuthCredentials,
    headers: getJsonHeaders(),
    body: JSON.stringify({ productType, productId, purchaseToken }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to verify Google Play purchase');
  }
  return data.account as SubscriptionAccount;
};

