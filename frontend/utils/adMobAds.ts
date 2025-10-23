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
 * Returns promise with reward status
 */
export const showRewardedVideoAd = async (): Promise<{ watched: boolean; rewarded: boolean }> => {
  try {
    const { RewardedAd, RewardedAdEventType } = await import('react-native-google-mobile-ads');
    
    const adUnitId = getAdUnitId('miner_activation');
    const rewarded = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });
    
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

      const unsubscribeDismissed = rewarded.addAdEventListener(
        RewardedAdEventType.DISMISSED,
        () => {
          console.log('Rewarded ad dismissed');
          unsubscribeLoaded();
          unsubscribeEarned();
          unsubscribeDismissed();
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
export const showInterstitialAd = async (adType: 'app_launch' | 'withdrawal'): Promise<boolean> => {
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
