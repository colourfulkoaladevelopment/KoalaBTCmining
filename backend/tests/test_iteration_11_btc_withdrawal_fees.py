"""
Iteration 11 backend tests — Bitcoin withdrawal fee structure + Kraken integration
Coverage:
  * GET /api/bitcoin/network-fee returns network_fee_btc
  * POST /api/withdraw/bitcoin:
      - Auth required (401/403)
      - Min 0.0002 BTC validation message
      - Empty address rejected, amount <= 0 rejected
      - Insufficient balance returns 400 itemizing fees (network + 0.00002 + 0.00001)
      - With sufficient balance and connected wallet, fee math is itemized in error
        AND the Kraken on-chain send returns a CLEAR "not whitelisted" error (not generic 500)
        AND the user's balance is fully restored on failure.
"""

import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if BASE_URL:
    BASE_URL = BASE_URL.rstrip("/")
else:
    # Fall back to value in frontend/.env (read-only convenience for in-cluster run)
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except Exception:
        BASE_URL = None
assert BASE_URL, "BASE_URL must be set from EXPO_PUBLIC_BACKEND_URL"

ADMIN_EMAIL = "colourfulkoaladevelopment@gmail.com"
ADMIN_PASSWORD = "KoalaAdmin#2026"

# A valid-format but very likely-NOT-whitelisted bech32 address.
TEST_BTC_ADDRESS = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token in admin login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def new_user(s):
    """Register a fresh test user, return (email, password, token, user_id)."""
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_btcw_{suffix}@example.com"
    password = "TestPass#2026"
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"email": email, "password": password, "name": "Btc Tester"})
    assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("access_token") or body.get("token")
    user = body.get("user") or {}
    user_id = user.get("id") or user.get("_id")
    if not token or not user_id:
        # Fallback: login + /api/auth/me
        rl = s.post(f"{BASE_URL}/api/auth/login",
                    json={"email": email, "password": password})
        assert rl.status_code == 200, f"Login failed: {rl.text}"
        token = rl.json().get("access_token") or rl.json().get("token")
        rme = s.get(f"{BASE_URL}/api/auth/me",
                    headers={"Authorization": f"Bearer {token}"})
        assert rme.status_code == 200, rme.text
        user_id = rme.json().get("id") or rme.json().get("_id")
    assert token and user_id
    return {"email": email, "password": password, "token": token, "id": user_id}


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- /api/bitcoin/network-fee ----------
def test_network_fee_endpoint(s):
    r = s.get(f"{BASE_URL}/api/bitcoin/network-fee", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "network_fee_btc" in body, f"missing network_fee_btc: {body}"
    fee = float(body["network_fee_btc"])
    assert fee > 0, f"network_fee_btc should be positive, got {fee}"


# ---------- auth gating ----------
def test_withdraw_requires_auth(s):
    r = s.post(f"{BASE_URL}/api/withdraw/bitcoin",
               json={"address": TEST_BTC_ADDRESS, "amount": 0.001, "network": "bitcoin"})
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text}"


# ---------- validation paths (no balance / no wallet needed) ----------
class TestValidation:

    def test_amount_zero_rejected(self, s, new_user):
        # No wallet yet -> bitcoin network path will 403 (wallet not connected).
        # So use lightning network where amount<=0 is hit before wallet check.
        r = s.post(f"{BASE_URL}/api/withdraw/bitcoin",
                   headers=_auth(new_user["token"]),
                   json={"address": "lnbc100n1...", "amount": 0, "network": "lightning"})
        assert r.status_code == 400, r.text
        assert "greater than 0" in r.text.lower() or "amount" in r.text.lower()

    def test_bitcoin_min_message(self, s, admin_token):
        """Admin user has wallet_status=connected after iteration_10 - good fit.
        Send amount < 0.0002 BTC on bitcoin network and expect the explicit message."""
        r = s.post(f"{BASE_URL}/api/withdraw/bitcoin",
                   headers=_auth(admin_token),
                   json={"address": TEST_BTC_ADDRESS, "amount": 0.0001, "network": "bitcoin"})
        # Could be 400 (min) or 403 (wallet not connected on admin). Accept both
        # but only mark pass if min message is included OR wallet-state msg shows.
        assert r.status_code in (400, 403), r.text
        if r.status_code == 400:
            assert "0.0002" in r.text, f"min message missing: {r.text}"
            assert "Bitcoin network minimum" in r.text or "minimum" in r.text.lower()

    def test_bitcoin_min_message_with_fresh_user(self, s, new_user, admin_token):
        """Set up fresh user: register wallet, admin-approve, then submit < 0.0002."""
        # Register wallet
        r = s.post(f"{BASE_URL}/api/wallet/register",
                   headers=_auth(new_user["token"]),
                   json={"btc_address": TEST_BTC_ADDRESS})
        assert r.status_code == 200, r.text

        # Admin approve wallet
        r = s.post(f"{BASE_URL}/api/admin/approve-wallet/{new_user['id']}",
                   headers=_auth(admin_token), json={})
        # Already-approved may modify_count=0 -> 404; accept either path
        assert r.status_code in (200, 404), r.text

        # Now request a sub-min withdrawal
        r = s.post(f"{BASE_URL}/api/withdraw/bitcoin",
                   headers=_auth(new_user["token"]),
                   json={"address": TEST_BTC_ADDRESS, "amount": 0.0001, "network": "bitcoin"})
        assert r.status_code == 400, r.text
        assert "0.0002" in r.text, f"expected '0.0002' in detail, got {r.text}"
        assert "Bitcoin network minimum" in r.text, f"expected clear message, got {r.text}"

    def test_amount_negative_rejected(self, s, new_user):
        # User has wallet connected at this point thanks to prior test. Amount<=0 check runs after wallet check.
        r = s.post(f"{BASE_URL}/api/withdraw/bitcoin",
                   headers=_auth(new_user["token"]),
                   json={"address": TEST_BTC_ADDRESS, "amount": -1, "network": "bitcoin"})
        assert r.status_code == 400, r.text
        # Either "greater than 0" or invalid amount
        assert ("greater than 0" in r.text.lower()
                or "invalid withdrawal amount" in r.text.lower()), r.text


# ---------- insufficient balance itemization ----------
class TestInsufficientBalance:

    def test_insufficient_balance_itemized(self, s, new_user):
        # User wallet is connected; balance is 0 by default for a brand-new account.
        # Request a valid amount (>= 0.0002 BTC) -> expect 400 with itemized fees.
        r = s.post(f"{BASE_URL}/api/withdraw/bitcoin",
                   headers=_auth(new_user["token"]),
                   json={"address": TEST_BTC_ADDRESS, "amount": 0.0005, "network": "bitcoin"})
        assert r.status_code == 400, f"expected 400 insufficient balance, got {r.status_code}: {r.text}"
        text = r.text
        # All three fee components and the amount itemization should be present
        assert "Insufficient balance" in text, text
        assert "network fee" in text.lower(), text
        assert "0.00002" in text, f"missing withdrawal fee 0.00002: {text}"
        assert "0.00001" in text, f"missing service fee 0.00001: {text}"
        assert "withdrawal fee" in text.lower(), text
        assert "service fee" in text.lower(), text


# ---------- successful pre-checks; kraken send must fail clearly + refund ----------
class TestKrakenWhitelistAndRefund:

    def test_fee_math_and_kraken_not_whitelisted_refund(self, s, new_user, admin_token):
        """
        Give the fresh user enough BTC, request a Bitcoin withdrawal that PASSES
        all validation, expect the Kraken on-chain send to fail because the test
        address is not whitelisted in the preview Kraken account. Verify:
          - Response is NOT a generic 500 (it should mention 'not whitelisted'
            OR at the very least restore balance and report a clear failure)
          - User's balance is fully refunded after the failed send
        """
        # Top up balance: 0.005 BTC is more than enough (amount + fees < 0.005)
        topup = 0.005
        r = s.post(f"{BASE_URL}/api/admin/give-btc/{new_user['id']}",
                   headers=_auth(admin_token),
                   json={"operation": "set", "amount": topup})
        assert r.status_code == 200, r.text
        before = r.json().get("new_balance")
        assert before is not None
        # Confirm wallet still connected
        ws = s.get(f"{BASE_URL}/api/wallet/status", headers=_auth(new_user["token"]))
        assert ws.status_code == 200, ws.text
        if ws.json().get("wallet_status") != "connected":
            # Re-approve in case
            s.post(f"{BASE_URL}/api/admin/approve-wallet/{new_user['id']}",
                   headers=_auth(admin_token), json={})

        # Attempt withdrawal that will pass validation & call Kraken
        amount = 0.0003  # > 0.0002 min, well under 0.005 balance
        r = s.post(f"{BASE_URL}/api/withdraw/bitcoin",
                   headers=_auth(new_user["token"]),
                   json={"address": TEST_BTC_ADDRESS, "amount": amount, "network": "bitcoin"},
                   timeout=60)
        body_text = r.text
        status = r.status_code
        # Expect failure (since address not whitelisted in Kraken preview).
        assert status != 200, f"Unexpected success against non-whitelisted address. Body: {body_text}"
        assert status in (400, 500, 502, 503), f"Unexpected status {status}: {body_text}"

        # ---- KEY: error must be CLEAR (mention 'whitelisted') and NOT a silent generic 500 ----
        # Soft assertion via flag so we can also verify refund regardless.
        clear_error = ("whitelisted" in body_text.lower()
                       or "not on file" in body_text.lower()
                       or "address" in body_text.lower() and "kraken" in body_text.lower())
        generic_500 = (status == 500 and "Bitcoin network error occurred" in body_text)

        # Allow a small delay for DB write of refund
        time.sleep(2)
        # Verify refund — balance must equal pre-attempt balance
        rb = s.get(f"{BASE_URL}/api/wallet/balance", headers=_auth(new_user["token"]))
        assert rb.status_code == 200, rb.text
        after = float(rb.json().get("total_balance", -1))
        assert abs(after - before) < 1e-9, (
            f"Balance NOT fully refunded. before={before}, after={after}, body={body_text}"
        )

        # Hard-assert the error clarity expectation last so refund is still verified.
        assert clear_error and not generic_500, (
            f"Expected clear 'not whitelisted' error from backend (not a generic 500). "
            f"status={status}, body={body_text}"
        )
