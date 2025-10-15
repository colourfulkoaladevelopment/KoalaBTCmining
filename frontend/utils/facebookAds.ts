/**
 * Facebook Audience Network Integration
 * Handles interstitial and rewarded video ads
 */

import { Platform } from 'react-native';
import { 
  AdSettings, 
  InterstitialAdManager,
  RewardedVideoAdManager 
} from 'expo-ads-facebook';

// Facebook Placement IDs
const PLACEMENT_IDS = {
  APP_LAUNCH: '813994837846321_817034327542372',
  MINER: '813994837846321_817034650875673',
  WITHDRAWAL: '813994837846321_817034827542322'
};

// Enable test mode during development
// Set to false for production
export const setupFacebookAds = (testMode: boolean = false) => {
  if (testMode) {
    // Add test device hash for testing
    AdSettings.addTestDevice(AdSettings.currentDeviceHash);
  }
  
  console.log('Facebook Ads initialized', testMode ? '(Test Mode)' : '(Production Mode)');
};

/**
 * Show Interstitial Ad (App Launch or Withdrawal)
 */
export const showInterstitialAd = async (
  adType: 'app_launch' | 'withdrawal'
): Promise<boolean> => {
  try {
    const placementId = adType === 'app_launch' 
      ? PLACEMENT_IDS.APP_LAUNCH 
      : PLACEMENT_IDS.WITHDRAWAL;
    
    console.log(`Loading interstitial ad: ${adType}`);
    
    // Show the ad
    await InterstitialAdManager.showAd(placementId);
    
    console.log(`Interstitial ad shown successfully: ${adType}`);
    return true;
    
  } catch (error: any) {
    console.error(`Failed to show interstitial ad (${adType}):`, error);
    
    // Common errors
    if (error.message?.includes('No fill')) {
      console.log('No ad available to show (no fill)');
    } else if (error.message?.includes('1001')) {
      console.log('Ad network error - no internet or network issue');
    } else if (error.message?.includes('canceled')) {
      console.log('Ad was canceled by user');
    }
    
    return false;
  }
};

/**
 * Show Rewarded Video Ad (Miner Activation)
 */
export const showRewardedVideoAd = async (): Promise<{
  watched: boolean;
  rewarded: boolean;
}> => {
  try {
    const placementId = PLACEMENT_IDS.MINER;
    
    console.log('Loading rewarded video ad');
    
    // Show the ad
    await RewardedVideoAdManager.showAd(placementId);
    
    console.log('Rewarded video ad shown successfully');
    
    return {
      watched: true,
      rewarded: true
    };
    
  } catch (error: any) {
    console.error('Failed to show rewarded video ad:', error);
    
    // Common errors
    if (error.message?.includes('No fill')) {
      console.log('No ad available to show (no fill)');
    } else if (error.message?.includes('1001')) {
      console.log('Ad network error - no internet or network issue');
    } else if (error.message?.includes('canceled')) {
      console.log('User closed ad before completion - no reward');
      return {
        watched: false,
        rewarded: false
      };
    }
    
    return {
      watched: false,
      rewarded: false
    };
  }
};

/**
 * Preload ads for better performance
 */
export const preloadAds = async () => {
  try {
    // Preload app launch interstitial
    InterstitialAdManager.showAd(PLACEMENT_IDS.APP_LAUNCH).catch(() => {
      // Silently fail if no ad available
    });
    
    // Preload withdrawal interstitial  
    InterstitialAdManager.showAd(PLACEMENT_IDS.WITHDRAWAL).catch(() => {
      // Silently fail if no ad available
    });
    
    // Preload rewarded video
    RewardedVideoAdManager.showAd(PLACEMENT_IDS.MINER).catch(() => {
      // Silently fail if no ad available
    });
    
    console.log('Ads preloaded');
  } catch (error) {
    console.error('Failed to preload ads:', error);
  }
};

/**
 * Check if an ad is available (optional - can help avoid showing "no ad" errors)
 */
export const isAdAvailable = async (adType: 'interstitial' | 'rewarded'): Promise<boolean> => {
  // Facebook Audience Network doesn't provide a direct way to check availability
  // So we return true and handle errors when showing ads
  return true;
};
