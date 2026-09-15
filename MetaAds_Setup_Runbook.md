# Meta Audience Network (Primary) + AdMob (Fallback) — Setup Runbook

This app is now **code-ready** for AdMob Mediation with **Meta Audience Network as the
primary** ad source and **Google AdMob as the fallback**. The "Meta-first / AdMob-fallback"
behaviour is controlled in the **AdMob dashboard**, NOT in the app code.

> IMPORTANT: This feature works ONLY in a native build (Android APK / iOS IPA generated via
> Emergent "Publish"). It CANNOT be tested in Expo Go or the web preview.

---

## What was already done in the app (code side)
1. `plugins/withMetaAudienceNetwork.js` — adds the Android Meta mediation adapter
   (`com.google.ads.mediation:facebook:6.21.0.3`) to the native build.
2. `app.json`:
   - Registered `./plugins/withMetaAudienceNetwork`.
   - Added iOS Meta adapter Pod via `expo-build-properties` → `ios.extraPods`:
     `GoogleMobileAdsMediationFacebook`.
   - Added Google's SKAdNetwork ID `cstr6suwn9.skadnetwork` (Meta's two were already present).
   - Bumped `android.versionCode` → 53.
3. `utils/adMobAds.ts` — added `initializeAdMob()` which calls
   `mobileAds().initialize()` and waits for mediation adapters.
4. `app/premium-mining-app.tsx` — calls `initializeAdMob()` once on app mount.

The app's ad-show code (`showRewardedVideoAd`, `showInterstitialAd`) is unchanged and
network-agnostic — AdMob decides whether Meta or AdMob fills each request.

---

## What YOU need to do (dashboard side) — in order

### Step 1 — Get a working Meta Audience Network account (BLOCKER)
Your current Meta Audience Network account was disabled for Community Standards / account
integrity. You must have an **approved** Audience Network property before Meta can serve ads.
- Go to https://www.facebook.com/business → Monetization Manager → Audience Network.
- Create/restore a property, add your app (package `com.koalamining.app`), and create
  **Placements** (one per ad slot: e.g. Rewarded, Interstitial).
- Note each **Placement ID** and your **Audience Network App/Property ID**.
- Wait for Meta approval (Meta reviews apps before serving real ads).

### Step 2 — Link Meta as an ad source in AdMob, with Meta as PRIMARY
In AdMob (https://apps.admob.com):
1. Mediation → **Create Mediation Group** (one per format: Rewarded, Interstitial) for Android
   (and iOS if you build for iOS).
2. Select the AdMob **ad unit(s)** for that format.
3. Add ad source → **Meta Audience Network**:
   - Preferred: add Meta as a **Bidding** source (Meta recommends bidding for new apps), OR
   - Waterfall: add Meta at the **top** with the **highest eCPM** so it's queried first.
   - Map it to your Meta **Placement ID** (and Property ID / access token Meta provides).
4. Ensure the **Google AdMob Network** source is also in the group as the **fallback**
   (lower priority / lower eCPM in waterfall, or as a competing bidder).
5. (Optional) Enable eCPM optimization, but monitor it so Meta stays effectively primary.

### Step 3 — Privacy/consent (so Meta is allowed to serve)
In AdMob → Privacy & messaging:
- Add **Meta (Facebook)** to your GDPR / US-states **ad partners** list. If Meta is not listed
  as an allowed partner, it will return no-fill even when configured.
- Ensure your iOS ATT prompt shows (already configured: `NSUserTrackingUsageDescription`).

### Step 4 — Build & test (ONE build cycle)
Only after Steps 1–3 are done:
1. Click **Publish** in Emergent → generate the Android (and/or iOS) build.
2. Install on a real device.
3. In the app, you can verify mediation with Ad Inspector (we can add a hidden dev button
   that calls `mobileAds().openAdInspector()` if you want).
4. Use Meta's "Test Devices" in Monetization Manager (add your device's GAID/IDFA) to see
   Meta test ads. Note: Meta intentionally returns no-fill ~20% of the time during testing —
   that's expected and lets you confirm AdMob fallback works.

---

## How "Meta primary, AdMob fallback" actually behaves
- AdMob requests an ad → Meta gets first opportunity (top priority / bid).
- If Meta fills → Meta ad shows.
- If Meta no-fills, is ineligible, or loses the auction → AdMob (or another source) fills.
- This is all decided by the AdMob mediation group config — no app rebuild needed to tune it
  (you can change priorities/eCPM floors in the dashboard anytime).

## Tips to avoid wasted build cycles
- Do NOT generate a build until your Meta account is approved AND the AdMob mediation group is
  configured. Dashboard changes don't need a new build — only the native adapter (already added)
  did, and it's done.
- If a build ever fails because of the Meta iOS Pod, we can switch `expo-build-properties` to
  `ios.useFrameworks: "static"`; we left it off to keep your current working build intact.
