
import React, { useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import ComparisonView from './components/ComparisonView';
import VideoResult from './components/VideoResult';
import LoadingOverlay from './components/LoadingOverlay';
import TurnstileCaptcha from './components/TurnstileCaptcha';
import AdminLoginPage from './components/AdminLoginPage';
import { AuthUser, ColorizedImage, AnimatedResult, ProcessingState, SubscriptionAccount, SubscriptionPlan, SubscriptionUsageItem } from './types';
import {
  clearAuthToken,
  colorizeImage,
  confirmPasswordReset,
  animateImage,
  checkImageSafety,
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
import {
  confirmPhoneOtp,
  isFirebaseAvailable,
  sendPhoneOtp,
  signInWithGoogle,
} from './services/firebaseAuthService';
import {
  getGooglePlayBillingAvailability,
  purchaseGooglePlayProduct,
  isAndroidNativePlatform,
} from './services/googlePlayBillingService';

const PALETTES = [
  { id: 'Natural', name: 'Natural', colors: 'from-emerald-600 to-emerald-400' },
  { id: 'Cinematic', name: 'Cinematic', colors: 'from-indigo-600 to-indigo-400' },
  { id: 'Vivid', name: 'Vivid', colors: 'from-pink-600 to-pink-400' },
  { id: 'Vintage', name: 'Vintage', colors: 'from-amber-600 to-amber-400' },
  { id: 'Technicolor', name: 'Technicolor', colors: 'from-rose-600 to-rose-400' }
];

const SAMPLE_IMAGE_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1f2937"/>
        <stop offset="100%" stop-color="#9ca3af"/>
      </linearGradient>
    </defs>
    <rect width="900" height="600" fill="url(#g)"/>
    <rect x="140" y="70" width="620" height="460" rx="28" fill="#111827" stroke="#d1d5db" stroke-width="8"/>
    <circle cx="320" cy="270" r="110" fill="#374151"/>
    <rect x="460" y="180" width="210" height="180" rx="18" fill="#4b5563"/>
    <text x="450" y="545" text-anchor="middle" fill="#f3f4f6" font-size="34" font-family="Arial, sans-serif">Sample B&amp;W Photo</text>
  </svg>`
)}`;

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

const App: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
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
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showAdminLoginPage, setShowAdminLoginPage] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const turnstileSiteKey = import.meta.env.REACT_APP_TURNSTILE_SITE_KEY || '';
  const isDeveloperMode = import.meta.env.DEV || import.meta.env.REACT_APP_ENABLE_ADMIN_PAGE === 'true';

  const currentPlan = subscriptionPlans.find((plan) => plan.id === (subscriptionAccount?.tier ?? 'free'));
  const planMonthlyTokens = currentPlan?.monthlyTokens ?? 1;
  const usedThisCycle = Math.max(0, planMonthlyTokens - (subscriptionAccount?.tokenBalance ?? 0));
  const usagePercent = Math.min(100, Math.round((usedThisCycle / planMonthlyTokens) * 100));

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
      setBillingMessage(error.message || 'Failed to load subscription data');
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

  useEffect(() => {
    if (!authUser) return;
    refreshSubscription();
  }, [activeUserId, authUser]);

  useEffect(() => {
    if (!showAccountMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
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
      setAuthMessage(error.message || 'Failed to delete account');
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const handleRegister = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const { user } = await registerUser({
        username: authUsername,
        password: authPassword,
        name: authName,
        email: authEmail,
        phoneNumber: authPhoneNumber || undefined,
      });
      setAuthUser(user);
      const storedId = setCurrentUserId(user.username);
      setActiveUserId(storedId);
      setUserIdInput(storedId);
      setAuthMessage('Account created and logged in.');
    } catch (error: any) {
      setAuthMessage(error.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const { user } = await loginUser({
        username: authUsername,
        password: authPassword,
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
      setAuthMessage(error.message || 'Login failed');
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
      setAuthMessage(error.message || 'Google sign-in failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      if (!isFirebaseAvailable()) {
        throw new Error('Phone login is not configured yet (missing Firebase env vars).');
      }
      const startResult = await sendPhoneOtp(socialPhoneNumber);

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
      setAuthMessage(error.message || 'Failed to send OTP');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const idToken = await confirmPhoneOtp(socialOtpCode);
      const { user } = await socialLogin({ idToken, provider: 'phone' });
      setAuthUser(user);
      const storedId = setCurrentUserId(user.username);
      setActiveUserId(storedId);
      setUserIdInput(storedId);
      setSocialOtpCode('');
      setSocialOtpSent(false);
      setAuthMessage('Phone login successful.');
    } catch (error: any) {
      setAuthMessage(error.message || 'OTP verification failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRecoverUsername = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    setRecoveredUsernames([]);
    try {
      const usernames = await recoverUsername(authRecoveryEmail);
      setRecoveredUsernames(usernames);
      setAuthMessage(usernames.length ? 'Recovered usernames below.' : 'No usernames found for that recovery email.');
    } catch (error: any) {
      setAuthMessage(error.message || 'Username recovery failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const result = await requestPasswordReset({
        username: authUsername,
        recoveryEmail: authRecoveryEmail,
      });
      setIssuedResetToken(result.resetToken || '');
      if (result.resetToken) {
        setAuthResetToken(result.resetToken);
      }
      setAuthMessage('Password reset token generated. Use it below to set a new password.');
    } catch (error: any) {
      setAuthMessage(error.message || 'Password reset request failed');
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
      setAuthMessage(error.message || 'Password reset failed');
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
      setBillingMessage(error.message || 'Failed to change plan');
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
      setBillingMessage(error.message || 'Failed to top up tokens');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleImageSelected = (base64: string) => {
    setSelectedImage(base64);
    setResult(null);
    setVideoResult(null);
    setProcessing(prev => ({ ...prev, error: undefined }));
    if (!uploadedOriginals.includes(base64)) {
      setUploadedOriginals(prev => [base64, ...prev]);
    }
  };

  const handleSampleImage = () => {
    handleImageSelected(SAMPLE_IMAGE_DATA_URL);
  };

  const handleColorize = async () => {
    if (!selectedImage) return;

    setProcessing({
      isProcessing: true,
      statusMessage: `Colorizing with ${selectedTheme} Palette...`,
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

      setProcessing(prev => ({ ...prev, statusMessage: `Applying ${selectedTheme} palette...` }));
      const colorized = await colorizeImage(selectedImage, selectedTheme);

      setProcessing(prev => ({ ...prev, statusMessage: 'Verifying result...' }));
      const postSafety = await checkImageSafety(colorized);

      const newResult: ColorizedImage = {
        id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
        original: selectedImage,
        colorized: colorized,
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
        error: error.message || 'An unexpected error occurred.'
      });
    }
  };

  const updateResult = (newImage: string) => {
    if (!result) return;
    const newVersion: ColorizedImage = {
      ...result,
      id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      colorized: newImage,
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
      setProcessing({ isProcessing: false, statusMessage: '', error: error.message || 'Upscaling failed.' });
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
      setProcessing({ isProcessing: false, statusMessage: '', error: error.message || 'Enhancement failed.' });
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
      setProcessing({ isProcessing: false, statusMessage: '', error: error.message || 'Sharpening failed.' });
    }
  };

  const handleUndo = () => {
    if (history.length > 1) {
      const newHistory = history.slice(1);
      setHistory(newHistory);
      setResult(newHistory[0]);
    }
  };

  const handleAnimate = async () => {
    if (!result || !result.safetyCheck?.isSafe || result.safetyCheck?.containsMinors) return;

    setProcessing({
      isProcessing: true,
      statusMessage: 'Generating Cinematic Animation...',
      type: 'animating'
    });

    try {
      const videoUrl = await animateImage(result.colorized, (message) => {
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
        error: error.message || 'Animation failed.'
      });
    }
  };

  const reset = () => {
    setSelectedImage(null);
    setSelectedTheme('Natural');
    setResult(null);
    setVideoResult(null);
    setProcessing({ isProcessing: false, statusMessage: '', error: undefined });
  };

  const handleDownloadResult = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result.colorized;
    link.download = `chromasnap-hd-${Date.now()}.png`;
    link.click();
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
      handleDownloadResult();
    }
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
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">Secure Login</h2>
            <p className="text-xs text-slate-400">Sign in to access colorization, billing, and account recovery tools.</p>

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
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
                placeholder=""
                aria-label="Username"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            )}

            {(authMode === 'login' || authMode === 'register') && (
              <div className="relative">
                <input
                  type={showAuthPassword ? 'text' : 'password'}
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder=""
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
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="Email"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <input
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
                  value={authResetToken}
                  onChange={(event) => setAuthResetToken(event.target.value)}
                  placeholder="Reset token"
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <div className="relative">
                  <input
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
                  className="w-full px-4 py-3 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Continue with Google
                </button>

                <div className="grid grid-cols-1 gap-2 p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                  <input
                    type="tel"
                    value={socialPhoneNumber}
                    onChange={(event) => setSocialPhoneNumber(event.target.value)}
                    placeholder="Phone (+12025551234)"
                    className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  {!socialOtpSent ? (
                    <button
                      onClick={handleSendPhoneOtp}
                      disabled={authLoading}
                      className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50"
                    >
                      Send OTP
                    </button>
                  ) : (
                    <>
                      <input
                        value={socialOtpCode}
                        onChange={(event) => setSocialOtpCode(event.target.value)}
                        placeholder="OTP code"
                        className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handleVerifyPhoneOtp}
                        disabled={authLoading}
                        className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50"
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
                    disabled={authLoading}
                    className="w-full px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50"
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
                  disabled={authLoading}
                  className="w-full px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  Create Account
                </button>
              )}
              {authMode === 'recover-username' && (
                <button
                  onClick={handleRecoverUsername}
                  disabled={authLoading}
                  className="w-full px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  Recover Username
                </button>
              )}
              {authMode === 'recover-password' && (
                <>
                  <button
                    onClick={handleRequestPasswordReset}
                    disabled={authLoading}
                    className="w-full px-4 py-3 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 transition-colors disabled:opacity-50"
                  >
                    Request Reset Token
                  </button>
                  <button
                    onClick={handleConfirmPasswordReset}
                    disabled={authLoading}
                    className="w-full px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50"
                  >
                    Confirm New Password
                  </button>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-4xl mx-auto w-full">
        {processing.isProcessing && (
          <LoadingOverlay
            message={processing.statusMessage}
            type={processing.type}
          />
        )}

        <div
          id="account-panel"
          className="w-full rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl p-4 sm:p-5 space-y-3 max-h-[65vh] overflow-y-auto"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-[0.18em]">Account</h3>
              <p className="text-xs leading-relaxed text-slate-400">Compact summary for mobile/tablet. Expand for full billing controls.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setAccountTab('overview');
                  setShowAccountMenu(false);
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-full border transition-colors ${accountTab === 'overview' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-700 text-slate-300 hover:border-indigo-400 hover:text-white'}`}
              >
                Overview
              </button>
              <button
                onClick={() => {
                  setAccountTab('account-details');
                  setShowAccountMenu(false);
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-full border transition-colors ${accountTab === 'account-details' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-700 text-slate-300 hover:border-indigo-400 hover:text-white'}`}
              >
                Account Details
              </button>
              <div ref={accountMenuRef} className="relative">
                <button
                  onClick={() => setShowAccountMenu((current) => !current)}
                  className={`px-4 py-2 text-xs font-semibold rounded-full border transition-colors ${showAccountMenu || accountTab === 'delete-account' ? 'border-slate-500 bg-slate-800/80 text-white' : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'}`}
                >
                  More
                </button>
                {showAccountMenu && (
                  <div className="absolute right-0 top-full z-10 mt-2 min-w-[160px] rounded-2xl border border-slate-700 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
                    <button
                      onClick={() => {
                        setAccountTab('delete-account');
                        setShowAccountMenu(false);
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
                    >
                      Delete Account
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  void refreshSubscription();
                }}
                disabled={billingLoading}
                className="px-4 py-2 text-xs font-semibold rounded-full border border-slate-700 text-slate-300 hover:border-indigo-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  handleLogout();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-full border border-slate-700 text-rose-300 hover:border-rose-400 hover:text-rose-200 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>

          {accountTab === 'overview' && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
              Select the <span className="font-semibold text-white">Account Details</span> tab to view user ID, token balance, cycle, usage, and billing controls.
            </div>
          )}

          {accountTab === 'account-details' && (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">User</div>
                  <div className="text-xs font-semibold text-slate-200 truncate">{authUser?.username || activeUserId}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Active: {activeUserId}</div>
                </div>

                <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Balance</div>
                  <div className="text-sm sm:text-base font-semibold text-white leading-tight">{subscriptionAccount?.tokenBalance ?? '--'} tokens</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Tier: {subscriptionAccount?.tier ?? 'free'}</div>
                </div>

                <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Cycle</div>
                  <div className="text-xs text-slate-200">Ends {subscriptionAccount?.cycleEndsAt ? new Date(subscriptionAccount.cycleEndsAt).toLocaleDateString() : '--'}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Usage: {usagePercent}%</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">User Id</label>
                  <div className="flex gap-2">
                    <input
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

              <div className="grid gap-3 md:grid-cols-3">
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
                type="password"
                value={deleteAccountPassword}
                onChange={(event) => setDeleteAccountPassword(event.target.value)}
                placeholder="Current password"
                className="w-full rounded-xl bg-slate-950/60 border border-rose-900/70 px-3 py-3 text-xs text-slate-100 focus:outline-none focus:border-rose-500 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              />
              <input
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

        {!selectedImage && !result && (
          <div className="w-full text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl md:text-5xl leading-tight font-black tracking-tight text-white">
                Breathe life into <span className="text-indigo-500">History</span>.
              </h2>
              <p className="text-slate-400 max-w-md mx-auto text-base sm:text-lg leading-relaxed">
                Upload your black and white photos and watch our AI reconstruct the natural colors and even animate them.
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

        {selectedImage && !result && (
          <div className="w-full flex flex-col items-center gap-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="relative w-full max-w-lg rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group bg-slate-900">
              <img
                src={selectedImage}
                alt="Preview"
                className="w-full h-auto block"
              />
              <button
                onClick={reset}
                className="absolute top-4 right-4 p-2 bg-slate-900/80 backdrop-blur-md rounded-full text-white hover:bg-red-500 transition-colors shadow-lg z-10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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

            {processing.error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-center gap-3 w-full max-w-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {processing.error}
              </div>
            )}

            {!processing.isProcessing && (
              <button
                onClick={handleColorize}
                className="w-full max-w-md py-4 min-h-[48px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Colorize
              </button>
            )}
          </div>
        )}

        {result && (
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

              {containsMinors ? (
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
              ) : isRestricted ? (
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
                <button
                  onClick={handleAnimate}
                  disabled={processing.isProcessing}
                  className="w-full py-4 min-h-[48px] bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-2xl shadow-xl shadow-purple-600/20 transition-all active:scale-95 flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Generate Animation
                </button>
              )}

              <button
                onClick={reset}
                className="w-full py-3 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-2xl border border-slate-800 transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Upload New Image
              </button>
            </div>

            {videoResult && (
              <div className="w-full space-y-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Animation</h3>
                <VideoResult videoUrl={videoResult.videoUrl} />
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
      </main>

      <footer className="py-6 px-4 text-center border-t border-slate-900 bg-slate-900/20 space-y-3">
        <div className="flex flex-wrap justify-center gap-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
          <span className="px-2.5 py-1 rounded-full border border-slate-800">Transparent usage</span>
        </div>
        <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">ChromaSnap AI • Restoration Studio</p>
      </footer>
    </div>
  );
};

export default App;
