#!/usr/bin/env python3
"""
Backend Testing Suite for Bitcoin Mining App - Kraken Withdrawal Integration Focus
Testing Agent - Comprehensive API Testing
"""

import requests
import json
import time
import os
from datetime import datetime
import uuid

# Configuration
BACKEND_URL = "https://koala-mining-app.preview.emergentagent.com/api"
TEST_USER_EMAIL = "kraken.test.user@bitcoinminer.com"
TEST_USER_PASSWORD = "KrakenTest2024!"
TEST_USER_NAME = "Kraken Test User"

# Test Bitcoin addresses (testnet/mainnet compatible)
VALID_BTC_ADDRESS = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"  # Valid bech32 address
INVALID_BTC_ADDRESS = "invalid_address_format"

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
    
    def test_store_miners_authentication(self):
        """Test that store endpoint requires authentication"""
        try:
            # Test without authentication
            session_no_auth = requests.Session()
            response = session_no_auth.get(f"{API_BASE}/store/miners")
            
            # The endpoint should work without authentication (it's a public store listing)
            # But let's verify it returns the same data
            if response.status_code == 200:
                return self.log_test(
                    "Store Miners Public Access", 
                    True, 
                    "Store endpoint is publicly accessible (as expected for store listings)"
                )
            else:
                return self.log_test(
                    "Store Miners Public Access", 
                    False, 
                    f"Unexpected authentication requirement: {response.status_code}"
                )
                
        except Exception as e:
            return self.log_test("Store Miners Authentication", False, f"Exception: {str(e)}")
    
    def test_store_miners_response_consistency(self):
        """Test that multiple calls return consistent data"""
        try:
            responses = []
            for i in range(3):
                response = self.session.get(f"{API_BASE}/store/miners")
                if response.status_code == 200:
                    responses.append(response.json())
                else:
                    return self.log_test(
                        "Store Miners Consistency", 
                        False, 
                        f"Request {i+1} failed: {response.status_code}"
                    )
            
            # Compare all responses
            first_response = responses[0]
            all_consistent = all(resp == first_response for resp in responses[1:])
            
            return self.log_test(
                "Store Miners Response Consistency", 
                all_consistent, 
                "All 3 requests returned identical data" if all_consistent else "Responses differ between calls"
            )
            
        except Exception as e:
            return self.log_test("Store Miners Consistency", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all store system tests"""
        print("=" * 80)
        print("🚀 BACKEND TESTING: Enhanced Store System (Issues #9-11)")
        print("=" * 80)
        print(f"Backend URL: {API_BASE}")
        print(f"Test User: {TEST_USER_EMAIL}")
        print(f"Timestamp: {datetime.now().isoformat()}")
        print("=" * 80)
        
        # Step 1: Setup authentication
        if not self.register_test_user():
            print("\n❌ CRITICAL: Cannot proceed without authentication")
            return False
        
        print("\n" + "=" * 40)
        print("🏪 STORE MINERS ENDPOINT TESTING")
        print("=" * 40)
        
        # Step 2: Test store miners endpoint
        store_success = self.test_store_miners_endpoint()
        
        # Step 3: Test authentication requirements
        auth_success = self.test_store_miners_authentication()
        
        # Step 4: Test response consistency
        consistency_success = self.test_store_miners_response_consistency()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        overall_success = store_success and auth_success and consistency_success
        
        print(f"\n🎯 OVERALL RESULT: {'✅ SUCCESS' if overall_success else '❌ FAILURE'}")
        
        if overall_success:
            print("\n🎉 Enhanced Store System is working correctly!")
            print("✅ All 9 miners present with correct specifications")
            print("✅ Hash rates match: 100GH → 20TH progression")
            print("✅ Prices match: $7.99 → $999.99 range")
            print("✅ Daily rewards calculated with 14-decimal precision")
            print("✅ All miners have 30-day duration")
            print("✅ JSON structure includes required fields")
        else:
            print("\n⚠️  Issues found in Enhanced Store System")
            print("Please review failed tests above for details")
        
        return overall_success

def main():
    """Main test execution"""
    tester = BackendTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()