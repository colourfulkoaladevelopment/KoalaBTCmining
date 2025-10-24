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

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        return success
    
    def register_test_user(self):
        """Register a test user for authentication"""
        try:
            payload = {
                "name": TEST_USER_NAME,
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                
                # Set authorization header for future requests
                self.session.headers.update({
                    "Authorization": f"Bearer {self.auth_token}"
                })
                
                return self.log_test(
                    "User Registration", 
                    True, 
                    f"User registered successfully with ID: {self.user_id}"
                )
            else:
                return self.log_test(
                    "User Registration", 
                    False, 
                    f"Registration failed: {response.status_code} - {response.text}"
                )
                
        except Exception as e:
            return self.log_test("User Registration", False, f"Exception: {str(e)}")
    
    def test_store_miners_endpoint(self):
        """Test GET /api/store/miners endpoint - Main focus of this testing"""
        try:
            response = self.session.get(f"{API_BASE}/store/miners")
            
            if response.status_code != 200:
                return self.log_test(
                    "Store Miners Endpoint Access", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
            
            # Test successful response
            self.log_test("Store Miners Endpoint Access", True, "Endpoint accessible")
            
            try:
                data = response.json()
            except json.JSONDecodeError:
                return self.log_test(
                    "Store Miners JSON Response", 
                    False, 
                    "Response is not valid JSON"
                )
            
            # Test JSON structure
            if "miners" not in data:
                return self.log_test(
                    "Store Miners JSON Structure", 
                    False, 
                    "Response missing 'miners' key"
                )
            
            self.log_test("Store Miners JSON Structure", True, "Response has 'miners' key")
            
            miners = data["miners"]
            
            # Test exact count (should be 9 miners)
            expected_count = 9
            actual_count = len(miners)
            count_success = actual_count == expected_count
            self.log_test(
                "Store Miners Count", 
                count_success, 
                f"Expected: {expected_count}, Actual: {actual_count}"
            )
            
            if not count_success:
                return False
            
            # Expected miner specifications from the review request
            expected_miners = [
                {"name": "Standard Miner", "hash_rate": 100.0, "price": 7.99, "duration_days": 30, "daily_reward": 0.00000054350000},
                {"name": "Advanced Miner", "hash_rate": 200.0, "price": 14.99, "duration_days": 30, "daily_reward": 0.00000108700000},
                {"name": "Pro Miner", "hash_rate": 400.0, "price": 29.99, "duration_days": 30, "daily_reward": 0.00000217400000},
                {"name": "Elite Miner", "hash_rate": 1000.0, "price": 79.99, "duration_days": 30, "daily_reward": 0.00000543500000},
                {"name": "Master Miner", "hash_rate": 2000.0, "price": 159.99, "duration_days": 30, "daily_reward": 0.00001087000000},
                {"name": "Supreme Miner", "hash_rate": 4000.0, "price": 299.99, "duration_days": 30, "daily_reward": 0.00002174000000},
                {"name": "Ultimate Miner", "hash_rate": 10000.0, "price": 449.99, "duration_days": 30, "daily_reward": 0.00005435000000},
                {"name": "Legendary Miner", "hash_rate": 15000.0, "price": 749.99, "duration_days": 30, "daily_reward": 0.00008152500000},
                {"name": "Mythical Miner", "hash_rate": 20000.0, "price": 999.99, "duration_days": 30, "daily_reward": 0.00010870000000}
            ]
            
            # Test each miner's specifications
            all_miners_valid = True
            
            for i, expected in enumerate(expected_miners):
                if i >= len(miners):
                    self.log_test(
                        f"Miner {i+1} Existence", 
                        False, 
                        f"Missing miner at index {i}"
                    )
                    all_miners_valid = False
                    continue
                
                actual = miners[i]
                miner_name = expected["name"]
                
                # Test required fields exist
                required_fields = ["id", "name", "hash_rate", "price", "duration_days", "daily_reward"]
                for field in required_fields:
                    if field not in actual:
                        self.log_test(
                            f"{miner_name} - Field '{field}'", 
                            False, 
                            f"Missing required field: {field}"
                        )
                        all_miners_valid = False
                        continue
                
                # Test name
                name_match = actual["name"] == expected["name"]
                self.log_test(
                    f"{miner_name} - Name", 
                    name_match, 
                    f"Expected: '{expected['name']}', Actual: '{actual.get('name', 'N/A')}'"
                )
                if not name_match:
                    all_miners_valid = False
                
                # Test hash rate
                hash_rate_match = actual["hash_rate"] == expected["hash_rate"]
                self.log_test(
                    f"{miner_name} - Hash Rate", 
                    hash_rate_match, 
                    f"Expected: {expected['hash_rate']} GH/s, Actual: {actual.get('hash_rate', 'N/A')} GH/s"
                )
                if not hash_rate_match:
                    all_miners_valid = False
                
                # Test price
                price_match = actual["price"] == expected["price"]
                self.log_test(
                    f"{miner_name} - Price", 
                    price_match, 
                    f"Expected: ${expected['price']}, Actual: ${actual.get('price', 'N/A')}"
                )
                if not price_match:
                    all_miners_valid = False
                
                # Test duration
                duration_match = actual["duration_days"] == expected["duration_days"]
                self.log_test(
                    f"{miner_name} - Duration", 
                    duration_match, 
                    f"Expected: {expected['duration_days']} days, Actual: {actual.get('duration_days', 'N/A')} days"
                )
                if not duration_match:
                    all_miners_valid = False
                
                # Test daily reward (14-decimal precision)
                daily_reward_match = abs(actual["daily_reward"] - expected["daily_reward"]) < 1e-15
                self.log_test(
                    f"{miner_name} - Daily Reward", 
                    daily_reward_match, 
                    f"Expected: {expected['daily_reward']:.14f}, Actual: {actual.get('daily_reward', 'N/A'):.14f}"
                )
                if not daily_reward_match:
                    all_miners_valid = False
            
            # Test hash rate progression (should be: 100, 200, 400, 1000, 2000, 4000, 10000, 15000, 20000)
            expected_hash_rates = [100, 200, 400, 1000, 2000, 4000, 10000, 15000, 20000]
            actual_hash_rates = [miner["hash_rate"] for miner in miners]
            hash_rate_progression_match = actual_hash_rates == expected_hash_rates
            self.log_test(
                "Hash Rate Progression", 
                hash_rate_progression_match, 
                f"Expected: {expected_hash_rates}, Actual: {actual_hash_rates}"
            )
            
            # Test price progression (should be ascending)
            actual_prices = [miner["price"] for miner in miners]
            price_ascending = all(actual_prices[i] <= actual_prices[i+1] for i in range(len(actual_prices)-1))
            self.log_test(
                "Price Progression (Ascending)", 
                price_ascending, 
                f"Prices: {actual_prices}"
            )
            
            return all_miners_valid and hash_rate_progression_match and price_ascending
            
        except Exception as e:
            return self.log_test("Store Miners Endpoint", False, f"Exception: {str(e)}")
    
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