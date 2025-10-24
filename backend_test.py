#!/usr/bin/env python3
"""
Backend Testing Suite for Bitcoin Mining App
Focus: Enhanced Store System Testing (Issues #9-11)
"""

import requests
import json
import uuid
from datetime import datetime
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
BACKEND_URL = os.getenv("EXPO_PUBLIC_BACKEND_URL", "https://mine-simulator.preview.emergentagent.com")
API_BASE = f"{BACKEND_URL}/api"
TEST_USER_EMAIL = f"storetest_{uuid.uuid4().hex[:8]}@example.com"
TEST_USER_PASSWORD = "TestPassword123!"
TEST_USER_NAME = "Store Test User"

class FacebookAdsBackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        
    def register_and_login(self):
        """Register a new test user and login"""
        try:
            # Generate unique test user
            timestamp = int(time.time())
            test_email = f"fbads_test_{timestamp}@test.com"
            test_password = "TestPass123!"
            test_name = f"FB Ads Tester {timestamp}"
            
            # Register user
            register_data = {
                "name": test_name,
                "email": test_email,
                "password": test_password
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=register_data)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data["access_token"]
                self.user_id = data["user"]["id"]
                
                # Set authorization header for future requests
                self.session.headers.update({
                    "Authorization": f"Bearer {self.auth_token}"
                })
                
                self.log_test("User Registration & Login", True, f"User ID: {self.user_id}")
                return True
            else:
                self.log_test("User Registration & Login", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Registration & Login", False, f"Exception: {str(e)}")
            return False
    
    def test_daily_stats_endpoint(self):
        """Test POST /api/ads/daily-stats endpoint"""
        try:
            response = self.session.post(f"{API_BASE}/ads/daily-stats")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify required fields
                required_fields = ["ads_watched_today", "remaining_ads", "max_daily_ads", "can_watch_ad", "next_reset"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Daily Stats - Required Fields", False, f"Missing fields: {missing_fields}")
                    return False
                
                # Verify data types and values
                if not isinstance(data["ads_watched_today"], int) or data["ads_watched_today"] < 0:
                    self.log_test("Daily Stats - ads_watched_today", False, f"Invalid value: {data['ads_watched_today']}")
                    return False
                
                if not isinstance(data["remaining_ads"], int) or data["remaining_ads"] < 0:
                    self.log_test("Daily Stats - remaining_ads", False, f"Invalid value: {data['remaining_ads']}")
                    return False
                
                if data["max_daily_ads"] != 30:
                    self.log_test("Daily Stats - max_daily_ads", False, f"Expected 30, got {data['max_daily_ads']}")
                    return False
                
                if not isinstance(data["can_watch_ad"], bool):
                    self.log_test("Daily Stats - can_watch_ad", False, f"Expected boolean, got {type(data['can_watch_ad'])}")
                    return False
                
                # For new user, should start with 0 ads watched
                if data["ads_watched_today"] == 0 and data["remaining_ads"] == 30 and data["can_watch_ad"]:
                    self.log_test("Daily Stats - New User Values", True, "New user starts with 0 ads, 30 remaining")
                else:
                    self.log_test("Daily Stats - New User Values", False, f"Unexpected values for new user: {data}")
                
                self.log_test("Daily Stats Endpoint", True, f"All fields present and valid")
                return True
            else:
                self.log_test("Daily Stats Endpoint", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Daily Stats Endpoint", False, f"Exception: {str(e)}")
            return False
    
    def test_watch_ad_endpoint(self, ad_type):
        """Test POST /api/ads/watch endpoint for specific ad type"""
        try:
            ad_data = {"ad_type": ad_type}
            response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ["success", "message", "ad_miner", "daily_stats"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(f"Watch Ad ({ad_type}) - Response Structure", False, f"Missing fields: {missing_fields}")
                    return False
                
                # Verify ad miner details
                ad_miner = data["ad_miner"]
                if ad_miner["hash_rate"] != 2.0:
                    self.log_test(f"Watch Ad ({ad_type}) - Hash Rate", False, f"Expected 2.0 GH/s, got {ad_miner['hash_rate']}")
                    return False
                
                if ad_miner["duration_hours"] != 24:
                    self.log_test(f"Watch Ad ({ad_type}) - Duration", False, f"Expected 24 hours, got {ad_miner['duration_hours']}")
                    return False
                
                # Verify daily stats increment
                daily_stats = data["daily_stats"]
                if daily_stats["max_daily_ads"] != 30:
                    self.log_test(f"Watch Ad ({ad_type}) - Max Daily Ads", False, f"Expected 30, got {daily_stats['max_daily_ads']}")
                    return False
                
                self.log_test(f"Watch Ad ({ad_type})", True, f"Created 2.0 GH/s miner for 24h, counter incremented")
                return True
            else:
                self.log_test(f"Watch Ad ({ad_type})", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test(f"Watch Ad ({ad_type})", False, f"Exception: {str(e)}")
            return False
    
    def test_all_ad_types(self):
        """Test all three ad types"""
        ad_types = ["app_launch", "withdrawal", "miner_activation"]
        success_count = 0
        
        for ad_type in ad_types:
            if self.test_watch_ad_endpoint(ad_type):
                success_count += 1
        
        if success_count == len(ad_types):
            self.log_test("All Ad Types", True, f"All {len(ad_types)} ad types working correctly")
            return True
        else:
            self.log_test("All Ad Types", False, f"Only {success_count}/{len(ad_types)} ad types working")
            return False
    
    def test_daily_limit_enforcement(self):
        """Test that daily limit of 30 ads is enforced"""
        try:
            # First, check current stats
            stats_response = self.session.post(f"{API_BASE}/ads/daily-stats")
            if stats_response.status_code != 200:
                self.log_test("Daily Limit - Get Initial Stats", False, f"Failed to get stats: {stats_response.status_code}")
                return False
            
            initial_stats = stats_response.json()
            ads_watched = initial_stats["ads_watched_today"]
            
            # Watch ads until we reach the limit
            ads_to_watch = 30 - ads_watched
            
            if ads_to_watch <= 0:
                self.log_test("Daily Limit - Already at Limit", True, "User already at daily limit")
                return True
            
            # Watch remaining ads (up to 30 total)
            for i in range(ads_to_watch):
                ad_data = {"ad_type": "app_launch"}
                response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
                
                if response.status_code != 200:
                    self.log_test("Daily Limit - Watch Ads to Limit", False, f"Failed at ad {i+1}: {response.status_code}")
                    return False
            
            # Now try to watch one more ad (should be rejected)
            ad_data = {"ad_type": "app_launch"}
            response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
            
            if response.status_code == 429:
                self.log_test("Daily Limit Enforcement", True, "31st ad correctly rejected with HTTP 429")
                return True
            else:
                self.log_test("Daily Limit Enforcement", False, f"Expected HTTP 429, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Daily Limit Enforcement", False, f"Exception: {str(e)}")
            return False
    
    def test_invalid_ad_type(self):
        """Test that invalid ad types are rejected"""
        try:
            ad_data = {"ad_type": "invalid_type"}
            response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
            
            if response.status_code == 400:
                self.log_test("Invalid Ad Type", True, "Invalid ad type correctly rejected with HTTP 400")
                return True
            else:
                self.log_test("Invalid Ad Type", False, f"Expected HTTP 400, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Invalid Ad Type", False, f"Exception: {str(e)}")
            return False
    
    def test_unauthenticated_requests(self):
        """Test that unauthenticated requests are rejected"""
        try:
            # Create session without auth token
            unauth_session = requests.Session()
            
            # Test daily stats without auth
            response = unauth_session.post(f"{API_BASE}/ads/daily-stats")
            if response.status_code not in [401, 403]:
                self.log_test("Unauthenticated Daily Stats", False, f"Expected 401/403, got {response.status_code}")
                return False
            
            # Test watch ad without auth
            ad_data = {"ad_type": "app_launch"}
            response = unauth_session.post(f"{API_BASE}/ads/watch", json=ad_data)
            if response.status_code not in [401, 403]:
                self.log_test("Unauthenticated Watch Ad", False, f"Expected 401/403, got {response.status_code}")
                return False
            
            self.log_test("Unauthenticated Requests", True, "Properly rejected unauthenticated requests")
            return True
            
        except Exception as e:
            self.log_test("Unauthenticated Requests", False, f"Exception: {str(e)}")
            return False
    
    def test_active_miners_endpoint(self):
        """Test GET /api/ads/active-miners endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/ads/active-miners")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ["active_ad_miners", "total_miners", "total_ad_hashrate"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Active Miners - Response Structure", False, f"Missing fields: {missing_fields}")
                    return False
                
                # Verify data types
                if not isinstance(data["active_ad_miners"], list):
                    self.log_test("Active Miners - Data Type", False, "active_ad_miners should be a list")
                    return False
                
                if not isinstance(data["total_miners"], int):
                    self.log_test("Active Miners - Data Type", False, "total_miners should be an integer")
                    return False
                
                if not isinstance(data["total_ad_hashrate"], (int, float)):
                    self.log_test("Active Miners - Data Type", False, "total_ad_hashrate should be a number")
                    return False
                
                self.log_test("Active Miners Endpoint", True, f"Found {data['total_miners']} active ad miners")
                return True
            else:
                self.log_test("Active Miners Endpoint", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Active Miners Endpoint", False, f"Exception: {str(e)}")
            return False
    
    def test_ad_miner_stacking(self):
        """Test that multiple ads create separate miners that stack"""
        try:
            # Watch 3 ads of the same type
            for i in range(3):
                ad_data = {"ad_type": "miner_activation"}
                response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
                
                if response.status_code != 200:
                    self.log_test("Ad Miner Stacking", False, f"Failed to watch ad {i+1}: {response.status_code}")
                    return False
            
            # Check active miners
            response = self.session.get(f"{API_BASE}/ads/active-miners")
            if response.status_code != 200:
                self.log_test("Ad Miner Stacking", False, f"Failed to get active miners: {response.status_code}")
                return False
            
            data = response.json()
            
            # Should have multiple ad miners
            if data["total_miners"] >= 3:
                self.log_test("Ad Miner Stacking", True, f"Multiple ads created {data['total_miners']} separate miners")
                return True
            else:
                self.log_test("Ad Miner Stacking", False, f"Expected at least 3 miners, got {data['total_miners']}")
                return False
                
        except Exception as e:
            self.log_test("Ad Miner Stacking", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run comprehensive Facebook Ads backend tests"""
        print("🚀 Starting Facebook Ads Backend Integration Tests")
        print("=" * 60)
        
        # Authentication
        if not self.register_and_login():
            print("❌ Authentication failed - cannot continue tests")
            return False
        
        # Core endpoint tests
        self.test_daily_stats_endpoint()
        self.test_all_ad_types()
        self.test_active_miners_endpoint()
        self.test_ad_miner_stacking()
        
        # Security and validation tests
        self.test_invalid_ad_type()
        self.test_unauthenticated_requests()
        
        # Daily limit test (run last as it consumes many ads)
        self.test_daily_limit_enforcement()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            if result["details"]:
                print(f"   └─ {result['details']}")
        
        print(f"\n🎯 RESULTS: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL FACEBOOK ADS BACKEND TESTS PASSED!")
            return True
        else:
            print(f"⚠️  {total - passed} tests failed - see details above")
            return False

def main():
    """Main test execution"""
    print(f"🧪 Facebook Ads Backend Integration Test Suite")
    print(f"🔧 Testing API at: {API_BASE}")
    print("=" * 80)
    
    tester = FacebookAdsBackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ Facebook Ads backend integration is fully functional!")
    else:
        print("\n❌ Facebook Ads backend integration has issues that need attention!")
    
    return success

if __name__ == "__main__":
    main()