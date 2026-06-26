"""Edge case tests for POST /api/admin/give-btc/{user_id}.

Covers the new robustness fix in confirmGiveBtc:
- 403 'Admin access required' for non-admin token (so frontend can surface it).
- 400 'Amount must be greater than 0' for amount=0 and negative amounts.
- 404 'User not found' for bogus user_id (must respond FAST, no 30-45s hang).
- 200 happy-path with admin token + valid user_id + positive amount.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://admin-balance-mgmt-1.preview.emergentagent.com",
).rstrip("/")

ADMIN_EMAIL = "colourfulkoaladevelopment@gmail.com"
ADMIN_PASSWORD = "KoalaAdmin#2026"
USER_EMAIL = "koalatest@example.com"
USER_PASSWORD = "TestUser#2026"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, email, password):
    return session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )


@pytest.fixture(scope="module")
def admin_token(session):
    r = _login(session, ADMIN_EMAIL, ADMIN_PASSWORD)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def user_token(session):
    r = _login(session, USER_EMAIL, USER_PASSWORD)
    if r.status_code != 200:
        pytest.skip(f"User login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def test_user_id(session, admin_token):
    r = session.get(
        f"{BASE_URL}/api/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text[:300]
    for u in r.json().get("users", []):
        if (u.get("email") or "").lower() == USER_EMAIL.lower():
            return u["id"]
    pytest.skip(f"Test user {USER_EMAIL} not found in admin users list")


# ---------------- 403: non-admin cannot give btc -------------------------
def test_give_btc_non_admin_returns_403(session, user_token, test_user_id):
    r = session.post(
        f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"amount": 0.0001},
        timeout=15,
    )
    assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert "Admin access required" in (body.get("detail") or ""), body


# ---------------- 400: amount must be > 0 --------------------------------
def test_give_btc_amount_zero_returns_400(session, admin_token, test_user_id):
    r = session.post(
        f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"amount": 0},
        timeout=15,
    )
    assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert "Amount must be greater than 0" in (body.get("detail") or ""), body


def test_give_btc_amount_negative_returns_400(session, admin_token, test_user_id):
    r = session.post(
        f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"amount": -1.5},
        timeout=15,
    )
    assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert "Amount must be greater than 0" in (body.get("detail") or ""), body


# ---------------- 404: bogus user id must respond FAST -------------------
def test_give_btc_bogus_user_id_returns_404_fast(session, admin_token):
    start = time.time()
    r = session.post(
        f"{BASE_URL}/api/admin/give-btc/bogus-id-does-not-exist",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"amount": 0.0001},
        timeout=15,
    )
    elapsed = time.time() - start
    assert r.status_code == 404, f"expected 404 got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert "User not found" in (body.get("detail") or ""), body
    # Must be fast - no 30-45s hang. Generous upper bound 10s for preview proxy.
    assert elapsed < 10, f"give-btc took {elapsed:.2f}s for bogus id (expected <10s)"


# ---------------- 200: happy path ----------------------------------------
def test_give_btc_happy_path_increments_balance(session, admin_token, test_user_id):
    # before
    r0 = session.get(
        f"{BASE_URL}/api/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r0.status_code == 200
    before = next(
        (float(u["balance"]) for u in r0.json()["users"] if u["id"] == test_user_id),
        None,
    )
    assert before is not None

    amount = 0.0001
    start = time.time()
    r = session.post(
        f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"amount": amount},
        timeout=15,
    )
    elapsed = time.time() - start
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    assert elapsed < 10, f"give-btc happy path took {elapsed:.2f}s"
    body = r.json()
    assert body.get("success") is True
    assert float(body.get("new_balance", 0)) >= before + amount - 1e-9

    # Verify via GET
    r2 = session.get(
        f"{BASE_URL}/api/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    after = next(
        (float(u["balance"]) for u in r2.json()["users"] if u["id"] == test_user_id),
        None,
    )
    assert after is not None
    assert after >= before + amount - 1e-9, f"balance not incremented: before={before} after={after}"
