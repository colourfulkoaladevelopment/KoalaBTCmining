# Kraken API Setup for Bitcoin Withdrawals

## What You Need to Provide

To enable real Bitcoin withdrawals through Kraken, you need to create API keys with specific permissions:

### Step 1: Generate Kraken API Keys

1. Log in to your Kraken account at https://www.kraken.com
2. Go to **Settings** → **API**
3. Click **Generate New Key**
4. Set the following permissions:
   - ✅ **Query Funds** (required to check balance)
   - ✅ **Withdraw Funds** (required to send BTC)
   - ✅ **Query Open Orders & Trades** (optional, for verification)
5. Set **Key Description**: "Koala Mining Withdrawals"
6. Click **Generate Key**

### Step 2: Save Your Credentials

You will receive two values:
1. **API Key** (public) - Example: `abc123xyz...`
2. **Private Key** (secret) - Example: `def456uvw...`

⚠️ **IMPORTANT**: Save the Private Key immediately - it's only shown once!

### Step 3: Provide to Developer

Send me these values securely:

```
KRAKEN_API_KEY=your_api_key_here
KRAKEN_PRIVATE_KEY=your_private_key_here
```

### Step 4: Whitelist Withdrawal Addresses (Optional but Recommended)

For security, you can whitelist specific Bitcoin addresses:
1. Go to **Settings** → **API** → Edit your API key
2. Add **Withdrawal Address Whitelist**
3. This ensures withdrawals can only go to pre-approved addresses

---

## How It Works

Once configured, the app will:

1. **User requests withdrawal** → Watch mandatory ad
2. **Validate withdrawal** → Check minimum amount (0.00001 BTC)
3. **Calculate fees** → 0.5% platform fee + Kraken network fee
4. **Submit to Kraken API** → Process Bitcoin withdrawal
5. **Track transaction** → Store withdrawal ID and status
6. **Update user balance** → Deduct withdrawn amount

---

## Kraken API Limits

- **Tier 2 (Intermediate)**: Up to $500,000/day withdrawal limit
- **Tier 3 (Pro)**: Higher limits with verification
- **Network Fees**: Bitcoin ~0.00005 BTC (paid by Kraken)
- **Processing Time**: 10-60 minutes typically

---

## Security Notes

✅ API keys are stored in `.env` file (not in code)  
✅ Keys are never exposed to frontend/users  
✅ Withdrawal requests require user authentication  
✅ All transactions are logged for audit  
✅ Minimum withdrawal protects against dust attacks  

---

## Testing

Before going live, I'll test with a small withdrawal:
- Amount: 0.00001 BTC (minimum)
- To: Your test Bitcoin address
- Expected cost: ~$0.50 USD

---

## What Happens Next

1. You provide API keys
2. I update `.env` with credentials
3. I change `BITCOIN_WALLET_TYPE=kraken` in `.env`
4. I trigger new build with Kraken enabled
5. We test with minimum withdrawal
6. If successful, remove "Withdrawals Disabled" popup
7. Users can withdraw!

---

## Questions?

- **Is it safe?** Yes, API keys are encrypted and stored server-side only
- **Can I revoke access?** Yes, delete the API key anytime from Kraken dashboard
- **What if something goes wrong?** You can disable the API key immediately
- **Do I need to fund it?** No, the app uses user balances from mining earnings

