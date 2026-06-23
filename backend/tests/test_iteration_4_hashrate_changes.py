"""Iteration 4 backend regression tests.

Covers:
1. /api/store/miners returns DOUBLED hashrates and unchanged prices.
2. For every miner in the store catalog, /api/payments/create-paypal-order
   returns 200 with original_price/final_price EXACTLY matching the store
   price (single-source-of-truth still holds after doubling).
3. /api/miners/activate-free creates a free miner with hash_rate == 10.0.
4. /api/ads/watch with ad_type='miner_activation' returns
   ad_miner.hash_rate == 20 and duration_hours == 24.
"""
import os
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://paypal-ads-rebuild.preview.emergentagent.com"
).rstrip("/")

USER_EMAIL = "koalatest@example.com"
USER_PASSWORD = "TestUser#2026"

# Spec for doubled hashrates and unchanged prices
EXPECTED_MINERS = {
    "miner_100gh": {"hash_rate": 200.0, "price": 7.99, "name": "Standard Miner"},
    "miner_200gh": {"hash_rate": 400.0, "price": 14.99, "name": "Advanced Miner"},
    "miner_400gh": {"hash_rate": 800.0, "price": 29.99, "name": "Pro Miner"},
    "miner_1th":   {"hash_rate": 2000.0, "price": 79.99, "name": "Elite Miner"},
    "miner_2th":   {"hash_rate": 4000.0, "price": 159.99, "name": "Master Miner"},
    "miner_4th":   {"hash_rate": 8000.0, "price": 299.99, "name": "Supreme Miner"},
    "miner_10th":  {"hash_rate": 20000.0, "price": 449.99, "name": "Ultimate Miner"},
    "miner_15th":  {"hash_rate": 30000.0, "price": 749.99, "name": "Legendary Miner"},
    "miner_20th":  {"hash_rate": 40000.0, "price": 999.99, "name": "Mythical Miner"},
}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_token(session):
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": USER_EMAIL, "password": USER_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"user login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --- Doubled hashrates in store catalog ---
class TestStoreMinerDoubledHashrates:
    def test_store_returns_doubled_hashrates_and_unchanged_prices(self, session, user_token):
        r = session.get(
            f"{BASE_URL}/api/store/miners", headers=_auth(user_token), timeout=30
        )
        assert r.status_code == 200, r.text
        body = r.json()
        miners = body if isinstance(body, list) else body.get("miners")
        assert miners, f"empty store catalog: {body}"

        catalog = {m["id"]: m for m in miners}
        for mid, expected in EXPECTED_MINERS.items():
            assert mid in catalog, f"{mid} missing from /api/store/miners"
            m = catalog[mid]
            assert m["name"] == expected["name"], (
                f"{mid} name: got {m['name']!r} expected {expected['name']!r}"
            )
            assert abs(float(m["hash_rate"]) - expected["hash_rate"]) < 0.001, (
                f"{mid} hash_rate: got {m['hash_rate']} expected {expected['hash_rate']}"
            )
            assert abs(float(m["price"]) - expected["price"]) < 0.001, (
                f"{mid} price changed: got {m['price']} expected {expected['price']}"
            )

    def test_store_catalog_and_paypal_catalog_match_after_doubling(self, session, user_token):
        """Real-money parity: every miner in /api/store/miners must be
        purchasable via create-paypal-order with EXACT price match."""
        r = session.get(
            f"{BASE_URL}/api/store/miners", headers=_auth(user_token), timeout=30
        )
        assert r.status_code == 200, r.text
        body = r.json()
        miners = body if isinstance(body, list) else body.get("miners")
        assert miners and len(miners) >= 9

        for miner in miners:
            mid = miner["id"]
            store_price = float(miner["price"])
            resp = session.post(
                f"{BASE_URL}/api/payments/create-paypal-order",
                json={"miner_id": mid, "promo_code": "", "subscription_type": "one_time"},
                headers=_auth(user_token),
                timeout=60,
            )
            assert resp.status_code == 200, (
                f"create-paypal-order FAILED for {mid} ({miner.get('name')}): "
                f"{resp.status_code} {resp.text}"
            )
            data = resp.json()
            assert abs(float(data["original_price"]) - store_price) < 0.001, (
                f"PRICE DIVERGENCE for {mid}: store=${store_price} "
                f"vs paypal.original_price=${data['original_price']}"
            )
            assert abs(float(data["final_price"]) - store_price) < 0.001, (
                f"PRICE DIVERGENCE for {mid}: store=${store_price} "
                f"vs paypal.final_price=${data['final_price']}"
            )


# --- Free miner activation ---
class TestActivateFreeMiner:
    def test_activate_free_miner_creates_10ghs_miner(self, session, user_token):
        # Attempt activation. If already active today, endpoint returns 400 -
        # in that case fetch miners list and verify the free miner is 10 GH/s.
        r = session.post(
            f"{BASE_URL}/api/miners/activate-free",
            headers=_auth(user_token),
            timeout=30,
        )
        if r.status_code == 400:
            # Already active today - verify existing one has hash_rate == 10
            ml = session.get(
                f"{BASE_URL}/api/miners/list", headers=_auth(user_token), timeout=30
            )
            assert ml.status_code == 200, ml.text
            body = ml.json()
            miners = body if isinstance(body, list) else body.get("miners", [])
            free_miners = [
                m for m in miners
                if (m.get("miner_type") == "free" or m.get("name") == "Daily Free Miner")
            ]
            assert free_miners, f"no free miner found in list: {miners}"
            hr = float(free_miners[0].get("hash_rate", 0))
            assert abs(hr - 10.0) < 0.001, f"free miner hash_rate expected 10, got {hr}"
            return

        assert r.status_code == 200, f"activate-free unexpected: {r.status_code} {r.text}"
        # After activation, fetch list and confirm the free miner is 10 GH/s
        ml = session.get(
            f"{BASE_URL}/api/miners/list", headers=_auth(user_token), timeout=30
        )
        assert ml.status_code == 200, ml.text
        body = ml.json()
        miners = body if isinstance(body, list) else body.get("miners", [])
        free_miners = [
            m for m in miners
            if (m.get("miner_type") == "free" or m.get("name") == "Daily Free Miner")
        ]
        assert free_miners, "no free miner created after activate-free"
        hr = float(free_miners[0].get("hash_rate", 0))
        assert abs(hr - 10.0) < 0.001, f"free miner hash_rate expected 10, got {hr}"


# --- Rewarded ad miner ---
class TestRewardedAdMiner:
    def test_watch_miner_activation_ad_returns_20ghs_24h(self, session, user_token):
        r = session.post(
            f"{BASE_URL}/api/ads/watch",
            json={"ad_type": "miner_activation"},
            headers=_auth(user_token),
            timeout=30,
        )
        # Acceptable: 200 success with reward; or 400 if daily ad limit reached.
        if r.status_code == 400:
            pytest.skip(f"daily ad limit reached for test user: {r.text}")

        assert r.status_code == 200, f"/api/ads/watch failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("success") is True, data
        ad_miner = data.get("ad_miner")
        assert ad_miner, f"missing ad_miner in response: {data}"
        assert abs(float(ad_miner["hash_rate"]) - 20.0) < 0.001, (
            f"ad miner hash_rate expected 20, got {ad_miner['hash_rate']}"
        )
        assert int(ad_miner["duration_hours"]) == 24, (
            f"ad miner duration expected 24h, got {ad_miner['duration_hours']}"
        )
