/**
 * Centralized entitlement / feature-access layer.
 *
 * Keeps feature → token-cost and tier-access rules in one place so components
 * don't hard-code pricing or gating logic. The server remains the source of
 * truth for enforcement; this mirrors the rules for client-side UI decisions.
 */

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface FeatureRule {
  /** Stable feature key. */
  key: string;
  label: string;
  /** Token cost per generation (mirrors server ACTION_TOKEN_COST). */
  tokenCost: number;
  /** Tiers allowed to use this feature. */
  allowedTiers: SubscriptionTier[];
}

export const FEATURE_RULES: FeatureRule[] = [
  { key: 'hairstyle_try_on', label: 'Hairstyle Try-On', tokenCost: 3, allowedTiers: ['free', 'pro', 'enterprise'] },
  { key: 'virtual_makeup', label: 'Beauty / Makeup', tokenCost: 3, allowedTiers: ['free', 'pro', 'enterprise'] },
  { key: 'outfit_tryon', label: 'Outfit Try-On', tokenCost: 3, allowedTiers: ['free', 'pro', 'enterprise'] },
  { key: 'animate_start', label: 'Animate', tokenCost: 54, allowedTiers: ['free', 'pro', 'enterprise'] },
  { key: 'photo_enhancement', label: 'Photo Enhance', tokenCost: 3, allowedTiers: ['free', 'pro', 'enterprise'] },
  { key: 'style_advisor', label: 'AI Stylist', tokenCost: 1, allowedTiers: ['free', 'pro', 'enterprise'] },
  { key: 'complete_look', label: 'Complete the Look', tokenCost: 1, allowedTiers: ['free', 'pro', 'enterprise'] },
  { key: 'create_my_look', label: 'Create My Look', tokenCost: 3, allowedTiers: ['free', 'pro', 'enterprise'] },
  { key: 'find_this_look', label: 'Find This Look', tokenCost: 1, allowedTiers: ['free', 'pro', 'enterprise'] },
];

const ruleMap = new Map(FEATURE_RULES.map((rule) => [rule.key, rule]));

export const getFeatureRule = (key: string): FeatureRule | undefined => ruleMap.get(key);

export const getTokenCost = (key: string): number => ruleMap.get(key)?.tokenCost ?? 0;

export const canUseFeature = (key: string, tier: SubscriptionTier): boolean => {
  const rule = ruleMap.get(key);
  return Boolean(rule && rule.allowedTiers.includes(tier));
};
