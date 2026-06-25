"""
Iteration 10 regression smoke after junk-file removal in /app/frontend/.
Tests backend endpoints called out in the review request.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://paypal-ads-rebuild.preview.emergentagent.com"
ADMIN_EMAIL = "colourfulkoaladevelopment@gmail.com"
ADMIN_PASS = "KoalaAdmin#2026"
USER_EMAIL = "koalatest@example.com"
USER_PASS = "TestUser#2026"


# ----- session/login fixtures -----
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in {data}"
    return tok


@pytest.fixture(scope="module")
def user_login():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": USER_EMAIL, "password": USER_PASS}, timeout=20)
    assert r.status_code == 200, f"user login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok and "user" in data, f"unexpected shape {data}"
    data["token"] = tok
    return data


@pytest.fixture(scope="module")
def user_token(user_login):
    return user_login["token"]


@pytest.fixture(scope="module")
def user_id(user_login):
    return user_login["user"]["id"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ----- Health -----
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") in ("healthy", "ok")


# ----- Auth -----
def test_admin_login_works(admin_token):
    assert admin_token


def test_user_login_works(user_token):
    assert user_token


# ----- Core reads for test user -----
@pytest.mark.parametrize("path", [
    "/api/wallet/balance",
    "/api/wallet/status",
    "/api/miners/list",
    "/api/store/miners",
    "/api/activity/recent",
])
def test_core_read_endpoints(user_token, path):
    r = requests.get(f"{BASE_URL}{path}", headers=_h(user_token), timeout=20)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
    # Each should return JSON
    j = r.json()
    assert isinstance(j, (dict, list))


# ----- Admin gating -----
def test_admin_users_admin_ok(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/users", headers=_h(admin_token), timeout=20)
    assert r.status_code == 200
    j = r.json()
    # Tolerate either {users:[...]} or [...]
    users = j.get("users", j) if isinstance(j, dict) else j
    assert isinstance(users, list)
    assert len(users) >= 1


def test_admin_users_non_admin_forbidden(user_token):
    r = requests.get(f"{BASE_URL}/api/admin/users", headers=_h(user_token), timeout=20)
    assert r.status_code == 403


def test_admin_pending_address_changes(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/pending-address-changes",
                     headers=_h(admin_token), timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert isinstance(j, (dict, list))


# ----- Admin give-btc -----
def test_admin_give_btc_add_small(admin_token, user_token, user_id):
    # Baseline
    b0 = requests.get(f"{BASE_URL}/api/wallet/balance", headers=_h(user_token), timeout=20).json()
    bal_before = float(b0.get("total_balance", b0.get("bitcoin_balance", 0)))

    r = requests.post(f"{BASE_URL}/api/admin/give-btc/{user_id}",
                      headers=_h(admin_token),
                      json={"operation": "add", "amount": 0.0001}, timeout=20)
    assert r.status_code == 200, f"give-btc failed: {r.status_code} {r.text}"

    # Verify persistence
    b1 = requests.get(f"{BASE_URL}/api/wallet/balance", headers=_h(user_token), timeout=20).json()
    bal_after = float(b1.get("total_balance", b1.get("bitcoin_balance", 0)))
    assert bal_after >= bal_before + 0.0001 - 1e-9, (bal_before, bal_after)


# ----- Background mining job: balance should increase over ~15s -----
def test_background_mining_credits_balance(user_token):
    b0 = requests.get(f"{BASE_URL}/api/wallet/balance", headers=_h(user_token), timeout=20).json()
    bal0 = float(b0.get("total_balance", 0))
    time.sleep(16)
    b1 = requests.get(f"{BASE_URL}/api/wallet/balance", headers=_h(user_token), timeout=20).json()
    bal1 = float(b1.get("total_balance", 0))
    # If user has an active miner, balance must strictly increase. If not, balance must not decrease.
    miners = requests.get(f"{BASE_URL}/api/miners/list", headers=_h(user_token), timeout=20).json()
    active = []
    if isinstance(miners, dict):
        active = [m for m in miners.get("miners", []) if m.get("status") == "active"]
    elif isinstance(miners, list):
        active = [m for m in miners if m.get("status") == "active"]
    if active:
        assert bal1 > bal0, f"expected balance to increase with active miner; bal0={bal0} bal1={bal1}"
    else:
        assert bal1 >= bal0
