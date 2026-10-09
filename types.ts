
export interface AnimatedResult {
  videoUrl: string;
  timestamp: number;
}

export interface ProcessingState {
  isProcessing: boolean;
  statusMessage: string;
  error?: string;
  type?: 'animating' | 'editing';
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
  cycleDurationMs: number;
  updatedAt: string;
}

export interface SubscriptionUsageItem {
  id: string;
  timestamp: number;
  action: string;
  tokens: number;
}

export interface AuthUser {
  username: string;
  name?: string;
  email?: string;
  phoneNumber?: string | null;
}

export type WorkspaceTab = 'dashboard' | 'animate' | 'create-look' | 'hairstyle' | 'beauty-lab' | 'barbershop' | 'outfit' | 'enhance' | 'stylist' | 'find-this-look' | 'looks' | 'account';
