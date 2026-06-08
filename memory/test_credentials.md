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
