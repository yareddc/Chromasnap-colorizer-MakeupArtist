/// <reference types="vite/client" />

// Augment the Vite ImportMetaEnv interface with our custom env vars
interface ImportMetaEnv {
  readonly REACT_APP_API_BASE_URL?: string;
  readonly REACT_APP_GEMINI_API_KEY?: string;
  readonly REACT_APP_TURNSTILE_SITE_KEY?: string;
  readonly REACT_APP_ENABLE_ADMIN_PAGE?: string;
  readonly REACT_APP_PLAY_PRODUCT_SUBSCRIPTION_PRO?: string;
  readonly REACT_APP_PLAY_PRODUCT_SUBSCRIPTION_ENTERPRISE?: string;
  readonly REACT_APP_PLAY_PRODUCT_TOPUP_100?: string;
  readonly REACT_APP_PLAY_PRODUCT_TOPUP_500?: string;
  readonly REACT_APP_PLAY_PRODUCT_TOPUP_1000?: string;
  readonly VITE_PLAY_PRODUCT_SUBSCRIPTION_PRO?: string;
  readonly VITE_PLAY_PRODUCT_SUBSCRIPTION_ENTERPRISE?: string;
  readonly VITE_PLAY_PRODUCT_TOPUP_100?: string;
  readonly VITE_PLAY_PRODUCT_TOPUP_500?: string;
  readonly VITE_PLAY_PRODUCT_TOPUP_1000?: string;
  readonly GEMINI_API_KEY?: string; // in case some code uses process.env mapping
  readonly NODE_ENV: 'development' | 'production' | 'test';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  turnstile?: {
    render: (
      element: HTMLElement,
      options: {
        sitekey: string;
        callback?: (token: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
      }
    ) => string | number;
    remove: (widgetId: string | number) => void;
  };
}
