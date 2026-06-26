# Test Credentials — Koala Mining

## Admin account (temporary password set for testing — user can change via Forgot Password)
- Email: colourfulkoaladevelopment@gmail.com
- Password: KoalaAdmin#2026
- Notes: Admin is determined by this email. Logging in shows the Admin Panel (Wallet Approvals + User Management).

## Test regular user
- Email: koalatest@example.com
- Password: TestUser#2026

## Backend
- Base URL (frontend uses): process.env.EXPO_PUBLIC_BACKEND_URL
- All API routes prefixed with /api
- DB: MongoDB local, db name `bitcoin_mining_db`. User `_id` is a UUID string (NOT ObjectId).

## Admin endpoints to test
- GET  /api/admin/users
- POST /api/admin/give-btc/{user_id}   body: { amount }
- POST /api/admin/reset-user/{user_id}
- DELETE /api/admin/delete-user/{user_id}
- GET  /api/admin/pending-wallets
- POST /api/admin/approve-wallet/{user_id}
- GET  /api/activity/recent

## Bitcoin Withdrawal testing (Kraken)
- Withdrawal provider = Kraken (BITCOIN_WALLET_TYPE=kraken).
- Min withdrawal = 0.0002 BTC. Fees: network fee (variable) + withdrawal fee 0.00002 (Kraken) + service fee 0.00001 (Colourful Koala).
- To test the withdraw path: register user, then either use admin (KoalaAdmin#2026) to approve wallet + give-btc, OR set directly in Mongo:
  db.users.update_one({"_id": uid}, {"$set": {"btc_wallet_address": "<unique bc1...>", "wallet_status": "connected", "bitcoin_balance": 0.005}})
- Live on-chain send currently returns Kraken `EGeneral:Permission denied` because the configured KRAKEN_API_KEY lacks Funding/Withdraw permissions. EXPECTED until user rotates the key. Backend now surfaces this as a clear 400 (not a generic 5xx).

