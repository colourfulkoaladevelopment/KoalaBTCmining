"""
Iteration 12 backend tests — Bitcoin withdrawal with:
  * Clear (non-generic) Kraken error surfaced as HTTP 400 (NOT 5xx)
  * Refund-on-failure preserves bitcoin_balance
  * Min 0.0002 BTC enforced for CONNECTED+funded users
  * Insufficient-balance itemized error (network + 0.00002 withdrawal + 0.00001 service)
  * Auth gating (403 without token)

Background:
  Previous iteration generic-500-swallowing bug FIXED in server.py:1614-1645.
  Current Kraken API key returns EGeneral:Permission denied because it lacks
  Funding/Withdraw permissions. That is the expected, real, non-generic error.
"""

import os
import uuid
import time
import secrets
import pytest
import requests


BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"

ADMIN_EMAIL = "colourfulkoaladevelopment@gmail.com"
ADMIN_PASSWORD = "KoalaAdmin#2026"


def _unique_btc_address() -> str:
    """Return a bech32-format-ish bc1q... address unique across test runs.
    Kraken-format validation only requires bech32-like prefix + length; we don't
    actually send funds — Kraken returns Permission denied long before address check.
    """
    # Use base58/bech32-safe charset (no 1, b, i, o per bech32 spec — actually bech32
    # excludes 1,b,i,o uppercase but lowercase 'b' is fine in data part). Keep it simple.
    chars = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
    suffix = "".join(secrets.choice(chars) for _ in range(38))
    return f"bc1q{suffix}"


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
    assert tok
    return tok


def _register_user(s):
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_iter12_{suffix}@example.com"
    password = "TestPass#2026"
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"email": email, "password": password, "name": "BTC Tester"})
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("access_token") or body.get("token")
    user = body.get("user") or {}
    user_id = user.get("id") or user.get("_id")
    if not (token and user_id):
        rl = s.post(f"{BASE_URL}/api/auth/login",
                    json={"email": email, "password": password})
        assert rl.status_code == 200, rl.text
        token = rl.json().get("access_token")
        rme = s.get(f"{BASE_URL}/api/auth/me",
                    headers={"Authorization": f"Bearer {token}"})
        assert rme.status_code == 200
        user_id = rme.json().get("id") or rme.json().get("_id")
    return {"email": email, "password": password, "token": token, "id": user_id}


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _setup_connected_user(s, admin_token, balance: float = 0.005) -> dict:
    """Register a fresh user, register a UNIQUE BTC address, admin-approve, and
    admin-set balance to `balance` BTC. Returns the user dict.
    """
    user = _register_user(s)
    address = _unique_btc_address()
    user["btc_address"] = address

    # Register the wallet
    r = s.post(f"{BASE_URL}/api/wallet/register",
               headers=_auth(user["token"]),
               json={"btc_address": address})
    assert r.status_code == 200, f"wallet register failed: {r.status_code} {r.text}"

    # Admin-approve
    r = s.post(f"{BASE_URL}/api/admin/approve-wallet/{user['id']}",
               headers=_auth(admin_token), json={})
    assert r.status_code in (200, 404), f"approve failed: {r.status_code} {r.text}"

    # Confirm connected
    ws = s.get(f"{BASE_URL}/api/wallet/status", headers=_auth(user["token"]))
    assert ws.status_code == 200, ws.text
    assert ws.json().get("wallet_status") == "connected", ws.json()

    # Admin set balance
    r = s.post(f"{BASE_URL}/api/admin/give-btc/{user['id']}",
               headers=_auth(admin_token),
               json={"operation": "set", "amount": balance})
    assert r.status_code == 200, r.text
    user["initial_balance"] = float(r.json().get("new_balance", balance))
    return user


# ---------- 1. Auth gating ----------
def test_withdraw_requires_auth(s):
    r = s.post(f"{BASE_URL}/api/withdraw/bitcoin",
               json={"address": _unique_btc_address(), "amount": 0.001, "network": "bitcoin"})
    assert r.status_code in (401, 403), f"want 401/403, got {r.status_code}: {r.text}"


# ---------- 2. Min 0.0002 BTC enforced for CONNECTED user ----------
def test_min_amount_enforced_for_connected_user(s, admin_token):
    user = _setup_connected_user(s, admin_token, balance=0.005)
    r = s.post(f"{BASE_URL}/api/withdraw/bitcoin",
               headers=_auth(user["token"]),
               json={"address": user["btc_address"], "amount": 0.0001, "network": "bitcoin"})
    assert r.status_code == 400, f"want 400, got {r.status_code}: {r.text}"
    assert "0.0002" in r.text, f"expected '0.0002' in detail: {r.text}"
    assert "Bitcoin network minimum" in r.text or "minimum" in r.text.lower(), r.text


# ---------- 3. Insufficient balance itemizes the fees ----------
def test_insufficient_balance_itemized(s, admin_token):
    # Setup user with very small balance (0.0001 — below min, so use a different approach):
    # give balance 0.00021 (just over min), then try amount = 0.00025 -> insufficient
    user = _setup_connected_user(s, admin_token, balance=0.00021)
    r = s.post(f"{BASE_URL}/api/withdraw/bitcoin",
               headers=_auth(user["token"]),
               json={"address": user["btc_address"], "amount": 0.00025, "network": "bitcoin"})
    assert r.status_code == 400, f"want 400 insufficient, got {r.status_code}: {r.text}"
    text = r.text.lower()
    assert "insufficient balance" in text, r.text
    assert "network fee" in text, r.text
    assert "withdrawal fee" in text, r.text
    assert "service fee" in text, r.text
    # itemized fee constants (8-decimal pads OR raw 0.00002 / 0.00001):
    assert ("0.00002000" in r.text or "0.00002" in r.text), r.text
    assert ("0.00001000" in r.text or "0.00001" in r.text), r.text


# ---------- 4. THE KEY ONE — Kraken error surfaces as CLEAR 400 (not generic 5xx) ----------
class TestClearErrorAndRefund:

    def test_clear_kraken_error_and_full_refund(self, s, admin_token):
        user = _setup_connected_user(s, admin_token, balance=0.005)
        before = user["initial_balance"]
        amount = 0.0003  # > 0.0002 min, fees + amount < 0.005

        r = s.post(f"{BASE_URL}/api/withdraw/bitcoin",
                   headers=_auth(user["token"]),
                   json={"address": user["btc_address"], "amount": amount, "network": "bitcoin"},
                   timeout=60)
        status = r.status_code
        body_text = r.text

        # 4.a — MUST NOT be a generic 5xx swallow
        assert status != 500, (
            f"Generic 500 (body swallowed). status={status}, body={body_text}"
        )
        assert status < 500, (
            f"Expected 4xx (clear error), got 5xx. status={status}, body={body_text}"
        )
        assert status == 400, (
            f"Expected HTTP 400, got {status}: {body_text}"
        )

        # 4.b — MUST contain a SPECIFIC, NON-GENERIC error
        # Acceptable specific Kraken errors:
        lower = body_text.lower()
        is_specific = any(s in lower for s in [
            "permission denied",       # current expected (key lacks Funding perms)
            "egeneral:permission",
            "not whitelisted",         # if address-not-whitelisted path is reached
            "not on file",
            "withdrawal methods error",
        ])
        # Must NOT be the old generic swallowing message
        is_generic = "bitcoin network error occurred" in lower
        assert is_specific, (
            f"Expected specific Kraken error in body, got: {body_text}"
        )
        assert not is_generic, (
            f"Detected old GENERIC swallow message in body: {body_text}"
        )

        # 4.c — Refund: balance fully restored
        time.sleep(1.5)  # allow async DB write
        rb = s.get(f"{BASE_URL}/api/wallet/balance", headers=_auth(user["token"]))
        assert rb.status_code == 200, rb.text
        after = float(rb.json().get("total_balance", -1))
        assert abs(after - before) < 1e-9, (
            f"Balance NOT fully refunded. before={before}, after={after}, body={body_text}"
        )

    def test_status_is_not_503_nor_502(self, s, admin_token):
        """Defensive: ensure server doesn't return 5xx that ingress could rewrite."""
        user = _setup_connected_user(s, admin_token, balance=0.005)
        r = s.post(f"{BASE_URL}/api/withdraw/bitcoin",
                   headers=_auth(user["token"]),
                   json={"address": user["btc_address"], "amount": 0.0003, "network": "bitcoin"},
                   timeout=60)
        assert r.status_code not in (500, 502, 503, 504), (
            f"5xx body would be swallowed by ingress — got {r.status_code}: {r.text}"
        )
