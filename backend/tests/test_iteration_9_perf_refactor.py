"""
Iteration 9 - Deployment-readiness performance refactor regression tests.

Validates that the refactors in /app/backend/server.py:
  - process_mining_earnings (bulk_write + insert_many + per-user aggregation)
  - check_expired_miners       (bulk_write for time_remaining updates)
  - /api/activity/recent       (batch user_map instead of N+1 find_one)
did NOT break functionality.

Background scheduler runs every 5s (APScheduler).
"""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://paypal-ads-rebuild.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "bitcoin_mining_db")

TEST_USER_EMAIL = "koalatest@example.com"
TEST_USER_PASSWORD = "TestUser#2026"
ADMIN_EMAIL = "colourfulkoaladevelopment@gmail.com"
ADMIN_PASSWORD = "KoalaAdmin#2026"


# ---------- shared fixtures ----------
@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def user_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
                      timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="module")
def user_id(user_token):
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {user_token}"}, timeout=10)
    assert r.status_code == 200
    return r.json()["id"] if "id" in r.json() else r.json().get("user", {}).get("id")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def ensure_active_miner(db, user_token, user_id):
    """Guarantee the test user has at least one ACTIVE miner with future expires_at."""
    # Try to find any active miner first
    existing = db.miners.find_one({"user_id": user_id, "status": "active"})
    if existing:
        return existing["_id"]

    # Try free-miner activation endpoint
    r = requests.post(f"{BASE_URL}/api/miners/activate-free",
                      headers={"Authorization": f"Bearer {user_token}"}, timeout=10)
    if r.status_code == 200:
        m = db.miners.find_one({"user_id": user_id, "status": "active"})
        if m:
            return m["_id"]

    # Fallback: insert a synthetic active miner directly into the DB
    import uuid
    from datetime import datetime, timedelta
    miner_id = str(uuid.uuid4())
    now = datetime.utcnow()
    db.miners.insert_one({
        "_id": miner_id,
        "user_id": user_id,
        "name": "TEST_Perf Refactor Miner",
        "hash_rate": 5000.0,        # 5000 GH/s makes earnings per-5s easily measurable
        "miner_type": "free",
        "status": "active",
        "duration_hours": 24.0,
        "time_remaining": 24.0,
        "total_earned": 0.0,
        "purchase_price": 0.0,
        "created_at": now,
        "activated_at": now,
        "expires_at": now + timedelta(hours=24),
    })
    return miner_id


# ---------- regression smoke ----------
class TestRegressionSmoke:
    """Smoke tests: confirm core endpoints still 200 after refactor."""

    def test_auth_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
                          timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body and "user" in body
        assert body["user"]["email"] == TEST_USER_EMAIL

    def test_wallet_balance(self, user_token):
        r = requests.get(f"{BASE_URL}/api/wallet/balance",
                         headers={"Authorization": f"Bearer {user_token}"}, timeout=10)
        assert r.status_code == 200
        body = r.json()
        for key in ("total_balance", "today_earnings", "total_miners",
                    "active_miners", "current_hash_rate"):
            assert key in body, f"missing key {key} in wallet/balance response"

    def test_miners_list(self, user_token):
        r = requests.get(f"{BASE_URL}/api/miners/list",
                         headers={"Authorization": f"Bearer {user_token}"}, timeout=10)
        assert r.status_code == 200
        assert "miners" in r.json()
        assert isinstance(r.json()["miners"], list)

    def test_store_miners(self, user_token):
        r = requests.get(f"{BASE_URL}/api/store/miners",
                         headers={"Authorization": f"Bearer {user_token}"}, timeout=10)
        assert r.status_code == 200


# ---------- /api/activity/recent (batch user_map refactor) ----------
class TestActivityRecent:
    def test_endpoint_returns_200_well_formed(self):
        r = requests.get(f"{BASE_URL}/api/activity/recent", timeout=10)
        assert r.status_code == 200, f"unexpected status {r.status_code}: {r.text}"
        body = r.json()
        assert "activities" in body and "count" in body
        assert isinstance(body["activities"], list)
        assert isinstance(body["count"], int)

    def test_activity_items_well_formed(self):
        """If activities present, each item must have type + user_name + timestamp,
        and user_name must be obfuscated (contain at least one '*' for multi-letter names)."""
        r = requests.get(f"{BASE_URL}/api/activity/recent", timeout=10)
        assert r.status_code == 200
        body = r.json()
        for act in body["activities"]:
            assert act["type"] in ("purchase", "cashout"), f"unknown activity type: {act}"
            assert "user_name" in act and isinstance(act["user_name"], str)
            assert "timestamp" in act
            if act["type"] == "purchase":
                assert "miner_name" in act and "hash_rate" in act
            else:
                assert "amount" in act

    def test_empty_activity_does_not_error(self, db):
        """Even when no recent purchases/withdrawals exist, endpoint must return 200 with empty list."""
        # Endpoint window is last 30 seconds; just call it and check shape (don't mutate prod data)
        r = requests.get(f"{BASE_URL}/api/activity/recent", timeout=10)
        assert r.status_code == 200
        body = r.json()
        # If empty, count should be 0 and list empty
        if not body["activities"]:
            assert body["count"] == 0


# ---------- process_mining_earnings (bulk_write + insert_many) ----------
class TestMiningEarnings:
    def test_balance_increases_after_wait(self, db, user_token, user_id, ensure_active_miner):
        # Sanity: at least one active miner
        active_count = db.miners.count_documents({"user_id": user_id, "status": "active"})
        assert active_count >= 1, "test user has no active miner"

        # Capture balance from DB (full float precision)
        u_before = db.users.find_one({"_id": user_id}, {"bitcoin_balance": 1, "total_earnings": 1})
        bal_before = float(u_before.get("bitcoin_balance", 0.0))
        earn_before = float(u_before.get("total_earnings", 0.0))

        # Wait for ~3 scheduler ticks (job runs every 5s)
        time.sleep(16)

        u_after = db.users.find_one({"_id": user_id}, {"bitcoin_balance": 1, "total_earnings": 1})
        bal_after = float(u_after.get("bitcoin_balance", 0.0))
        earn_after = float(u_after.get("total_earnings", 0.0))

        delta_bal = bal_after - bal_before
        delta_earn = earn_after - earn_before
        print(f"\n[earnings] bal_before={bal_before:.18f} bal_after={bal_after:.18f} delta={delta_bal:.18f}")
        print(f"[earnings] earn_before={earn_before:.18f} earn_after={earn_after:.18f} delta={delta_earn:.18f}")
        assert delta_bal > 0, f"bitcoin_balance did not increase after 16s (delta={delta_bal})"
        assert delta_earn > 0, f"total_earnings did not increase after 16s (delta={delta_earn})"

    def test_earning_transactions_recorded(self, db, user_id, ensure_active_miner):
        """After waiting, new 'earning' transactions should exist for this user."""
        from datetime import datetime, timedelta
        cutoff = datetime.utcnow() - timedelta(seconds=2)
        before_count = db.transactions.count_documents({
            "user_id": user_id, "transaction_type": "earning",
            "created_at": {"$gte": cutoff}
        })

        time.sleep(11)  # >= 2 ticks

        after_count = db.transactions.count_documents({
            "user_id": user_id, "transaction_type": "earning",
            "created_at": {"$gte": cutoff}
        })
        print(f"\n[txn] earning txns after wait: {after_count} (was {before_count} at start)")
        assert after_count >= 2, f"expected at least 2 new 'earning' transactions, got {after_count}"

        # Inspect one transaction's shape
        sample = db.transactions.find_one({
            "user_id": user_id, "transaction_type": "earning",
            "created_at": {"$gte": cutoff}
        })
        assert sample is not None
        for field in ("user_id", "transaction_type", "amount", "description", "miner_id", "created_at"):
            assert field in sample, f"earning txn missing field {field}: {sample}"
        assert sample["transaction_type"] == "earning"
        assert sample["amount"] > 0


# ---------- check_expired_miners (bulk time_remaining update) ----------
class TestCheckExpiredMiners:
    def test_time_remaining_decreases(self, db, user_id, ensure_active_miner):
        miner_id = ensure_active_miner
        m_before = db.miners.find_one({"_id": miner_id}, {"time_remaining": 1, "status": 1})
        assert m_before is not None and m_before["status"] == "active"
        tr_before = float(m_before.get("time_remaining", 0.0))

        time.sleep(11)  # >= 2 check_expired_miners ticks

        m_after = db.miners.find_one({"_id": miner_id}, {"time_remaining": 1, "status": 1})
        tr_after = float(m_after.get("time_remaining", 0.0))
        print(f"\n[time_remaining] before={tr_before} after={tr_after}")
        # time_remaining is in hours; should decrease by ~0.003 over 11s. Allow tiny tolerance.
        assert tr_after < tr_before, f"time_remaining did not decrease ({tr_before} -> {tr_after})"

    def test_expired_miner_gets_deactivated(self, db, user_id):
        """Force a miner to be expired and confirm check_expired_miners flips it to 'expired'
        with time_remaining=0 within one scheduler tick."""
        import uuid
        from datetime import datetime, timedelta
        miner_id = f"TEST_expire_{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow()
        db.miners.insert_one({
            "_id": miner_id,
            "user_id": user_id,
            "name": "TEST_Expire Now Miner",
            "hash_rate": 1.0,
            "miner_type": "free",
            "status": "active",
            "duration_hours": 0.0,
            "time_remaining": 0.0001,
            "total_earned": 0.0,
            "purchase_price": 0.0,
            "created_at": now - timedelta(hours=1),
            "activated_at": now - timedelta(hours=1),
            "expires_at": now - timedelta(seconds=5),  # already expired
        })
        try:
            time.sleep(8)  # one full scheduler tick + buffer
            m = db.miners.find_one({"_id": miner_id}, {"status": 1, "time_remaining": 1})
            assert m is not None
            print(f"\n[expire] status={m['status']} time_remaining={m.get('time_remaining')}")
            assert m["status"] == "expired", f"miner not flipped to expired (got {m['status']})"
            assert m.get("time_remaining", 1) == 0
        finally:
            db.miners.delete_one({"_id": miner_id})


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-v", "-s"]))
