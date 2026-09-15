"""Backend tests for admin user management endpoints + activity feed.

Covers:
- GET /api/admin/users (auth, balance/wallet fields)
- POST /api/admin/give-btc/{user_id}
- POST /api/admin/reset-user/{user_id}  (regression: no `await` TypeError -> 500)
- DELETE /api/admin/delete-user/{user_id} (throwaway user only)
- GET /api/activity/recent (public)
- Admin endpoint auth rejection for non-admin / no token
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://admin-balance-mgmt-1.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "colourfulkoaladevelopment@gmail.com"
ADMIN_PASSWORD = "KoalaAdmin#2026"
USER_EMAIL = "koalatest@example.com"
USER_PASSWORD = "TestUser#2026"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, email, password):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    return r


@pytest.fixture(scope="module")
def admin_token(session):
    r = _login(session, ADMIN_EMAIL, ADMIN_PASSWORD)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if not token:
        pytest.skip(f"No token in admin login response: {data}")
    return token


@pytest.fixture(scope="module")
def user_token(session):
    r = _login(session, USER_EMAIL, USER_PASSWORD)
    if r.status_code != 200:
        pytest.skip(f"Test user login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def throwaway_user(session):
    """Register a brand new user we can safely delete."""
    email = f"TEST_throwaway_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"name": "TEST Throwaway", "email": email, "password": "Throwaway#2026"}
    r = session.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    user_id = (data.get("user") or {}).get("id") or data.get("user_id") or data.get("id")
    return {"email": email, "id": user_id, "raw": data}


# ---------- Activity feed (public) ----------
def test_activity_recent_public(session):
    r = session.get(f"{BASE_URL}/api/activity/recent", timeout=15)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    assert "activities" in body, f"missing activities key: {body}"
    assert isinstance(body["activities"], list)


# ---------- Auth gating ----------
def test_admin_users_requires_auth(session):
    r = session.get(f"{BASE_URL}/api/admin/users", timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}: {r.text[:200]}"


def test_admin_users_rejects_non_admin(session, user_token):
    r = session.get(
        f"{BASE_URL}/api/admin/users",
        headers={"Authorization": f"Bearer {user_token}"},
        timeout=15,
    )
    assert r.status_code in (401, 403), f"non-admin should be rejected got {r.status_code}"


def test_admin_give_btc_rejects_non_admin(session, user_token):
    r = session.post(
        f"{BASE_URL}/api/admin/give-btc/some-id",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"amount": 0.001},
        timeout=15,
    )
    assert r.status_code in (401, 403)


# ---------- Admin users list ----------
@pytest.fixture(scope="module")
def admin_users_list(session, admin_token):
    r = session.get(
        f"{BASE_URL}/api/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 200, f"admin users failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert "users" in data
    return data["users"]


def test_admin_users_has_expected_fields(admin_users_list):
    assert len(admin_users_list) > 0, "no users returned"
    sample = admin_users_list[0]
    for key in ("id", "email", "balance", "btc_wallet_address", "wallet_status"):
        assert key in sample, f"missing key {key} in user record: {sample}"
    # balance must be numeric
    assert isinstance(sample["balance"], (int, float))


def _find_user(admin_users_list, email):
    for u in admin_users_list:
        if (u.get("email") or "").lower() == email.lower():
            return u
    return None


# ---------- give-btc ----------
def test_give_btc_to_test_user(session, admin_token, admin_users_list):
    target = _find_user(admin_users_list, USER_EMAIL)
    if not target:
        pytest.skip(f"Test user {USER_EMAIL} not in users list")
    before = float(target.get("balance", 0))
    amount = 0.001
    r = session.post(
        f"{BASE_URL}/api/admin/give-btc/{target['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"amount": amount},
        timeout=30,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("success") is True
    new_balance = float(body.get("new_balance", 0))
    assert new_balance >= before + amount - 1e-9, f"balance not incremented: before={before} new={new_balance}"

    # Verify via GET that bitcoin_balance/balance is updated
    r2 = session.get(
        f"{BASE_URL}/api/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r2.status_code == 200
    refreshed = _find_user(r2.json()["users"], USER_EMAIL)
    assert refreshed is not None
    assert float(refreshed["balance"]) >= before + amount - 1e-9


# ---------- reset-user (regression: must NOT 500) ----------
def test_reset_test_user(session, admin_token, admin_users_list):
    target = _find_user(admin_users_list, USER_EMAIL)
    if not target:
        pytest.skip(f"Test user {USER_EMAIL} not in users list")
    r = session.post(
        f"{BASE_URL}/api/admin/reset-user/{target['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 200, f"reset returned {r.status_code} {r.text[:300]}"
    # Verify balance is now 0 via admin/users list
    r2 = session.get(
        f"{BASE_URL}/api/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    refreshed = _find_user(r2.json()["users"], USER_EMAIL)
    assert refreshed is not None
    assert float(refreshed["balance"]) == 0.0


# ---------- delete-user (throwaway only) ----------
def test_delete_throwaway_user(session, admin_token, throwaway_user):
    uid = throwaway_user["id"]
    if not uid:
        # try to discover via admin/users
        r = session.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        for u in r.json().get("users", []):
            if u.get("email") == throwaway_user["email"]:
                uid = u["id"]
                break
    assert uid, "could not resolve throwaway user id"
    # Safety guard: never delete admin or main test user
    assert throwaway_user["email"] not in (ADMIN_EMAIL, USER_EMAIL)

    r = session.delete(
        f"{BASE_URL}/api/admin/delete-user/{uid}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 200, f"delete failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("success") is True

    # Verify user no longer appears
    r2 = session.get(
        f"{BASE_URL}/api/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    emails = {u.get("email") for u in r2.json().get("users", [])}
    assert throwaway_user["email"] not in emails
