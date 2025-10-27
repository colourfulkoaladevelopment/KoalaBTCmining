# Koala Mining App - Complete Deployment Guide

## Project Structure
```
koala-mining-app/
├── backend/          # FastAPI Python backend
│   ├── server.py    # Main application
│   ├── requirements.txt
│   └── .env         # Environment variables
├── frontend/        # Expo React Native app
│   ├── app/         # Routes and screens
│   ├── assets/      # Images and resources
│   ├── utils/       # Utility functions
│   ├── app.json     # Expo configuration
│   ├── package.json # Dependencies
│   └── .env         # Frontend environment
└── test_result.md   # Testing documentation
```

## Latest Fixes Applied (October 27, 2025)

### 1. Daily Miner Button Alignment Fix
- Fixed button layout for large screens (S24+)
- Added `justifyContent: 'space-between'` and proper margins

### 2. Kraken Withdrawal Integration Fix ✅
**Root Cause**: Backend was looking for `KRAKEN_API_SECRET` but .env had `KRAKEN_PRIVATE_KEY`
**Result**: All withdrawals were falling back to demo mode

**Fixes Applied**:
- Renamed KRAKEN_PRIVATE_KEY → KRAKEN_API_SECRET in backend/.env
- Updated kraken_send_bitcoin() to use newer API format (method_id + address)
- Added automatic withdrawal method fetching from Kraken API
- Implemented Kraken minimum (0.000218 BTC) and network fee validation (0.000015 BTC)

**Status**: Kraken integration now active and verified (0.00139869 BTC in account)

## Backend Setup

### Requirements
- Python 3.11+
- MongoDB 5.0+

### Installation
```bash
cd backend
pip install -r requirements.txt
```

### Environment Variables (.env)
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"

# Bitcoin Withdrawal - Kraken Integration (ACTIVE)
BITCOIN_WALLET_TYPE=kraken
KRAKEN_API_KEY=<your_api_key>
KRAKEN_API_SECRET=<your_api_secret>
KRAKEN_BASE_URL=https://api.kraken.com
FEE_COLLECTION_ADDRESS=<your_btc_address>

# PayPal Integration
PAYPAL_CLIENT_ID=<your_client_id>
PAYPAL_CLIENT_SECRET=<your_client_secret>
PAYPAL_MODE=live

# Email (Gmail SMTP)
GMAIL_USER=colourfulkoaladevelopment@gmail.com
GMAIL_APP_PASSWORD=<your_app_password>

# Facebook Ads
FACEBOOK_APP_ID=<your_app_id>
FACEBOOK_PLACEMENT_ID_LAUNCH=<placement_id>
FACEBOOK_PLACEMENT_ID_MINER=<placement_id>
FACEBOOK_PLACEMENT_ID_WITHDRAWAL=<placement_id>
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

### Environment Variables (.env)
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

### Run Frontend
```bash
cd frontend
npx expo start
# or
yarn start
```

### Build for Production
```bash
# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

## Key Features
- ✅ JWT Authentication (Google + Email)
- ✅ Bitcoin Mining Simulation
- ✅ Kraken BTC Withdrawals (LIVE)
- ✅ PayPal Miner Purchases
- ✅ Facebook Ads Integration
- ✅ Admin Panel
- ✅ Referral System
- ✅ Password Reset (Email)
- ✅ Wallet Registration & Approval

## API Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/wallet/balance
- POST /api/withdraw/bitcoin (Kraken)
- GET /api/store/miners
- POST /api/purchase/miner
- GET /api/admin/stats
- POST /api/admin/approve-wallet
- POST /api/admin/delete-user
- POST /api/admin/give-btc

## Database Collections
- users
- miners
- transactions
- purchases
- withdrawals
- mining_sessions
- support_tickets
- reset_tokens
- wallet_registrations

## Important Notes

### Kraken Withdrawal
- Minimum: 0.000218 BTC
- Network Fee: 0.000015 BTC
- System Fee: 0.5%
- Requires KRAKEN_API_SECRET (not KRAKEN_PRIVATE_KEY)

### Security
- Admin email: colourfulkoaladevelopment@gmail.com
- JWT tokens stored in AsyncStorage
- Bcrypt password hashing
- HMAC-SHA512 for Kraken API signatures

## Testing
See test_result.md for complete testing history and protocols.

## Support
For issues or questions, contact: colourfulkoaladevelopment@gmail.com
