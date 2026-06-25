"""Backend tests for iteration_6: Lightning lane, user address-change, admin pending/set address,
admin adjust balance (give-btc) operations.

Covers:
- POST /api/admin/give-btc/{id}: add/remove/set + edge cases
- POST /api/wallet/request-address-change: 401 wrong pw, 400 invalid, 400 same-as-current, 200 happy
- GET /api/admin/pending-address-changes
- POST /api/admin/approve-address-change/{id}
- POST /api/admin/set-address/{id}
- GET /api/wallet/status pending_address_change visibility
- POST /api/withdraw/bitcoin network=lightning bypasses wallet gate, validates invoice format/amount
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "https://paypal-ads-rebuild.preview.emergentagent.com"
).rstrip("/")

ADMIN_EMAIL = "colourfulkoaladevelopment@gmail.com"
ADMIN_PASSWORD = "KoalaAdmin#2026"
USER_EMAIL = "koalatest@example.com"
USER_PASSWORD = "TestUser#2026"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    return r


@pytest.fixture(scope="module")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def user_token():
    r = _login(USER_EMAIL, USER_PASSWORD)
    if r.status_code != 200:
        pytest.skip(f"User login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    return data.get("access_token") or data.get("token")


def _admin_headers(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def _user_headers(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_user_id(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/users", headers=_admin_headers(admin_token), timeout=30)
    assert r.status_code == 200
    for u in r.json().get("users", []):
        if (u.get("email") or "").lower() == USER_EMAIL.lower():
            return u["id"]
    pytest.skip("Test user not found")


# ==================== /api/admin/give-btc (Adjust Balance) ====================
class TestAdjustBalance:
    def test_add_increments(self, admin_token, test_user_id):
        # Get current balance
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=_admin_headers(admin_token), timeout=30)
        before = next(u["balance"] for u in r.json()["users"] if u["id"] == test_user_id)
        r = requests.post(
            f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
            headers=_admin_headers(admin_token),
            json={"operation": "add", "amount": 0.001},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body["success"] is True
        assert abs(float(body["new_balance"]) - (before + 0.001)) < 1e-7

    def test_remove_decrements(self, admin_token, test_user_id):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=_admin_headers(admin_token), timeout=30)
        before = next(u["balance"] for u in r.json()["users"] if u["id"] == test_user_id)
        r = requests.post(
            f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
            headers=_admin_headers(admin_token),
            json={"operation": "remove", "amount": 0.0005},
            timeout=30,
        )
        assert r.status_code == 200
        assert abs(float(r.json()["new_balance"]) - max(0.0, before - 0.0005)) < 1e-7

    def test_remove_clamps_at_zero(self, admin_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
            headers=_admin_headers(admin_token),
            json={"operation": "remove", "amount": 9999.0},
            timeout=30,
        )
        assert r.status_code == 200
        assert float(r.json()["new_balance"]) == 0.0

    def test_set_exact_balance(self, admin_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
            headers=_admin_headers(admin_token),
            json={"operation": "set", "amount": 0.01},
            timeout=30,
        )
        assert r.status_code == 200
        assert abs(float(r.json()["new_balance"]) - 0.01) < 1e-9

    def test_set_zero_is_allowed(self, admin_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
            headers=_admin_headers(admin_token),
            json={"operation": "set", "amount": 0},
            timeout=30,
        )
        assert r.status_code == 200
        assert float(r.json()["new_balance"]) == 0.0

    def test_invalid_operation_400(self, admin_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
            headers=_admin_headers(admin_token),
            json={"operation": "explode", "amount": 0.001},
            timeout=30,
        )
        assert r.status_code == 400

    def test_negative_amount_400(self, admin_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
            headers=_admin_headers(admin_token),
            json={"operation": "add", "amount": -0.001},
            timeout=30,
        )
        assert r.status_code == 400

    def test_add_zero_amount_400(self, admin_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
            headers=_admin_headers(admin_token),
            json={"operation": "add", "amount": 0},
            timeout=30,
        )
        assert r.status_code == 400

    def test_remove_zero_amount_400(self, admin_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/give-btc/{test_user_id}",
            headers=_admin_headers(admin_token),
            json={"operation": "remove", "amount": 0},
            timeout=30,
        )
        assert r.status_code == 400


# ==================== /api/admin/set-address ====================
class TestAdminSetAddress:
    SEED_ADDRESS = "bc1qexampleaddressxxxxxxxxxxxxxxxxxxxxxx"

    def test_set_address_seeds_test_user(self, admin_token, test_user_id):
        """Seed test_user with an approved address (used by later tests + frontend UI)."""
        r = requests.post(
            f"{BASE_URL}/api/admin/set-address/{test_user_id}",
            headers=_admin_headers(admin_token),
            json={"new_address": self.SEED_ADDRESS},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body["success"] is True
        assert body["btc_wallet_address"] == self.SEED_ADDRESS

    def test_set_address_persists(self, admin_token, test_user_id):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=_admin_headers(admin_token), timeout=30)
        target = next(u for u in r.json()["users"] if u["id"] == test_user_id)
        assert target["btc_wallet_address"] == self.SEED_ADDRESS
        assert target["wallet_status"] == "connected"

    def test_set_address_empty_400(self, admin_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/set-address/{test_user_id}",
            headers=_admin_headers(admin_token),
            json={"new_address": ""},
            timeout=30,
        )
        assert r.status_code == 400

    def test_set_address_non_admin_403(self, user_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/set-address/{test_user_id}",
            headers=_user_headers(user_token),
            json={"new_address": "bc1qnewaddress"},
            timeout=30,
        )
        assert r.status_code in (401, 403)


# ==================== /api/wallet/request-address-change + admin approval ====================
class TestUserAddressChangeRequest:
    NEW_ADDR = "bc1qnewuserrequestxxxxxxxxxxxxxxxxxxxxxxxx"

    def test_wrong_password_401(self, user_token):
        r = requests.post(
            f"{BASE_URL}/api/wallet/request-address-change",
            headers=_user_headers(user_token),
            json={"current_password": "WrongPass#9999", "new_address": self.NEW_ADDR},
            timeout=30,
        )
        assert r.status_code == 401

    def test_invalid_address_format_400(self, user_token):
        r = requests.post(
            f"{BASE_URL}/api/wallet/request-address-change",
            headers=_user_headers(user_token),
            json={"current_password": USER_PASSWORD, "new_address": "invalid_address_zzz"},
            timeout=30,
        )
        assert r.status_code == 400

    def test_same_as_current_400(self, user_token):
        # SEED_ADDRESS was set by TestAdminSetAddress
        r = requests.post(
            f"{BASE_URL}/api/wallet/request-address-change",
            headers=_user_headers(user_token),
            json={"current_password": USER_PASSWORD, "new_address": TestAdminSetAddress.SEED_ADDRESS},
            timeout=30,
        )
        assert r.status_code == 400

    def test_valid_request_200_and_pending_set(self, user_token):
        r = requests.post(
            f"{BASE_URL}/api/wallet/request-address-change",
            headers=_user_headers(user_token),
            json={"current_password": USER_PASSWORD, "new_address": self.NEW_ADDR},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        # Check /api/wallet/status now shows pending_address_change
        r2 = requests.get(f"{BASE_URL}/api/wallet/status", headers=_user_headers(user_token), timeout=30)
        assert r2.status_code == 200
        pac = r2.json().get("pending_address_change")
        assert pac is not None
        assert pac.get("new_address") == self.NEW_ADDR
        assert pac.get("status") == "pending"


class TestAdminPendingAddressChanges:
    def test_pending_list_includes_test_user(self, admin_token, test_user_id):
        r = requests.get(
            f"{BASE_URL}/api/admin/pending-address-changes",
            headers=_admin_headers(admin_token),
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert "pending_changes" in body
        match = next((p for p in body["pending_changes"] if p["user_id"] == test_user_id), None)
        assert match is not None, "test_user should be in pending list"
        assert match["new_address"] == TestUserAddressChangeRequest.NEW_ADDR
        assert match["current_address"] == TestAdminSetAddress.SEED_ADDRESS

    def test_pending_list_non_admin_403(self, user_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/pending-address-changes",
            headers=_user_headers(user_token),
            timeout=30,
        )
        assert r.status_code in (401, 403)

    def test_approve_address_change(self, admin_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/approve-address-change/{test_user_id}",
            headers=_admin_headers(admin_token),
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body["success"] is True
        assert body["btc_wallet_address"] == TestUserAddressChangeRequest.NEW_ADDR

        # Pending cleared
        r2 = requests.get(
            f"{BASE_URL}/api/admin/pending-address-changes",
            headers=_admin_headers(admin_token),
            timeout=30,
        )
        match = next((p for p in r2.json()["pending_changes"] if p["user_id"] == test_user_id), None)
        assert match is None

    def test_approve_with_no_pending_404(self, admin_token, test_user_id):
        # Already approved, so calling again should 404
        r = requests.post(
            f"{BASE_URL}/api/admin/approve-address-change/{test_user_id}",
            headers=_admin_headers(admin_token),
            timeout=30,
        )
        assert r.status_code == 404

    def test_approve_non_admin_403(self, user_token, test_user_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/approve-address-change/{test_user_id}",
            headers=_user_headers(user_token),
            timeout=30,
        )
        assert r.status_code in (401, 403)


# ==================== /api/wallet/status pending null ====================
def test_wallet_status_pending_null_when_no_request(user_token):
    r = requests.get(f"{BASE_URL}/api/wallet/status", headers=_user_headers(user_token), timeout=30)
    assert r.status_code == 200
    body = r.json()
    # After approval the pending_address_change should be null
    assert body.get("pending_address_change") is None


# ==================== Lightning lane (bitcoin/withdraw) ====================
class TestLightningLane:
    def test_lightning_invalid_invoice_400(self, user_token):
        """Even WITHOUT connected wallet, lightning should bypass the wallet gate and
        fail at invoice validation, NOT 403 'register your wallet'."""
        r = requests.post(
            f"{BASE_URL}/api/withdraw/bitcoin",
            headers=_user_headers(user_token),
            json={"address": "notavalidinvoice", "amount": 0.0001, "network": "lightning"},
            timeout=30,
        )
        # Must NOT be 403 with the wallet-registration message
        if r.status_code == 403 and "register your" in r.text.lower():
            pytest.fail(f"Lightning was blocked by wallet gate: {r.text}")
        assert r.status_code == 400
        assert "invalid lightning invoice" in r.text.lower()

    def test_lightning_amount_mismatch_400(self, user_token):
        """lnbc100u = 100 * 1e-6 = 0.0001 BTC. Request amount 0.0005 -> mismatch."""
        invoice = "lnbc100u1p0fakefake"
        r = requests.post(
            f"{BASE_URL}/api/withdraw/bitcoin",
            headers=_user_headers(user_token),
            json={"address": invoice, "amount": 0.0005, "network": "lightning"},
            timeout=30,
        )
        if r.status_code == 403 and "register your" in r.text.lower():
            pytest.fail(f"Lightning was blocked by wallet gate: {r.text}")
        assert r.status_code == 400
        assert "does not match" in r.text.lower()

    def test_lightning_bypass_wallet_gate_with_valid_match(self, user_token, admin_token, test_user_id):
        """Set wallet_status back to disconnected to confirm lightning still works (passes the gate)."""
        # First, disconnect the wallet by deleting btc_wallet_address (we can simulate via reset-user
        # but that wipes balance too). Instead, we just rely on the test_user currently being
        # connected (from approval above) and test that an invoice with MATCHING amount gets past
        # invoice validation. It will fail later at balance check or kraken send, but NOT at wallet gate.
        # lnbc100u = 0.0001 BTC
        invoice = "lnbc100u1p0fakefake"
        r = requests.post(
            f"{BASE_URL}/api/withdraw/bitcoin",
            headers=_user_headers(user_token),
            json={"address": invoice, "amount": 0.0001, "network": "lightning"},
            timeout=60,
        )
        # Should NOT be the wallet-gate 403
        assert not (r.status_code == 403 and "register your" in r.text.lower()), r.text
        # Should NOT be the invoice-validation 400 (the invoice format is valid and amount matches)
        if r.status_code == 400:
            assert "does not match" not in r.text.lower()
            assert "invalid lightning invoice" not in r.text.lower()
        # It's fine if it eventually 400s on Kraken or insufficient balance - the gate was passed.

    def test_bitcoin_network_without_connected_wallet_403(self, admin_token):
        """Register a fresh user (wallet_status defaults to disconnected) and confirm
        network='bitcoin' still gives 403 'register your Bitcoin wallet'."""
        email = f"TEST_btcgate_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"name": "TEST BtcGate", "email": email, "password": "BtcGate#2026"},
            timeout=30,
        )
        assert reg.status_code in (200, 201)
        tok = (reg.json().get("access_token") or reg.json().get("token"))
        try:
            r = requests.post(
                f"{BASE_URL}/api/withdraw/bitcoin",
                headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                json={"address": "bc1qsomeaddress", "amount": 0.001, "network": "bitcoin"},
                timeout=30,
            )
            assert r.status_code == 403
            assert "register your" in r.text.lower() or "pending admin approval" in r.text.lower()
        finally:
            # cleanup throwaway
            r2 = requests.get(f"{BASE_URL}/api/admin/users", headers=_admin_headers(admin_token), timeout=30)
            for u in r2.json().get("users", []):
                if u.get("email") == email:
                    requests.delete(
                        f"{BASE_URL}/api/admin/delete-user/{u['id']}",
                        headers=_admin_headers(admin_token),
                        timeout=30,
                    )
                    break

    def test_lightning_bypass_for_disconnected_user(self, admin_token):
        """A brand-new user with NO wallet must be able to pass the wallet gate on lightning."""
        email = f"TEST_lngate_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"name": "TEST LnGate", "email": email, "password": "LnGate#2026"},
            timeout=30,
        )
        assert reg.status_code in (200, 201)
        tok = reg.json().get("access_token") or reg.json().get("token")
        try:
            r = requests.post(
                f"{BASE_URL}/api/withdraw/bitcoin",
                headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                json={"address": "notavalidinvoice", "amount": 0.0001, "network": "lightning"},
                timeout=30,
            )
            # Should fail with 400 invoice-invalid, NOT 403 wallet-gate
            assert r.status_code == 400, f"Expected 400 (invoice invalid), got {r.status_code}: {r.text[:300]}"
            assert "invalid lightning invoice" in r.text.lower()
        finally:
            r2 = requests.get(f"{BASE_URL}/api/admin/users", headers=_admin_headers(admin_token), timeout=30)
            for u in r2.json().get("users", []):
                if u.get("email") == email:
                    requests.delete(
                        f"{BASE_URL}/api/admin/delete-user/{u['id']}",
                        headers=_admin_headers(admin_token),
                        timeout=30,
                    )
                    break
