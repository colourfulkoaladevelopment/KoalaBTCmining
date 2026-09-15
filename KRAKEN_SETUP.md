# Kraken API Setup for Bitcoin Withdrawals

## What You Need to Provide

To enable real Bitcoin withdrawals through Kraken, you need to create API keys with specific permissions:

### Step 1: Generate Kraken API Keys

1. Log in to your Kraken account at https://www.kraken.com
2. Go to **Settings** → **API**
3. Click **Generate New Key**
4. Set the following permissions:
   - **Query Funds** (required to check balance)
   - **Withdraw Funds** (required to send BTC)
   - **Query Open Orders & Trades** (optional, for verification)
5. Set **Key Description**: "Koala Mining Withdrawals"
6. Click **Generate Key**

### Step 2: Save Your Credentials

You will receive two values:
1. **API Key** (public) - Example: `abc123xyz...`
2. **API Secret** (private) - Example: `def456uvw...`

**IMPORTANT**: Save the API Secret immediately — it's only shown once. In the backend `.env` file, this must be set as `KRAKEN_API_SECRET` (not `KRAKEN_PRIVATE_KEY`).

### Step 3: Configure Backend Environment

Add these to `backend/.env`:

```env
BITCOIN_WALLET_TYPE=kraken
KRAKEN_API_KEY=your_api_key_here
KRAKEN_API_SECRET=your_api_secret_here
KRAKEN_BASE_URL=https://api.kraken.com
FEE_COLLECTION_ADDRESS=your_btc_fee_collection_address
```

### Step 4: Whitelist Withdrawal Addresses (Optional but Recommended)

For security, you can whitelist specific Bitcoin addresses:
1. Go to **Settings** → **API** → Edit your API key
2. Add **Withdrawal Address Whitelist**
3. This ensures withdrawals can only go to pre-approved addresses

---

## How It Works

Once configured, the app will:

1. **User requests withdrawal** → Must watch a mandatory interstitial ad first
2. **Validate withdrawal** → Check minimum amount (0.000218 BTC)
3. **Calculate fees** → 0.5% platform fee + Kraken network fee (0.000015 BTC)
4. **Submit to Kraken API** → Process Bitcoin withdrawal via HMAC-SHA512 signed request
5. **Track transaction** → Store withdrawal ID and status in database
6. **Update user balance** → Deduct withdrawn amount + fees

---

## Kraken API Limits

- **Tier 2 (Intermediate)**: Up to $500,000/day withdrawal limit
- **Tier 3 (Pro)**: Higher limits with verification
- **Network Fees**: Bitcoin ~0.00005 BTC (paid by Kraken)
- **Processing Time**: 10-60 minutes typically

---

## Security Notes

- API keys are stored in `backend/.env` (never in code or frontend)
- Keys are never exposed to frontend/users
- Withdrawal requests require user authentication (JWT)
- All transactions are logged for audit
- Minimum withdrawal (0.000218 BTC) protects against dust attacks
- API requests are signed with HMAC-SHA512 using the API secret
- Password hashing uses bcrypt (via passlib) for all user accounts

---

## Testing

Before going live, test with a small withdrawal:
- Amount: 0.000218 BTC (minimum)
- To: Your test Bitcoin address
- Expected cost: ~$0.50 USD

```bash
# Run Kraken-specific tests
cd backend
python -m pytest tests/test_iteration_11_btc_withdrawal_fees.py -v
python -m pytest tests/test_iteration_12_btc_withdrawal_clear_error.py -v
```

---

## What Happens Next

1. You provide API keys (API Key + API Secret)
2. Add them to `backend/.env` as `KRAKEN_API_KEY` and `KRAKEN_API_SECRET`
3. Set `BITCOIN_WALLET_TYPE=kraken` in `.env`
4. Rebuild the backend
5. Test with minimum withdrawal
6. If successful, users can withdraw

---

## Questions?

- **Is it safe?** Yes, API keys are stored server-side only in `.env`
- **Can I revoke access?** Yes, delete the API key anytime from Kraken dashboard
- **What if something goes wrong?** You can disable the API key immediately
- **Do I need to fund it?** No, the app uses user balances from mining earnings

---

## Backend Scheduler Note

Mining earnings are credited every **10 minutes** via APScheduler. The per-tick rate is `daily_reward / 144` (144 ticks per day), so the daily total matches each miner's advertised daily reward exactly. This interval was chosen to keep the database clean — the previous 5-second interval was flooding the transactions collection with excessive records.
