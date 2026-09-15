const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Config plugin: AdMob Mediation -> Meta Audience Network (Facebook) adapter.
 *
 * The "Meta primary / AdMob fallback" waterfall itself is configured in the
 * AdMob dashboard (mediation group). This plugin only adds the NATIVE Meta
 * mediation ADAPTER so AdMob is able to serve Meta ads on a real build.
 *
 * - Android: injects `com.google.ads.mediation:facebook` into app/build.gradle.
 * - iOS: the `GoogleMobileAdsMediationFacebook` Pod is added via the
 *   `expo-build-properties` `ios.extraPods` option in app.json.
 *
 * NOTE: This only takes effect in a native (development/production) build —
 * it cannot be tested in Expo Go or the web preview.
 */
const META_ANDROID_ADAPTER = "implementation 'com.google.ads.mediation:facebook:6.21.0.3'";

const withMetaAudienceNetwork = (config) => {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // Avoid duplicate insertion on repeated prebuilds
    if (!contents.includes('com.google.ads.mediation:facebook')) {
      // Insert the adapter as the first entry inside the first dependencies { } block
      contents = contents.replace(
        /dependencies\s*\{/,
        (match) => `${match}\n    ${META_ANDROID_ADAPTER}`
      );
      cfg.modResults.contents = contents;
    }

    return cfg;
  });
};

module.exports = withMetaAudienceNetwork;
