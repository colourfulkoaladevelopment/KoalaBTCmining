/**
 * Google AdMob Integration for Koala Mining
 * Handles rewarded and interstitial ads
 */

import { Platform } from 'react-native';

// Get AdMob Ad Unit IDs from environment variables
const AD_UNIT_IDS = {
  android: {
    app_launch: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_LAUNCH || '',
    miner_activation: process.env.EXPO_PUBLIC_ADMOB_ANDROID_MINER_ACTIVATION || '',
    withdrawal: process.env.EXPO_PUBLIC_ADMOB_ANDROID_WITHDRAWAL || '',
  },
  ios: {
    app_launch: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_LAUNCH || '',
    miner_activation: process.env.EXPO_PUBLIC_ADMOB_IOS_MINER_ACTIVATION || '',
    withdrawal: process.env.EXPO_PUBLIC_ADMOB_IOS_WITHDRAWAL || '',
  }
};

/**
 * Get the appropriate ad unit ID based on platform and ad type
 */
const getAdUnitId = (adType: 'app_launch' | 'miner_activation' | 'withdrawal') => {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  return AD_UNIT_IDS[platform][adType];
};

/**
 * Initialize the Google Mobile Ads SDK and wait for all mediation adapters
 * (including the Meta Audience Network adapter) to finish initializing.
 *
 * For AdMob Mediation, the "Meta primary / AdMob fallback" waterfall is
 * configured in the AdMob dashboard. The app only needs to initialize the SDK
 * so that mediated networks can participate on the first ad request.
 *
 * Safe to call multiple times; it only initializes once. No-op on web.
 */
let adsInitialized = false;
export const initializeAdMob = async (): Promise<void> => {
  if (Platform.OS === 'web' || adsInitialized) {
    return;
  }
  try {
    const { default: mobileAds } = await import('react-native-google-mobile-ads');
    const adapterStatuses = await mobileAds().initialize();
    adsInitialized = true;
    console.log('AdMob + mediation adapters initialized:', adapterStatuses);
  } catch (error) {
    // Don't crash the app if ad init fails — ads simply won't show.
    console.warn('AdMob initialization failed:', error);
  }
};

/**
 * Open the Google Ad Inspector overlay (native builds only).
 * Lets you see the live mediation waterfall and confirm whether Meta or AdMob
 * filled each request. Returns a human-readable status string for the caller.
 */
export const openAdInspector = async (): Promise<{ ok: boolean; message: string }> => {
  if (Platform.OS === 'web') {
    return { ok: false, message: 'Ad Inspector only works on a real device build, not web preview.' };
  }
  try {
    const { default: mobileAds } = await import('react-native-google-mobile-ads');
    // Make sure the SDK is initialized before opening the inspector
    await initializeAdMob();
    await mobileAds().openAdInspector();
    return { ok: true, message: 'Ad Inspector closed.' };
  } catch (error: any) {
    console.warn('Ad Inspector error:', error);
    return { ok: false, message: error?.message || 'Could not open Ad Inspector on this device.' };
  }
};

/**
 * Show Rewarded Video Ad (for miner activation)
 * Returns object with watched and rewarded status
 */
export const showRewardedVideoAd = async (): Promise<{ watched: boolean; rewarded: boolean }> => {
  // Skip ads on web platform
  if (Platform.OS === 'web') {
    console.log('Ads not supported on web platform');
    return { watched: true, rewarded: true };
  }

  try {
    const mobileAds = await import('react-native-google-mobile-ads');
    const { RewardedAd, RewardedAdEventType, AdEventType } = mobileAds;
    
    const adUnitId = getAdUnitId('miner_activation');
    console.log('Loading rewarded ad with unit ID:', adUnitId);
    
    const rewarded = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });
    
    return new Promise((resolve, reject) => {
      let adWatched = false;
      let adRewarded = false;
      let loadTimeout: NodeJS.Timeout;
      
      // Set timeout for ad loading (30 seconds)
      loadTimeout = setTimeout(() => {
        console.log('Rewarded ad load timeout');
        unsubscribeAll();
        reject(new Error('Ad load timeout'));
      }, 30000);

      // Use RewardedAdEventType.LOADED (shows reward info)
      const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        console.log('Rewarded ad loaded, showing now...');
        clearTimeout(loadTimeout);
        rewarded.show();
      });

      // Use RewardedAdEventType.EARNED_REWARD when user completes the ad
      const unsubscribeEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
        console.log('User earned reward:', reward);
        adRewarded = true;
        adWatched = true;
      });

      // Use AdEventType.CLOSED (not RewardedAdEventType.CLOSED)
      const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('Rewarded ad closed, watched:', adWatched, 'rewarded:', adRewarded);
        unsubscribeAll();
        resolve({ watched: adWatched, rewarded: adRewarded });
      });

      // Handle errors
      const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error('Rewarded ad error:', error);
        clearTimeout(loadTimeout);
        unsubscribeAll();
        reject(error);
      });
      
      const unsubscribeAll = () => {
        unsubscribeLoaded();
        unsubscribeEarned();
        unsubscribeClosed();
        unsubscribeError();
      };

      // Load the ad
      console.log('Starting to load rewarded ad...');
      rewarded.load();
    });
  } catch (error) {
    console.error('Error showing rewarded ad:', error);
    return { watched: false, rewarded: false };
  }
};

/**
 * Show Interstitial Ad (for app launch and withdrawal)
 * Returns promise when ad completes
 */
export const showInterstitialAd = async (adType: 'app_launch' | 'withdrawal'): Promise<boolean> => {
  // Skip ads on web platform
  if (Platform.OS === 'web') {
    console.log('Ads not supported on web platform');
    return true;
  }

  try {
    const { InterstitialAd, AdEventType } = await import('react-native-google-mobile-ads');
    
    const adUnitId = getAdUnitId(adType);
    const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });
    
    return new Promise((resolve) => {
      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        console.log(`Interstitial ad (${adType}) loaded`);
        interstitial.show();
      });

      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        console.log(`Interstitial ad (${adType}) closed`);
        unsubscribeLoaded();
        unsubscribeClosed();
        resolve(true);
      });

      // Load the ad
      interstitial.load();
    });
  } catch (error) {
    console.error('Error showing interstitial ad:', error);
    return false;
  }
};
