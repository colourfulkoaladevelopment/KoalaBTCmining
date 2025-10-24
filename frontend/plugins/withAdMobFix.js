const { withAndroidManifest } = require('@expo/config-plugins');

const withAdMobFix = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    // Find the DELAY_APP_MEASUREMENT_INIT meta-data
    const metaDataIndex = mainApplication['meta-data']?.findIndex(
      (item) => item.$['android:name'] === 'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT'
    );

    if (metaDataIndex !== -1 && mainApplication['meta-data']) {
      // Add tools:replace attribute
      mainApplication['meta-data'][metaDataIndex].$['tools:replace'] = 'android:value';
    }

    return config;
  });
};

module.exports = withAdMobFix;
