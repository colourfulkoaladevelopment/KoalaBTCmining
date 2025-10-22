/**
 * Google AdMob Integration for Koala Mining
 * Handles rewarded and interstitial ads
 */

import { Platform } from 'react-native';

// Test Ad Unit IDs (replace with your real IDs from AdMob)
const AD_UNIT_IDS = {
  android: {
    rewarded: 'ca-app-pub-3940256099942544/5224354917', // Test ID
    interstitial: 'ca-app-pub-3940256099942544/1033173712' // Test ID
  },
  ios: {
    rewarded: 'ca-app-pub-3940256099942544/1712485313', // Test ID
    interstitial: 'ca-app-pub-3940256099942544/4411468910' // Test ID
  }
};

export const getAdUnitId = (adType: 'rewarded' | 'interstitial') => {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  return AD_UNIT_IDS[platform][adType];
};

/**
 * Show Rewarded Ad (for miner activation)
 * Returns promise with reward status
 */
export const showRewardedAd = async (): Promise<{ watched: boolean; rewarded: boolean }> => {
  try {
    // Dynamic import to avoid errors in web/expo go
    const { RewardedAd, RewardedAdEventType, TestIds } = await import('react-native-google-mobile-ads');
    
    const adUnitId = getAdUnitId('rewarded');
    const rewarded = RewardedAd.createForAdRequest(adUnitId);
    
    return new Promise((resolve) => {
      let adWatched = false;
      let rewardEarned = false;

      const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        console.log('Rewarded ad loaded');
        rewarded.show();
      });

      const unsubscribeEarned = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward) => {
          console.log('User earned reward:', reward);
          adWatched = true;
          rewardEarned = true;
        }
      );

      const unsubscribeClosed = rewarded.addAdEventListener(
        RewardedAdEventType.DISMISSED,
        () => {
          console.log('Rewarded ad dismissed');
          unsubscribeLoaded();
          unsubscribeEarned();
          unsubscribeClosed();
          resolve({ watched: adWatched, rewarded: rewardEarned });
        }
      );

      // Load the ad
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
export const showInterstitialAd = async (): Promise<boolean> => {
  try {
    // Dynamic import to avoid errors in web/expo go
    const { InterstitialAd, AdEventType, TestIds } = await import('react-native-google-mobile-ads');
    
    const adUnitId = getAdUnitId('interstitial');
    const interstitial = InterstitialAd.createForAdRequest(adUnitId);
    
    return new Promise((resolve) => {
      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        console.log('Interstitial ad loaded');
        interstitial.show();
      });

      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('Interstitial ad closed');
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

/**
 * Initialize AdMob (call once at app start)
 */
export const initializeAdMob = async () => {
  try {
    const { MobileAds } = await import('react-native-google-mobile-ads');
    await MobileAds().initialize();
    console.log('AdMob initialized successfully');
  } catch (error) {
    console.error('Error initializing AdMob:', error);
  }
};
