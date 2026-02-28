
export interface ColorizedImage {
  id: string;
  original: string; // base64
  colorized: string; // base64
  timestamp: number;
  safetyCheck?: {
    isSafe: boolean;
    containsMinors?: boolean;
    reason?: string;
  };
}

export interface AnimatedResult {
  videoUrl: string;
  timestamp: number;
}

export interface ProcessingState {
  isProcessing: boolean;
  statusMessage: string;
  error?: string;
  type?: 'colorizing' | 'animating' | 'editing';
}

export interface SubscriptionBillingConfig {
  billingModel: 'usage';
  actionTokenCost: Record<string, number>;
  notes?: string[];
}

export interface SubscriptionAccount {
  userId: string;
  billingModel: 'usage';
  tokenBalance: number;
  actionTokenCost: Record<string, number>;
}

export interface SubscriptionUsageItem {
  id: string;
  timestamp: number;
  action: string;
  tokens: number;
}

export interface StripeTokenPack {
  id: string;
  label: string;
  tokens: number;
  amountCents: number;
  currency: string;
}

export interface AuthUser {
  username: string;
}
