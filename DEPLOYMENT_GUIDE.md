# Koala Mining App - Complete Deployment Guide

## Project Structure
```
koala-mining-app/
├── backend/              # FastAPI Python backend
│   ├── server.py        # Main application (~4700 lines)
│   ├── requirements.txt
│   ├── tests/           # Pytest suite (iterations 4-12)
│   └── .env             # Environment variables
├── frontend/            # Expo React Native app
│   ├── app/             # Routes and screens
│   │   ├── (tabs)/      # Tabbed screens (dashboard, store, invites, profile)
│   │   └── paypal/      # PayPal deep-link return routes
│   ├── utils/           # AdMob SDK, API wrapper
│   ├── plugins/         # AdMob + Meta Audience Network config
│   ├── app.json         # Expo configuration
│   ├── eas.json         # EAS build profiles (AAB for production)
│   └── package.json
├── capture_pending_payments.py  # Manual PayPal capture utility
└── test_reports/        # Pytest results archive
```

## Backend Setup

### Requirements
- Python 3.11+
- MongoDB 5.0+ (or MongoDB Atlas)

### Installation
```bash
cd backend
pip install -r requirements.txt
```

### Environment Variables (.env)
```env
# Database
MONGO_URL="mongodb://localhost:27017"
DB_NAME="koala_mining"

# Security
SECRET_KEY="your_jwt_secret"
ALLOWED_ORIGINS="https://yourdomain.com,http://localhost:8081"

# Bitcoin Withdrawal - Kraken Integration
BITCOIN_WALLET_TYPE=kraken
KRAKEN_API_KEY=<your_api_key>
KRAKEN_API_SECRET=<your_api_secret>
KRAKEN_BASE_URL=https://api.kraken.com
FEE_COLLECTION_ADDRESS=<your_btc_address>

# PayPal Integration
PAYPAL_CLIENT_ID=<your_client_id>
PAYPAL_CLIENT_SECRET=<your_client_secret>
PAYPAL_MODE=live

# Email (Gmail SMTP for password resets)
GMAIL_USER=colourfulkoaladevelopment@gmail.com
GMAIL_APP_PASSWORD=<your_app_password>

# Admin
ADMIN_EMAIL=colourfulkoaladevelopment@gmail.com
```

### Run Backend
```bash
cd backend
python server.py
# Runs on http://0.0.0.0:8001
```

## Frontend Setup

### Requirements
- Node.js 18+
- Yarn
- Expo CLI

### Installation
```bash
cd frontend
yarn install
```

### Environment Variables
Create `frontend/.env`:
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PUBLIC_ADMOB_ANDROID_APP_LAUNCH=ca-app-pub-xxx/xxx
EXPO_PUBLIC_ADMOB_ANDROID_MINER_ACTIVATION=ca-app-pub-xxx/xxx
EXPO_PUBLIC_ADMOB_ANDROID_WITHDRAWAL=ca-app-pub-xxx/xxx
EXPO_PUBLIC_ADMOB_IOS_APP_LAUNCH=ca-app-pub-xxx/xxx
EXPO_PUBLIC_ADMOB_IOS_MINER_ACTIVATION=ca-app-pub-xxx/xxx
EXPO_PUBLIC_ADMOB_IOS_WITHDRAWAL=ca-app-pub-xxx/xxx
```

### Run Frontend
```bash
cd frontend
npx expo start
```

### Build for Production

#### Android (AAB for Google Play Store)
```bash
eas build --platform android --profile production
```
The production profile in `eas.json` outputs an `.aab` (Android App Bundle) for Play Store distribution.

#### iOS
```bash
eas build --platform ios --profile production
```

## Background Scheduler

The backend uses APScheduler with two jobs that run every **10 minutes**:

| Job | Purpose | Interval |
|-----|---------|----------|
| `check_expired_miners` | Deactivates miners past their expiry | 10 minutes |
| `process_mining_earnings` | Credits Bitcoin earnings to active miners | 10 minutes |

The per-tick earnings rate is calibrated as `daily_reward / 144` (144 ticks per day at 10-minute intervals), so the total daily earning per miner matches the advertised daily reward exactly.

## Authentication

- **Method**: Email/password only
- **Password hashing**: bcrypt (via passlib)
- **Tokens**: JWT (HS256), stored in AsyncStorage on the client
- **No social login**: The fake Google OAuth bypass has been removed. To add real Google OAuth, you would need to configure `expo-auth-session` with Google OAuth client IDs.

## Key Features
- Email/password authentication with bcrypt hashing
- Bitcoin mining simulation with 10-minute earnings ticks
- Kraken BTC withdrawals (live, admin-verified)
- PayPal miner purchases (create order → browser approval → deep-link return → capture)
- Google AdMob rewarded + interstitial ads (real SDK, no simulation timers)
- Meta Audience Network mediation via AdMob waterfall
- Admin panel (stats, wallet approval, user management, BTC grants)
- Referral system with bonus miners
- Password reset via Gmail SMTP
- Wallet registration and approval workflow

## API Endpoints

### Authentication
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Sign in
- `POST /api/auth/logout` — Sign out
- `GET /api/auth/me` — Current user info

### Wallet & Mining
- `GET /api/wallet/balance` — Wallet overview
- `GET /api/miners/list` — User's miners
- `POST /api/miners/activate-free` — Activate free daily miner
- `POST /api/miners/watch-ad` — Credit ad reward
- `GET /api/wallet/status` — Wallet connection status
- `POST /api/withdraw/bitcoin` — Request Kraken withdrawal

### Store & Payments
- `GET /api/store/miners` — Available premium miners
- `POST /api/payments/create-paypal-order` — Create PayPal order
- `GET /api/payments/paypal-return` — PayPal approval redirect
- `GET /api/payments/paypal-cancel` — PayPal cancel redirect

### Ads
- `POST /api/ads/daily-stats` — Ad watching limits

### Admin
- `GET /api/admin/stats` — Platform statistics
- `POST /api/admin/approve-wallet` — Approve wallet address
- `POST /api/admin/delete-user` — Delete user
- `POST /api/admin/give-btc` — Grant BTC to user

## Database Collections
- `users` — User accounts with balances and referral codes
- `miners` — Active and inactive miner instances
- `transactions` — Earnings, purchases, and withdrawals
- `paypal_orders` — PayPal order tracking
- `withdrawals` — Withdrawal request history
- `user_sessions` — JWT session tokens
- `wallet_registrations` — Wallet address approval queue
- `support_tickets` — User support requests
- `reset_tokens` — Password reset tokens
- `devices` — Push notification device registration

## Security
- bcrypt password hashing (via passlib)
- JWT tokens (HS256) with 7-day expiry
- HMAC-SHA512 signatures for Kraken API
- `ALLOWED_ORIGINS` CORS whitelist
- Wallet address changes require password confirmation
- Admin endpoints require admin email verification

## Testing

```bash
# Run all backend tests
cd backend
python -m pytest tests/ -v

# Run specific iteration tests
python -m pytest tests/test_iteration_12_btc_withdrawal_clear_error.py -v

# Full regression smoke test
python -m pytest tests/test_regression_smoke_iter10.py -v

# PayPal flow tests
python -m pytest tests/test_paypal_flow.py -v
```

## Support
For issues or questions, contact: colourfulkoaladevelopment@gmail.com
