# Restore Points Registry

## ALPHA  (label: "Alpha")
- Archive: /app/backups/RESTORE_POINT_ALPHA_20260623_181145.tar.gz
- Stable copy: /app/backups/RESTORE_POINT_ALPHA_latest.tar.gz
- Created: 20260623_181145
- State summary (VERIFIED WORKING):
  * Android APK built successfully via EAS and set up by user.
  * eas.json: APK profiles + all 8 EXPO_PUBLIC_ vars embedded; backend URL = https://paypal-ads-rebuild.emergent.host (verified live 24/7).
  * yarn.lock in sync with package.json (passes EAS --frozen-lockfile).
  * Backend admin fixes live (reset-user/give-btc/get_all_users correct field; non-admin -> 403).
  * Activity Feed re-enabled (leak-free useRef timer).
  * Admin Panel: Wallet Approvals + User Management (Add BTC / Reset / Delete) + Developer Tools (Ad Inspector).
  * AdMob Mediation -> Meta Audience Network adapter wired (Android), versionCode 53.
- Admin login: colourfulkoaladevelopment@gmail.com / KoalaAdmin#2026
- How to restore: tar -xzf /app/backups/RESTORE_POINT_ALPHA_latest.tar.gz -C /app  (then restart backend & expo)
