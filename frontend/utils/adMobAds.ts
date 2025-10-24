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
    const { RewardedAd, RewardedAdEventType } = mobileAds;
    
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

      // Use RewardedAdEventType.LOADED (as error message specified)
      const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        console.log('Rewarded ad loaded, showing now...');
        clearTimeout(loadTimeout);
        rewarded.show();
      });

      // Use RewardedAdEventType.EARNED_REWARD
      const unsubscribeEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
        console.log('User earned reward:', reward);
        adRewarded = true;
        adWatched = true;
      });

      // Try using CLOSED event (common in ad SDKs)
      const unsubscribeClosed = rewarded.addAdEventListener(RewardedAdEventType.CLOSED, () => {
        console.log('Rewarded ad closed, watched:', adWatched, 'rewarded:', adRewarded);
        unsubscribeAll();
        resolve({ watched: adWatched, rewarded: adRewarded });
      });
      
      const unsubscribeAll = () => {
        unsubscribeLoaded();
        unsubscribeEarned();
        unsubscribeClosed();
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
