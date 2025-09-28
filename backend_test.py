#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Bitcoin Mining Simulator
Tests all authentication, mining, referral, and store functionality
"""

import requests
import json
import time
import random
import string
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

# Get backend URL from frontend .env
FRONTEND_ENV_PATH = "/app/frontend/.env"
BACKEND_URL = None

try:
    with open(FRONTEND_ENV_PATH, 'r') as f:
        for line in f:
            if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                BACKEND_URL = line.split('=', 1)[1].strip().strip('"')
                break
except:
    pass

if not BACKEND_URL:
    BACKEND_URL = "http://localhost:8001"

API_BASE = f"{BACKEND_URL}/api"

print(f"🔧 Testing Bitcoin Mining Simulator API at: {API_BASE}")
print("=" * 80)

class BitcoinMiningAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'errors': []
        }
        
    def log_result(self, test_name, success, message=""):
        if success:
            print(f"✅ {test_name}")
            self.test_results['passed'] += 1
        else:
            print(f"❌ {test_name}: {message}")
            self.test_results['failed'] += 1
            self.test_results['errors'].append(f"{test_name}: {message}")
    
    def test_health_check(self):
        """Test /api/health endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy':
                    self.log_result("Health Check", True)
                    return True
                else:
                    self.log_result("Health Check", False, f"Unexpected response: {data}")
            else:
                self.log_result("Health Check", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Health Check", False, f"Exception: {str(e)}")
        return False
    
    def test_user_profile(self):
        """Test /api/user/profile endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/user/profile")
            if response.status_code == 200:
                data = response.json()
                required_fields = ['id', 'username', 'email', 'bitcoin_balance', 'total_earnings']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    if data['username'] == 'demo_user':
                        self.log_result("User Profile", True)
                        return data
                    else:
                        self.log_result("User Profile", False, f"Unexpected username: {data['username']}")
                else:
                    self.log_result("User Profile", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("User Profile", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("User Profile", False, f"Exception: {str(e)}")
        return None
    
    def test_wallet_balance(self):
        """Test /api/wallet/balance endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/wallet/balance")
            if response.status_code == 200:
                data = response.json()
                required_fields = ['total_balance', 'today_earnings', 'total_miners', 'active_miners']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    # Validate data types
                    if (isinstance(data['total_balance'], (int, float)) and
                        isinstance(data['today_earnings'], (int, float)) and
                        isinstance(data['total_miners'], int) and
                        isinstance(data['active_miners'], int)):
                        self.log_result("Wallet Balance", True)
                        return data
                    else:
                        self.log_result("Wallet Balance", False, "Invalid data types in response")
                else:
                    self.log_result("Wallet Balance", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("Wallet Balance", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Wallet Balance", False, f"Exception: {str(e)}")
        return None
    
    def test_miners_list(self):
        """Test /api/miners/list endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/miners/list")
            if response.status_code == 200:
                data = response.json()
                if 'miners' in data and isinstance(data['miners'], list):
                    miners = data['miners']
                    if len(miners) > 0:
                        # Check first miner structure
                        miner = miners[0]
                        required_fields = ['id', 'name', 'hash_rate', 'status', 'time_remaining', 'total_earned', 'miner_type']
                        missing_fields = [field for field in required_fields if field not in miner]
                        
                        if not missing_fields:
                            self.log_result("Miners List", True)
                            return miners
                        else:
                            self.log_result("Miners List", False, f"Missing miner fields: {missing_fields}")
                    else:
                        self.log_result("Miners List", False, "No miners found (demo miners should be created)")
                else:
                    self.log_result("Miners List", False, "Invalid response structure")
            else:
                self.log_result("Miners List", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Miners List", False, f"Exception: {str(e)}")
        return None
    
    def test_create_miner(self):
        """Test /api/miners/create endpoint"""
        try:
            miner_data = {
                "name": "Test Miner",
                "hash_rate": 10.5,
                "duration": 24.0,
                "type": "free",
                "price": 0.0
            }
            
            response = self.session.post(f"{API_BASE}/miners/create", json=miner_data)
            if response.status_code == 200:
                data = response.json()
                if 'message' in data and 'miner' in data:
                    miner = data['miner']
                    if (miner['name'] == miner_data['name'] and 
                        miner['hash_rate'] == miner_data['hash_rate']):
                        self.log_result("Create Miner", True)
                        return miner['id']
                    else:
                        self.log_result("Create Miner", False, "Miner data mismatch")
                else:
                    self.log_result("Create Miner", False, "Invalid response structure")
            else:
                self.log_result("Create Miner", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Create Miner", False, f"Exception: {str(e)}")
        return None
    
    def test_miner_activation(self, miner_id):
        """Test /api/miners/{id}/activate endpoint"""
        try:
            response = self.session.post(f"{API_BASE}/miners/{miner_id}/activate")
            if response.status_code == 200:
                data = response.json()
                if 'message' in data and 'activated' in data['message'].lower():
                    self.log_result("Miner Activation", True)
                    return True
                else:
                    self.log_result("Miner Activation", False, f"Unexpected response: {data}")
            else:
                self.log_result("Miner Activation", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Miner Activation", False, f"Exception: {str(e)}")
        return False
    
    def test_miner_deactivation(self, miner_id):
        """Test /api/miners/{id}/deactivate endpoint"""
        try:
            response = self.session.post(f"{API_BASE}/miners/{miner_id}/deactivate")
            if response.status_code == 200:
                data = response.json()
                if 'message' in data and 'deactivated' in data['message'].lower():
                    self.log_result("Miner Deactivation", True)
                    return True
                else:
                    self.log_result("Miner Deactivation", False, f"Unexpected response: {data}")
            else:
                self.log_result("Miner Deactivation", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Miner Deactivation", False, f"Exception: {str(e)}")
        return False
    
    def test_ad_rewards(self):
        """Test /api/ad-rewards/activate endpoint"""
        try:
            ad_data = {"reward_type": "mining_boost"}
            
            response = self.session.post(f"{API_BASE}/ad-rewards/activate", json=ad_data)
            if response.status_code == 200:
                data = response.json()
                if 'message' in data and 'activated' in data['message'].lower():
                    self.log_result("Ad Rewards Activation", True)
                    return True
                else:
                    self.log_result("Ad Rewards Activation", False, f"Unexpected response: {data}")
            else:
                self.log_result("Ad Rewards Activation", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Ad Rewards Activation", False, f"Exception: {str(e)}")
        return False
    
    def test_mining_stats(self):
        """Test /api/mining/stats endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/mining/stats")
            if response.status_code == 200:
                data = response.json()
                required_fields = ['current_hash_rate', 'mining_active', 'chart_data']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    # Validate chart data structure
                    if isinstance(data['chart_data'], list) and len(data['chart_data']) > 0:
                        chart_item = data['chart_data'][0]
                        if 'time' in chart_item and 'value' in chart_item:
                            self.log_result("Mining Stats", True)
                            return data
                        else:
                            self.log_result("Mining Stats", False, "Invalid chart data structure")
                    else:
                        self.log_result("Mining Stats", False, "Invalid or empty chart data")
                else:
                    self.log_result("Mining Stats", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("Mining Stats", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Mining Stats", False, f"Exception: {str(e)}")
        return None
    
    def test_shop_miners(self):
        """Test /api/shop/miners endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/shop/miners")
            if response.status_code == 200:
                data = response.json()
                if 'miners' in data and isinstance(data['miners'], list):
                    miners = data['miners']
                    if len(miners) > 0:
                        # Check first shop miner structure
                        miner = miners[0]
                        required_fields = ['id', 'name', 'hash_rate', 'duration', 'price', 'description']
                        missing_fields = [field for field in required_fields if field not in miner]
                        
                        if not missing_fields:
                            self.log_result("Shop Miners", True)
                            return miners
                        else:
                            self.log_result("Shop Miners", False, f"Missing shop miner fields: {missing_fields}")
                    else:
                        self.log_result("Shop Miners", False, "No shop miners available")
                else:
                    self.log_result("Shop Miners", False, "Invalid response structure")
            else:
                self.log_result("Shop Miners", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Shop Miners", False, f"Exception: {str(e)}")
        return None
    
    def test_shop_purchase(self):
        """Test /api/shop/purchase endpoint"""
        try:
            # First get user balance to check if purchase is possible
            user_response = self.session.get(f"{API_BASE}/user/profile")
            if user_response.status_code != 200:
                self.log_result("Shop Purchase", False, "Could not get user profile for balance check")
                return False
            
            user_data = user_response.json()
            current_balance = user_data['bitcoin_balance']
            
            # Try to purchase the cheapest miner
            purchase_data = {
                "name": "Basic Test Miner",
                "hash_rate": 15.0,
                "duration": 168,
                "price": 0.001
            }
            
            if current_balance >= purchase_data['price']:
                response = self.session.post(f"{API_BASE}/shop/purchase", json=purchase_data)
                if response.status_code == 200:
                    data = response.json()
                    if 'message' in data and 'purchased' in data['message'].lower():
                        self.log_result("Shop Purchase", True)
                        return True
                    else:
                        self.log_result("Shop Purchase", False, f"Unexpected response: {data}")
                else:
                    self.log_result("Shop Purchase", False, f"Status code: {response.status_code}")
            else:
                # Test insufficient balance scenario
                response = self.session.post(f"{API_BASE}/shop/purchase", json=purchase_data)
                if response.status_code == 400:
                    data = response.json()
                    if 'insufficient' in data.get('detail', '').lower():
                        self.log_result("Shop Purchase (Insufficient Balance)", True)
                        return True
                    else:
                        self.log_result("Shop Purchase", False, f"Expected insufficient balance error, got: {data}")
                else:
                    self.log_result("Shop Purchase", False, f"Expected 400 status for insufficient balance, got: {response.status_code}")
        except Exception as e:
            self.log_result("Shop Purchase", False, f"Exception: {str(e)}")
        return False
    
    def test_transaction_recording(self):
        """Test /api/transactions/record endpoint"""
        try:
            transaction_data = {
                "type": "earning",
                "amount": 0.00000123,
                "description": "Test mining reward"
            }
            
            response = self.session.post(f"{API_BASE}/transactions/record", json=transaction_data)
            if response.status_code == 200:
                data = response.json()
                if 'message' in data and 'transaction_id' in data:
                    self.log_result("Transaction Recording", True)
                    return data['transaction_id']
                else:
                    self.log_result("Transaction Recording", False, f"Invalid response structure: {data}")
            else:
                self.log_result("Transaction Recording", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Transaction Recording", False, f"Exception: {str(e)}")
        return None
    
    def run_all_tests(self):
        """Run all API tests in sequence"""
        print("Starting Bitcoin Mining Simulator API Tests...")
        print("-" * 60)
        
        # Test 1: Health Check
        if not self.test_health_check():
            print("❌ Health check failed - API may not be running")
            return self.test_results
        
        # Test 2: User Profile
        user_data = self.test_user_profile()
        if not user_data:
            print("❌ User profile test failed - cannot continue with user-dependent tests")
            return self.test_results
        
        # Test 3: Wallet Balance
        wallet_data = self.test_wallet_balance()
        
        # Test 4: Miners List
        miners = self.test_miners_list()
        
        # Test 5: Create Miner
        new_miner_id = self.test_create_miner()
        
        # Test 6: Miner Activation/Deactivation
        if new_miner_id:
            self.test_miner_activation(new_miner_id)
            time.sleep(1)  # Brief pause between activation and deactivation
            self.test_miner_deactivation(new_miner_id)
        elif miners and len(miners) > 0:
            # Use existing miner for activation/deactivation tests
            existing_miner_id = miners[0]['id']
            self.test_miner_activation(existing_miner_id)
            time.sleep(1)
            self.test_miner_deactivation(existing_miner_id)
        
        # Test 7: Ad Rewards
        self.test_ad_rewards()
        
        # Test 8: Mining Stats
        self.test_mining_stats()
        
        # Test 9: Shop Miners
        shop_miners = self.test_shop_miners()
        
        # Test 10: Shop Purchase
        self.test_shop_purchase()
        
        # Test 11: Transaction Recording
        self.test_transaction_recording()
        
        return self.test_results
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("TEST RESULTS SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        print(f"📊 Total: {self.test_results['passed'] + self.test_results['failed']}")
        
        if self.test_results['errors']:
            print("\n🔍 FAILED TESTS:")
            for error in self.test_results['errors']:
                print(f"   • {error}")
        
        success_rate = (self.test_results['passed'] / (self.test_results['passed'] + self.test_results['failed'])) * 100
        print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("🎉 Excellent! API is working well.")
        elif success_rate >= 70:
            print("⚠️  Good, but some issues need attention.")
        else:
            print("🚨 Multiple issues detected - needs investigation.")

def main():
    """Main test execution"""
    tester = BitcoinMiningAPITester()
    
    try:
        results = tester.run_all_tests()
        tester.print_summary()
        
        # Return exit code based on results
        if results['failed'] == 0:
            print("\n✅ All tests passed!")
            return 0
        else:
            print(f"\n❌ {results['failed']} test(s) failed!")
            return 1
            
    except KeyboardInterrupt:
        print("\n⏹️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error during testing: {str(e)}")
        return 1

if __name__ == "__main__":
    exit(main())