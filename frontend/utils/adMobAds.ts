/**
 * Facebook Audience Network Integration for Koala Mining
 * Uses expo-ads-facebook for rewarded and interstitial ads
 */

import { Platform } from 'react-native';
import * as Facebook from 'expo-ads-facebook';

// Your Facebook Placement IDs from Facebook Monetization Manager
const PLACEMENT_IDS = {
  app_launch: '813994837846321_817034327542372',
  miner_activation: '813994837846321_817034650875673',
  withdrawal: '813994837846321_817034827542322',
};

/**
 * Initialize Facebook Audience Network
 * Call this once at app startup
 */
export const initializeFacebookAds = async () => {
  try {
    await Facebook.AdSettings.addTestDevice(Facebook.AdSettings.currentDeviceHash);
    await Facebook.initializeAsync('813994837846321');
    console.log('Facebook Ads initialized successfully');
  } catch (error) {
    console.error('Error initializing Facebook Ads:', error);
  }
};

/**
 * Show Rewarded Video Ad (for miner activation)
 * Returns promise with reward status
 */
export const showRewardedVideoAd = async (): Promise<{ watched: boolean; rewarded: boolean }> => {
  try {
    const placementId = PLACEMENT_IDS.miner_activation;
    
    return new Promise((resolve) => {
      let adWatched = false;
      let rewardEarned = false;

      // Load the ad
      Facebook.RewardedVideoAd.loadAsync(placementId)
        .then(() => {
          console.log('Rewarded video ad loaded');
          // Show the ad
          return Facebook.RewardedVideoAd.showAsync(placementId);
        })
        .then((didClick) => {
          console.log('Rewarded video ad shown, clicked:', didClick);
          adWatched = true;
          rewardEarned = true;
          resolve({ watched: adWatched, rewarded: rewardEarned });
        })
        .catch((error) => {
          console.error('Error with rewarded video ad:', error);
          resolve({ watched: false, rewarded: false });
        });
    });
  } catch (error) {
    console.error('Error showing rewarded video ad:', error);
    return { watched: false, rewarded: false };
  }
};

/**
 * Show Interstitial Ad (for app launch and withdrawal)
 * Returns promise when ad completes
 */
export const showInterstitialAd = async (adType: 'app_launch' | 'withdrawal'): Promise<boolean> => {
  try {
    const placementId = PLACEMENT_IDS[adType];
    
    return new Promise((resolve) => {
      // Load the ad
      Facebook.InterstitialAdManager.loadAsync(placementId)
        .then(() => {
          console.log(`Interstitial ad (${adType}) loaded`);
          // Show the ad
          return Facebook.InterstitialAdManager.showAsync(placementId);
        })
        .then((didClick) => {
          console.log(`Interstitial ad (${adType}) shown, clicked:`, didClick);
          resolve(true);
        })
        .catch((error) => {
          console.error(`Error with interstitial ad (${adType}):`, error);
          resolve(false);
        });
    });
  } catch (error) {
    console.error('Error showing interstitial ad:', error);
    return false;
  }
};
