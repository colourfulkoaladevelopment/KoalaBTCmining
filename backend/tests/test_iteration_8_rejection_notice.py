"""
Iteration 8 - Address-change rejection notice surfacing
Backend tests for:
- GET /api/wallet/status returns last_address_change_rejection
- POST /api/wallet/dismiss-rejection clears it
- POST /api/wallet/request-address-change clears any existing rejection
- End-to-end: request -> admin reject -> status shows rejection
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://admin-balance-mgmt-1.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "colourfulkoaladevelopment@gmail.com"
ADMIN_PASSWORD = "KoalaAdmin#2026"
USER_EMAIL = "koalatest@example.com"
USER_PASSWORD = "TestUser#2026"

USER_NEW_ADDRESS = "bc1qiter8noticetest11111111111111111"
APPROVED_ADDRESS = "bc1qexampleaddressxxxxxxxxxxxxxxxxxxxxxx"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    body = r.json()
    return body.get("access_token") or body.get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def user_token():
    return _login(USER_EMAIL, USER_PASSWORD)


@pytest.fixture(scope="module")
def test_user_id(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    for u in r.json().get("users", []):
        if u.get("email") == USER_EMAIL:
            return u.get("id") or u.get("_id")
    pytest.skip("test user not found")


@pytest.fixture(scope="module", autouse=True)
def ensure_user_has_approved_address(admin_token, test_user_id):
    """Make sure the user has an approved withdrawal address before tests."""
    # Try set-address (creates approved address regardless of current state)
    requests.post(
        f"{BASE_URL}/api/admin/set-address/{test_user_id}",
        json={"address": APPROVED_ADDRESS},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    yield


# --- Module: wallet rejection feature ---

class TestRejectionNoticeFlow:
    """End-to-end: request -> reject -> status returns rejection."""

    def test_01_request_address_change(self, user_token):
        r = requests.post(
            f"{BASE_URL}/api/wallet/request-address-change",
            json={"current_password": USER_PASSWORD, "new_address": USER_NEW_ADDRESS},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

    def test_02_admin_rejects_with_reason(self, admin_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/reject-address-change/{test_user_id}",
            json={"reason": "test reason X"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200, r.text

    def test_03_status_shows_rejection(self, user_token):
        r = requests.get(
            f"{BASE_URL}/api/wallet/status",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("pending_address_change") is None
        rej = data.get("last_address_change_rejection")
        assert rej is not None, f"rejection missing: {data}"
        assert rej.get("reason") == "test reason X"
        assert rej.get("new_address") == USER_NEW_ADDRESS
        assert rej.get("rejected_at") is not None

    def test_04_dismiss_rejection_clears_it(self, user_token):
        r = requests.post(
            f"{BASE_URL}/api/wallet/dismiss-rejection",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert r.status_code == 200
        assert r.json().get("success") is True

        # verify cleared
        r2 = requests.get(
            f"{BASE_URL}/api/wallet/status",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert r2.status_code == 200
        assert r2.json().get("last_address_change_rejection") is None

    def test_05_new_request_clears_existing_rejection(self, user_token, admin_token, test_user_id):
        # 1. create a rejection again
        r1 = requests.post(
            f"{BASE_URL}/api/wallet/request-address-change",
            json={"current_password": USER_PASSWORD, "new_address": USER_NEW_ADDRESS},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert r1.status_code == 200, r1.text
        r2 = requests.post(
            f"{BASE_URL}/api/admin/reject-address-change/{test_user_id}",
            json={"reason": "another reason"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r2.status_code == 200

        # confirm rejection now exists
        s = requests.get(f"{BASE_URL}/api/wallet/status", headers={"Authorization": f"Bearer {user_token}"})
        assert s.json().get("last_address_change_rejection") is not None

        # 2. submit a new request - should clear rejection and set pending
        new_addr2 = "bc1qiter8noticetest22222222222222222"
        r3 = requests.post(
            f"{BASE_URL}/api/wallet/request-address-change",
            json={"current_password": USER_PASSWORD, "new_address": new_addr2},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert r3.status_code == 200, r3.text

        s2 = requests.get(f"{BASE_URL}/api/wallet/status", headers={"Authorization": f"Bearer {user_token}"})
        body = s2.json()
        assert body.get("last_address_change_rejection") is None, f"rejection should be cleared: {body}"
        assert body.get("pending_address_change") is not None
        assert body.get("pending_address_change", {}).get("new_address") == new_addr2

    def test_06_dismiss_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/wallet/dismiss-rejection")
        assert r.status_code in (401, 403), f"expected auth error, got {r.status_code}"


# --- Module: cleanup so the user ends in a clean state ---

class TestCleanup:
    def test_99_admin_cleans_pending_and_rejection(self, admin_token, test_user_id, user_token):
        # If there's a pending change left from test_05, approve it to keep state stable
        # Easiest path: reject + dismiss to clear everything
        requests.post(
            f"{BASE_URL}/api/admin/reject-address-change/{test_user_id}",
            json={"reason": "cleanup"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        requests.post(
            f"{BASE_URL}/api/wallet/dismiss-rejection",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        # Restore approved address (in case anything set it)
        requests.post(
            f"{BASE_URL}/api/admin/set-address/{test_user_id}",
            json={"address": APPROVED_ADDRESS},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        s = requests.get(f"{BASE_URL}/api/wallet/status", headers={"Authorization": f"Bearer {user_token}"})
        body = s.json()
        assert body.get("pending_address_change") is None
        assert body.get("last_address_change_rejection") is None
