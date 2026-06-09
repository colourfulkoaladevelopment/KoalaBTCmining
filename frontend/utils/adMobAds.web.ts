/**
 * Google AdMob Integration for Koala Mining - WEB STUB
 * This is a stub implementation for web platform only
 */

/**
 * Initialize AdMob + mediation adapters - Web Stub (no-op)
 */
export const initializeAdMob = async (): Promise<void> => {
  // Ads are not supported on web; nothing to initialize.
  return;
};

/**
 * Open Ad Inspector - Web Stub
 */
export const openAdInspector = async (): Promise<{ ok: boolean; message: string }> => {
  return { ok: false, message: 'Ad Inspector only works on a real device build, not web preview.' };
};

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
