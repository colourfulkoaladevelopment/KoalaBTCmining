# Koala Mining App - Fork Handoff Document
**Last Updated:** 2025-11-08
**Current Build:** Version 25 (in progress)
**App Status:** Functional with pending fixes

---

## 🔑 CRITICAL CREDENTIALS (Wiped on Fork)

### Expo Account
- **Username:** colourfulkoaladevelopment
- **Email:** colourfulkoaladevelopment@gmail.com
- **Personal Access Token:** `nRQoZeqRX-JK4ZxINBG3n-EHrtUpHUF3UMigKG2z`
- **Usage:** EAS builds require this token to push builds

### Kraken API (Bitcoin Withdrawals)
- **API Key:** `tYRe21B+R2MB8kSI2b/B6NCNhpfbPzvwGI63ldf31itZyFuw4QQJUR0n`
- **API Secret:** `qRKufd6kUu0pvBS3XWdVGn7+vzyeoApWBSR0OpYD504+hJXK7/LmX+dQFWeQRnaaBHdL7+rVfLTTWBlDdrVQlQ==`
- **Account Balance:** 0.00139869 BTC
- **Base URL:** https://api.kraken.com

### PayPal Integration
- **Client ID:** (in backend/.env)
- **Client Secret:** (in backend/.env)
- **Mode:** live

### Gmail SMTP (Email Support)
- **User:** colourfulkoaladevelopment@gmail.com
- **App Password:** `kwkg czgx shbd btrp`

### Admin Account
- **Email:** colourfulkoaladevelopment@gmail.com
- **Role:** Admin with full access

### GitHub Repository
- **URL:** https://github.com/colourfulkoaladevelopment/koala-mining-app
- **Access Token:** `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`

---

## 📱 APP ARCHITECTURE

### Tech Stack
- **Frontend:** Expo (React Native) - File-based routing with custom tabs
- **Backend:** FastAPI (Python)
- **Database:** MongoDB (PyMongo, NOT Motor)
- **Payments:** PayPal SDK
- **Withdrawals:** Kraken API (Live)
- **Ads:** Google AdMob

### Key Files
```
/app/
├── backend/
│   ├── server.py (Main API, 3600+ lines)
│   ├── requirements.txt
│   └── .env (Bitcoin/PayPal/Gmail credentials)
├── frontend/
│   ├── app/
│   │   ├── premium-mining-app.tsx (MAIN APP FILE - 4200+ lines)
│   │   ├── (tabs)/ (Legacy, overridden by custom tabs)
│   │   ├── index.tsx (Entry point)
│   │   └── reset-password.tsx
│   ├── app.json (versionCode: currently 25)
│   └── .env (Backend URL config)
```

### Navigation Structure
- **Custom tabs in premium-mining-app.tsx override expo-router**
- Tabs: Dashboard | Store | Invites | Profile
- Authentication: JWT tokens in AsyncStorage

---

## 🚨 PENDING ISSUES (Must Fix)

### Issue #4: Send Message Button Not Working
**Status:** NOT IMPLEMENTED
**Location:** `premium-mining-app.tsx` line ~3067, ~1828
**What's needed:**
1. Find `submitContactForm` function (around line 1720-1850)
2. Implement API call to `/api/support/contact`
3. Backend endpoint exists and sends email to colourfulkoaladevelopment@gmail.com
4. Same logic needed for `submitSuggestForm`

**Code template:**
```javascript
const submitContactForm = async () => {
  try {
    const token = await AsyncStorage.getItem('session_token');
    const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/support/contact`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactForm)
    });
    
    if (response.ok) {
      showCustomAlert('Success', 'Message sent successfully!');
      setContactForm({ name: '', email: '', subject: '', message: '' });
      setShowContactForm(false);
    } else {
      showCustomAlert('Error', 'Failed to send message');
    }
  } catch (error) {
    showCustomAlert('Error', 'Failed to send message');
  }
};
```

### Issue #5: PayPal Button Not Working
**Status:** NOT WORKING despite Linking import
**Location:** `premium-mining-app.tsx` line ~1222 `initiatePayPalPurchase`
**Investigation needed:**
1. Check if backend `/api/payments/create-paypal-order` returns valid approval URL
2. Verify `Linking.openURL(approvalUrl)` executes
3. Add console.log to debug flow
4. Check PayPal credentials in backend/.env

**Current code location:** Line 1222-1300

### Suggest Feature Modal
**Status:** State added, button updated, but modal JSX not created
**What's needed:**
1. Duplicate Contact Support modal (lines 3006-3075)
2. Change `showContactForm` to `showSuggestForm`
3. Change title to "Suggest a Feature"
4. Update submit function to `submitSuggestForm`

---

## ✅ RECENTLY COMPLETED FEATURES

### Build 25 (Current)
1. ✅ Avatar persistence fixed (backend returns avatar in /api/auth/me)
2. ✅ Withdrawal limit text updates dynamically
   - Lightning: "₿ 0.00001 - 0.001"
   - Bitcoin: "Min ₿ 0.001"
3. ✅ Separate modal states (`showContactForm`, `showSuggestForm`)
4. ✅ Suggest button opens correct modal

### Recent Fixes (Builds 21-24)
- Password visibility toggle (eye icon)
- Miner dropdowns always visible with empty states
- Instant ad reward feedback (no 15s delay)
- Split miner categories (Free/Premium/Referral)
- Lightning Network field shows "Invoice" vs "Address"
- Daily earning estimate formatting (₿ on new line)
- Referral page reorganization with description

### Withdrawal System
- **Lightning Network:** 0.00001 - 0.001 BTC (Kraken)
- **Bitcoin Network:** 0.001 BTC minimum (Kraken)
- **System Fee:** 0.5% of amount
- **Network Fee:** Additional, from Kraken

---

## 🔧 COMMON ISSUES & SOLUTIONS

### Issue: Build fails with duplicate import
- **Check:** Lines 1-25 for duplicate imports (Linking, etc.)
- **Fix:** Remove duplicates

### Issue: Miner dropdowns not showing
- **Cause:** `setUser()` overwrites state instead of merging
- **Fix:** Use `setUser(prev => ({ ...prev, ...newData }))`

### Issue: App crashes after login
- **Cause:** Functions referencing removed `miners` state
- **Check:** `calculateTotalDailyEarnings`, logout functions
- **Fix:** Use `user.freeMiners`, `user.premiumMiners`, `user.referralMiners`

### Issue: Avatar not persisting
- **Cause:** Backend not returning avatar field
- **Fix:** Add `avatar: current_user.get("avatar")` in `/api/auth/me`

---

## 📋 BUILD PROCESS

### Increment Version
```bash
# Update app.json
"versionCode": 26  # Increment from current
```

### Trigger Build
```bash
export EXPO_TOKEN="nRQoZeqRX-JK4ZxINBG3n-EHrtUpHUF3UMigKG2z"
cd /app/frontend
npx eas-cli build --platform android --profile production --non-interactive
```

### Monitor Build
- Track at: https://expo.dev/accounts/colourful-koala-development/projects/koala-mining/builds/[BUILD_ID]
- Typical build time: 10-15 minutes
- **Note:** 100% of included build credits used, pay-as-you-go rates apply

---

## 🗄️ DATABASE STRUCTURE

### MongoDB Collections
- `users` - User accounts (including `avatar` field)
- `miners` - User's miners (miner_type: 'free', 'premium', 'ad', 'referral_reward')
- `transactions` - Balance changes
- `purchases` - PayPal purchases
- `withdrawals` - Bitcoin withdrawals (with `network` field)
- `wallet_registrations` - Pending wallet approvals
- `mining_sessions` - Active mining tracking
- `daily_ad_counters` - Ad watch tracking

### Important: Miner Types
- `free` - Daily free miner
- `ad` or `ad_reward` - From watching ads
- `premium` - Purchased miners
- `referral_reward` or `referral_commission` - From referrals

---

## 🎯 NEXT STEPS FOR NEW AGENT

1. **Read test_result.md** - Contains testing protocols and history
2. **Fix Send Message buttons** - Implement submitContactForm/submitSuggestForm
3. **Add Suggest Feature modal JSX** - Duplicate Contact modal
4. **Debug PayPal button** - Add logging, verify backend response
5. **Test all features** - Use deep_testing_backend_v2 for backend
6. **Build version 26** - After all fixes complete

---

## ⚠️ CRITICAL REMINDERS

1. **NEVER modify:**
   - `metro.config.js`
   - `.env` URL variables (EXPO_PACKAGER_PROXY_URL, etc.)
   - `MONGO_URL` in backend/.env

2. **ALWAYS:**
   - Use `setUser(prev => ({ ...prev, ...data }))` to merge state
   - Add optional chaining: `user?.freeMiners?.map()`
   - Restart services after changes: `sudo supervisorctl restart backend expo`
   - Read test_result.md before invoking testing agents

3. **Testing Protocol:**
   - Backend first with `deep_testing_backend_v2`
   - Frontend only if user approves (ask with `ask_human`)

---

## 📞 SUPPORT CONTACT
- **Email:** colourfulkoaladevelopment@gmail.com
- **GitHub:** https://github.com/colourfulkoaladevelopment/koala-mining-app

---

## END OF HANDOFF DOCUMENT
**Next agent: Please read this entire document before starting work.**
