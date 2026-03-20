import { Capacitor, registerPlugin } from '@capacitor/core';

type GooglePlayProductType = 'subs' | 'inapp';

type BillingAvailabilityResult = {
  available: boolean;
  platform: string;
  message?: string;
};

type NormalizedBillingAvailability = {
  available: boolean;
  message?: string;
};

type BillingPurchaseResult = {
  productId: string;
  purchaseToken: string;
  orderId?: string;
  purchaseState?: number;
};

type GooglePlayBillingPlugin = {
  isAvailable(): Promise<BillingAvailabilityResult>;
  purchase(options: { productType: GooglePlayProductType; productId: string }): Promise<BillingPurchaseResult>;
};

const GooglePlayBilling = registerPlugin<GooglePlayBillingPlugin>('GooglePlayBilling');

export const isAndroidNativePlatform = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const getGooglePlayBillingAvailability = async (): Promise<NormalizedBillingAvailability> => {
  if (!isAndroidNativePlatform()) {
    return { available: false, message: 'Google Play Billing is only available on native Android builds.' };
  }

  try {
    const result = await GooglePlayBilling.isAvailable();
    return {
      available: Boolean(result?.available),
      message: result?.message,
    };
  } catch (error: any) {
    return {
      available: false,
      message: error?.message || 'Unable to initialize Google Play Billing.',
    };
  }
};

export const isGooglePlayBillingAvailable = async (): Promise<boolean> => {
  const availability = await getGooglePlayBillingAvailability();
  return availability.available;
};

export const purchaseGooglePlayProduct = async (
  productType: GooglePlayProductType,
  productId: string,
): Promise<BillingPurchaseResult> => {
  if (!isAndroidNativePlatform()) {
    throw new Error('Google Play Billing is only available on native Android builds.');
  }

  if (!productId?.trim()) {
    throw new Error('Missing Google Play product id.');
  }

  return GooglePlayBilling.purchase({ productType, productId: productId.trim() });
};
