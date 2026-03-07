
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

export interface SubscriptionPlan {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  monthlyTokens: number;
  maxTopUpPerMonth: number;
}

export interface SubscriptionAccount {
  userId: string;
  tier: 'free' | 'pro' | 'enterprise';
  tokenBalance: number;
  monthlyRemainingTopUp: number;
  cycleStartedAt: string;
  cycleEndsAt: string;
}

export interface SubscriptionUsageItem {
  id: string;
  timestamp: number;
  action: string;
  tokens: number;
}

export interface AuthUser {
  username: string;
}
