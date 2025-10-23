#!/usr/bin/env python3
"""
Test Facebook Ads Daily Limit Enforcement (30 ads max)
"""

import requests
import time

BACKEND_URL = "https://mine-simulator.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

def test_daily_limit():
    # Register test user
    register_data = {
        "name": "Daily Limit Test User",
        "email": f"limit_test_{int(time.time())}@test.com",
        "password": "testpass123"
    }
    
    session = requests.Session()
    response = session.post(f"{API_BASE}/auth/register", json=register_data)
    
    if response.status_code != 200:
        print(f"❌ Failed to register user: {response.status_code}")
        return
    
    data = response.json()
    auth_token = data["access_token"]
    session.headers.update({"Authorization": f"Bearer {auth_token}"})
    
    print(f"✅ Registered user: {data['user']['id']}")
    
    # Watch ads until we hit the limit
    for i in range(35):  # Try to watch 35 ads (should be rejected after 30)
        ad_data = {"ad_type": "miner_activation"}
        response = session.post(f"{API_BASE}/ads/watch", json=ad_data)
        
        if response.status_code == 200:
            print(f"✅ Ad {i+1}: Success")
        elif response.status_code == 429:
            print(f"⚠️  Ad {i+1}: Daily limit reached (expected)")
            break
        else:
            print(f"❌ Ad {i+1}: Unexpected error {response.status_code}")
            break
    
    # Check final stats
    stats_response = session.post(f"{API_BASE}/ads/daily-stats")
    if stats_response.status_code == 200:
        stats = stats_response.json()
        print(f"📊 Final stats: {stats['ads_watched_today']}/30 ads watched")
        
        if stats['ads_watched_today'] == 30:
            print("🎉 Daily limit enforcement working correctly!")
        else:
            print(f"⚠️  Expected 30 ads, got {stats['ads_watched_today']}")

if __name__ == "__main__":
    test_daily_limit()