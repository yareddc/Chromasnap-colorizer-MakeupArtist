
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import ComparisonView from './components/ComparisonView';
import VideoResult from './components/VideoResult';
import LoadingOverlay from './components/LoadingOverlay';
import TurnstileCaptcha from './components/TurnstileCaptcha';
import AdminLoginPage from './components/AdminLoginPage';
import PhotoEditorModal from './components/PhotoEditorModal';
import MultiAngleAfterPreview from './components/MultiAngleAfterPreview';
import { AuthUser, ColorizedImage, AnimatedResult, ProcessingState, SubscriptionAccount, SubscriptionPlan, SubscriptionUsageItem } from './types';
import {
  analyzeComplexionReport,
  clearAuthToken,
  colorizeImage,
  confirmPasswordReset,
  animateImage,
  checkImageSafety,
  analyzeBeautyProfile,
  consultBeautyAdvisor,
  generateOutfitTryOn,
  generateVirtualMakeup,
  recommendOccasionLook,
  fetchAuthMe,
  isBlackAndWhite,
  deleteAuthAccount,
  loginUser,
    socialLogin,
  upscaleImage,
  enhanceVibrancy,
  sharpenImage,
  fetchSubscriptionPlans,
  fetchSubscriptionUsage,
  getCurrentUserId,
  recoverUsername,
  registerUser,
  requestPasswordReset,
  setCurrentUserId,
  subscribeToPlan,
  topUpTokens,
  verifyGooglePlayPurchase,
} from './services/geminiService';
import type { BeautyProfileAnalysis, ComplexionReport } from './services/geminiService';
import {
  checkGoogleRedirectResult,
  confirmPhoneOtp,
  isFirebaseAvailable,
  sendPhoneOtp,
  signInWithGoogle,
} from './services/firebaseAuthService';
import { friendlyError } from './services/errorMessages';
import { downloadAsset } from './services/downloadService';
import {
  getGooglePlayBillingAvailability,
  purchaseGooglePlayProduct,
  isAndroidNativePlatform,
} from './services/googlePlayBillingService';
import {
  BARBERSHOP_HAIRCUT_OPTIONS,
  GENERAL_HAIRSTYLE_OPTIONS,
  OCCASION_OPTIONS,
  buildHair360BaseDescription,
  buildHair360PreviewOccasionContext,
  buildOccasionRequestValue,
  buildOccasionSuccessMessage,
  buildVirtualMakeupOccasionContext,
} from './services/barbershopVisitFeature';
import { generateBarbershopLook, getBarbershopRecommendations } from './services/barbershopService';

const PALETTES = [
  { id: 'Natural', name: 'Natural', colors: 'from-emerald-600 to-emerald-400' },
  { id: 'Cinematic', name: 'Cinematic', colors: 'from-indigo-600 to-indigo-400' },
  { id: 'Vivid', name: 'Vivid', colors: 'from-pink-600 to-pink-400' },
  { id: 'Vintage', name: 'Vintage', colors: 'from-amber-600 to-amber-400' },
  { id: 'Technicolor', name: 'Technicolor', colors: 'from-rose-600 to-rose-400' }
];

const SAMPLE_IMAGE_ASSET_URL = '/bw_smoke_test.jpg';

const resolveEnvProductId = (...keys: (keyof ImportMetaEnv)[]): string | undefined => {
  for (const key of keys) {
    const value = import.meta.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const PLAY_SUBSCRIPTION_PRODUCT_IDS: Record<'pro' | 'enterprise', string> = {
  pro: resolveEnvProductId('VITE_PLAY_PRODUCT_SUBSCRIPTION_PRO', 'REACT_APP_PLAY_PRODUCT_SUBSCRIPTION_PRO') || 'chromasnap_pro',
  enterprise:
    resolveEnvProductId('VITE_PLAY_PRODUCT_SUBSCRIPTION_ENTERPRISE', 'REACT_APP_PLAY_PRODUCT_SUBSCRIPTION_ENTERPRISE') ||
    'chromasnap_enterprise',
};

const PLAY_TOPUP_PRODUCT_IDS: Record<number, string> = {
  100: resolveEnvProductId('VITE_PLAY_PRODUCT_TOPUP_100', 'REACT_APP_PLAY_PRODUCT_TOPUP_100') || 'chromasnap_topup_100',
  500: resolveEnvProductId('VITE_PLAY_PRODUCT_TOPUP_500', 'REACT_APP_PLAY_PRODUCT_TOPUP_500') || 'chromasnap_topup_500',
  1000:
    resolveEnvProductId('VITE_PLAY_PRODUCT_TOPUP_1000', 'REACT_APP_PLAY_PRODUCT_TOPUP_1000') ||
    'chromasnap_topup_1000',
};

const FEATURE_ACTION_TOKEN_COST = {
  colorize: 3,
  upscale: 1,
  vibrancy: 1,
  sharpen: 1,
  animate_start: 54,
  beauty_consult: 1,
  virtual_makeup: 3,
  outfit_tryon: 3,
  occasion_recommend: 1,
  beauty_profile_analysis: 1,
  complexion_report: 1,
} as const;

const ACCOUNT_PRICING_ROWS = [
  { workspace: 'Colorizer', label: 'Colorize', tokens: FEATURE_ACTION_TOKEN_COST.colorize, note: 'Main image colorization request.' },
  { workspace: 'Colorizer', label: '4K Upscale', tokens: FEATURE_ACTION_TOKEN_COST.upscale, note: 'Optional enhancement after colorization.' },
  { workspace: 'Colorizer', label: 'Vibrant', tokens: FEATURE_ACTION_TOKEN_COST.vibrancy, note: 'Optional saturation enhancement.' },
  { workspace: 'Colorizer', label: 'Sharpen', tokens: FEATURE_ACTION_TOKEN_COST.sharpen, note: 'Optional detail enhancement.' },
  { workspace: 'Animate', label: 'Animate / Animate This Photo', tokens: FEATURE_ACTION_TOKEN_COST.animate_start, note: 'Charged when the animation job starts.' },
  { workspace: 'Beauty Lab', label: 'Get Ideas', tokens: FEATURE_ACTION_TOKEN_COST.occasion_recommend, note: 'Occasion-based recommendation set.' },
  { workspace: 'Beauty Lab', label: 'Consult Notes', tokens: FEATURE_ACTION_TOKEN_COST.beauty_consult, note: 'Written beauty consultation based on your notes.' },
  { workspace: 'Beauty Lab', label: 'Generate', tokens: FEATURE_ACTION_TOKEN_COST.virtual_makeup, note: 'Creates the Beauty Lab after-image.' },
  { workspace: 'Beauty Lab', label: 'Generate 360 Preview', tokens: FEATURE_ACTION_TOKEN_COST.virtual_makeup, note: 'Single non-image preview call for the 360 hairstyle summary.' },
  { workspace: 'Beauty Lab', label: 'Analyze Profile', tokens: FEATURE_ACTION_TOKEN_COST.beauty_profile_analysis, note: 'Face, skin, eye, and hair analysis.' },
  { workspace: 'Beauty Lab', label: 'Complexion Report', tokens: FEATURE_ACTION_TOKEN_COST.complexion_report, note: 'Complexion scan and recommended adjustments.' },
  { workspace: 'Barbershop', label: 'Get Ideas', tokens: FEATURE_ACTION_TOKEN_COST.occasion_recommend, note: 'Barbershop recommendation set.' },
  { workspace: 'Barbershop', label: 'Generate Look', tokens: FEATURE_ACTION_TOKEN_COST.virtual_makeup, note: 'Creates the barbershop after-image.' },
  { workspace: 'Barbershop', label: 'Left / Right / Back angle', tokens: FEATURE_ACTION_TOKEN_COST.virtual_makeup, note: 'Each non-front angle is billed the first time it is generated, then cached for the session.' },
  { workspace: 'Outfit Studio', label: 'Generate Outfit', tokens: FEATURE_ACTION_TOKEN_COST.outfit_tryon, note: 'One request charge even if 2 or 3 looks are returned.' },
] as const;

const ACCOUNT_PRICING_BUNDLES = [
  { label: 'Colorize image', tokens: FEATURE_ACTION_TOKEN_COST.colorize },
  { label: 'Animate image', tokens: FEATURE_ACTION_TOKEN_COST.animate_start },
  { label: 'Barbershop full flow', tokens: FEATURE_ACTION_TOKEN_COST.occasion_recommend + FEATURE_ACTION_TOKEN_COST.virtual_makeup },
  { label: 'Beauty Lab core flow', tokens: FEATURE_ACTION_TOKEN_COST.occasion_recommend + FEATURE_ACTION_TOKEN_COST.beauty_consult + FEATURE_ACTION_TOKEN_COST.virtual_makeup },
  { label: 'Outfit Studio generation', tokens: FEATURE_ACTION_TOKEN_COST.outfit_tryon },
] as const;

const ACCOUNT_PLAN_FALLBACKS: SubscriptionPlan[] = [
  { id: 'free', name: 'Free', monthlyTokens: 50, maxTopUpPerMonth: 100 },
  { id: 'pro', name: 'Pro', monthlyTokens: 1000, maxTopUpPerMonth: 5000 },
  { id: 'enterprise', name: 'Enterprise', monthlyTokens: 10000, maxTopUpPerMonth: 50000 },
];

type WorkspaceTab = 'dashboard' | 'colorizer' | 'animate' | 'beauty-lab' | 'barbershop' | 'outfit' | 'account';
type Hair360Angle = 'front' | 'left' | 'right' | 'back';
type LookRecommendation = { style: string; makeup: string; hair: string; description: string };
type PendingPhotoEditTarget = 'try-on' | 'barbershop' | 'outfit';
type OutfitLookVariant = { title: string; editedImage: string; description: string };
type ComplexionHistoryEntry = {
  timestamp: number;
  hydrationLevel: 'low' | 'balanced' | 'high';
  rednessLevel: 'low' | 'moderate' | 'high';
  poreVisibility: 'low' | 'moderate' | 'high';
  toneUniformity: 'uneven' | 'mostly-even' | 'even';
  recommendedMakeupStyle: 'natural' | 'bold' | 'smokey-eye' | 'glam' | 'editorial' | 'dewy';
  recommendedStyleIntensity: 'subtle' | 'balanced' | 'dramatic';
};

const NO_HAIRSTYLE_CHANGE_VALUE = 'none';

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not load sample image.'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error('Could not read sample image.'));
    reader.readAsDataURL(blob);
  });

const toDisplayLabel = (value: string): string =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const loadImageElement = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not render consultation card images.'));
    image.src = source;
  });

const isLikelyBlankGeneratedImage = async (source: string): Promise<boolean> => {
  try {
    const image = await loadImageElement(source);
    if (image.naturalWidth <= 4 || image.naturalHeight <= 4) {
      return true;
    }

    const canvas = document.createElement('canvas');
    const sampleWidth = Math.max(1, Math.min(64, image.naturalWidth));
    const sampleHeight = Math.max(1, Math.min(64, image.naturalHeight));
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return false;
    }

    context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
    const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);

    let totalLuma = 0;
    let totalLumaSquared = 0;
    let visiblePixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 16) {
        continue;
      }

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      visiblePixels += 1;
      totalLuma += luma;
      totalLumaSquared += luma * luma;
    }

    if (visiblePixels === 0) {
      return true;
    }

    const meanLuma = totalLuma / visiblePixels;
    const variance = totalLumaSquared / visiblePixels - meanLuma * meanLuma;

    return meanLuma > 245 && variance < 20;
  } catch {
    return false;
  }
};

const BEAUTY_SERVICES = [
  { id: 'bridal-glam', label: 'Bridal Glam', description: 'Premium full-face glam workflow for bridal clients.' },
  { id: 'soft-day', label: 'Soft Day Look', description: 'Natural finish with skin-tone preserving enhancement.' },
  { id: 'editorial', label: 'Editorial Style', description: 'High-contrast, runway-inspired beauty direction.' },
] as const;

type BeautyServiceId = (typeof BEAUTY_SERVICES)[number]['id'];

const App: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadPreviewZoom, setUploadPreviewZoom] = useState<number>(1);
  const [selectedTheme, setSelectedTheme] = useState<string>('Natural');
  const [result, setResult] = useState<ColorizedImage | null>(null);
  const [history, setHistory] = useState<ColorizedImage[]>([]);
  const [uploadedOriginals, setUploadedOriginals] = useState<string[]>([]);
  const [videoResult, setVideoResult] = useState<AnimatedResult | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    statusMessage: '',
  });
  const [activeUserId, setActiveUserId] = useState<string>(() => getCurrentUserId());
  const [userIdInput, setUserIdInput] = useState<string>(activeUserId);
  const [subscriptionAccount, setSubscriptionAccount] = useState<SubscriptionAccount | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptionUsage, setSubscriptionUsage] = useState<SubscriptionUsageItem[]>([]);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<string>('50');
  const [billingLoading, setBillingLoading] = useState<boolean>(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'recover-username' | 'recover-password'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhoneNumber, setAuthPhoneNumber] = useState('');
  const [socialPhoneNumber, setSocialPhoneNumber] = useState('');
  const [socialOtpCode, setSocialOtpCode] = useState('');
  const [socialOtpSent, setSocialOtpSent] = useState(false);
  const [authRecoveryEmail, setAuthRecoveryEmail] = useState('');
  const [authResetToken, setAuthResetToken] = useState('');
  const [authNewPassword, setAuthNewPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authRequireCaptcha, setAuthRequireCaptcha] = useState(false);
  const [authCaptchaToken, setAuthCaptchaToken] = useState('');
  const [recoveredUsernames, setRecoveredUsernames] = useState<string[]>([]);
  const [issuedResetToken, setIssuedResetToken] = useState<string>('');
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountConfirmUsername, setDeleteAccountConfirmUsername] = useState('');
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [accountTab, setAccountTab] = useState<'overview' | 'account-details' | 'delete-account'>('overview');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('dashboard');
  const [beautyService, setBeautyService] = useState<BeautyServiceId>('bridal-glam');
  const [beautyClientName, setBeautyClientName] = useState('');
  const [beautyNotes, setBeautyNotes] = useState('');
  const [beautyConsultationResult, setBeautyConsultationResult] = useState<{ advice: string; recommendations: string[] } | null>(null);
  const [beautyConsultationLoading, setBeautyConsultationLoading] = useState(false);
  const [beautyConsultationMessage, setBeautyConsultationMessage] = useState<string | null>(null);
  const [trySelfie, setTrySelfie] = useState<string | null>(null);
  const [tryOccasion, setTryOccasion] = useState('wedding');
  const [tryMakeupStyle, setTryMakeupStyle] = useState('bold');
  const [tryStyleIntensity, setTryStyleIntensity] = useState<'subtle' | 'balanced' | 'dramatic'>('balanced');
  const [tryHairStyle, setTryHairStyle] = useState('wavy');
  const [complexionOpacity, setComplexionOpacity] = useState(72);
  const [eyesOpacity, setEyesOpacity] = useState(68);
  const [lipsOpacity, setLipsOpacity] = useState(74);
  const [complexionShadeProfile, setComplexionShadeProfile] = useState('warm-beige');
  const [faceShapeContour, setFaceShapeContour] = useState('soft-oval');
  const [accentBlushProfile, setAccentBlushProfile] = useState('rose');
  const [eyelinerPattern, setEyelinerPattern] = useState('cat-eye');
  const [lashOverlayDensity, setLashOverlayDensity] = useState('high-density');
  const [lipFinish, setLipFinish] = useState('matte');
  const [wigTrackStyle, setWigTrackStyle] = useState('structured-bob');
  const [haircutProfile, setHaircutProfile] = useState('butterfly-layers');
  const [extensionProfile, setExtensionProfile] = useState('clip-in-volume');
  const [colorLabDualTone, setColorLabDualTone] = useState('balayage');
  const [tryAfterImage, setTryAfterImage] = useState<string | null>(null);
  const [tryResults, setTryResults] = useState<LookRecommendation[] | null>(null);
  const [tryLoading, setTryLoading] = useState(false);
  const [tryMessage, setTryMessage] = useState<string | null>(null);
  const [barbershopSelfie, setBarbershopSelfie] = useState<string | null>(null);
  const [barbershopMakeupStyle, setBarbershopMakeupStyle] = useState('natural');
  const [barbershopStyleIntensity, setBarbershopStyleIntensity] = useState<'subtle' | 'balanced' | 'dramatic'>('balanced');
  const [barbershopNotes, setBarbershopNotes] = useState('');
  const [barbershopHaircut, setBarbershopHaircut] = useState('taper-fade');
  const [barbershopAfterImage, setBarbershopAfterImage] = useState<string | null>(null);
  const [barbershopResults, setBarbershopResults] = useState<LookRecommendation[] | null>(null);
  const [barbershopRecommendationLoading, setBarbershopRecommendationLoading] = useState(false);
  const [barbershopGenerateLoading, setBarbershopGenerateLoading] = useState(false);
  const [barbershopMessage, setBarbershopMessage] = useState<string | null>(null);
  const [outfitSelfie, setOutfitSelfie] = useState<string | null>(null);
  const [outfitAfterImage, setOutfitAfterImage] = useState<string | null>(null);
  const [outfitLooks, setOutfitLooks] = useState<OutfitLookVariant[] | null>(null);
  const [outfitActiveLookIndex, setOutfitActiveLookIndex] = useState(0);
  const [outfitStyle, setOutfitStyle] = useState('formal-evening');
  const [outfitMode, setOutfitMode] = useState<'style' | 'garment'>('style');
  const [outfitOccasion, setOutfitOccasion] = useState('night out');
  const [outfitColorPalette, setOutfitColorPalette] = useState('match makeup palette');
  const [outfitBatchCount, setOutfitBatchCount] = useState<1 | 2 | 3>(3);
  const [outfitMatchCurrentSalonLook, setOutfitMatchCurrentSalonLook] = useState(true);
  const [outfitNotes, setOutfitNotes] = useState('');
  const [outfitGarmentLabel, setOutfitGarmentLabel] = useState('tailored blazer set');
  const [outfitGarmentImage, setOutfitGarmentImage] = useState<string | null>(null);
  const [outfitLoading, setOutfitLoading] = useState(false);
  const [outfitMessage, setOutfitMessage] = useState<string | null>(null);
  const [showOutfitPhotoPicker, setShowOutfitPhotoPicker] = useState(false);
  const [hair360Length, setHair360Length] = useState<'short' | 'medium' | 'long'>('medium');
  const [hair360Volume, setHair360Volume] = useState<'low' | 'balanced' | 'high'>('balanced');
  const [hair360Fringe, setHair360Fringe] = useState<'none' | 'curtain' | 'side-swept' | 'full'>('none');
  const [hair360Texture, setHair360Texture] = useState<'soft' | 'defined' | 'sleek'>('soft');
  const [hair360ActiveAngle, setHair360ActiveAngle] = useState<Hair360Angle>('front');
  const [hair360Loading, setHair360Loading] = useState(false);
  const [hair360Message, setHair360Message] = useState<string | null>(null);
  const [hair360Previews, setHair360Previews] = useState<Array<{ angle: Hair360Angle; title: string; summary: string; editHint: string }> | null>(null);
  const [profileAnalysisResult, setProfileAnalysisResult] = useState<BeautyProfileAnalysis | null>(null);
  const [profileAnalysisLoading, setProfileAnalysisLoading] = useState(false);
  const [profileAnalysisMessage, setProfileAnalysisMessage] = useState<string | null>(null);
  const [complexionReport, setComplexionReport] = useState<ComplexionReport | null>(null);
  const [complexionReportLoading, setComplexionReportLoading] = useState(false);
  const [complexionReportMessage, setComplexionReportMessage] = useState<string | null>(null);
  const [complexionHistory, setComplexionHistory] = useState<ComplexionHistoryEntry[]>([]);
  const [pendingPhotoEdit, setPendingPhotoEdit] = useState<{ target: PendingPhotoEditTarget; image: string } | null>(null);
  const [showBeautyPhotoPicker, setShowBeautyPhotoPicker] = useState(false);
  const [showBarbershopPhotoPicker, setShowBarbershopPhotoPicker] = useState(false);
  const tryUploadInputRef = useRef<HTMLInputElement>(null);
  const tryCameraInputRef = useRef<HTMLInputElement>(null);
  const barbershopUploadInputRef = useRef<HTMLInputElement>(null);
  const barbershopCameraInputRef = useRef<HTMLInputElement>(null);
  const outfitUploadInputRef = useRef<HTMLInputElement>(null);
  const outfitCameraInputRef = useRef<HTMLInputElement>(null);
  const outfitGarmentUploadInputRef = useRef<HTMLInputElement>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showAccountDrawer, setShowAccountDrawer] = useState(false);
  const [showBeautyToolsDrawer, setShowBeautyToolsDrawer] = useState(false);
  const [showAdminLoginPage, setShowAdminLoginPage] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const uploadPreviewRef = useRef<HTMLDivElement | null>(null);
  const pinchZoomStateRef = useRef<{ startDistance: number; startZoom: number } | null>(null);
  const turnstileSiteKey = import.meta.env.REACT_APP_TURNSTILE_SITE_KEY || '';
  const isDeveloperMode = import.meta.env.DEV || import.meta.env.REACT_APP_ENABLE_ADMIN_PAGE === 'true';
  const [mediaMode, setMediaMode] = useState<'colorize' | 'animate'>('colorize');
  const complexionHistoryStorageKey = `chromasnap_complexion_history_${authUser?.username || activeUserId || 'guest'}`;

  const currentPlan = subscriptionPlans.find((plan) => plan.id === (subscriptionAccount?.tier ?? 'free'));
  const planMonthlyTokens = currentPlan?.monthlyTokens ?? 1;
  const usedThisCycle = Math.max(0, planMonthlyTokens - (subscriptionAccount?.tokenBalance ?? 0));
  const usagePercent = Math.min(100, Math.round((usedThisCycle / planMonthlyTokens) * 100));
  const pricingPlans = subscriptionPlans.length ? subscriptionPlans : ACCOUNT_PLAN_FALLBACKS;
  const playSubscriptionRows = [
    { tier: 'Pro', productId: PLAY_SUBSCRIPTION_PRODUCT_IDS.pro },
    { tier: 'Enterprise', productId: PLAY_SUBSCRIPTION_PRODUCT_IDS.enterprise },
  ];
  const playTopUpRows = Object.entries(PLAY_TOPUP_PRODUCT_IDS)
    .map(([tokens, productId]) => ({ tokens: Number(tokens), productId }))
    .sort((left, right) => left.tokens - right.tokens);

  const refreshSubscription = async () => {
    setBillingLoading(true);
    setBillingMessage(null);
    try {
      const [plans, usageData] = await Promise.all([
        fetchSubscriptionPlans(),
        fetchSubscriptionUsage(),
      ]);
      setSubscriptionPlans(plans);
      setSubscriptionAccount(usageData.account);
      setSubscriptionUsage(usageData.usage || []);
    } catch (error: any) {
      setBillingMessage(friendlyError(error, 'refreshSubscription'));
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const currentUser = await fetchAuthMe();
        if (currentUser) {
          setAuthUser(currentUser);
          const storedId = setCurrentUserId(currentUser.username);
          setActiveUserId(storedId);
          setUserIdInput(storedId);
        }
      } catch (error) {
        console.error('Auth bootstrap failed:', error);
      } finally {
        setAuthInitialized(true);
      }
    };

    void bootstrapAuth();
  }, []);

  // Pick up a pending Google redirect-sign-in result (mobile web flow)
  useEffect(() => {
    if (!isFirebaseAvailable()) return;
    checkGoogleRedirectResult()
      .then((idToken) => {
        if (!idToken) return;
        setAuthLoading(true);
        return socialLogin({ idToken, provider: 'google' })
          .then(({ user }) => {
            setAuthUser(user);
            const storedId = setCurrentUserId(user.username);
            setActiveUserId(storedId);
            setUserIdInput(storedId);
            setAuthMessage('Signed in with Google.');
          })
          .finally(() => setAuthLoading(false));
      })
      .catch((err: any) => {
        // Ignore "no pending redirect" — not an error
        const code = err?.code || '';
        if (code === 'auth/no-auth-event' || code === 'auth/null-user') return;
        setAuthMessage(friendlyError(err, 'googleRedirect'));
      });
  }, []);

  useEffect(() => {
    if (!authUser) return;
    refreshSubscription();
  }, [activeUserId, authUser]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(complexionHistoryStorageKey);
      if (!raw) {
        setComplexionHistory([]);
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setComplexionHistory([]);
        return;
      }

      const valid = parsed
        .filter((entry: unknown) => !!entry && typeof entry === 'object')
        .map((entry: any) => ({
          timestamp: Number(entry.timestamp) || Date.now(),
          hydrationLevel: entry.hydrationLevel === 'low' || entry.hydrationLevel === 'high' || entry.hydrationLevel === 'balanced' ? entry.hydrationLevel : 'balanced',
          rednessLevel: entry.rednessLevel === 'low' || entry.rednessLevel === 'high' || entry.rednessLevel === 'moderate' ? entry.rednessLevel : 'moderate',
          poreVisibility: entry.poreVisibility === 'low' || entry.poreVisibility === 'high' || entry.poreVisibility === 'moderate' ? entry.poreVisibility : 'moderate',
          toneUniformity: entry.toneUniformity === 'uneven' || entry.toneUniformity === 'even' || entry.toneUniformity === 'mostly-even' ? entry.toneUniformity : 'mostly-even',
          recommendedMakeupStyle:
            entry.recommendedMakeupStyle === 'natural' || entry.recommendedMakeupStyle === 'bold' || entry.recommendedMakeupStyle === 'smokey-eye' || entry.recommendedMakeupStyle === 'glam' || entry.recommendedMakeupStyle === 'editorial' || entry.recommendedMakeupStyle === 'dewy'
              ? entry.recommendedMakeupStyle
              : 'natural',
          recommendedStyleIntensity:
            entry.recommendedStyleIntensity === 'subtle' || entry.recommendedStyleIntensity === 'dramatic' || entry.recommendedStyleIntensity === 'balanced'
              ? entry.recommendedStyleIntensity
              : 'balanced',
        }))
        .slice(0, 20);

      setComplexionHistory(valid);
    } catch {
      setComplexionHistory([]);
    }
  }, [complexionHistoryStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(complexionHistoryStorageKey, JSON.stringify(complexionHistory.slice(0, 20)));
    } catch {
      // Ignore local persistence failures.
    }
  }, [complexionHistory, complexionHistoryStorageKey]);

  useEffect(() => {
    if (!showAccountMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const trigger = (event.target as Element | null)?.closest('#workspace-hamburger-trigger');
      if (trigger) return;
      if (accountMenuRef.current?.contains(event.target as Node)) return;
      setShowAccountMenu(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showAccountMenu]);

  const handleLogout = () => {
    clearAuthToken();
    setAuthUser(null);
    setAuthMessage('Logged out successfully.');
    setSubscriptionAccount(null);
    setSubscriptionUsage([]);
  };

  const handleDeleteAccount = async () => {
    if (!authUser?.username) {
      setAuthMessage('You must be logged in to delete your account.');
      return;
    }

    if (!deleteAccountPassword.trim()) {
      setAuthMessage('Enter your password to delete your account.');
      return;
    }

    if (deleteAccountConfirmUsername.trim() !== authUser.username) {
      setAuthMessage(`Type your exact username (${authUser.username}) to confirm deletion.`);
      return;
    }

    const confirmed = window.confirm(
      'This permanently deletes your account, billing history, and token data. This action cannot be undone. Continue?'
    );
    if (!confirmed) {
      return;
    }

    setDeleteAccountLoading(true);
    setAuthMessage(null);
    try {
      await deleteAuthAccount({
        password: deleteAccountPassword,
        confirmUsername: deleteAccountConfirmUsername,
      });

      await clearAuthToken();
      setAuthUser(null);
      setSubscriptionAccount(null);
      setSubscriptionUsage([]);
      setDeleteAccountPassword('');
      setDeleteAccountConfirmUsername('');
      setAccountTab('overview');
      setAuthMessage('Account deleted successfully.');
    } catch (error: any) {
      setAuthMessage(friendlyError(error, 'deleteAccount'));
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const handleRegister = async () => {
    const normalizedUsername = authUsername.trim();
    const normalizedPassword = authPassword;
    const normalizedName = authName.trim();
    const normalizedEmail = authEmail.trim();

    if (!normalizedUsername || !normalizedPassword || !normalizedName || !normalizedEmail) {
      setAuthMessage('Fill in username, password, full name, and email before creating an account.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const { user } = await registerUser({
        username: normalizedUsername,
        password: normalizedPassword,
        name: normalizedName,
        email: normalizedEmail,
        phoneNumber: authPhoneNumber || undefined,
      });
      setAuthUser(user);
      const storedId = setCurrentUserId(user.username);
      setActiveUserId(storedId);
      setUserIdInput(storedId);
      setAuthMessage('Account created and logged in.');
    } catch (error: any) {
      setAuthMessage(friendlyError(error, 'register'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async () => {
    const normalizedUsername = authUsername.trim();
    const normalizedPassword = authPassword;

    if (!normalizedUsername || !normalizedPassword) {
      setAuthMessage('Enter both username and password to sign in.');
      return;
    }

    if (authRequireCaptcha && !authCaptchaToken.trim()) {
      setAuthMessage('Complete the captcha before signing in.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const { user } = await loginUser({
        username: normalizedUsername,
        password: normalizedPassword,
        captchaToken: authRequireCaptcha ? authCaptchaToken : undefined,
      });
      setAuthUser(user);
      setAuthRequireCaptcha(false);
      setAuthCaptchaToken('');
      const storedId = setCurrentUserId(user.username);
      setActiveUserId(storedId);
      setUserIdInput(storedId);
      setAuthMessage('Login successful.');
    } catch (error: any) {
      if (error?.data?.captchaRequired) {
        setAuthRequireCaptcha(true);
      }
      setAuthMessage(friendlyError(error, 'login'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      if (!isFirebaseAvailable()) {
        throw new Error('Google login is not configured yet (missing Firebase env vars).');
      }
      const idToken = await signInWithGoogle();
      const { user } = await socialLogin({ idToken, provider: 'google' });
      setAuthUser(user);
      const storedId = setCurrentUserId(user.username);
      setActiveUserId(storedId);
      setUserIdInput(storedId);
      setAuthMessage('Signed in with Google.');
    } catch (error: any) {
      // Redirect flow triggered: browser will return to this app after Google sign-in.
      if (error?.message === '__redirect__') {
        setAuthMessage('Redirecting to Google sign-in...');
        return;
      }
      setAuthMessage(friendlyError(error, 'googleLogin'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    const normalizedPhoneNumber = socialPhoneNumber.trim();
    if (!normalizedPhoneNumber) {
      setAuthMessage('Enter your phone number before sending an OTP.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage(null);
    try {
      if (!isFirebaseAvailable()) {
        throw new Error('Phone login is not configured yet (missing Firebase env vars).');
      }
      const startResult = await sendPhoneOtp(normalizedPhoneNumber);

      if (startResult.status === 'verified') {
        const { user } = await socialLogin({ idToken: startResult.idToken, provider: 'phone' });
        setAuthUser(user);
        const storedId = setCurrentUserId(user.username);
        setActiveUserId(storedId);
        setUserIdInput(storedId);
        setSocialOtpCode('');
        setSocialOtpSent(false);
        setAuthMessage('Phone login successful (instant verification).');
      } else {
        setSocialOtpSent(true);
        setAuthMessage('OTP sent. Check your phone and enter the code.');
      }
    } catch (error: any) {
      setAuthMessage(friendlyError(error, 'sendOTP'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    const normalizedOtp = socialOtpCode.trim();
    if (!normalizedOtp) {
      setAuthMessage('Enter the OTP code before verifying.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const idToken = await confirmPhoneOtp(normalizedOtp);
      const { user } = await socialLogin({ idToken, provider: 'phone' });
      setAuthUser(user);
      const storedId = setCurrentUserId(user.username);
      setActiveUserId(storedId);
      setUserIdInput(storedId);
      setSocialOtpCode('');
      setSocialOtpSent(false);
      setAuthMessage('Phone login successful.');
    } catch (error: any) {
      setAuthMessage(friendlyError(error, 'verifyOTP'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRecoverUsername = async () => {
    const normalizedRecoveryEmail = authRecoveryEmail.trim();
    if (!normalizedRecoveryEmail) {
      setAuthMessage('Enter your recovery email to recover usernames.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage(null);
    setRecoveredUsernames([]);
    try {
      const usernames = await recoverUsername(normalizedRecoveryEmail);
      setRecoveredUsernames(usernames);
      setAuthMessage(usernames.length ? 'Recovered usernames below.' : 'No usernames found for that recovery email.');
    } catch (error: any) {
      setAuthMessage(friendlyError(error, 'recoverUsername'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    const normalizedUsername = authUsername.trim();
    const normalizedRecoveryEmail = authRecoveryEmail.trim();

    if (!normalizedUsername || !normalizedRecoveryEmail) {
      setAuthMessage('Enter both username and recovery email to request a reset token.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const result = await requestPasswordReset({
        username: normalizedUsername,
        recoveryEmail: normalizedRecoveryEmail,
      });
      setIssuedResetToken(result.resetToken || '');
      if (result.resetToken) {
        setAuthResetToken(result.resetToken);
      }
      setAuthMessage('Password reset token generated. Use it below to set a new password.');
    } catch (error: any) {
      setAuthMessage(friendlyError(error, 'requestPasswordReset'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConfirmPasswordReset = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      await confirmPasswordReset({
        resetToken: authResetToken,
        newPassword: authNewPassword,
      });
      setAuthMessage('Password reset successful. You can now log in.');
      setAuthMode('login');
    } catch (error: any) {
      setAuthMessage(friendlyError(error, 'confirmPasswordReset'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleApplyUserId = () => {
    const nextId = userIdInput.trim();
    if (!nextId) {
      setBillingMessage('User id is required.');
      return;
    }
    const storedId = setCurrentUserId(nextId);
    setActiveUserId(storedId);
  };

  const handleSubscribeTier = async (tier: SubscriptionPlan['id']) => {
    setBillingLoading(true);
    setBillingMessage(null);
    try {
      if (isAndroidNativePlatform()) {
        if (tier === 'free') {
          throw new Error('Manage free-plan downgrade or cancellation from your Google Play subscriptions page.');
        }

        const availability = await getGooglePlayBillingAvailability();
        if (!availability.available) {
          throw new Error(availability.message || 'Google Play Billing is unavailable on this device/build.');
        }

        const productId = PLAY_SUBSCRIPTION_PRODUCT_IDS[tier as 'pro' | 'enterprise'];
        if (!productId) {
          throw new Error(`Missing product mapping for tier: ${tier}`);
        }

        const purchase = await purchaseGooglePlayProduct('subs', productId);
        const account = await verifyGooglePlayPurchase('subs', productId, purchase.purchaseToken);
        setSubscriptionAccount(account);
        await refreshSubscription();
        return;
      }

      const account = await subscribeToPlan(tier);
      setSubscriptionAccount(account);
      await refreshSubscription();
    } catch (error: any) {
      setBillingMessage(friendlyError(error, 'changePlan'));
    } finally {
      setBillingLoading(false);
    }
  };

  const handleTopUp = async () => {
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setBillingMessage('Enter a valid top-up amount.');
      return;
    }
    setBillingLoading(true);
    setBillingMessage(null);
    try {
      if (isAndroidNativePlatform()) {
        const availability = await getGooglePlayBillingAvailability();
        if (!availability.available) {
          throw new Error(availability.message || 'Google Play Billing is unavailable on this device/build.');
        }

        const normalizedAmount = Math.floor(amount);
        const productId = PLAY_TOPUP_PRODUCT_IDS[normalizedAmount];
        if (!productId) {
          throw new Error('Android top-up requires Google Play product packs (100, 500, or 1000).');
        }

        const purchase = await purchaseGooglePlayProduct('inapp', productId);
        const account = await verifyGooglePlayPurchase('inapp', productId, purchase.purchaseToken);
        setSubscriptionAccount(account);
        await refreshSubscription();
        return;
      }

      const account = await topUpTokens(amount);
      setSubscriptionAccount(account);
      await refreshSubscription();
    } catch (error: any) {
      setBillingMessage(friendlyError(error, 'topUp'));
    } finally {
      setBillingLoading(false);
    }
  };

  const handleImageSelected = (base64: string) => {
    setSelectedImage(base64);
    setUploadPreviewZoom(1);
    setResult(null);
    setVideoResult(null);
    setProcessing(prev => ({ ...prev, error: undefined }));
    if (!uploadedOriginals.includes(base64)) {
      setUploadedOriginals(prev => [base64, ...prev]);
    }
  };

  const ensureFreshPreviewUrl = (imageUrl: string): string => {
    if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      return imageUrl;
    }
    const separator = imageUrl.includes('?') ? '&' : '?';
    return `${imageUrl}${separator}cb=${Date.now().toString(36)}`;
  };

  const handleSampleImage = async () => {
    try {
      const response = await fetch(SAMPLE_IMAGE_ASSET_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Sample image request failed (${response.status})`);
      }
      const sampleBlob = await response.blob();
      handleImageSelected(await blobToDataUrl(sampleBlob));
    } catch (error) {
      console.error('Sample image load failed:', error);
      setProcessing((prev) => ({
        ...prev,
        error: 'The sample image is unavailable right now. Please upload a photo instead.',
      }));
    }
  };

  const clampUploadZoom = (value: number) => Math.min(3, Math.max(0.5, Number(value.toFixed(2))));

  const applyUploadZoom = (nextZoom: number) => {
    setUploadPreviewZoom(clampUploadZoom(nextZoom));
  };

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  };

  const handlePreviewWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const zoomStep = event.deltaY < 0 ? 0.1 : -0.1;
    applyUploadZoom(uploadPreviewZoom + zoomStep);
  };

  const handlePreviewTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return;
    pinchZoomStateRef.current = {
      startDistance: getTouchDistance(event.touches),
      startZoom: uploadPreviewZoom,
    };
  };

  const handlePreviewTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !pinchZoomStateRef.current) return;
    event.preventDefault();
    const currentDistance = getTouchDistance(event.touches);
    if (!currentDistance || !pinchZoomStateRef.current.startDistance) return;
    const scale = currentDistance / pinchZoomStateRef.current.startDistance;
    applyUploadZoom(pinchZoomStateRef.current.startZoom * scale);
  };

  const handlePreviewTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      pinchZoomStateRef.current = null;
    }
  };

  const handleColorize = async (themeOverride?: string) => {
    if (!selectedImage) return;
    const activeTheme = themeOverride || selectedTheme;

    setProcessing({
      isProcessing: true,
      statusMessage: `Colorizing with ${activeTheme} Palette...`,
      type: 'colorizing',
      error: undefined
    });

    try {
      const monochromatic = await isBlackAndWhite(selectedImage);
      if (!monochromatic) {
        setProcessing({
          isProcessing: false,
          statusMessage: '',
          error: "Please upload a black and white photo."
        });
        return;
      }

      setProcessing(prev => ({ ...prev, statusMessage: 'Scanning photo for safety...' }));
      const preSafety = await checkImageSafety(selectedImage);
      if (!preSafety.isSafe && preSafety.reason?.toLowerCase().includes('nudity')) {
        setProcessing({
          isProcessing: false,
          statusMessage: '',
          error: "Nudity is not allowed. Please upload a different image."
        });
        return;
      }

      setProcessing(prev => ({ ...prev, statusMessage: `Applying ${activeTheme} palette...` }));
      const colorized = await colorizeImage(selectedImage, activeTheme);

      setProcessing(prev => ({ ...prev, statusMessage: 'Verifying result...' }));
      const postSafety = await checkImageSafety(colorized);

      const newResult: ColorizedImage = {
        id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
        original: selectedImage,
        colorized: ensureFreshPreviewUrl(colorized),
        timestamp: Date.now(),
        safetyCheck: postSafety
      };

      setResult(newResult);
      setHistory([newResult]); // Reset undo history for new base image
      setProcessing({ isProcessing: false, statusMessage: '' });
    } catch (error: any) {
      setProcessing({
        isProcessing: false,
        statusMessage: '',
        error: friendlyError(error, 'colorize')
      });
    }
  };

  const updateResult = (newImage: string) => {
    if (!result) return;
    const newVersion: ColorizedImage = {
      ...result,
      id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      colorized: ensureFreshPreviewUrl(newImage),
      timestamp: Date.now()
    };
    setResult(newVersion);
    setHistory(prev => [newVersion, ...prev]);
  };

  const handleUpscale = async () => {
    if (!result) return;
    setProcessing({ isProcessing: true, statusMessage: 'Enhancing Resolution (4K)...', type: 'editing' });
    try {
      const upscaled = await upscaleImage(result.colorized);
      updateResult(upscaled);
      setProcessing({ isProcessing: false, statusMessage: '' });
    } catch (error: any) {
      setProcessing({ isProcessing: false, statusMessage: '', error: friendlyError(error, 'upscale') });
    }
  };

  const handleVibrancy = async () => {
    if (!result) return;
    setProcessing({ isProcessing: true, statusMessage: 'Increasing Color Vibrancy...', type: 'editing' });
    try {
      const vibrant = await enhanceVibrancy(result.colorized);
      updateResult(vibrant);
      setProcessing({ isProcessing: false, statusMessage: '' });
    } catch (error: any) {
      setProcessing({ isProcessing: false, statusMessage: '', error: friendlyError(error, 'vibrancy') });
    }
  };

  const handleSharpen = async () => {
    if (!result) return;
    setProcessing({ isProcessing: true, statusMessage: 'Sharpening Details...', type: 'editing' });
    try {
      const sharpened = await sharpenImage(result.colorized);
      updateResult(sharpened);
      setProcessing({ isProcessing: false, statusMessage: '' });
    } catch (error: any) {
      setProcessing({ isProcessing: false, statusMessage: '', error: friendlyError(error, 'sharpen') });
    }
  };

  const handleUndo = () => {
    if (history.length > 1) {
      const newHistory = history.slice(1);
      setHistory(newHistory);
      setResult(newHistory[0]);
    }
  };

  const triggerDownload = async (sourceUrl: string, filename: string) => {
    await downloadAsset(sourceUrl, filename);
  };

  const handleAnimate = async () => {
    const sourceImage = result?.colorized || selectedImage;
    if (!sourceImage) return;

    const safety = result?.safetyCheck || await checkImageSafety(sourceImage);
    if (safety?.containsMinors) {
      setProcessing({
        isProcessing: false,
        statusMessage: '',
        error: 'Animation is disabled for images containing minors due to safety policies.'
      });
      return;
    }

    if (!safety?.isSafe) {
      setProcessing({
        isProcessing: false,
        statusMessage: '',
        error: 'This image is restricted by safety policy and cannot be animated.'
      });
      return;
    }

    setProcessing({
      isProcessing: true,
      statusMessage: 'Generating Cinematic Animation...',
      type: 'animating'
    });

    try {
      const videoUrl = await animateImage(sourceImage, (message) => {
        setProcessing(prev => ({ ...prev, statusMessage: message }));
      });
      setVideoResult({
        videoUrl,
        timestamp: Date.now(),
      });
      setProcessing({ isProcessing: false, statusMessage: '' });
    } catch (error: any) {
      setProcessing({
        isProcessing: false,
        statusMessage: '',
        error: friendlyError(error, 'animate')
      });
    }
  };

  const reset = () => {
    setSelectedImage(null);
    setUploadPreviewZoom(1);
    setSelectedTheme('Natural');
    setResult(null);
    setVideoResult(null);
    setProcessing({ isProcessing: false, statusMessage: '', error: undefined });
    setMediaMode('colorize');
  };

  const handleDownloadResult = async () => {
    if (!result) return;
    try {
      await triggerDownload(result.colorized, `chromasnap-hd-${Date.now()}.png`);
    } catch (error: any) {
      setProcessing({ isProcessing: false, statusMessage: '', error: friendlyError(error, 'download') });
    }
  };

  const handleShareResult = async () => {
    if (!result || !navigator.share) return;
    try {
      const response = await fetch(result.colorized);
      const blob = await response.blob();
      const file = new File([blob], `chromasnap-${Date.now()}.png`, { type: blob.type || 'image/png' });
      await navigator.share({
        title: 'ChromaSnap Result',
        text: 'AI colorized image generated with ChromaSnap',
        files: [file],
      });
    } catch {
        void handleDownloadResult();
    }
  };

  const handleWorkspaceTabChange = (tab: WorkspaceTab) => {
    setActiveWorkspaceTab(tab);
    setShowAccountMenu(false);
    if (tab !== 'beauty-lab') {
      setShowBeautyToolsDrawer(false);
    }
    const targetId = tab === 'dashboard'
      ? 'dashboard-panel'
      : tab === 'animate'
        ? 'animate-panel'
      : tab === 'beauty-lab'
        ? 'beauty-lab-panel'
        : tab === 'barbershop'
          ? 'barbershop-panel'
      : tab === 'outfit'
          ? 'outfit-panel'
          : tab === 'account'
            ? 'account-panel'
            : 'colorizer-panel';
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const sleepWithBackoff = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const isRetryableBeautyError = (error: unknown): boolean => {
    const message = String((error as { message?: string })?.message || '').toLowerCase();
    if (!message) return false;

    // Avoid retrying auth/validation failures that need user action.
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('invalid') ||
      message.includes('captcha') ||
      message.includes('session expired')
    ) {
      return false;
    }

    return (
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('abort') ||
      message.includes('429') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('temporar') ||
      message.includes('unavailable')
    );
  };

  const runBeautyActionWithRetry = async <T,>(action: () => Promise<T>, maxAttempts: number = 3): Promise<T> => {
    const backoffMs = [350, 900];
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await action();
      } catch (error) {
        lastError = error;
        const canRetry = isRetryableBeautyError(error);
        if (!canRetry || attempt === maxAttempts) {
          throw error;
        }
        const delay = backoffMs[attempt - 1] ?? 1200;
        await sleepWithBackoff(delay);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Beauty action failed');
  };

  const handleBeautyConsultation = async () => {
    if (!trySelfie) {
      setBeautyConsultationMessage('Please upload a selfie in Virtual Try-On Studio first');
      return;
    }
    if (!beautyNotes.trim()) {
      setBeautyConsultationMessage('Please add consultation notes');
      return;
    }

    setBeautyConsultationLoading(true);
    setBeautyConsultationMessage(null);
    setBeautyConsultationResult(null);

    try {
      const result = await runBeautyActionWithRetry(() => consultBeautyAdvisor(
        trySelfie,
        beautyNotes,
        beautyService
      ));
      setBeautyConsultationResult(result);
      setBeautyConsultationMessage('Consultation complete! Review the advice below.');
    } catch (error: any) {
      setBeautyConsultationMessage(friendlyError(error, 'consultation'));
    } finally {
      setBeautyConsultationLoading(false);
    }
  };

  const handleTrySelfieCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      setPendingPhotoEdit({ target: 'try-on', image: base64String });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleBarbershopSelfieCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      setPendingPhotoEdit({ target: 'barbershop', image: base64String });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleOutfitSelfieCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      setPendingPhotoEdit({ target: 'outfit', image: base64String });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleOutfitGarmentCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      setOutfitGarmentImage(base64String);
      setOutfitMessage('Garment reference uploaded. Generate to apply this exact item direction.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleApplyPendingPhotoEdit = (editedImage: string) => {
    if (!pendingPhotoEdit) return;

    if (pendingPhotoEdit.target === 'try-on') {
      setTrySelfie(editedImage);
      setTryAfterImage(null);
      setTryResults(null);
      setTryMessage(null);
      setHair360Previews(null);
      setHair360Message(null);
    } else if (pendingPhotoEdit.target === 'barbershop') {
      setBarbershopSelfie(editedImage);
      setBarbershopAfterImage(null);
      setBarbershopResults(null);
      setBarbershopMessage(null);
    } else {
      setOutfitSelfie(editedImage);
      setOutfitAfterImage(null);
      setOutfitLooks(null);
      setOutfitActiveLookIndex(0);
      setOutfitMessage(null);
    }

    setPendingPhotoEdit(null);
  };

  const handleGetOccasionRecommendations = async () => {
    if (!trySelfie) {
      setTryMessage('Please upload a selfie first');
      return;
    }

    setTryLoading(true);
    setTryMessage(null);
    setTryResults(null);

    try {
      const result = await runBeautyActionWithRetry(() =>
        recommendOccasionLook(trySelfie, buildOccasionRequestValue(tryOccasion))
      );
      setTryResults(result.recommendations);
      setTryMessage(buildOccasionSuccessMessage(tryOccasion, result.recommendations.length));
    } catch (error: any) {
      setTryMessage(friendlyError(error, 'try-on-recommendations'));
    } finally {
      setTryLoading(false);
    }
  };

  const selectedBeautyHairStyle = tryHairStyle === NO_HAIRSTYLE_CHANGE_VALUE ? 'no hairstyle change' : tryHairStyle;

  const beautyLabToolkitContext = [
    `Complexion ${complexionOpacity}%: shade ${complexionShadeProfile}, contour ${faceShapeContour}, blush ${accentBlushProfile}`,
    `Eyes ${eyesOpacity}%: liner ${eyelinerPattern}, lashes ${lashOverlayDensity}`,
    `Lips ${lipsOpacity}%: finish ${lipFinish}`,
    `Primary hair direction: ${selectedBeautyHairStyle}`,
    `Wig track: ${wigTrackStyle}`,
    `Haircut: ${haircutProfile}`,
    `Extensions: ${extensionProfile}`,
    `Color laboratory: ${colorLabDualTone}`,
  ].join(' | ');

  const beautyLabHairDescriptor =
    tryHairStyle === NO_HAIRSTYLE_CHANGE_VALUE
      ? 'Keep original hairstyle unchanged. Preserve current cut, texture, and silhouette while applying makeup edits only.'
      : `${selectedBeautyHairStyle}, ${wigTrackStyle}, ${haircutProfile}, ${extensionProfile}, ${colorLabDualTone}`;

  const handleGenerateVirtualMakeup = async () => {
    if (!trySelfie) {
      setTryMessage('Please upload a selfie first');
      return;
    }

    setTryLoading(true);
    setTryMessage(null);

    try {
      const result = await runBeautyActionWithRetry(() => generateVirtualMakeup(
        trySelfie,
        tryMakeupStyle,
        beautyLabHairDescriptor,
        buildVirtualMakeupOccasionContext(tryOccasion, [beautyNotes, beautyLabToolkitContext].filter(Boolean).join(' | ')),
        { styleIntensity: tryStyleIntensity }
      ));
      const singleRec = [{
        style: `${tryMakeupStyle.charAt(0).toUpperCase() + tryMakeupStyle.slice(1)} ${tryStyleIntensity.charAt(0).toUpperCase() + tryStyleIntensity.slice(1)} Look`,
        makeup: result.description.substring(0, 200),
        hair: beautyLabHairDescriptor,
        description: result.description
      }];
      const hasGeneratedAfterImage =
        typeof result.editedImage === 'string' &&
        result.editedImage.length > 0 &&
        result.editedImage !== trySelfie;

      if (!hasGeneratedAfterImage) {
        setTryAfterImage(null);
        setTryResults(singleRec);
        setTryMessage('Look analysis completed, but no edited image was returned. Please try Generate again.');
        return;
      }

      const normalizedAfterImage = ensureFreshPreviewUrl(result.editedImage);
      const appearsBlank = await isLikelyBlankGeneratedImage(normalizedAfterImage);
      if (appearsBlank) {
        setTryAfterImage(null);
        setTryResults(singleRec);
        setTryMessage('The generated image looked blank. Please try Generate again with a different selfie angle or style settings.');
        return;
      }

      setTryResults(singleRec);
      setTryAfterImage(normalizedAfterImage);
      setTryMessage('Virtual look generated! Review the description below.');
    } catch (error: any) {
      setTryMessage(friendlyError(error, 'virtual-makeup'));
    } finally {
      setTryLoading(false);
    }
  };

  const handleGetBarbershopRecommendations = async () => {
    if (!barbershopSelfie) {
      setBarbershopMessage('Please upload a selfie first');
      return;
    }

    setBarbershopRecommendationLoading(true);
    setBarbershopMessage(null);
    setBarbershopResults(null);

    try {
      const result = await runBeautyActionWithRetry(() => getBarbershopRecommendations(barbershopSelfie));
      setBarbershopResults(result.recommendations);
      setBarbershopMessage(result.message);
    } catch (error: any) {
      setBarbershopMessage(friendlyError(error, 'barbershop-recommendations'));
    } finally {
      setBarbershopRecommendationLoading(false);
    }
  };

  const handleGenerateBarbershopLook = async () => {
    if (!barbershopSelfie) {
      setBarbershopMessage('Please upload a selfie first');
      return;
    }

    setBarbershopGenerateLoading(true);
    setBarbershopMessage(null);

    try {
      const result = await runBeautyActionWithRetry(() =>
        generateBarbershopLook({
          selfieBase64: barbershopSelfie,
          makeupStyle: barbershopMakeupStyle,
          haircut: barbershopHaircut,
          notes: barbershopNotes,
          styleIntensity: barbershopStyleIntensity,
        })
      );

      setBarbershopResults(result.recommendations);
      const hasGeneratedAfterImage =
        typeof result.afterImage === 'string' &&
        result.afterImage.length > 0 &&
        result.afterImage !== barbershopSelfie;

      if (!hasGeneratedAfterImage) {
        setBarbershopAfterImage(null);
        setBarbershopMessage('Barbershop style generated, but no after-image was returned. Please try Generate Look again.');
        return;
      }

      const normalizedAfterImage = ensureFreshPreviewUrl(result.afterImage);
      const appearsBlank = await isLikelyBlankGeneratedImage(normalizedAfterImage);
      if (appearsBlank) {
        setBarbershopAfterImage(null);
        setBarbershopMessage('The generated barbershop image looked blank. Please try Generate Look again with adjusted settings.');
        return;
      }

      setBarbershopAfterImage(normalizedAfterImage);
      setBarbershopMessage(result.message || 'Barbershop look generated!');
    } catch (error: any) {
      setBarbershopMessage(friendlyError(error, 'barbershop-virtual-look'));
    } finally {
      setBarbershopGenerateLoading(false);
    }
  };

  const buildOutfitSalonAlignmentContext = () => {
    if (!outfitMatchCurrentSalonLook) {
      return '';
    }
    return outfitNotes.trim();
  };

  const handleGenerateOutfitLook = async () => {
    if (!outfitSelfie) {
      setOutfitMessage('Please upload a full-body selfie first');
      return;
    }

    setOutfitLoading(true);
    setOutfitMessage(null);
    setOutfitLooks(null);
    setOutfitActiveLookIndex(0);

    try {
      const result = await runBeautyActionWithRetry(() =>
        generateOutfitTryOn(
          outfitSelfie,
          outfitStyle,
          outfitOccasion,
          outfitColorPalette,
          buildOutfitSalonAlignmentContext(),
          {
            mode: outfitMode,
            garmentLabel: outfitGarmentLabel,
            garmentImageBase64: outfitGarmentImage || undefined,
            matchCurrentSalonLook: outfitMatchCurrentSalonLook,
            batchCount: outfitBatchCount,
          }
        )
      );

      const validLooks: OutfitLookVariant[] = Array.isArray(result.looks) && result.looks.length
        ? (await Promise.all(result.looks.map(async (look, index) => {
          if (typeof look?.editedImage !== 'string' || look.editedImage.length === 0 || look.editedImage === outfitSelfie) {
            return null;
          }
          const normalizedImage = ensureFreshPreviewUrl(look.editedImage);
          const appearsBlank = await isLikelyBlankGeneratedImage(normalizedImage);
          if (appearsBlank) {
            return null;
          }
          return {
            title: look.title || `Look ${index + 1}`,
            editedImage: normalizedImage,
            description: look.description || result.description || '',
          };
        }))).filter((look): look is OutfitLookVariant => look !== null)
        : [];

      const hasPrimaryAfterImage =
        typeof result.editedImage === 'string' &&
        result.editedImage.length > 0 &&
        result.editedImage !== outfitSelfie;

      let primaryLook: OutfitLookVariant[] = [];
      if (hasPrimaryAfterImage) {
        const normalizedPrimary = ensureFreshPreviewUrl(result.editedImage);
        const primaryLooksBlank = await isLikelyBlankGeneratedImage(normalizedPrimary);
        if (!primaryLooksBlank) {
          primaryLook = [{
            title: 'Primary Look',
            editedImage: normalizedPrimary,
            description: result.description || '',
          }];
        }
      }

      const normalizedLooks: OutfitLookVariant[] = validLooks.length ? validLooks : primaryLook;

      if (!normalizedLooks.length) {
        setOutfitLooks(null);
        setOutfitAfterImage(null);
        setOutfitMessage('Outfit guidance generated, but the returned image looked blank or unusable. Please try Generate Outfit again.');
        return;
      }

      setOutfitLooks(normalizedLooks);
      setOutfitAfterImage(normalizedLooks[0]?.editedImage || null);
      setOutfitMessage(result.description || 'Outfit generated! Compare options before heading out.');
    } catch (error: any) {
      setOutfitMessage(friendlyError(error, 'outfit-try-on'));
    } finally {
      setOutfitLoading(false);
    }
  };

  const handleGenerateTryOnAngle = useCallback(async (angle: Hair360Angle): Promise<string | null> => {
    if (angle === 'front') {
      return tryAfterImage || trySelfie;
    }
    if (!tryAfterImage && !trySelfie) {
      return null;
    }

    try {
      const sourceImage = tryAfterImage || trySelfie || '';
      const result = await runBeautyActionWithRetry(() => generateVirtualMakeup(
        sourceImage,
        tryMakeupStyle,
        beautyLabHairDescriptor,
        buildVirtualMakeupOccasionContext(tryOccasion, [beautyNotes, beautyLabToolkitContext].filter(Boolean).join(' | ')),
        {
          styleIntensity: tryStyleIntensity,
          cameraView: angle,
        }
      ));

      return ensureFreshPreviewUrl(result.editedImage || sourceImage);
    } catch (error: any) {
      setTryMessage(friendlyError(error, `try-on-${angle}-view`));
      return null;
    }
  }, [
    tryAfterImage,
    trySelfie,
    tryMakeupStyle,
    beautyLabHairDescriptor,
    beautyLabToolkitContext,
    tryOccasion,
    beautyNotes,
    tryStyleIntensity,
  ]);

  const handleGenerateBarbershopAngle = useCallback(async (angle: Hair360Angle): Promise<string | null> => {
    if (angle === 'front') {
      return barbershopAfterImage || barbershopSelfie;
    }
    if (!barbershopAfterImage && !barbershopSelfie) {
      return null;
    }

    try {
      const sourceImage = barbershopAfterImage || barbershopSelfie || '';
      const result = await runBeautyActionWithRetry(() => generateVirtualMakeup(
        sourceImage,
        barbershopMakeupStyle,
        barbershopHaircut,
        buildVirtualMakeupOccasionContext('barbershop visit', barbershopNotes),
        {
          styleIntensity: barbershopStyleIntensity,
          cameraView: angle,
        }
      ));

      return ensureFreshPreviewUrl(result.editedImage || sourceImage);
    } catch (error: any) {
      setBarbershopMessage(friendlyError(error, `barbershop-${angle}-view`));
      return null;
    }
  }, [
    barbershopAfterImage,
    barbershopSelfie,
    barbershopMakeupStyle,
    barbershopHaircut,
    barbershopNotes,
    barbershopStyleIntensity,
  ]);

  const handleDownloadTryOn = async () => {
    if (!tryAfterImage) {
      setTryMessage('Generate a finished Beauty Lab look before downloading the final photo.');
      return;
    }

    const toSlug = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24) || 'na';

    const filename = [
      'chromasnap-virtual-try-on',
      toSlug(tryMakeupStyle),
      toSlug(tryHairStyle),
      toSlug(tryOccasion),
      toSlug(tryStyleIntensity),
      Date.now().toString(),
    ].join('-');

    try {
      await triggerDownload(tryAfterImage, `${filename}.jpg`);
      setTryMessage('Finished photo downloaded.');
    } catch (error: any) {
      setTryMessage(friendlyError(error, 'beauty-lab-download'));
    }
  };

  const handleSaveBeautyConsultationSheet = async () => {
    if (!trySelfie || !tryAfterImage) {
      setTryMessage('Upload a selfie and generate a finished look before downloading the consultation card.');
      return;
    }

    const beforeImage = trySelfie;
    const afterImage = tryAfterImage;

    const formulaBreakdown = [
      `Hair: ${toDisplayLabel(colorLabDualTone)} color profile with ${toDisplayLabel(wigTrackStyle)} wig track, ${toDisplayLabel(haircutProfile)} haircut, and ${toDisplayLabel(extensionProfile)} extension shaping.`,
      `Complexion: ${toDisplayLabel(complexionShadeProfile)} foundation with ${toDisplayLabel(faceShapeContour)} contour and ${toDisplayLabel(accentBlushProfile)} blush at ${complexionOpacity}% weight.`,
      `Eyes: ${toDisplayLabel(eyelinerPattern)} liner with ${toDisplayLabel(lashOverlayDensity)} lash overlay at ${eyesOpacity}% weight.`,
      `Lips: ${toDisplayLabel(lipFinish)} finish at ${lipsOpacity}% weight in ${toDisplayLabel(tryMakeupStyle)} style (${toDisplayLabel(tryStyleIntensity)} intensity).`,
    ];

    const terminologyPrompt = [
      `I'm looking for a ${toDisplayLabel(haircutProfile)} shape blended into a ${toDisplayLabel(wigTrackStyle)} direction with ${toDisplayLabel(extensionProfile)} support for movement and fullness.`,
      `For color, please build a ${toDisplayLabel(colorLabDualTone)} result with controlled tonal lift and a polished salon finish that complements my complexion.`,
      `For makeup, keep ${toDisplayLabel(eyelinerPattern)} definition with ${toDisplayLabel(lashOverlayDensity)} lashes and a ${toDisplayLabel(lipFinish)} lip, balanced at a ${toDisplayLabel(tryStyleIntensity)} intensity.`
    ];

    try {
      const [beforeElement, afterElement] = await Promise.all([
        loadImageElement(beforeImage),
        loadImageElement(afterImage),
      ]);

      const cardWidth = 1400;
      const cardHeight = 1800;
      const horizontalPadding = 72;
      const canvas = document.createElement('canvas');
      canvas.width = cardWidth;
      canvas.height = cardHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Unable to create consultation card renderer.');
      }

      context.fillStyle = '#0b1220';
      context.fillRect(0, 0, cardWidth, cardHeight);

      context.fillStyle = '#f1f5f9';
      context.font = '700 52px Arial';
      context.fillText('Technical Consultation Card', horizontalPadding, 88);

      context.fillStyle = '#94a3b8';
      context.font = '400 26px Arial';
      context.fillText(`Generated ${new Date().toLocaleString()}`, horizontalPadding, 126);

      const imageTop = 168;
      const imageHeight = 560;
      const imageGap = 26;
      const imageWidth = (cardWidth - horizontalPadding * 2 - imageGap) / 2;

      context.strokeStyle = '#475569';
      context.lineWidth = 4;
      context.strokeRect(horizontalPadding, imageTop, imageWidth, imageHeight);
      context.strokeRect(horizontalPadding + imageWidth + imageGap, imageTop, imageWidth, imageHeight);

      context.fillStyle = '#e2e8f0';
      context.font = '700 28px Arial';
      context.fillText('Before', horizontalPadding + 24, imageTop + 42);
      context.fillText('After', horizontalPadding + imageWidth + imageGap + 24, imageTop + 42);

      context.drawImage(beforeElement, horizontalPadding + 16, imageTop + 56, imageWidth - 32, imageHeight - 72);
      context.drawImage(afterElement, horizontalPadding + imageWidth + imageGap + 16, imageTop + 56, imageWidth - 32, imageHeight - 72);

      let textY = imageTop + imageHeight + 70;
      context.fillStyle = '#f1f5f9';
      context.font = '700 36px Arial';
      context.fillText('Formula Breakdown', horizontalPadding, textY);
      textY += 42;

      context.fillStyle = '#cbd5e1';
      context.font = '400 24px Arial';
      formulaBreakdown.forEach((line) => {
        const wrapped = context.measureText(`- ${line}`).width > cardWidth - horizontalPadding * 2
          ? [
              `- ${line.slice(0, 82)}${line.length > 82 ? '...' : ''}`,
            ]
          : [`- ${line}`];
        wrapped.forEach((segment) => {
          context.fillText(segment, horizontalPadding, textY);
          textY += 34;
        });
        textY += 10;
      });

      textY += 16;
      context.fillStyle = '#f1f5f9';
      context.font = '700 36px Arial';
      context.fillText('Terminology Prompt', horizontalPadding, textY);
      textY += 42;

      context.fillStyle = '#cbd5e1';
      context.font = '400 24px Arial';
      const promptSentence = terminologyPrompt.join(' ');
      const truncatedPrompt = promptSentence.length > 380 ? `${promptSentence.slice(0, 377)}...` : promptSentence;
      context.fillText(truncatedPrompt, horizontalPadding, textY);

      const cardDataUrl = canvas.toDataURL('image/png');
      const filename = `beauty-consultation-card-${Date.now()}.png`;
      await triggerDownload(cardDataUrl, filename);
      setTryMessage('Consultation card downloaded.');
    } catch (error: any) {
      setTryMessage(friendlyError(error, 'beauty-consultation-sheet'));
    }
  };

  const handleDownloadBarbershop = async () => {
    if (!barbershopAfterImage) {
      setBarbershopMessage('Generate a barbershop after image before downloading.');
      return;
    }

    const toSlug = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24) || 'na';

    const filename = [
      'chromasnap-barbershop',
      toSlug(barbershopHaircut),
      toSlug(barbershopStyleIntensity),
      Date.now().toString(),
    ].join('-');

    try {
      await triggerDownload(barbershopAfterImage, `${filename}.jpg`);
      setBarbershopMessage('Barbershop after image downloaded.');
    } catch (error: any) {
      setBarbershopMessage(friendlyError(error, 'barbershop-download'));
    }
  };

  const handleDownloadOutfit = async () => {
    if (!outfitAfterImage) {
      setOutfitMessage('Generate an outfit after image before downloading.');
      return;
    }

    const toSlug = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24) || 'na';

    const filename = [
      'chromasnap-outfit',
      toSlug(outfitMode),
      toSlug(outfitStyle),
      toSlug(outfitOccasion),
      toSlug(outfitColorPalette),
      Date.now().toString(),
    ].join('-');

    try {
      await triggerDownload(outfitAfterImage, `${filename}.jpg`);
      setOutfitMessage('Outfit after image downloaded.');
    } catch (error: any) {
      setOutfitMessage(friendlyError(error, 'outfit-download'));
    }
  };

  const handleSelectOutfitLook = (index: number) => {
    if (!outfitLooks || !outfitLooks[index]) return;
    setOutfitActiveLookIndex(index);
    setOutfitAfterImage(outfitLooks[index].editedImage);
    setOutfitMessage(outfitLooks[index].description || 'Outfit look selected.');
  };

  const handleDownloadAnimation = async () => {
    if (!videoResult?.videoUrl) return;
    try {
      await triggerDownload(videoResult.videoUrl, `chromasnap-animation-${Date.now()}.mp4`);
    } catch (error: any) {
      setProcessing({ isProcessing: false, statusMessage: '', error: friendlyError(error, 'animation-download') });
    }
  };

  const handleGenerateHair360Preview = async () => {
    if (!trySelfie) {
      setHair360Message('Please upload a selfie first');
      return;
    }

    setHair360Loading(true);
    setHair360Message(null);
    setHair360Previews(null);

    try {
      const angleOrder: Hair360Angle[] = ['front', 'left', 'right', 'back'];
      const titleByAngle: Record<Hair360Angle, string> = {
        front: 'Front View',
        left: 'Left Profile',
        right: 'Right Profile',
        back: 'Back View',
      };

      const angleHints: Record<Hair360Angle, string> = {
        front: 'Refine fringe density, face-framing pieces, and temple softness.',
        left: 'Adjust layering around cheekbone and ear line for cleaner profile balance.',
        right: 'Tune volume symmetry and perimeter weight against jawline.',
        back: 'Rebalance crown fullness and hemline shape for movement and polish.',
      };

      let baseDescription = buildHair360BaseDescription(tryHairStyle, tryOccasion);
      const result = await runBeautyActionWithRetry(() => generateVirtualMakeup(
        trySelfie,
        tryMakeupStyle,
        `${tryHairStyle}, length:${hair360Length}, volume:${hair360Volume}, fringe:${hair360Fringe}, texture:${hair360Texture}`,
        buildHair360PreviewOccasionContext(tryOccasion),
        { generateImage: false, styleIntensity: tryStyleIntensity }
      ));
      baseDescription = result.description || baseDescription;

      const previews = angleOrder.map((angle) => ({
        angle,
        title: titleByAngle[angle],
        summary: `${titleByAngle[angle]}: ${tryHairStyle} style with ${hair360Length} length, ${hair360Volume} volume, ${hair360Fringe} fringe, and ${hair360Texture} finish. ${baseDescription.substring(0, 130)}${baseDescription.length > 130 ? '...' : ''}`,
        editHint: angleHints[angle],
      }));

      setHair360Previews(previews);
      setHair360Message('360 hairstyle preview generated. Switch angles and fine-tune your settings.');
    } catch (error: any) {
      setHair360Message(friendlyError(error, 'hair-360-preview'));
    } finally {
      setHair360Loading(false);
    }
  };

  const handleAnalyzeBeautyProfile = async () => {
    if (!trySelfie) {
      setProfileAnalysisMessage('Please upload a selfie first');
      return;
    }
    setProfileAnalysisLoading(true);
    setProfileAnalysisMessage(null);
    setProfileAnalysisResult(null);
    try {
      const result = await runBeautyActionWithRetry(() => analyzeBeautyProfile(trySelfie));
      setProfileAnalysisResult(result);
      setProfileAnalysisMessage('Beauty profile analysis complete!');
    } catch (error: any) {
      setProfileAnalysisMessage(friendlyError(error, 'analyzeBeautyProfile'));
    } finally {
      setProfileAnalysisLoading(false);
    }
  };

  const handleAnalyzeComplexionReport = async () => {
    if (!trySelfie) {
      setComplexionReportMessage('Please upload a close-up selfie first');
      return;
    }

    setComplexionReportLoading(true);
    setComplexionReportMessage(null);
    setComplexionReport(null);

    try {
      const report = await runBeautyActionWithRetry(() => analyzeComplexionReport(trySelfie));
      setComplexionReport(report);
      setComplexionHistory((current) => [
        {
          timestamp: Date.now(),
          hydrationLevel: report.hydrationLevel,
          rednessLevel: report.rednessLevel,
          poreVisibility: report.poreVisibility,
          toneUniformity: report.toneUniformity,
          recommendedMakeupStyle: report.recommendedMakeupStyle,
          recommendedStyleIntensity: report.recommendedStyleIntensity,
        },
        ...current,
      ].slice(0, 20));
      setComplexionReportMessage('Complexion report ready. You can apply this directly in Beauty Lab.');
    } catch (error: any) {
      setComplexionReportMessage(friendlyError(error, 'complexion-report'));
    } finally {
      setComplexionReportLoading(false);
    }
  };

  const handleApplyComplexionToBeautyLab = () => {
    if (!complexionReport) return;

    setTryMakeupStyle(complexionReport.recommendedMakeupStyle);
    setTryStyleIntensity(complexionReport.recommendedStyleIntensity);

    const tipText = complexionReport.beautyLabTips.slice(0, 3).join(' | ');
    const notePrefix = `Complexion focus: hydration ${complexionReport.hydrationLevel}, redness ${complexionReport.rednessLevel}, pores ${complexionReport.poreVisibility}, tone ${complexionReport.toneUniformity}. Color corrector: ${complexionReport.colorCorrector}.`;
    const nextNotes = [notePrefix, tipText, beautyNotes].filter(Boolean).join(' ');
    setBeautyNotes(nextNotes.slice(0, 1200));

    setComplexionReportMessage('Applied complexion recommendations to Beauty Lab controls.');
  };

  const metricScore = {
    hydration: (value: 'low' | 'balanced' | 'high') => (value === 'low' ? 1 : value === 'balanced' ? 2 : 3),
    redness: (value: 'low' | 'moderate' | 'high') => (value === 'low' ? 3 : value === 'moderate' ? 2 : 1),
    pores: (value: 'low' | 'moderate' | 'high') => (value === 'low' ? 3 : value === 'moderate' ? 2 : 1),
    uniformity: (value: 'uneven' | 'mostly-even' | 'even') => (value === 'uneven' ? 1 : value === 'mostly-even' ? 2 : 3),
  };

  const weeklyComplexionTrend = complexionHistory.slice(0, 7).reverse();

  const calculateTrendStatus = (): { status: 'improving' | 'stable' | 'declining'; label: string; color: string } => {
    if (complexionHistory.length < 2) return { status: 'stable', label: 'Insufficient data', color: 'text-slate-400' };
    
    const lastThree = complexionHistory.slice(0, 3).reverse();
    const scores = lastThree.map(entry => {
      const avgScore = (metricScore.hydration(entry.hydrationLevel) + metricScore.redness(entry.rednessLevel) + metricScore.pores(entry.poreVisibility) + metricScore.uniformity(entry.toneUniformity)) / 4;
      return avgScore;
    });
    
    if (scores.length === 1) return { status: 'stable', label: 'Single report', color: 'text-slate-400' };
    
    const oldestScore = scores[0];
    const newestScore = scores[scores.length - 1];
    const difference = newestScore - oldestScore;
    const threshold = 0.3;
    
    if (difference > threshold) {
      return { status: 'improving', label: 'Improving', color: 'text-emerald-400' };
    } else if (difference < -threshold) {
      return { status: 'declining', label: 'Declining', color: 'text-orange-400' };
    } else {
      return { status: 'stable', label: 'Stable', color: 'text-slate-300' };
    }
  };

  const trendStatus = calculateTrendStatus();

  const clearComplexionHistory = () => {
    setComplexionHistory([]);
    setComplexionReportMessage('Complexion history cleared.');
  };

  const isRestricted = result && result.safetyCheck && !result.safetyCheck.isSafe;
  const containsMinors = result && result.safetyCheck?.containsMinors;

  if (!authInitialized) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
        <Header tokenBalance={null} />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-sm text-slate-300">Initializing secure session...</div>
        </main>
      </div>
    );
  }

  if (showAdminLoginPage && isDeveloperMode) {
    return <AdminLoginPage onBack={() => setShowAdminLoginPage(false)} />;
  }

  if (!authUser) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
        <Header tokenBalance={null} />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            {/* ── Login Form ── */}
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl p-5 space-y-3">
            <h2 className="text-base font-bold text-white">Secure Login</h2>
            <p className="text-xs text-slate-400">Sign in to continue.</p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setAuthMode('login'); setAuthRequireCaptcha(false); setAuthCaptchaToken(''); }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold ${authMode === 'login' ? 'bg-indigo-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-300'}`}
              >
                Login
              </button>
              <button
                onClick={() => { setAuthMode('register'); setAuthRequireCaptcha(false); setAuthCaptchaToken(''); }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold ${authMode === 'register' ? 'bg-indigo-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-300'}`}
              >
                Register
              </button>
            </div>

            {(authMode === 'login' || authMode === 'register' || authMode === 'recover-password') && (
              <input
                id="auth-username"
                name="username"
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
                placeholder="Username"
                aria-label="Username"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            )}

            {(authMode === 'login' || authMode === 'register') && (
              <div className="relative">
                <input
                  id="auth-password"
                  name="password"
                  type={showAuthPassword ? 'text' : 'password'}
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Password"
                  aria-label="Password"
                  autoComplete="off"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 pr-11 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowAuthPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-white transition-colors"
                  aria-label={showAuthPassword ? 'Hide password' : 'Show password'}
                >
                  {showAuthPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.423-4.057m2.138-1.556A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.965 9.965 0 01-4.293 5.291M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 9L3 3" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            )}

            {authMode === 'login' && authRequireCaptcha && (
              <div className="space-y-2">
                <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                  Additional verification required before login.
                </div>
                {turnstileSiteKey ? (
                  <TurnstileCaptcha
                    siteKey={turnstileSiteKey}
                    onTokenChange={setAuthCaptchaToken}
                  />
                ) : (
                  <input
                    id="auth-captcha-token"
                    name="captchaToken"
                    value={authCaptchaToken}
                    onChange={(event) => setAuthCaptchaToken(event.target.value)}
                    placeholder="Captcha token (dev: dev-captcha-ok)"
                    className="w-full rounded-xl bg-slate-950/60 border border-amber-500/40 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                )}
              </div>
            )}

            {authMode === 'register' && (
              <>
                <input
                  id="auth-full-name"
                  name="fullName"
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="Email"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <input
                  id="auth-phone-number"
                  name="phoneNumber"
                  type="tel"
                  value={authPhoneNumber}
                  onChange={(event) => setAuthPhoneNumber(event.target.value)}
                  placeholder="Phone number (optional)"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </>
            )}

            {(authMode === 'recover-username' || authMode === 'recover-password') && (
              <input
                id="auth-recovery-email"
                name="recoveryEmail"
                type="email"
                value={authRecoveryEmail}
                onChange={(event) => setAuthRecoveryEmail(event.target.value)}
                placeholder="Recovery email"
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            )}

            {authMode === 'recover-password' && (
              <>
                <input
                  id="auth-reset-token"
                  name="resetToken"
                  value={authResetToken}
                  onChange={(event) => setAuthResetToken(event.target.value)}
                  placeholder="Reset token"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <div className="relative">
                  <input
                    id="auth-new-password"
                    name="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={authNewPassword}
                    onChange={(event) => setAuthNewPassword(event.target.value)}
                    placeholder="New password"
                    className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 pr-11 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(prev => !prev)}
                    className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-white transition-colors"
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showNewPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.423-4.057m2.138-1.556A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.965 9.965 0 01-4.293 5.291M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 9L3 3" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {!!issuedResetToken && (
                  <div className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 break-all">
                    Dev reset token: {issuedResetToken}
                  </div>
                )}
              </>
            )}

            {recoveredUsernames.length > 0 && (
              <div className="text-xs text-slate-300 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
                Recovered usernames: {recoveredUsernames.join(', ')}
              </div>
            )}

            {authMessage && (
              <div className="text-xs text-indigo-200 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-3 py-2">
                {authMessage}
              </div>
            )}

            {authMode === 'login' && (
              <div className="space-y-2">
                <button
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                  className="w-full px-4 py-2 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Continue with Google
                </button>

                <div className="grid grid-cols-1 gap-2 p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                  <input
                    id="social-phone-number"
                    name="socialPhoneNumber"
                    type="tel"
                    value={socialPhoneNumber}
                    onChange={(event) => setSocialPhoneNumber(event.target.value)}
                    placeholder="Phone (+12025551234)"
                    className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  {!socialOtpSent ? (
                    <button
                      onClick={handleSendPhoneOtp}
                      disabled={authLoading || !socialPhoneNumber.trim()}
                      className="w-full px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50"
                    >
                      Send OTP
                    </button>
                  ) : (
                    <>
                      <input
                        id="social-otp-code"
                        name="socialOtpCode"
                        value={socialOtpCode}
                        onChange={(event) => setSocialOtpCode(event.target.value)}
                        placeholder="OTP code"
                        className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handleVerifyPhoneOtp}
                        disabled={authLoading || !socialOtpCode.trim()}
                        className="w-full px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50"
                      >
                        Verify OTP & Sign In
                      </button>
                    </>
                  )}
                </div>

                <div id="recaptcha-container" />
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              {authMode === 'login' && (
                <div className="space-y-2">
                  <button
                    onClick={handleLogin}
                    disabled={authLoading || !authUsername.trim() || !authPassword || (authRequireCaptcha && !authCaptchaToken.trim())}
                    className="w-full px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50"
                  >
                    Sign In
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setAuthMode('recover-username'); setAuthRequireCaptcha(false); setAuthCaptchaToken(''); }}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300 hover:border-indigo-500 hover:text-white transition-colors"
                    >
                      Forgot Username
                    </button>
                    <button
                      onClick={() => { setAuthMode('recover-password'); setAuthRequireCaptcha(false); setAuthCaptchaToken(''); }}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300 hover:border-indigo-500 hover:text-white transition-colors"
                    >
                      Forgot Password
                    </button>
                  </div>
                </div>
              )}
              {authMode === 'register' && (
                <button
                  onClick={handleRegister}
                  disabled={authLoading || !authUsername.trim() || !authPassword || !authName.trim() || !authEmail.trim()}
                  className="w-full px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  Create Account
                </button>
              )}
              {authMode === 'recover-username' && (
                <button
                  onClick={handleRecoverUsername}
                  disabled={authLoading || !authRecoveryEmail.trim()}
                  className="w-full px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  Recover Username
                </button>
              )}
              {authMode === 'recover-password' && (
                <>
                  <button
                    onClick={handleRequestPasswordReset}
                    disabled={authLoading || !authUsername.trim() || !authRecoveryEmail.trim()}
                    className="w-full px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 transition-colors disabled:opacity-50"
                  >
                    Request Reset Token
                  </button>
                  <button
                    onClick={handleConfirmPasswordReset}
                    disabled={authLoading}
                    className="w-full px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50"
                  >
                    Confirm New Password
                  </button>
                </>
              )}
            </div>

          </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      <Header
        tokenBalance={subscriptionAccount?.tokenBalance ?? null}
        onMenuToggle={() => setShowAccountMenu((current) => !current)}
        isMenuOpen={showAccountMenu}
      />

      {showAccountMenu && (
        <div ref={accountMenuRef} className="studio-menu-enter fixed right-4 top-20 z-[60] w-[min(92vw,336px)] rounded-2xl border border-indigo-500/30 bg-slate-950/92 p-2.5 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl">
          <div className="rounded-xl border border-indigo-400/30 bg-gradient-to-r from-indigo-500/10 via-slate-950/70 to-cyan-500/10 px-3 py-2 mb-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-200/85">Workspace</div>
            <div className="text-[10px] text-slate-400 mt-1">Switch studio tabs quickly.</div>
          </div>

          <div className="rounded-xl border border-indigo-400/20 bg-slate-900/45 p-1.5 space-y-1 mb-2">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-200/75">Core</div>
            <button
              onClick={() => handleWorkspaceTabChange('dashboard')}
              className={`w-full rounded-full px-3 py-2 text-left text-xs font-semibold transition-all ${activeWorkspaceTab === 'dashboard' ? 'bg-indigo-500/25 text-indigo-100 border border-indigo-400/50' : 'text-slate-300 border border-transparent hover:bg-indigo-500/10 hover:border-indigo-400/30 hover:text-white'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => handleWorkspaceTabChange('colorizer')}
              className={`w-full rounded-full px-3 py-2 text-left text-xs font-semibold transition-all ${activeWorkspaceTab === 'colorizer' ? 'bg-indigo-500/25 text-indigo-100 border border-indigo-400/50' : 'text-slate-300 border border-transparent hover:bg-indigo-500/10 hover:border-indigo-400/30 hover:text-white'}`}
            >
              Colorizer
            </button>
            <button
              onClick={() => handleWorkspaceTabChange('animate')}
              className={`w-full rounded-full px-3 py-2 text-left text-xs font-semibold transition-all ${activeWorkspaceTab === 'animate' ? 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/50' : 'text-slate-300 border border-transparent hover:bg-cyan-500/10 hover:border-cyan-400/30 hover:text-white'}`}
            >
              Animate
            </button>
          </div>

          <div className="rounded-xl border border-rose-400/20 bg-slate-900/45 p-1.5 space-y-1 mb-2">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-200/75">Studios</div>
            <button
              onClick={() => handleWorkspaceTabChange('beauty-lab')}
              className={`w-full rounded-full px-3 py-2 text-left text-xs font-semibold transition-all ${activeWorkspaceTab === 'beauty-lab' ? 'bg-rose-500/25 text-rose-100 border border-rose-400/50' : 'text-slate-300 border border-transparent hover:bg-rose-500/10 hover:border-rose-400/30 hover:text-white'}`}
            >
              Beauty Lab
            </button>
            <button
              onClick={() => handleWorkspaceTabChange('barbershop')}
              className={`w-full rounded-full px-3 py-2 text-left text-xs font-semibold transition-all ${activeWorkspaceTab === 'barbershop' ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-400/50' : 'text-slate-300 border border-transparent hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:text-white'}`}
            >
              Barbershop
            </button>
            <button
              onClick={() => handleWorkspaceTabChange('outfit')}
              className={`w-full rounded-full px-3 py-2 text-left text-xs font-semibold transition-all ${activeWorkspaceTab === 'outfit' ? 'bg-fuchsia-500/25 text-fuchsia-100 border border-fuchsia-400/50' : 'text-slate-300 border border-transparent hover:bg-fuchsia-500/10 hover:border-fuchsia-400/30 hover:text-white'}`}
            >
              Outfit Studio
            </button>
          </div>

          <div className="rounded-xl border border-amber-400/20 bg-slate-900/45 p-1.5 space-y-1 mb-2">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200/75">Account</div>
            <button
              onClick={() => handleWorkspaceTabChange('account')}
              className={`w-full rounded-full px-3 py-2 text-left text-xs font-semibold transition-all ${activeWorkspaceTab === 'account' ? 'bg-amber-500/25 text-amber-100 border border-amber-400/50' : 'text-slate-300 border border-transparent hover:bg-amber-500/10 hover:border-amber-400/30 hover:text-white'}`}
            >
              Account
            </button>
            <button
              onClick={() => { setAccountTab('overview'); setShowAccountDrawer(true); setShowAccountMenu(false); }}
              className="w-full rounded-full px-3 py-2 text-left text-xs font-semibold text-slate-300 border border-transparent transition-all hover:bg-amber-500/10 hover:border-amber-400/30 hover:text-white"
            >
              Overview
            </button>
            <button
              onClick={() => { setAccountTab('account-details'); setShowAccountDrawer(true); setShowAccountMenu(false); }}
              className="w-full rounded-full px-3 py-2 text-left text-xs font-semibold text-slate-300 border border-transparent transition-all hover:bg-amber-500/10 hover:border-amber-400/30 hover:text-white"
            >
              Account Details
            </button>
            <button
              onClick={() => { setShowAccountMenu(false); void refreshSubscription(); }}
              disabled={billingLoading}
              className="w-full rounded-full px-3 py-2 text-left text-xs font-semibold text-slate-300 border border-transparent transition-all hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:text-white disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <div className="rounded-xl border border-rose-400/20 bg-slate-900/45 p-1.5 space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-200/75">Tools & Session</div>
            <button
              onClick={() => { setShowBeautyToolsDrawer(true); setShowAccountMenu(false); }}
              disabled={activeWorkspaceTab !== 'beauty-lab'}
              className="w-full rounded-full px-3 py-2 text-left text-xs font-semibold text-slate-300 border border-transparent transition-all hover:bg-rose-500/10 hover:border-rose-400/30 hover:text-white disabled:opacity-50"
            >
              Open Beauty Tools
            </button>
            <button
              onClick={() => { setAccountTab('delete-account'); setShowAccountDrawer(true); setShowAccountMenu(false); }}
              className="w-full rounded-full px-3 py-2 text-left text-xs font-semibold text-rose-300 border border-transparent transition-all hover:bg-rose-500/10 hover:border-rose-400/30 hover:text-rose-100"
            >
              Delete Account
            </button>
            <button
              onClick={() => { setShowAccountMenu(false); handleLogout(); }}
              className="w-full rounded-full px-3 py-2 text-left text-xs font-semibold text-rose-300 border border-transparent transition-all hover:bg-rose-500/10 hover:border-rose-400/30 hover:text-rose-100"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full p-4 sm:p-6">
        {processing.isProcessing && (
          <LoadingOverlay
            message={processing.statusMessage}
            type={processing.type}
          />
        )}

        <div className="grid items-start gap-6 xl:grid-cols-[310px_minmax(0,1fr)]">
        <div
          id="workspace-panel"
          className="studio-shell-enter hidden xl:block w-full rounded-3xl border border-indigo-500/30 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-indigo-500/10 p-4 sm:p-5 space-y-3 max-h-[72vh] overflow-y-auto xl:col-start-1 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]"
        >
          <div className="rounded-2xl border border-indigo-400/30 bg-gradient-to-r from-indigo-500/10 via-slate-950/70 to-cyan-500/10 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200/85">Workspace</div>
            <div className="text-[10px] text-slate-400 mt-1">Launch a studio panel from here.</div>
          </div>

          <div className="rounded-2xl border border-indigo-400/25 bg-slate-950/60 p-2 space-y-1">
            <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-widest font-bold text-indigo-200/75">Core</div>
            <button
              onClick={() => handleWorkspaceTabChange('dashboard')}
              className={`w-full rounded-full px-3 py-2 text-left text-sm font-semibold transition-all ${
                activeWorkspaceTab === 'dashboard'
                  ? 'bg-indigo-500/25 text-indigo-100 border border-indigo-400/50 shadow-sm shadow-indigo-500/30'
                  : 'text-slate-300 border border-transparent hover:bg-indigo-500/10 hover:border-indigo-400/30 hover:text-white'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => handleWorkspaceTabChange('colorizer')}
              className={`w-full rounded-full px-3 py-2 text-left text-sm font-semibold transition-all ${
                activeWorkspaceTab === 'colorizer'
                  ? 'bg-indigo-500/25 text-indigo-100 border border-indigo-400/50 shadow-sm shadow-indigo-500/30'
                  : 'text-slate-300 border border-transparent hover:bg-indigo-500/10 hover:border-indigo-400/30 hover:text-white'
              }`}
            >
              Colorizer
            </button>
            <button
              onClick={() => handleWorkspaceTabChange('animate')}
              className={`w-full rounded-full px-3 py-2 text-left text-sm font-semibold transition-all ${
                activeWorkspaceTab === 'animate'
                  ? 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/50 shadow-sm shadow-cyan-500/30'
                  : 'text-slate-300 border border-transparent hover:bg-cyan-500/10 hover:border-cyan-400/30 hover:text-white'
              }`}
            >
              Animate
            </button>
          </div>

          <div className="rounded-2xl border border-rose-400/20 bg-slate-950/60 p-2 space-y-1">
            <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-widest font-bold text-rose-200/75">Studios</div>
            <button
              onClick={() => handleWorkspaceTabChange('beauty-lab')}
              className={`w-full rounded-full px-3 py-2 text-left text-sm font-semibold transition-all ${
                activeWorkspaceTab === 'beauty-lab'
                  ? 'bg-rose-500/25 text-rose-100 border border-rose-400/50 shadow-sm shadow-rose-500/30'
                  : 'text-slate-300 border border-transparent hover:bg-rose-500/10 hover:border-rose-400/30 hover:text-white'
              }`}
            >
              Beauty Lab
            </button>
            <button
              onClick={() => handleWorkspaceTabChange('barbershop')}
              className={`w-full rounded-full px-3 py-2 text-left text-sm font-semibold transition-all ${
                activeWorkspaceTab === 'barbershop'
                  ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-400/50 shadow-sm shadow-emerald-500/30'
                  : 'text-slate-300 border border-transparent hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:text-white'
              }`}
            >
              Barbershop
            </button>
            <button
              onClick={() => handleWorkspaceTabChange('outfit')}
              className={`w-full rounded-full px-3 py-2 text-left text-sm font-semibold transition-all ${
                activeWorkspaceTab === 'outfit'
                  ? 'bg-fuchsia-500/25 text-fuchsia-100 border border-fuchsia-400/50 shadow-sm shadow-fuchsia-500/30'
                  : 'text-slate-300 border border-transparent hover:bg-fuchsia-500/10 hover:border-fuchsia-400/30 hover:text-white'
              }`}
            >
              Outfit Studio
            </button>
          </div>

          <div className="rounded-2xl border border-amber-400/20 bg-slate-950/60 p-2 space-y-1">
            <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-widest font-bold text-amber-200/75">Account</div>
            <button
              onClick={() => handleWorkspaceTabChange('account')}
              className={`w-full rounded-full px-3 py-2 text-left text-sm font-semibold transition-all ${
                activeWorkspaceTab === 'account'
                  ? 'bg-amber-500/25 text-amber-100 border border-amber-400/50 shadow-sm shadow-amber-500/30'
                  : 'text-slate-300 border border-transparent hover:bg-amber-500/10 hover:border-amber-400/30 hover:text-white'
              }`}
            >
              Account
            </button>
          </div>
        </div>

        <div
          id="account-drawer"
          className={`${showAccountDrawer ? 'studio-shell-enter fixed' : 'hidden'} right-4 top-24 z-50 w-[min(92vw,420px)] rounded-3xl border border-amber-500/35 bg-slate-900/90 backdrop-blur-xl shadow-2xl shadow-amber-500/10 p-4 sm:p-5 space-y-3 max-h-[calc(100vh-7rem)] overflow-y-auto`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-amber-100 uppercase tracking-[0.18em]">Account Settings</h3>
              <p className="text-[10px] uppercase tracking-wider text-amber-200/70 mt-1">Studio Billing Console</p>
            </div>
            <button
              onClick={() => setShowAccountDrawer(false)}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-amber-500/30 text-amber-100/80 hover:border-amber-300 hover:text-white transition-colors"
              aria-label="Close account drawer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {accountTab === 'overview' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {ACCOUNT_PRICING_BUNDLES.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.label}</div>
                    <div className="mt-2 text-lg font-semibold text-white">{item.tokens} tokens</div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Feature pricing</div>
                  <div className="text-[10px] text-slate-500">Token-based billing from the backend pricing table</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                        <th className="pb-2 pr-4 font-semibold">Workspace</th>
                        <th className="pb-2 pr-4 font-semibold">Action</th>
                        <th className="pb-2 pr-4 font-semibold">Tokens</th>
                        <th className="pb-2 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ACCOUNT_PRICING_ROWS.map((row) => (
                        <tr key={`${row.workspace}-${row.label}`} className="border-b border-slate-900/70 align-top">
                          <td className="py-2 pr-4 text-slate-400">{row.workspace}</td>
                          <td className="py-2 pr-4 text-slate-200">{row.label}</td>
                          <td className="py-2 pr-4 text-white font-semibold">{row.tokens}</td>
                          <td className="py-2 text-slate-400">{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Subscription plans</div>
                  <div className="space-y-2">
                    {pricingPlans.map((plan) => (
                      <div key={plan.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 px-3 py-2">
                        <div>
                          <div className="font-semibold text-white">{plan.name}</div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">{plan.id}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-slate-200">{plan.monthlyTokens} tokens / month</div>
                          <div className="text-[10px] text-slate-500">Top-up cap {plan.maxTopUpPerMonth}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Google Play mappings</div>
                  <div className="space-y-2">
                    {playSubscriptionRows.map((item) => (
                      <div key={item.tier} className="rounded-xl border border-slate-800/80 bg-slate-900/50 px-3 py-2">
                        <div className="font-semibold text-white">{item.tier} subscription</div>
                        <div className="text-[10px] text-slate-400 break-all">{item.productId}</div>
                      </div>
                    ))}
                    {playTopUpRows.map((item) => (
                      <div key={item.productId} className="rounded-xl border border-slate-800/80 bg-slate-900/50 px-3 py-2">
                        <div className="font-semibold text-white">{item.tokens} token top-up</div>
                        <div className="text-[10px] text-slate-400 break-all">{item.productId}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2 text-[11px] text-amber-100/90">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Purchase flow notes</div>
                <div>Web and local development can use direct plan changes and token top-ups when billing mutations are enabled.</div>
                <div>Android production flow is Google Play purchase, then backend verification through `/api/billing/google-play/verify`.</div>
                <div>Use `npm run pricing:features:json` for a machine-readable export of the same pricing matrix.</div>
              </div>
            </div>
          )}

          {accountTab === 'account-details' && (
            <>
              <div className="grid gap-2">
                <div className="rounded-2xl bg-slate-950/60 border border-amber-400/25 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80 mb-1">User</div>
                  <div className="text-xs font-semibold text-slate-200 truncate">{authUser?.username || activeUserId}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Active: {activeUserId}</div>
                </div>

                <div className="rounded-2xl bg-slate-950/60 border border-amber-400/25 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80 mb-1">Balance</div>
                  <div className="text-sm sm:text-base font-semibold text-white leading-tight">{subscriptionAccount?.tokenBalance ?? '--'} tokens</div>
                  <div className="text-[10px] text-amber-100/70 uppercase tracking-wider mt-1">Tier: {subscriptionAccount?.tier ?? 'free'}</div>
                </div>

                <div className="rounded-2xl bg-slate-950/60 border border-amber-400/25 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80 mb-1">Cycle</div>
                  <div className="text-xs text-slate-200">Ends {subscriptionAccount?.cycleEndsAt ? new Date(subscriptionAccount.cycleEndsAt).toLocaleDateString() : '--'}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Usage: {usagePercent}%</div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">User Id</label>
                  <div className="flex gap-2">
                    <input
                      id="billing-user-id"
                      name="userId"
                      value={authUser?.username || userIdInput}
                      onChange={(event) => setUserIdInput(event.target.value)}
                      placeholder="user-123"
                      readOnly={Boolean(authUser)}
                      className="flex-1 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    />
                    <button
                      onClick={handleApplyUserId}
                      disabled={Boolean(authUser)}
                      className="px-4 py-3 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      Use
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400">Top-up left: {subscriptionAccount?.monthlyRemainingTopUp ?? '--'}</div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Top-up</label>
                  <div className="flex gap-2">
                    <input
                      id="billing-top-up-amount"
                      name="topUpAmount"
                      value={topUpAmount}
                      onChange={(event) => setTopUpAmount(event.target.value)}
                      className="flex-1 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    />
                    <button
                      onClick={handleTopUp}
                      disabled={billingLoading}
                      className="px-4 py-3 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <span>Token usage this cycle</span>
                    <span>{usagePercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${usagePercent}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-400">{usedThisCycle} used of {planMonthlyTokens} monthly tokens</div>
                </div>
              </div>

              <div className="grid gap-3">
                {subscriptionPlans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handleSubscribeTier(plan.id)}
                    disabled={billingLoading}
                    className={`rounded-2xl border px-4 py-4 text-left transition-all min-h-[110px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                      subscriptionAccount?.tier === plan.id
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{plan.name}</div>
                      {plan.id === 'pro' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border border-indigo-400/40 bg-indigo-500/10 text-indigo-300">Most Popular</span>
                      )}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">{plan.monthlyTokens} tokens / month</div>
                    <div className="text-[10px] text-slate-400">Top-up cap {plan.maxTopUpPerMonth}</div>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Recent Usage</div>
                {subscriptionUsage.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-xs text-slate-300">
                    <span className="uppercase tracking-wider text-slate-400">{entry.action.replace('_', ' ')}</span>
                    <span>-{entry.tokens}</span>
                  </div>
                ))}
                {!subscriptionUsage.length && (
                  <div className="text-xs text-slate-400">No usage yet.</div>
                )}
              </div>
            </>
          )}

          {accountTab === 'delete-account' && (
            <div className="rounded-2xl border border-rose-600/40 bg-rose-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-rose-300">Danger Zone</div>
                <div className="text-[10px] uppercase tracking-wider text-rose-200/70">Permanent action</div>
              </div>
              <button
                onClick={() => setAccountTab('account-details')}
                className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:text-white transition-colors"
              >
                Back to Account Details
              </button>
              <p className="text-xs text-rose-200/80">Delete this account and permanently remove billing/account data.</p>
              <input
                id="delete-account-password"
                name="deleteAccountPassword"
                type="password"
                value={deleteAccountPassword}
                onChange={(event) => setDeleteAccountPassword(event.target.value)}
                placeholder="Current password"
                className="w-full rounded-xl bg-slate-950/60 border border-rose-900/70 px-3 py-3 text-xs text-slate-100 focus:outline-none focus:border-rose-500 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              />
              <input
                id="delete-account-confirm-username"
                name="deleteAccountConfirmUsername"
                value={deleteAccountConfirmUsername}
                onChange={(event) => setDeleteAccountConfirmUsername(event.target.value)}
                placeholder={`Type ${authUser?.username || 'your username'} to confirm`}
                className="w-full rounded-xl bg-slate-950/60 border border-rose-900/70 px-3 py-3 text-xs text-slate-100 focus:outline-none focus:border-rose-500 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deleteAccountLoading}
                className="w-full px-4 py-3 rounded-xl bg-rose-700 text-xs font-semibold text-white hover:bg-rose-600 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                {deleteAccountLoading ? 'Deleting...' : 'Delete Account Permanently'}
              </button>
            </div>
          )}

          {billingMessage && (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-3 py-2">
              {billingMessage}
            </div>
          )}
        </div>

        <div
          id="beauty-tools-drawer"
          className={`${showBeautyToolsDrawer ? 'fixed' : 'hidden'} right-4 top-24 z-50 w-[min(92vw,420px)] rounded-3xl border border-amber-500/35 bg-slate-900/95 shadow-2xl p-4 sm:p-5 space-y-3 max-h-[calc(100vh-7rem)] overflow-y-auto`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-amber-100 uppercase tracking-[0.18em]">Beauty Tools</h3>
            </div>
            <button
              onClick={() => setShowBeautyToolsDrawer(false)}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:border-amber-400 hover:text-white transition-colors"
              aria-label="Close beauty tools drawer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-rose-300">Selected Service</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {BEAUTY_SERVICES.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setBeautyService(service.id)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      beautyService === service.id
                        ? 'border-rose-400/60 bg-rose-500/10 text-rose-50'
                        : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-rose-400/40 hover:text-white'
                    }`}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wider">{service.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-rose-300">Client Name</label>
              <input
                value={beautyClientName}
                onChange={(event) => setBeautyClientName(event.target.value)}
                placeholder="Client profile name"
                className="w-full rounded-xl bg-slate-950/60 border border-rose-400/30 px-3 py-3 text-xs text-slate-200 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Occasion</label>
              <select
                value={tryOccasion}
                onChange={(e) => setTryOccasion(e.target.value)}
                className="w-full rounded-xl bg-slate-950/60 border border-amber-400/40 px-3 py-3 text-xs text-amber-100 focus:outline-none focus:border-amber-300"
              >
                <optgroup label="General Occasions">
                  {OCCASION_OPTIONS.map((occasion) => (
                    <option key={occasion.value} value={occasion.value}>{occasion.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Makeup Style</label>
              <select
                value={tryMakeupStyle}
                onChange={(e) => setTryMakeupStyle(e.target.value)}
                className="w-full rounded-xl bg-slate-950/60 border border-amber-400/40 px-3 py-3 text-xs text-amber-100 focus:outline-none focus:border-amber-300"
              >
                <option value="natural">Natural/Minimal</option>
                <option value="bold">Bold/Dramatic</option>
                <option value="smokey-eye">Smokey Eye</option>
                <option value="glam">Glamorous</option>
                <option value="editorial">Editorial/Artistic</option>
                <option value="dewy">Dewy/Fresh</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Style Intensity</label>
              <select
                value={tryStyleIntensity}
                onChange={(e) => setTryStyleIntensity(e.target.value as 'subtle' | 'balanced' | 'dramatic')}
                className="w-full rounded-xl bg-slate-950/60 border border-amber-400/40 px-3 py-3 text-xs text-amber-100 focus:outline-none focus:border-amber-300"
              >
                <option value="subtle">Subtle (natural)</option>
                <option value="balanced">Balanced</option>
                <option value="dramatic">Dramatic</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Hairstyle / Haircut</label>
              <select
                value={tryHairStyle}
                onChange={(e) => setTryHairStyle(e.target.value)}
                className="w-full rounded-xl bg-slate-950/60 border border-amber-400/40 px-3 py-3 text-xs text-amber-100 focus:outline-none focus:border-amber-300"
              >
                <optgroup label="General Styles">
                  <option value="none">None (keep current hairstyle)</option>
                  {GENERAL_HAIRSTYLE_OPTIONS.map((style) => (
                    <option key={style.value} value={style.value}>{style.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={handleGetOccasionRecommendations}
              disabled={tryLoading || !trySelfie}
              className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            >
              {tryLoading ? 'Getting...' : 'Get Ideas'}
            </button>
            <button
              onClick={handleGenerateHair360Preview}
              disabled={hair360Loading || !trySelfie}
              className="px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            >
              {hair360Loading ? 'Generating 360...' : 'Generate 360 Preview'}
            </button>
            <button
              onClick={handleAnalyzeBeautyProfile}
              disabled={profileAnalysisLoading || !trySelfie}
              className="px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            >
              {profileAnalysisLoading ? 'Analyzing...' : 'Analyze Profile'}
            </button>
            <button
              onClick={handleAnalyzeComplexionReport}
              disabled={complexionReportLoading || !trySelfie}
              className="px-4 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            >
              {complexionReportLoading ? 'Scanning...' : 'Complexion Report'}
            </button>
            <button
              onClick={() => void handleBeautyConsultation()}
              disabled={beautyConsultationLoading || !trySelfie || !beautyNotes.trim()}
              className="px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            >
              {beautyConsultationLoading ? 'Consulting...' : 'Consult Notes'}
            </button>
          </div>

          {tryMessage && (
            <div className={`rounded-xl border p-3 text-xs ${
              tryMessage.toLowerCase().includes('error') || tryMessage.toLowerCase().includes('failed') || tryMessage.toLowerCase().includes('please')
                ? 'border-red-500/30 bg-red-500/10 text-red-200'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
            }`}>{tryMessage}</div>
          )}
          {beautyConsultationMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">{beautyConsultationMessage}</div>
          )}
          {hair360Message && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-xs text-violet-100">{hair360Message}</div>
          )}
          {profileAnalysisMessage && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">{profileAnalysisMessage}</div>
          )}
          {complexionReportMessage && (
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-3 text-xs text-teal-100">{complexionReportMessage}</div>
          )}

          {tryResults && tryResults.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-slate-950/60 p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Look Ideas</div>
              {tryResults.slice(0, 3).map((rec, idx) => (
                <div key={idx} className="text-[11px] text-slate-300">
                  <span className="font-semibold text-amber-200">{rec.style}: </span>
                  {rec.description?.slice(0, 120) || rec.makeup?.slice(0, 120) || 'Generated look'}
                </div>
              ))}
            </div>
          )}

          {beautyConsultationResult && (
            <div className="rounded-xl border border-rose-500/30 bg-slate-950/60 p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-rose-300">Consultation</div>
              <div className="text-[11px] text-slate-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
                {beautyConsultationResult.advice}
              </div>
            </div>
          )}

          {hair360Previews && hair360Previews.length > 0 && (
            <div className="rounded-xl border border-violet-500/30 bg-slate-950/60 p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-violet-300">Hair 360</div>
              <div className="grid grid-cols-4 gap-1">
                {(['front', 'left', 'right', 'back'] as Hair360Angle[]).map((angle) => (
                  <button
                    key={angle}
                    onClick={() => setHair360ActiveAngle(angle)}
                    className={`rounded-md px-2 py-1 text-[9px] uppercase font-bold ${hair360ActiveAngle === angle ? 'bg-violet-500/25 text-violet-100' : 'bg-slate-800 text-slate-300'}`}
                  >
                    {angle}
                  </button>
                ))}
              </div>
              {hair360Previews.filter((item) => item.angle === hair360ActiveAngle).map((item) => (
                <div key={item.angle} className="text-[11px] text-slate-300">{item.summary}</div>
              ))}
            </div>
          )}

          {profileAnalysisResult && (
            <div className="rounded-xl border border-cyan-500/30 bg-slate-950/60 p-3 space-y-1 text-[11px] text-slate-300">
              <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Profile Snapshot</div>
              <div><span className="text-cyan-200 font-semibold">Skin: </span>{profileAnalysisResult.skinTone.undertone} / {profileAnalysisResult.skinTone.overtone}</div>
              <div><span className="text-cyan-200 font-semibold">Face: </span>{profileAnalysisResult.faceShape.shape}</div>
              <div><span className="text-cyan-200 font-semibold">Eyes: </span>{profileAnalysisResult.eyes.shape}</div>
              <div><span className="text-cyan-200 font-semibold">Hair: </span>{profileAnalysisResult.hair.texture}</div>
            </div>
          )}

          {complexionReport && (
            <div className="rounded-xl border border-teal-500/30 bg-slate-950/60 p-3 space-y-2 text-[11px] text-slate-300">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-teal-300">Smart Skincare & Complexion Tracker</div>
                <button
                  onClick={handleApplyComplexionToBeautyLab}
                  className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold uppercase tracking-wider"
                >
                  Apply to Beauty Lab
                </button>
              </div>
              <div><span className="text-teal-200 font-semibold">Hydration: </span>{complexionReport.hydrationLevel}</div>
              <div><span className="text-teal-200 font-semibold">Redness: </span>{complexionReport.rednessLevel}</div>
              <div><span className="text-teal-200 font-semibold">Pore Visibility: </span>{complexionReport.poreVisibility}</div>
              <div><span className="text-teal-200 font-semibold">Tone Uniformity: </span>{complexionReport.toneUniformity}</div>
              <div><span className="text-teal-200 font-semibold">Color Corrector: </span>{complexionReport.colorCorrector}</div>
              <div><span className="text-teal-200 font-semibold">Suggested Makeup: </span>{complexionReport.recommendedMakeupStyle} ({complexionReport.recommendedStyleIntensity})</div>
              <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-2 text-[10px] text-teal-100 whitespace-pre-wrap">{complexionReport.summary}</div>
              {complexionReport.beautyLabTips.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-teal-300">Beauty Lab Tips</div>
                  {complexionReport.beautyLabTips.slice(0, 4).map((tip, idx) => (
                    <div key={idx} className="text-[10px] text-slate-300">- {tip}</div>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-slate-400">{complexionReport.disclaimer}</div>
            </div>
          )}

          {weeklyComplexionTrend.length > 0 && (
            <div className="rounded-xl border border-teal-500/25 bg-slate-950/60 p-3 space-y-2 text-[11px] text-slate-300">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-teal-300">Weekly Complexion Trend</div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${trendStatus.status === 'improving' ? 'border-emerald-500/40 bg-emerald-500/10' : trendStatus.status === 'declining' ? 'border-orange-500/40 bg-orange-500/10' : 'border-slate-500/40 bg-slate-500/10'} ${trendStatus.color}`}>
                    {trendStatus.label}
                  </span>
                </div>
                <button
                  onClick={clearComplexionHistory}
                  className="px-2 py-1 rounded-md border border-teal-500/40 text-teal-200 hover:text-white hover:border-teal-300 text-[10px] font-semibold uppercase tracking-wider"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-2">
                {weeklyComplexionTrend.map((entry) => {
                  const avgScore = Math.round(((metricScore.hydration(entry.hydrationLevel) + metricScore.redness(entry.rednessLevel) + metricScore.pores(entry.poreVisibility) + metricScore.uniformity(entry.toneUniformity)) / 12) * 100);
                  const dateLabel = new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  return (
                    <div key={entry.timestamp} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-300">{dateLabel}</span>
                        <span className="text-teal-200">{entry.recommendedMakeupStyle} · {entry.recommendedStyleIntensity}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-2 bg-teal-500" style={{ width: `${avgScore}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-slate-400">Trend score blends hydration, redness, pore visibility, and tone uniformity for cosmetic planning only.</div>
            </div>
          )}
        </div>

        <div className="w-full min-w-0 space-y-6 sm:space-y-8 xl:col-start-2 max-w-xl xl:max-w-none mx-auto xl:mx-0">

        {activeWorkspaceTab === 'dashboard' && (
        <div
          id="dashboard-panel"
          className="studio-shell-enter w-full rounded-3xl border border-cyan-400/30 bg-slate-900/70 backdrop-blur-xl p-4 sm:p-6 shadow-2xl shadow-cyan-500/10 overflow-hidden"
        >
          <div className="mb-4 rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/10 via-slate-900/20 to-indigo-500/10 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/85">Studio Workspace</div>
            <div className="mt-1 text-xs text-slate-300">Pick a studio and continue in the same split-canvas workflow.</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:auto-rows-[140px]">
            <button
              onClick={() => {
                setMediaMode('colorize');
                handleWorkspaceTabChange('colorizer');
              }}
              className="studio-tile lg:col-span-3 rounded-3xl border border-indigo-400/40 bg-gradient-to-br from-indigo-500/15 via-indigo-300/10 to-slate-900/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/20"
            >
              <div className="mt-2 text-lg font-extrabold text-white">Colorizer</div>
              <p className="mt-2 text-xs text-indigo-100/80">Restore color from black-and-white photos.</p>
            </button>

            <button
              onClick={() => {
                setMediaMode('animate');
                handleWorkspaceTabChange('animate');
              }}
              className="studio-tile lg:col-span-3 rounded-3xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/15 via-cyan-300/10 to-slate-900/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-500/20"
            >
              <div className="mt-2 text-lg font-extrabold text-white">Animate</div>
              <p className="mt-2 text-xs text-cyan-100/80">Turn a photo into a cinematic motion clip.</p>
            </button>

            <button
              onClick={() => handleWorkspaceTabChange('beauty-lab')}
              className="studio-tile lg:col-span-2 rounded-3xl border border-rose-400/40 bg-gradient-to-br from-rose-500/15 via-rose-300/10 to-slate-900/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose-500/20"
            >
              <div className="mt-2 text-lg font-extrabold text-white">Beauty Lab</div>
              <p className="mt-2 text-xs text-rose-100/80">Try-on studio, consultation, and profile tools.</p>
            </button>

            <button
              onClick={() => handleWorkspaceTabChange('barbershop')}
              className="studio-tile lg:col-span-2 rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 via-emerald-300/10 to-slate-900/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/20"
            >
              <div className="mt-2 text-lg font-extrabold text-white">Barbershop Visit</div>
              <p className="mt-2 text-xs text-emerald-100/80">Haircut previews with isolated session context.</p>
            </button>

            <button
              onClick={() => handleWorkspaceTabChange('outfit')}
              className="studio-tile lg:col-span-2 rounded-3xl border border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-500/15 via-pink-300/10 to-slate-900/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-fuchsia-500/20"
            >
              <div className="mt-2 text-lg font-extrabold text-white">Outfit Studio</div>
              <p className="mt-2 text-xs text-fuchsia-100/80">Virtual outfit try-on aligned with your makeup and haircut choices.</p>
            </button>
          </div>
        </div>
        )}

        {activeWorkspaceTab === 'account' && (
        <div
          id="account-panel"
          className="studio-shell-enter w-full rounded-3xl border transition-all border-amber-500/45 bg-amber-500/5 shadow-lg shadow-amber-500/10 overflow-hidden"
        >
          <div className="h-[52%] p-4 sm:p-5 bg-slate-950/70">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-amber-100 uppercase tracking-[0.18em]">Account Center</h3>
                <p className="text-[10px] uppercase tracking-wider text-amber-200/70 mt-1">Studio Billing Snapshot</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-amber-400/25 bg-slate-950/60 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80">Current User</div>
                <div className="mt-2 text-sm font-semibold text-white truncate">{authUser?.username || activeUserId}</div>
              </div>
              <div className="rounded-2xl border border-amber-400/25 bg-slate-950/60 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80">Token Balance</div>
                <div className="mt-2 text-sm font-semibold text-white">{subscriptionAccount?.tokenBalance ?? '--'}</div>
              </div>
              <div className="rounded-2xl border border-amber-400/25 bg-slate-950/60 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80">Plan</div>
                <div className="mt-2 text-sm font-semibold text-white uppercase">{subscriptionAccount?.tier ?? 'free'}</div>
              </div>
            </div>
          </div>

          <div className="h-[48%] border-t border-amber-400/20 bg-slate-900/65 backdrop-blur-xl p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => { setAccountTab('overview'); setShowAccountDrawer(true); }}
              className="px-4 py-3 rounded-full border border-amber-500/40 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              Overview
            </button>
            <button
              onClick={() => { setAccountTab('account-details'); setShowAccountDrawer(true); }}
              className="px-4 py-3 rounded-full border border-indigo-500/40 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-100 font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              Details
            </button>
            <button
              onClick={() => { void refreshSubscription(); }}
              disabled={billingLoading}
              className="px-4 py-3 rounded-full border border-emerald-500/40 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            >
              {billingLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={() => { setAccountTab('delete-account'); setShowAccountDrawer(true); }}
              className="px-4 py-3 rounded-full border border-rose-500/40 bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              Delete
            </button>
          </div>
          </div>
        </div>
        )}

        {activeWorkspaceTab === 'beauty-lab' && (
        <div
          id="beauty-lab-panel"
          className="studio-shell-enter w-full min-w-0 rounded-3xl border transition-all border-rose-500/50 bg-rose-500/5 shadow-lg shadow-rose-500/10 overflow-hidden"
        >
          <div className="h-[44vh] sm:h-[56vh] lg:h-[62vh] bg-slate-950/70 flex items-center justify-center min-w-0">
            {tryAfterImage || trySelfie ? (
              <img
                src={tryAfterImage || trySelfie || ''}
                alt="Beauty Lab render canvas"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center px-6 text-slate-400">
                <div className="text-sm font-semibold uppercase tracking-widest">Beauty Lab & Style Studio</div>
                <p className="mt-3 text-xs">Upload a face photo to begin styling.</p>
              </div>
            )}
          </div>

          <div className="h-[50vh] sm:h-[40vh] lg:h-[34vh] border-t border-rose-400/20 bg-slate-900/65 backdrop-blur-xl p-3 sm:p-4 space-y-3 overflow-y-auto min-w-0">
            <input
              type="file"
              accept="image/*"
              onChange={handleTrySelfieCapture}
              className="hidden"
              id="try-on-upload-input"
              ref={tryUploadInputRef}
            />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleTrySelfieCapture}
              className="hidden"
              id="try-on-camera-input"
              ref={tryCameraInputRef}
            />

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2 sm:overflow-x-auto sm:whitespace-nowrap sm:pb-1">
              <button
                onClick={() => tryUploadInputRef.current?.click()}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-200 hover:border-rose-400"
              >
                Upload
              </button>
              <button
                onClick={() => tryCameraInputRef.current?.click()}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-200 hover:border-rose-400"
              >
                Camera
              </button>
              <button
                onClick={handleGenerateVirtualMakeup}
                disabled={tryLoading || !trySelfie}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
              >
                {tryLoading ? 'Generating...' : 'Generate'}
              </button>
              <button
                onClick={handleDownloadTryOn}
                disabled={!tryAfterImage}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-indigo-500/40 bg-indigo-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
              >
                <span className="studio-label-full">Download Photo</span>
                <span className="studio-label-short">Download</span>
              </button>
              <button
                onClick={handleSaveBeautyConsultationSheet}
                disabled={!tryAfterImage}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
              >
                <span className="studio-label-full">Download Card</span>
                <span className="studio-label-short">Card</span>
              </button>
              {trySelfie && (
                <button
                  onClick={() => {
                    setTrySelfie(null);
                    setTryAfterImage(null);
                    setTryResults(null);
                    setTryMessage(null);
                    setTryLoading(false);
                    setHair360Previews(null);
                    setHair360Message(null);
                  }}
                  className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:border-slate-500"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-rose-200/80">Makeup Base</div>
              <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
                {[
                  { value: 'natural', label: 'Natural' },
                  { value: 'bold', label: 'Bold' },
                  { value: 'smokey-eye', label: 'Smokey' },
                  { value: 'glam', label: 'Glam' },
                  { value: 'editorial', label: 'Editorial' },
                  { value: 'dewy', label: 'Dewy' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setTryMakeupStyle(item.value)}
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      tryMakeupStyle === item.value
                        ? 'border-rose-300/70 bg-rose-500/25 text-rose-100'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-widest text-rose-200/80">Complexion Toolkit</div>
                <div className="text-[10px] text-rose-100">{complexionOpacity}%</div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={complexionOpacity}
                onChange={(event) => setComplexionOpacity(Number(event.target.value))}
                className="w-full accent-rose-400"
              />
              <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
                {[
                  { value: 'warm-beige', label: 'Warm Beige' },
                  { value: 'neutral-ivory', label: 'Neutral Ivory' },
                  { value: 'golden-honey', label: 'Golden Honey' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setComplexionShadeProfile(item.value)}
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      complexionShadeProfile === item.value
                        ? 'border-rose-300/70 bg-rose-500/25 text-rose-100'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                {[
                  { value: 'soft-oval', label: 'Soft Oval' },
                  { value: 'sculpted-v', label: 'Sculpted V' },
                  { value: 'lifted-cheek', label: 'Lifted Cheek' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setFaceShapeContour(item.value)}
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      faceShapeContour === item.value
                        ? 'border-rose-300/70 bg-rose-500/25 text-rose-100'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                {[
                  { value: 'rose', label: 'Rose Blush' },
                  { value: 'peach', label: 'Peach Blush' },
                  { value: 'berry', label: 'Berry Blush' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setAccentBlushProfile(item.value)}
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      accentBlushProfile === item.value
                        ? 'border-rose-300/70 bg-rose-500/25 text-rose-100'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-200/80">Eyes Toolkit</div>
                <div className="text-[10px] text-cyan-100">{eyesOpacity}%</div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={eyesOpacity}
                onChange={(event) => setEyesOpacity(Number(event.target.value))}
                className="w-full accent-cyan-400"
              />
              <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
                {[
                  { value: 'cat-eye', label: 'Cat-Eye' },
                  { value: 'fox-wing', label: 'Fox-Wing' },
                  { value: 'soft-smudge', label: 'Soft Smudge' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setEyelinerPattern(item.value)}
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      eyelinerPattern === item.value
                        ? 'border-cyan-300/70 bg-cyan-500/25 text-cyan-100'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                {[
                  { value: 'natural-density', label: 'Natural Lash' },
                  { value: 'high-density', label: 'High-Density Lash' },
                  { value: 'dramatic-volume', label: 'Dramatic Lash' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setLashOverlayDensity(item.value)}
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      lashOverlayDensity === item.value
                        ? 'border-cyan-300/70 bg-cyan-500/25 text-cyan-100'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-widest text-pink-200/80">Lips Toolkit</div>
                <div className="text-[10px] text-pink-100">{lipsOpacity}%</div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={lipsOpacity}
                onChange={(event) => setLipsOpacity(Number(event.target.value))}
                className="w-full accent-pink-400"
              />
              <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
                {[
                  { value: 'matte', label: 'Matte' },
                  { value: 'high-gloss', label: 'High Gloss' },
                  { value: 'vertical-ombre', label: 'Vertical Ombre' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setLipFinish(item.value)}
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      lipFinish === item.value
                        ? 'border-pink-300/70 bg-pink-500/25 text-pink-100'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80">Hair & Wig Cap Studio</div>
              <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
                {[
                  { value: 'structured-bob', label: 'Bob Wig' },
                  { value: 'textured-pixie', label: 'Pixie Wig' },
                  { value: 'protective-braids', label: 'Protective Braids' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      setWigTrackStyle(item.value);
                      setTryHairStyle(item.value);
                    }}
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      wigTrackStyle === item.value
                        ? 'border-amber-300/70 bg-amber-500/25 text-amber-100'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                {[
                  { value: 'butterfly-layers', label: 'Butterfly Layers' },
                  { value: 'precision-bangs', label: 'Bangs' },
                  { value: 'blunt-cut', label: 'Blunt Cut' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setHaircutProfile(item.value)}
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      haircutProfile === item.value
                        ? 'border-amber-300/70 bg-amber-500/25 text-amber-100'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                {[
                  { value: 'clip-in-volume', label: 'Clip-In Volume' },
                  { value: 'dimensional-extensions', label: 'Extensions' },
                  { value: 'length-shift', label: 'Length Shift' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setExtensionProfile(item.value)}
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      extensionProfile === item.value
                        ? 'border-amber-300/70 bg-amber-500/25 text-amber-100'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-violet-200/80">Color Laboratory</div>
              <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
                {[
                  { value: 'balayage', label: 'Balayage' },
                  { value: 'ombre-melt', label: 'Ombre Melt' },
                  { value: 'highlight-ribbon', label: 'Highlights' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setColorLabDualTone(item.value)}
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      colorLabDualTone === item.value
                        ? 'border-violet-300/70 bg-violet-500/25 text-violet-100'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {tryMessage && (
              <div className={`rounded-xl px-3 py-2 text-[10px] ${
                tryMessage.toLowerCase().includes('error') || tryMessage.toLowerCase().includes('failed') || tryMessage.toLowerCase().includes('please')
                  ? 'bg-red-500/10 border border-red-500/30 text-red-200'
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
              }`}>
                {tryMessage}
              </div>
            )}
          </div>
        </div>
        )}

        {activeWorkspaceTab === 'barbershop' && (
        <div
          id="barbershop-panel"
          className="studio-shell-enter w-full min-w-0 rounded-3xl border transition-all border-emerald-500/50 bg-emerald-500/5 shadow-lg shadow-emerald-500/10 overflow-hidden"
        >
          <div className="h-[52vh] sm:h-[62vh] lg:h-[70vh] bg-slate-950/70 flex items-center justify-center min-w-0">
            {barbershopSelfie ? (
              <div className="w-full h-full min-w-0 grid md:grid-cols-2 gap-px bg-slate-800/60">
                <div className="flex flex-col bg-slate-950/70">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-emerald-300 border-b border-emerald-500/20">Before</div>
                  <img src={barbershopSelfie} alt="Before barbershop selfie" className="w-full h-full object-contain bg-slate-950" />
                </div>
                <div className="flex flex-col bg-slate-950/70">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-emerald-300 border-b border-emerald-500/20">After</div>
                  {barbershopAfterImage ? (
                    <MultiAngleAfterPreview
                      image={barbershopAfterImage}
                      alt="After barbershop look"
                      requestAngleImage={handleGenerateBarbershopAngle}
                      className="w-full h-full object-contain bg-slate-950"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-[10px] text-slate-400 px-3 text-center">
                      Generate a barbershop look to preview your after result.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center px-6 text-slate-400">
                <div className="text-sm font-semibold uppercase tracking-widest">Barbershop Visit & Style Studio</div>
                <p className="mt-3 text-xs">Upload a full-face photo to begin your haircut session.</p>
              </div>
            )}
          </div>

          <div className="h-[48vh] sm:h-[38vh] lg:h-[30vh] border-t border-emerald-400/20 bg-slate-900/65 backdrop-blur-xl p-3 sm:p-4 space-y-3 overflow-y-auto min-w-0">
            <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2 md:overflow-x-auto md:whitespace-nowrap md:pb-1">
              <button
                type="button"
                onClick={() => barbershopUploadInputRef.current?.click()}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-200 hover:border-emerald-400 md:shrink-0"
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => barbershopCameraInputRef.current?.click()}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-200 hover:border-emerald-400 md:shrink-0"
              >
                Camera
              </button>
              <button
                onClick={handleGetBarbershopRecommendations}
                disabled={barbershopRecommendationLoading || barbershopGenerateLoading || !barbershopSelfie}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50 md:shrink-0"
              >
                {barbershopRecommendationLoading ? 'Getting...' : 'Get Ideas'}
              </button>
              <button
                onClick={handleGenerateBarbershopLook}
                disabled={barbershopRecommendationLoading || barbershopGenerateLoading || !barbershopSelfie}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-teal-500/40 bg-teal-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-teal-100 hover:bg-teal-500/30 disabled:opacity-50 md:shrink-0"
              >
                {barbershopGenerateLoading ? (
                  <>
                    <span className="studio-label-full">Generating...</span>
                    <span className="studio-label-short">Working...</span>
                  </>
                ) : (
                  <>
                    <span className="studio-label-full">Generate Look</span>
                    <span className="studio-label-short">Generate</span>
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadBarbershop}
                disabled={!barbershopAfterImage}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50 md:shrink-0"
              >
                Download
              </button>
              {barbershopSelfie && (
                <button
                  onClick={() => {
                    setBarbershopSelfie(null);
                    setBarbershopAfterImage(null);
                    setBarbershopResults(null);
                    setBarbershopMessage(null);
                    setBarbershopNotes('');
                    setBarbershopGenerateLoading(false);
                    setBarbershopRecommendationLoading(false);
                  }}
                  className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:border-slate-500 md:shrink-0"
                >
                  Reset
                </button>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={handleBarbershopSelfieCapture}
              className="hidden"
              id="barbershop-upload-input"
              ref={barbershopUploadInputRef}
            />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleBarbershopSelfieCapture}
              className="hidden"
              id="barbershop-camera-input"
              ref={barbershopCameraInputRef}
            />

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Upload Photo</label>
              <div className="text-[10px] text-slate-400">Use the buttons above to import a front-facing portrait.</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Barbershop Haircut</label>
                <select
                  value={barbershopHaircut}
                  onChange={(e) => setBarbershopHaircut(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/60 border border-emerald-400/40 px-3 py-3 text-xs text-emerald-100 focus:outline-none focus:border-emerald-300"
                >
                  {BARBERSHOP_HAIRCUT_OPTIONS.map((style) => (
                    <option key={style.value} value={style.value}>{style.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Style Intensity</label>
                <select
                  value={barbershopStyleIntensity}
                  onChange={(e) => setBarbershopStyleIntensity(e.target.value as 'subtle' | 'balanced' | 'dramatic')}
                  className="w-full rounded-xl bg-slate-950/60 border border-emerald-400/40 px-3 py-3 text-xs text-emerald-100 focus:outline-none focus:border-emerald-300"
                >
                  <option value="subtle">Subtle (natural)</option>
                  <option value="balanced">Balanced</option>
                  <option value="dramatic">Dramatic</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Makeup Style</label>
                <select
                  value={barbershopMakeupStyle}
                  onChange={(e) => setBarbershopMakeupStyle(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/60 border border-emerald-400/40 px-3 py-3 text-xs text-emerald-100 focus:outline-none focus:border-emerald-300"
                >
                  <option value="none">None (No Makeup)</option>
                  <option value="natural">Natural/Minimal</option>
                  <option value="bold">Bold/Dramatic</option>
                  <option value="smokey-eye">Smokey Eye</option>
                  <option value="glam">Glamorous</option>
                  <option value="editorial">Editorial/Artistic</option>
                  <option value="dewy">Dewy/Fresh</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Session Notes</label>
                <div className="relative">
                  <textarea
                    value={barbershopNotes}
                    onChange={(event) => setBarbershopNotes(event.target.value)}
                    placeholder="Hairline, fade preference, texture goals, and maintenance notes"
                    rows={3}
                    className="w-full rounded-xl bg-slate-950/60 border border-emerald-400/40 px-3 py-3 pb-10 text-xs text-emerald-100 focus:outline-none focus:border-emerald-300"
                  />
                  <div className="absolute bottom-2 left-2 z-20">
                    <button
                      type="button"
                      onClick={() => setShowBarbershopPhotoPicker((v) => !v)}
                      className="relative z-10 w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold leading-none transition-all active:scale-95 shadow"
                      title="Add photo"
                    >+</button>
                    {showBarbershopPhotoPicker && (
                      <div className="absolute bottom-10 left-0 z-30 w-44 rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl p-2 space-y-1 backdrop-blur">
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                          onClick={() => {
                            setShowBarbershopPhotoPicker(false);
                            barbershopUploadInputRef.current?.click();
                          }}
                        >Upload Photo</button>
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                          onClick={() => {
                            setShowBarbershopPhotoPicker(false);
                            barbershopCameraInputRef.current?.click();
                          }}
                        >Use Camera</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {barbershopMessage && (
              <div className={`rounded-xl border p-3 text-xs ${
                barbershopMessage.toLowerCase().includes('error') || barbershopMessage.toLowerCase().includes('failed') || barbershopMessage.toLowerCase().includes('please')
                  ? 'border-red-500/35 bg-red-500/10 text-red-200'
                  : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
              }`}>{barbershopMessage}</div>
            )}

            {barbershopResults && barbershopResults.length > 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-slate-950/60 p-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Barbershop Ideas</div>
                {barbershopResults.slice(0, 3).map((rec, idx) => (
                  <div key={idx} className="text-[11px] text-slate-300">
                    <span className="font-semibold text-emerald-200">{rec.style}: </span>
                    {rec.description?.slice(0, 120) || rec.makeup?.slice(0, 120) || 'Generated barbershop look'}
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
        )}

        {activeWorkspaceTab === 'outfit' && (
        <div
          id="outfit-panel"
          className="studio-shell-enter w-full min-w-0 rounded-3xl border transition-all border-fuchsia-500/50 bg-fuchsia-500/5 shadow-lg shadow-fuchsia-500/10 overflow-hidden"
        >
          <div className="h-[52vh] sm:h-[62vh] lg:h-[70vh] bg-slate-950/70 flex items-center justify-center min-w-0">
            {outfitSelfie ? (
              <div className="w-full h-full min-w-0 grid md:grid-cols-2 gap-px bg-slate-800/60">
                <div className="flex flex-col bg-slate-950/70">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-fuchsia-300 border-b border-fuchsia-500/20">Before</div>
                  <img src={outfitSelfie} alt="Before outfit selfie" className="w-full h-full object-contain bg-slate-950" />
                </div>
                <div className="flex flex-col bg-slate-950/70">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-fuchsia-300 border-b border-fuchsia-500/20">After</div>
                  {outfitAfterImage ? (
                    <img src={outfitAfterImage} alt="After outfit try-on" className="w-full h-full object-contain bg-slate-950" />
                  ) : (
                    <div className="h-full flex items-center justify-center text-[10px] text-slate-400 px-3 text-center">
                      Generate an outfit to preview your final look before heading out.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center px-6 text-slate-400">
                <div className="text-sm font-semibold uppercase tracking-widest">Outfit Studio & Style Studio</div>
                <p className="mt-3 text-xs">Upload a full-body photo to begin styling your wardrobe.</p>
              </div>
            )}
          </div>

          <div className="h-[48vh] sm:h-[38vh] lg:h-[30vh] border-t border-fuchsia-400/20 bg-slate-900/65 backdrop-blur-xl p-3 sm:p-4 space-y-3 overflow-y-auto min-w-0">
            <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2 md:overflow-x-auto md:whitespace-nowrap md:pb-1">
              <button
                type="button"
                onClick={() => outfitUploadInputRef.current?.click()}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-200 hover:border-fuchsia-400 md:shrink-0"
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => outfitCameraInputRef.current?.click()}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-200 hover:border-fuchsia-400 md:shrink-0"
              >
                Camera
              </button>
              <button
                type="button"
                onClick={() => outfitGarmentUploadInputRef.current?.click()}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-fuchsia-500/40 bg-fuchsia-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-100 hover:bg-fuchsia-500/30 md:shrink-0"
              >
                <span className="studio-label-full">Upload Garment</span>
                <span className="studio-label-short">Garment</span>
              </button>
              <button
                onClick={handleGenerateOutfitLook}
                disabled={outfitLoading || !outfitSelfie}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-fuchsia-500/40 bg-fuchsia-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-100 hover:bg-fuchsia-500/30 disabled:opacity-50 md:shrink-0"
              >
                {outfitLoading ? (
                  <>
                    <span className="studio-label-full">Generating...</span>
                    <span className="studio-label-short">Working...</span>
                  </>
                ) : (
                  <>
                    <span className="studio-label-full">Generate Outfit</span>
                    <span className="studio-label-short">Generate</span>
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadOutfit}
                disabled={!outfitAfterImage}
                className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-pink-500/40 bg-pink-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-pink-100 hover:bg-pink-500/30 disabled:opacity-50 md:shrink-0"
              >
                Download
              </button>
              {outfitSelfie && (
                <button
                  onClick={() => {
                    setOutfitSelfie(null);
                    setOutfitAfterImage(null);
                    setOutfitLooks(null);
                    setOutfitActiveLookIndex(0);
                    setOutfitMessage(null);
                    setOutfitNotes('');
                    setOutfitGarmentImage(null);
                    setOutfitLoading(false);
                  }}
                  className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:border-slate-500 md:shrink-0"
                >
                  Reset
                </button>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={handleOutfitSelfieCapture}
              className="hidden"
              id="outfit-upload-input"
              ref={outfitUploadInputRef}
            />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleOutfitSelfieCapture}
              className="hidden"
              id="outfit-camera-input"
              ref={outfitCameraInputRef}
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleOutfitGarmentCapture}
              className="hidden"
              id="outfit-garment-upload-input"
              ref={outfitGarmentUploadInputRef}
            />

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Full-Body Selfie</label>
              <div className="text-[10px] text-slate-400">Use the buttons above to import a full-body portrait or garment reference.</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Generation Mode</label>
                <select
                  value={outfitMode}
                  onChange={(e) => setOutfitMode(e.target.value as 'style' | 'garment')}
                  className="w-full rounded-xl bg-slate-950/60 border border-fuchsia-400/40 px-3 py-3 text-xs text-fuchsia-100 focus:outline-none focus:border-fuchsia-300"
                >
                  <option value="style">Style + Palette Mode</option>
                  <option value="garment">Specific Garment Mode</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Batch Looks</label>
                <select
                  value={outfitBatchCount}
                  onChange={(e) => setOutfitBatchCount(Number(e.target.value) as 1 | 2 | 3)}
                  className="w-full rounded-xl bg-slate-950/60 border border-fuchsia-400/40 px-3 py-3 text-xs text-fuchsia-100 focus:outline-none focus:border-fuchsia-300"
                >
                  <option value={1}>1 look</option>
                  <option value={2}>2 looks</option>
                  <option value={3}>3 looks</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Outfit Style</label>
                <select
                  value={outfitStyle}
                  onChange={(e) => setOutfitStyle(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/60 border border-fuchsia-400/40 px-3 py-3 text-xs text-fuchsia-100 focus:outline-none focus:border-fuchsia-300"
                >
                  <option value="formal-evening">Formal Evening</option>
                  <option value="smart-casual">Smart Casual</option>
                  <option value="streetwear">Streetwear</option>
                  <option value="business-chic">Business Chic</option>
                  <option value="cocktail">Cocktail</option>
                  <option value="traditional-elegant">Traditional Elegant</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Occasion</label>
                <select
                  value={outfitOccasion}
                  onChange={(e) => setOutfitOccasion(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/60 border border-fuchsia-400/40 px-3 py-3 text-xs text-fuchsia-100 focus:outline-none focus:border-fuchsia-300"
                >
                  <option value="night out">Night Out</option>
                  <option value="salon visit">Salon Visit</option>
                  <option value="dinner date">Dinner Date</option>
                  <option value="wedding guest">Wedding Guest</option>
                  <option value="event party">Event Party</option>
                </select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Color Palette</label>
                <select
                  value={outfitColorPalette}
                  onChange={(e) => setOutfitColorPalette(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/60 border border-fuchsia-400/40 px-3 py-3 text-xs text-fuchsia-100 focus:outline-none focus:border-fuchsia-300"
                >
                  <option value="match makeup palette">Match Makeup Palette</option>
                  <option value="neutral luxe">Neutral Luxe</option>
                  <option value="bold contrast">Bold Contrast</option>
                  <option value="earth tones">Earth Tones</option>
                  <option value="cool monochrome">Cool Monochrome</option>
                </select>
              </div>

              {outfitMode === 'garment' && (
                <>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Garment Label</label>
                    <input
                      value={outfitGarmentLabel}
                      onChange={(e) => setOutfitGarmentLabel(e.target.value)}
                      placeholder="e.g. black tuxedo with satin lapel"
                      className="w-full rounded-xl bg-slate-950/60 border border-fuchsia-400/40 px-3 py-3 text-xs text-fuchsia-100 focus:outline-none focus:border-fuchsia-300"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => outfitGarmentUploadInputRef.current?.click()}
                      className="px-4 py-3 rounded-xl bg-fuchsia-800/70 hover:bg-fuchsia-700 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
                    >
                      Upload Garment Reference
                    </button>
                    {outfitGarmentImage && (
                      <div className="rounded-xl overflow-hidden border border-fuchsia-500/30 bg-slate-950/50">
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-fuchsia-300 border-b border-fuchsia-500/20">Garment Reference</div>
                        <img src={outfitGarmentImage} alt="Garment reference" className="w-full h-44 object-contain bg-slate-950" />
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Salon Alignment</label>
                <label className="inline-flex items-center gap-2 text-xs text-fuchsia-100">
                  <input
                    type="checkbox"
                    checked={outfitMatchCurrentSalonLook}
                    onChange={(e) => setOutfitMatchCurrentSalonLook(e.target.checked)}
                    className="h-4 w-4 rounded border-fuchsia-400/40 bg-slate-950/60"
                  />
                  Match current Beauty Lab + Barbershop look
                </label>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Salon Alignment Notes</label>
                <div className="relative">
                  <textarea
                    value={outfitNotes}
                    onChange={(event) => setOutfitNotes(event.target.value)}
                    placeholder={outfitMatchCurrentSalonLook ? 'Optional notes: preferred fit, modesty level, or fabrics' : 'Enable match toggle to include salon alignment notes'}
                    rows={3}
                    disabled={!outfitMatchCurrentSalonLook}
                    className="w-full rounded-xl bg-slate-950/60 border border-fuchsia-400/40 px-3 py-3 pb-10 text-xs text-fuchsia-100 focus:outline-none focus:border-fuchsia-300 disabled:opacity-50"
                  />
                  <div className="absolute bottom-2 left-2 z-20">
                    <button
                      type="button"
                      onClick={() => setShowOutfitPhotoPicker((v) => !v)}
                      className="relative z-10 w-8 h-8 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-lg font-bold leading-none transition-all active:scale-95 shadow"
                      title="Add photo"
                    >+</button>
                    {showOutfitPhotoPicker && (
                      <div className="absolute bottom-10 left-0 z-30 w-44 rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl p-2 space-y-1 backdrop-blur">
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                          onClick={() => {
                            setShowOutfitPhotoPicker(false);
                            outfitUploadInputRef.current?.click();
                          }}
                        >Upload Photo</button>
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                          onClick={() => {
                            setShowOutfitPhotoPicker(false);
                            outfitCameraInputRef.current?.click();
                          }}
                        >Use Camera</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {outfitMessage && (
              <div className={`rounded-xl border p-3 text-xs ${
                outfitMessage.toLowerCase().includes('error') || outfitMessage.toLowerCase().includes('failed') || outfitMessage.toLowerCase().includes('please')
                  ? 'border-red-500/35 bg-red-500/10 text-red-200'
                  : 'border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-100'
              }`}>{outfitMessage}</div>
            )}

            {outfitLooks && outfitLooks.length > 1 && (
              <div className="rounded-xl border border-fuchsia-500/30 bg-slate-950/60 p-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Generated Outfit Options</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {outfitLooks.map((look, idx) => (
                    <button
                      key={`${look.title}-${idx}`}
                      onClick={() => handleSelectOutfitLook(idx)}
                      className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                        outfitActiveLookIndex === idx
                          ? 'border-fuchsia-300 bg-fuchsia-500/20 text-fuchsia-100'
                          : 'border-fuchsia-500/30 bg-slate-900/50 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-widest">{look.title}</div>
                      <div className="mt-1 text-[10px] text-slate-300 line-clamp-2">{look.description || 'Generated look'}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
        )}

        <div id="colorizer-panel" className="w-full" />
        <div id="animate-panel" className="w-full" />

        {(activeWorkspaceTab === 'colorizer' || activeWorkspaceTab === 'animate') && !selectedImage && !result && (
          <div className="w-full text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl md:text-5xl leading-tight font-black tracking-tight text-white">
                {activeWorkspaceTab === 'animate' ? (
                  <>
                    Create <span className="text-cyan-400">Animate</span> clips from still photos.
                  </>
                ) : (
                  <>
                    Restore <span className="text-indigo-500">Color</span> with precision.
                  </>
                )}
              </h2>
              <p className="text-slate-400 max-w-md mx-auto text-base sm:text-lg leading-relaxed">
                {activeWorkspaceTab === 'animate'
                  ? 'Upload a portrait or scene and generate a cinematic motion clip in one tap.'
                  : 'Upload a black and white photo to rebuild natural tones and preserve detail.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                <span className="px-2.5 py-1 rounded-full border border-slate-800">Fast processing</span>
                <span className="px-2.5 py-1 rounded-full border border-slate-800">Studio-quality output</span>
                <span className="px-2.5 py-1 rounded-full border border-slate-800">Privacy-conscious workflow</span>
              </div>
            </div>

            <ImageUploader
              onImageSelected={handleImageSelected}
              isLoading={processing.isProcessing}
              onSampleSelect={handleSampleImage}
            />
          </div>
        )}

        {(activeWorkspaceTab === 'colorizer' || activeWorkspaceTab === 'animate') && selectedImage && !result && (
          <div className="w-full flex flex-col items-center gap-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="relative w-full max-w-lg rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group bg-slate-900">
              <div
                ref={uploadPreviewRef}
                className="max-h-[70vh] overflow-auto bg-slate-950/40"
                style={{ touchAction: 'none' }}
                onWheel={handlePreviewWheelZoom}
                onTouchStart={handlePreviewTouchStart}
                onTouchMove={handlePreviewTouchMove}
                onTouchEnd={handlePreviewTouchEnd}
              >
                <img
                  src={selectedImage}
                  alt="Preview"
                  className="block h-auto mx-auto"
                  style={{
                    width: `${uploadPreviewZoom * 100}%`,
                  }}
                />
              </div>
              <button
                onClick={reset}
                className="absolute top-4 right-4 p-2 bg-slate-900/80 backdrop-blur-md rounded-full text-white hover:bg-red-500 transition-colors shadow-lg z-10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="w-full max-w-lg flex items-center justify-between gap-2">
              <p className="text-xs text-slate-400">Preview zoom: {Math.round(uploadPreviewZoom * 100)}%</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => applyUploadZoom(uploadPreviewZoom - 0.25)}
                  className="px-3 py-2 min-h-[40px] rounded-lg border border-slate-700 text-slate-200 hover:border-indigo-400 hover:text-white transition-colors"
                  aria-label="Zoom out uploaded preview"
                >
                  -
                </button>
                <button
                  onClick={() => applyUploadZoom(1)}
                  className="px-3 py-2 min-h-[40px] rounded-lg border border-slate-700 text-slate-200 hover:border-indigo-400 hover:text-white transition-colors"
                  aria-label="Reset uploaded preview zoom"
                >
                  100%
                </button>
                <button
                  onClick={() => applyUploadZoom(uploadPreviewZoom + 0.25)}
                  className="px-3 py-2 min-h-[40px] rounded-lg border border-slate-700 text-slate-200 hover:border-indigo-400 hover:text-white transition-colors"
                  aria-label="Zoom in uploaded preview"
                >
                  +
                </button>
              </div>
            </div>

            {/* Minimalist Theme Selector */}
            <div className="w-full max-w-md space-y-3 px-1 sm:px-0">
              <h3 className="text-[11px] sm:text-xs font-bold text-center text-slate-400 uppercase tracking-[0.18em]">Atmospheric Palette</h3>
              <div className="flex flex-wrap justify-center gap-2">
                {PALETTES.map((palette) => (
                  <button
                    key={palette.id}
                    onClick={() => setSelectedTheme(palette.id)}
                    className={`
                      px-4 py-3 rounded-full text-xs font-bold transition-all duration-300 border min-h-[44px]
                      ${selectedTheme === palette.id
                        ? 'bg-indigo-600 border-indigo-400 text-white scale-105 shadow-lg shadow-indigo-600/20'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-300'}
                    `}
                  >
                    <span className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${palette.colors}`}></div>
                      {palette.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full max-w-md grid grid-cols-2 gap-3 px-1 sm:px-0">
              {activeWorkspaceTab === 'animate' ? (
                <button
                  onClick={() => void handleAnimate()}
                  disabled={processing.isProcessing}
                  className="col-span-2 px-4 py-3 min-h-[44px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                >
                  Animate
                </button>
              ) : (
                <button
                  onClick={() => void handleColorize()}
                  disabled={processing.isProcessing}
                  className="col-span-2 px-4 py-3 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                >
                  Colorize
                </button>
              )}
            </div>

            {processing.error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-center justify-between gap-3 w-full max-w-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">{processing.error}</div>
                {/out of tokens?|not enough tokens|usage limit|insufficient token/i.test(processing.error) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountTab('account-details');
                      setShowAccountDrawer(true);
                      handleWorkspaceTabChange('account');
                    }}
                    className="shrink-0 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Add Tokens
                  </button>
                )}
              </div>
            )}

          </div>
        )}

        {(activeWorkspaceTab === 'colorizer' || activeWorkspaceTab === 'animate') && result && (
          <div className="w-full flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-700">
            <ComparisonView
              original={result.original}
              colorized={result.colorized}
            />

            <div className="w-full max-w-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
              <button
                onClick={handleDownloadResult}
                className="px-4 py-3 min-h-[44px] rounded-xl border border-slate-700 text-slate-200 text-xs font-semibold hover:border-indigo-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Download HD
              </button>
              {activeWorkspaceTab === 'colorizer' && (
                <button
                  onClick={() => {
                    setMediaMode('animate');
                    handleWorkspaceTabChange('animate');
                  }}
                  className="px-4 py-3 min-h-[44px] rounded-xl bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Animate This Photo
                </button>
              )}
              <button
                onClick={handleShareResult}
                disabled={!navigator.share}
                className="px-4 py-3 min-h-[44px] rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Share
              </button>
            </div>

            <div className="w-full max-w-md flex flex-col gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enhancements</h3>
                  {history.length > 1 && (
                    <button
                      onClick={handleUndo}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 uppercase tracking-wider"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Undo
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <button
                    onClick={handleUpscale}
                    disabled={processing.isProcessing}
                    className="flex flex-col items-center justify-center gap-1 py-3 min-h-[64px] bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold rounded-2xl border border-slate-800 transition-all active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                    <span className="text-[10px] sm:text-[11px] leading-tight uppercase tracking-wider">4K Upscale</span>
                  </button>
                  <button
                    onClick={handleVibrancy}
                    disabled={processing.isProcessing}
                    className="flex flex-col items-center justify-center gap-1 py-3 min-h-[64px] bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold rounded-2xl border border-slate-800 transition-all active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    <span className="text-[10px] sm:text-[11px] leading-tight uppercase tracking-wider">Vibrant</span>
                  </button>
                  <button
                    onClick={handleSharpen}
                    disabled={processing.isProcessing}
                    className="flex flex-col items-center justify-center gap-1 py-3 min-h-[64px] bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold rounded-2xl border border-slate-800 transition-all active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h3m-3 0H7m5 3v3m7-3l-1.414-1.414M5.414 5.414L4 4m1.414 14.586L4 20M20 4l-1.414 1.414" />
                    </svg>
                    <span className="text-[10px] sm:text-[11px] leading-tight uppercase tracking-wider">Sharpen</span>
                  </button>
                </div>
              </div>

              {activeWorkspaceTab === 'animate' && containsMinors ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200 text-sm text-center">
                  <div className="flex items-center justify-center gap-3 font-bold text-amber-500 uppercase tracking-tight mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Animation Restricted
                  </div>
                  <p className="opacity-90">
                    Images containing minors cannot be animated for safety reasons.
                  </p>
                </div>
              ) : activeWorkspaceTab === 'animate' && isRestricted ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200 text-sm space-y-2">
                  <div className="flex items-center gap-3 font-bold text-amber-500 uppercase tracking-tight">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Animation Restricted
                  </div>
                  <p className="opacity-80">
                    Video generation is not permitted for this content due to safety guidelines.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-1">
                    {activeWorkspaceTab === 'animate' ? (
                      <button
                        onClick={() => void handleAnimate()}
                        disabled={processing.isProcessing}
                        className="px-4 py-3 min-h-[44px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                      >
                        Animate
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleColorize()}
                        disabled={processing.isProcessing}
                        className="px-4 py-3 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                      >
                        Colorize
                      </button>
                    )}
                  </div>

                </>
              )}

              <button
                onClick={reset}
                className="w-full py-3 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-2xl border border-slate-800 transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                New Image
              </button>
            </div>

            {videoResult && (
              <div className="w-full space-y-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Animation</h3>
                <VideoResult videoUrl={videoResult.videoUrl} onDownload={handleDownloadAnimation} />
              </div>
            )}
          </div>
        )}

        {/* Original Uploaded Images Gallery */}
        {uploadedOriginals.length > 0 && (
          <div className="w-full max-w-4xl mt-12 pt-8 border-t border-slate-900 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Upload Gallery</h3>
              </div>
              <button
                onClick={() => { setUploadedOriginals([]); reset(); }}
                className="text-[10px] font-semibold text-slate-400 hover:text-red-400 transition-colors uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-md px-2 py-1"
              >
                Clear All
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-6 px-2 no-scrollbar scroll-smooth">
              {uploadedOriginals.map((original) => (
                <button
                  key={original.substring(0, 100)} // Using prefix as key
                  onClick={() => handleImageSelected(original)}
                  className={`
                    flex-shrink-0 group relative w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all duration-300
                    ${selectedImage === original
                      ? 'border-indigo-500 ring-4 ring-indigo-500/10 scale-105 z-10'
                      : 'border-slate-800 hover:border-slate-600 hover:scale-105'}
                  `}
                >
                  <img
                    src={original}
                    alt="Original thumbnail"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
      </main>

      <footer className="py-6 px-4 text-center border-t border-slate-900 bg-slate-900/20">
        <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">ChromaSnap AI</p>
      </footer>

      {pendingPhotoEdit && (
        <PhotoEditorModal
          image={pendingPhotoEdit.image}
          title={pendingPhotoEdit.target === 'try-on' ? 'Edit Try-On Photo' : pendingPhotoEdit.target === 'barbershop' ? 'Edit Barbershop Photo' : 'Edit Outfit Photo'}
          onCancel={() => setPendingPhotoEdit(null)}
          onApply={handleApplyPendingPhotoEdit}
        />
      )}
    </div>
  );
};

export default App;
