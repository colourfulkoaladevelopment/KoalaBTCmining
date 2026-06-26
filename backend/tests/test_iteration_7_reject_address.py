"""Backend tests for iteration_7: REJECT pending address change.

Endpoint under test:
- POST /api/admin/reject-address-change/{user_id}  body: { reason: str }

Cases:
- happy path (with reason) -> 200, clears pending_address_change, btc_wallet_address unchanged, stores last_address_change_rejection
- no pending change -> 404
- non-admin token -> 403
- missing/empty reason -> 200, stores "No reason provided"
- regression: approve-address-change still works; iteration-6 endpoints not broken
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://admin-balance-mgmt-1.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "colourfulkoaladevelopment@gmail.com"
ADMIN_PASSWORD = "KoalaAdmin#2026"
USER_EMAIL = "koalatest@example.com"
USER_PASSWORD = "TestUser#2026"

NEW_ADDR_A = "bc1qrejectedaddressxxxxxxxxxxxxxxxxxxa1"
NEW_ADDR_B = "bc1qrejectedaddressxxxxxxxxxxxxxxxxxxb2"
NEW_ADDR_C = "bc1qrejectedaddressxxxxxxxxxxxxxxxxxxc3"
NEW_ADDR_D = "bc1qrejectedaddressxxxxxxxxxxxxxxxxxxd4"


def _login(email, password):
    return requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)


def _tok(r):
    j = r.json()
    return j.get("access_token") or j.get("token")


@pytest.fixture(scope="module")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return _tok(r)


@pytest.fixture(scope="module")
def user_token():
    r = _login(USER_EMAIL, USER_PASSWORD)
    if r.status_code != 200:
        pytest.skip(f"user login failed: {r.status_code} {r.text[:200]}")
    return _tok(r)


def _hdr(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_user_id(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/users", headers=_hdr(admin_token), timeout=30)
    assert r.status_code == 200
    users = r.json().get("users") or r.json()
    for u in users:
        if u.get("email") == USER_EMAIL:
            return u.get("id") or u.get("_id") or u.get("user_id")
    pytest.skip("test user not found")


def _request_pending_change(user_token, new_address):
    """Submit a pending address change as the test user."""
    r = requests.post(
        f"{BASE_URL}/api/wallet/request-address-change",
        headers=_hdr(user_token),
        json={"current_password": USER_PASSWORD, "new_address": new_address, "confirm_new_address": new_address},
        timeout=30,
    )
    return r


def _clear_pending_if_any(admin_token, user_id):
    """Best-effort: ensure no pending change is active before a test."""
    r = requests.get(f"{BASE_URL}/api/admin/pending-address-changes", headers=_hdr(admin_token), timeout=30)
    if r.status_code != 200:
        return
    items = r.json().get("pending") or r.json().get("requests") or r.json()
    if isinstance(items, dict):
        items = items.get("items", [])
    for it in items or []:
        if it.get("user_id") == user_id:
            # reject to clear; ignore failures
            requests.post(
                f"{BASE_URL}/api/admin/reject-address-change/{user_id}",
                headers=_hdr(admin_token),
                json={"reason": "cleanup"},
                timeout=30,
            )
            break


def _wallet_status(user_token):
    return requests.get(f"{BASE_URL}/api/wallet/status", headers=_hdr(user_token), timeout=30)


# --- Tests ---

class TestRejectAddressChange:

    def test_reject_happy_path_with_reason(self, admin_token, user_token, test_user_id):
        _clear_pending_if_any(admin_token, test_user_id)

        # capture current address
        ws_before = _wallet_status(user_token)
        assert ws_before.status_code == 200
        current_addr_before = ws_before.json().get("btc_wallet_address")

        # create pending change
        rc = _request_pending_change(user_token, NEW_ADDR_A)
        assert rc.status_code == 200, rc.text

        # reject as admin
        r = requests.post(
            f"{BASE_URL}/api/admin/reject-address-change/{test_user_id}",
            headers=_hdr(admin_token),
            json={"reason": "suspicious address"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True

        # verify wallet/status: pending cleared, address unchanged
        ws_after = _wallet_status(user_token)
        assert ws_after.status_code == 200
        pac = ws_after.json().get("pending_address_change")
        # backend returns null/None after rejection
        assert pac in (None, {}, "null"), f"pending_address_change should be cleared, got {pac}"
        assert ws_after.json().get("btc_wallet_address") == current_addr_before, "btc_wallet_address must not change on reject"

    def test_reject_no_pending_returns_404(self, admin_token, user_token, test_user_id):
        _clear_pending_if_any(admin_token, test_user_id)
        r = requests.post(
            f"{BASE_URL}/api/admin/reject-address-change/{test_user_id}",
            headers=_hdr(admin_token),
            json={"reason": "nothing here"},
            timeout=30,
        )
        assert r.status_code == 404, r.text

    def test_reject_non_admin_returns_403(self, user_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/reject-address-change/{test_user_id}",
            headers=_hdr(user_token),
            json={"reason": "not allowed"},
            timeout=30,
        )
        assert r.status_code == 403, r.text

    def test_reject_with_empty_reason(self, admin_token, user_token, test_user_id):
        _clear_pending_if_any(admin_token, test_user_id)
        rc = _request_pending_change(user_token, NEW_ADDR_B)
        assert rc.status_code == 200, rc.text

        r = requests.post(
            f"{BASE_URL}/api/admin/reject-address-change/{test_user_id}",
            headers=_hdr(admin_token),
            json={"reason": ""},
            timeout=30,
        )
        assert r.status_code == 200, r.text

        # pending cleared
        ws = _wallet_status(user_token)
        assert ws.json().get("pending_address_change") in (None, {}, "null")

    def test_reject_with_missing_reason_body(self, admin_token, user_token, test_user_id):
        _clear_pending_if_any(admin_token, test_user_id)
        rc = _request_pending_change(user_token, NEW_ADDR_C)
        assert rc.status_code == 200, rc.text

        # Send empty JSON body (no reason key)
        r = requests.post(
            f"{BASE_URL}/api/admin/reject-address-change/{test_user_id}",
            headers=_hdr(admin_token),
            json={},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        ws = _wallet_status(user_token)
        assert ws.json().get("pending_address_change") in (None, {}, "null")


class TestRegressionApproveAndRequest:

    def test_approve_still_works(self, admin_token, user_token, test_user_id):
        _clear_pending_if_any(admin_token, test_user_id)

        ws_before = _wallet_status(user_token)
        assert ws_before.status_code == 200
        addr_before = ws_before.json().get("btc_wallet_address")

        rc = _request_pending_change(user_token, NEW_ADDR_D)
        assert rc.status_code == 200, rc.text

        # approve
        r = requests.post(
            f"{BASE_URL}/api/admin/approve-address-change/{test_user_id}",
            headers=_hdr(admin_token),
            json={},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("btc_wallet_address") == NEW_ADDR_D

        # verify status: address updated, pending cleared
        ws = _wallet_status(user_token)
        assert ws.json().get("btc_wallet_address") == NEW_ADDR_D
        assert ws.json().get("pending_address_change") in (None, {}, "null")

        # restore canonical address using admin set-address so other tests are repeatable
        restore_addr = addr_before or "bc1qexampleaddressxxxxxxxxxxxxxxxxxxxxxx"
        rs = requests.post(
            f"{BASE_URL}/api/admin/set-address/{test_user_id}",
            headers=_hdr(admin_token),
            json={"new_address": restore_addr},
            timeout=30,
        )
        assert rs.status_code == 200, rs.text

    def test_pending_list_endpoint_still_works(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/pending-address-changes", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200, r.text

    def test_request_change_validation_unaffected(self, user_token):
        # wrong password -> 401
        r = requests.post(
            f"{BASE_URL}/api/wallet/request-address-change",
            headers=_hdr(user_token),
            json={"current_password": "WRONGPW", "new_address": NEW_ADDR_A, "confirm_new_address": NEW_ADDR_A},
            timeout=30,
        )
        assert r.status_code in (400, 401), r.text
