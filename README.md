# Koala Mining App

A premium Bitcoin mining simulator with real Bitcoin withdrawal rewards, built with Expo React Native (frontend) and FastAPI Python (backend).

> Koala Mining App is a premium mining simulator that offers real Bitcoin withdrawal rewards subject to administrative verification and terms of service.

## Architecture

### Frontend (Expo React Native)

```
frontend/
├── app/
│   ├── _layout.tsx          # Root layout (auth gate)
│   ├── auth.tsx             # Email/password login & registration
│   ├── index.tsx            # Entry redirect
│   ├── admin.tsx            # Admin panel
│   ├── reset-password.tsx   # Password reset screen
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab navigator
│   │   ├── dashboard.tsx     # Mining dashboard, wallet, ads, withdrawals
│   │   ├── store.tsx         # Premium miner store (PayPal checkout)
│   │   ├── invites.tsx      # Referral system
│   │   └── profile.tsx       # User profile, FAQ, support, settings
│   └── paypal/
│       ├── success.tsx       # PayPal return deep-link (payment confirmed)
│       └── cancel.tsx        # PayPal cancel deep-link
├── utils/
│   ├── adMobAds.ts           # Google Mobile Ads SDK (rewarded + interstitial)
│   ├── adMobAds.web.ts       # Web no-op stub
│   └── api.ts                # Authenticated fetch wrapper
├── plugins/
│   ├── withAdMobFix.js        # AdMob native config plugin
│   └── withMetaAudienceNetwork.js  # Meta Audience Network mediation
├── app.json                  # Expo config (AdMob, deep links, build props)
├── eas.json                  # EAS build profiles (AAB for production)
└── package.json
```

### Backend (FastAPI + MongoDB)

```
backend/
├── server.py                 # Main FastAPI application (~4700 lines)
├── requirements.txt          # Python dependencies
└── tests/                     # Pytest test suite (iterations 4-12)
```

The backend runs on port 8001 and provides:
- JWT authentication (email/password, bcrypt hashing)
- Mining simulation with 10-minute earnings ticks
- PayPal order creation, approval redirect, and capture
- Kraken Bitcoin withdrawals with admin verification
- Google AdMob rewarded ad credit system
- Admin panel (stats, wallet approval, user management)
- Referral system with bonus miners
- Wallet registration and approval workflow

## Environment Variables

### Backend (`backend/.env`)

```env
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=koala_mining

# Security
SECRET_KEY=your_jwt_secret_key
ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:8081

# Bitcoin Withdrawals (Kraken)
BITCOIN_WALLET_TYPE=kraken
KRAKEN_API_KEY=your_kraken_api_key
KRAKEN_API_SECRET=your_kraken_api_secret
KRAKEN_BASE_URL=https://api.kraken.com
FEE_COLLECTION_ADDRESS=your_btc_fee_address

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox

# Email (Gmail SMTP for password resets)
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password

# Admin
ADMIN_EMAIL=admin@koalamining.com
```

### Frontend (`frontend/.env` or EAS build env)

```env
EXPO_PUBLIC_BACKEND_URL=https://your-backend-url
EXPO_PUBLIC_ADMOB_ANDROID_APP_LAUNCH=ca-app-pub-xxx/xxx
EXPO_PUBLIC_ADMOB_ANDROID_MINER_ACTIVATION=ca-app-pub-xxx/xxx
EXPO_PUBLIC_ADMOB_ANDROID_WITHDRAWAL=ca-app-pub-xxx/xxx
EXPO_PUBLIC_ADMOB_IOS_APP_LAUNCH=ca-app-pub-xxx/xxx
EXPO_PUBLIC_ADMOB_IOS_MINER_ACTIVATION=ca-app-pub-xxx/xxx
EXPO_PUBLIC_ADMOB_IOS_WITHDRAWAL=ca-app-pub-xxx/xxx
```

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- Yarn
- MongoDB 5.0+ (or MongoDB Atlas connection string)

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Fill in your credentials
python server.py      # Runs on http://0.0.0.0:8001
```

### Frontend

```bash
cd frontend
yarn install
npx expo start        # Metro bundler
```

### Running Tests

```bash
# Backend tests
cd backend
python -m pytest tests/ -v

# Or run specific iteration tests
python -m pytest tests/test_iteration_12_btc_withdrawal_clear_error.py -v

# Full regression smoke
python -m pytest tests/test_regression_smoke_iter10.py -v
```

## Production Build

### Android (Google Play Store — AAB)

```bash
cd frontend
eas build --platform android --profile production
```

The production build profile in `eas.json` is configured to output an `.aab` (Android App Bundle) for Google Play Store distribution.

### iOS

```bash
cd frontend
eas build --platform ios --profile production
```

## Key Technical Details

### Background Scheduler
Mining earnings and expired-miner checks run every **10 minutes** via APScheduler. The per-tick earnings rate is calibrated so the daily total matches the advertised daily reward for each miner tier.

### Authentication
- Email/password only (bcrypt hashing, JWT tokens stored in AsyncStorage)
- No social login — the fake Google OAuth bypass has been removed
- Password reset via Gmail SMTP

### AdMob Integration
- Rewarded video ads for mining boosts (real Google Mobile Ads SDK)
- Interstitial ads for withdrawals
- 30-second load timeout with error listeners — no infinite hangs
- Meta Audience Network mediation configured via AdMob waterfall

### PayPal Flow
1. Frontend calls `/api/payments/create-paypal-order` to create an order
2. Backend returns PayPal approval URL
3. Frontend opens URL in device browser via `Linking.openURL`
4. User approves payment on PayPal
5. PayPal redirects back via deep-link (`koala-mining://paypal/success`)
6. `AppState` listener detects app regaining focus and checks pending payment
7. Backend captures the order and activates the miner

### Kraken Withdrawals
- Minimum withdrawal: 0.000218 BTC
- Network fee: 0.000015 BTC
- Platform fee: 0.5%
- Requires `KRAKEN_API_SECRET` (not `KRAKEN_PRIVATE_KEY`)
- HMAC-SHA512 API signature authentication

## Documentation
- [Deployment Guide](DEPLOYMENT_GUIDE.md) — Full setup and deployment instructions
- [Kraken Setup](KRAKEN_SETUP.md) — Kraken API configuration for Bitcoin withdrawals
- [Meta Ads Runbook](MetaAds_Setup_Runbook.md) — Meta Audience Network mediation setup

## Support
Contact: colourfulkoaladevelopment@gmail.com
