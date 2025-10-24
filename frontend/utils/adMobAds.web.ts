/**
 * Google AdMob Integration for Koala Mining - WEB STUB
 * This is a stub implementation for web platform only
 */

/**
 * Show Rewarded Video Ad (for miner activation) - Web Stub
 * Returns object with watched and rewarded status
 */
export const showRewardedVideoAd = async (): Promise<{ watched: boolean; rewarded: boolean }> => {
  console.log('Ads not supported on web platform - stub called');
  return { watched: true, rewarded: true };
};

/**
 * Show Interstitial Ad (for app launch and withdrawal) - Web Stub
 * Returns promise when ad completes
 */
export const showInterstitialAd = async (adType: 'app_launch' | 'withdrawal'): Promise<boolean> => {
  console.log(`Ads not supported on web platform - stub called for ${adType}`);
  return true;
};
