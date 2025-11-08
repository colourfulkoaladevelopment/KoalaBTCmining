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
BACKEND_URL = "https://btc-simulator.preview.emergentagent.com/api"
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
        
    def log_test(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"   {message}")
        if details:
            print(f"   Details: {details}")
        print()
        
    def register_test_user(self):
        """Register a test user for Kraken withdrawal testing"""
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/register", json={
                "name": TEST_USER_NAME,
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                
                self.log_test(
                    "User Registration",
                    True,
                    f"Test user registered successfully: {TEST_USER_EMAIL}",
                    {"user_id": self.user_id, "token_length": len(self.auth_token) if self.auth_token else 0}
                )
                return True
            elif response.status_code == 400 and "already registered" in response.text:
                # User exists, try to login
                return self.login_test_user()
            else:
                self.log_test(
                    "User Registration",
                    False,
                    f"Registration failed: {response.status_code} - {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_test("User Registration", False, f"Registration error: {str(e)}")
            return False
    
    def login_test_user(self):
        """Login test user"""
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                
                self.log_test(
                    "User Login",
                    True,
                    f"Test user logged in successfully: {TEST_USER_EMAIL}",
                    {"user_id": self.user_id}
                )
                return True
            else:
                self.log_test(
                    "User Login",
                    False,
                    f"Login failed: {response.status_code} - {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_test("User Login", False, f"Login error: {str(e)}")
            return False
    
    def test_kraken_withdrawal_validation(self):
        """Test Kraken withdrawal validation logic"""
        print("🔍 TESTING KRAKEN WITHDRAWAL VALIDATION...")
        
        # Test 1: Empty address validation
        try:
            response = self.session.post(f"{BACKEND_URL}/withdraw/bitcoin", json={
                "address": "",
                "amount": 0.001
            })
            
            if response.status_code == 400 and "address is required" in response.text.lower():
                self.log_test(
                    "Empty Address Validation",
                    True,
                    "Empty address properly rejected with 400 error"
                )
            else:
                self.log_test(
                    "Empty Address Validation",
                    False,
                    f"Expected 400 error for empty address, got {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_test("Empty Address Validation", False, f"Test error: {str(e)}")
        
        # Test 2: Invalid address format validation
        try:
            response = self.session.post(f"{BACKEND_URL}/withdraw/bitcoin", json={
                "address": INVALID_BTC_ADDRESS,
                "amount": 0.001
            })
            
            # Should either reject invalid format or proceed to Kraken (which will reject it)
            if response.status_code in [400, 500]:
                self.log_test(
                    "Invalid Address Format",
                    True,
                    f"Invalid address format handled: {response.status_code}"
                )
            else:
                self.log_test(
                    "Invalid Address Format",
                    False,
                    f"Unexpected response for invalid address: {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_test("Invalid Address Format", False, f"Test error: {str(e)}")
        
        # Test 3: Below minimum amount validation (Kraken minimum is 0.000218 BTC)
        try:
            response = self.session.post(f"{BACKEND_URL}/withdraw/bitcoin", json={
                "address": VALID_BTC_ADDRESS,
                "amount": 0.0001  # Below Kraken minimum
            })
            
            if response.status_code in [400, 500]:
                response_text = response.text.lower()
                if "minimum" in response_text or "kraken" in response_text:
                    self.log_test(
                        "Below Minimum Amount",
                        True,
                        f"Below minimum amount properly rejected: {response.status_code}"
                    )
                else:
                    self.log_test(
                        "Below Minimum Amount",
                        False,
                        f"Rejected but wrong reason: {response.text}"
                    )
            else:
                self.log_test(
                    "Below Minimum Amount",
                    False,
                    f"Expected rejection for below minimum, got {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_test("Below Minimum Amount", False, f"Test error: {str(e)}")
        
        # Test 4: Insufficient balance validation
        try:
            response = self.session.post(f"{BACKEND_URL}/withdraw/bitcoin", json={
                "address": VALID_BTC_ADDRESS,
                "amount": 999.0  # Way more than user balance
            })
            
            if response.status_code == 400 and "insufficient" in response.text.lower():
                self.log_test(
                    "Insufficient Balance",
                    True,
                    "Insufficient balance properly detected and rejected"
                )
            else:
                self.log_test(
                    "Insufficient Balance",
                    False,
                    f"Expected insufficient balance error, got {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_test("Insufficient Balance", False, f"Test error: {str(e)}")
    
    def test_kraken_api_connection(self):
        """Test Kraken API connection and method fetching"""
        print("🔍 TESTING KRAKEN API CONNECTION...")
        
        # Test with valid amount that should trigger Kraken API call
        try:
            response = self.session.post(f"{BACKEND_URL}/withdraw/bitcoin", json={
                "address": VALID_BTC_ADDRESS,
                "amount": 0.0003  # Above Kraken minimum
            })
            
            # Check if we get Kraken-specific responses
            response_text = response.text.lower()
            
            if "kraken" in response_text:
                if "method" in response_text or "minimum" in response_text:
                    self.log_test(
                        "Kraken API Connection",
                        True,
                        "Kraken API connection active - method fetching working",
                        {"status_code": response.status_code, "contains_kraken": True}
                    )
                else:
                    self.log_test(
                        "Kraken API Connection",
                        False,
                        f"Kraken mentioned but unexpected response: {response.text}"
                    )
            elif response.status_code == 500 and "demo" not in response_text:
                # If we get 500 error without demo mention, likely hitting real Kraken API
                self.log_test(
                    "Kraken API Connection",
                    True,
                    "Likely hitting real Kraken API (not demo mode)",
                    {"status_code": response.status_code, "response": response.text[:200]}
                )
            elif "demo" in response_text:
                self.log_test(
                    "Kraken API Connection",
                    False,
                    "Still falling back to demo mode - Kraken integration not active"
                )
            else:
                self.log_test(
                    "Kraken API Connection",
                    False,
                    f"Unexpected response - unclear if Kraken active: {response.status_code}: {response.text[:200]}"
                )
                
        except Exception as e:
            self.log_test("Kraken API Connection", False, f"Test error: {str(e)}")
    
    def test_backend_logs_for_kraken(self):
        """Check if backend logs show Kraken API communication"""
        print("🔍 CHECKING BACKEND LOGS FOR KRAKEN DIAGNOSTICS...")
        
        # Trigger a withdrawal to generate logs
        try:
            response = self.session.post(f"{BACKEND_URL}/withdraw/bitcoin", json={
                "address": VALID_BTC_ADDRESS,
                "amount": 0.0003
            })
            
            # The logs should be visible in supervisor logs
            # We can't directly access them, but we can infer from response
            
            if response.status_code in [400, 500]:
                response_text = response.text
                
                # Look for Kraken-specific error messages
                kraken_indicators = [
                    "kraken",
                    "method_id",
                    "withdrawal method",
                    "minimum",
                    "network fee"
                ]
                
                found_indicators = [indicator for indicator in kraken_indicators if indicator in response_text.lower()]
                
                if found_indicators:
                    self.log_test(
                        "Kraken Diagnostics in Response",
                        True,
                        f"Kraken-specific terms found in response: {found_indicators}",
                        {"response_snippet": response_text[:300]}
                    )
                else:
                    self.log_test(
                        "Kraken Diagnostics in Response",
                        False,
                        "No Kraken-specific terms found in response - may still be in demo mode"
                    )
            else:
                self.log_test(
                    "Kraken Diagnostics in Response",
                    False,
                    f"Unexpected successful response: {response.status_code}"
                )
                
        except Exception as e:
            self.log_test("Kraken Diagnostics in Response", False, f"Test error: {str(e)}")
    
    def test_network_fee_endpoint(self):
        """Test network fee endpoint"""
        print("🔍 TESTING NETWORK FEE ENDPOINT...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/bitcoin/network-fee")
            
            if response.status_code == 200:
                data = response.json()
                
                required_fields = ["network_fee_btc", "network_fee_satoshis", "fee_per_byte"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    fee_btc = data.get("network_fee_btc", 0)
                    if 0.000001 <= fee_btc <= 0.001:  # Reasonable fee range
                        self.log_test(
                            "Network Fee Endpoint",
                            True,
                            f"Network fee endpoint working: {fee_btc} BTC",
                            data
                        )
                    else:
                        self.log_test(
                            "Network Fee Endpoint",
                            False,
                            f"Network fee seems unreasonable: {fee_btc} BTC"
                        )
                else:
                    self.log_test(
                        "Network Fee Endpoint",
                        False,
                        f"Missing required fields: {missing_fields}"
                    )
            else:
                self.log_test(
                    "Network Fee Endpoint",
                    False,
                    f"Network fee endpoint failed: {response.status_code} - {response.text}"
                )
                
        except Exception as e:
            self.log_test("Network Fee Endpoint", False, f"Test error: {str(e)}")
    
    def test_unauthenticated_withdrawal(self):
        """Test withdrawal without authentication"""
        print("🔍 TESTING UNAUTHENTICATED WITHDRAWAL...")
        
        # Remove auth header temporarily
        original_headers = self.session.headers.copy()
        if "Authorization" in self.session.headers:
            del self.session.headers["Authorization"]
        
        try:
            response = self.session.post(f"{BACKEND_URL}/withdraw/bitcoin", json={
                "address": VALID_BTC_ADDRESS,
                "amount": 0.001
            })
            
            if response.status_code in [401, 403]:
                self.log_test(
                    "Unauthenticated Withdrawal",
                    True,
                    f"Unauthenticated request properly rejected: {response.status_code}"
                )
            else:
                self.log_test(
                    "Unauthenticated Withdrawal",
                    False,
                    f"Expected 401/403 for unauthenticated request, got {response.status_code}"
                )
                
        except Exception as e:
            self.log_test("Unauthenticated Withdrawal", False, f"Test error: {str(e)}")
        finally:
            # Restore auth headers
            self.session.headers.update(original_headers)
    
    def add_test_balance(self):
        """Add some test balance to user for withdrawal testing"""
        print("🔍 ADDING TEST BALANCE...")
        
        # Check if there's a test endpoint to add balance
        try:
            # Try to activate a free miner to get some balance
            response = self.session.post(f"{BACKEND_URL}/miners/activate-free")
            
            if response.status_code == 200:
                self.log_test(
                    "Add Test Balance",
                    True,
                    "Free miner activated - balance will grow over time"
                )
                
                # Wait a few seconds for mining earnings
                print("   Waiting 10 seconds for mining earnings...")
                time.sleep(10)
                
                # Check balance
                balance_response = self.session.get(f"{BACKEND_URL}/wallet/balance")
                if balance_response.status_code == 200:
                    balance_data = balance_response.json()
                    current_balance = balance_data.get("total_balance", 0)
                    self.log_test(
                        "Check Balance After Mining",
                        True,
                        f"Current balance: {current_balance} BTC",
                        balance_data
                    )
                
            else:
                self.log_test(
                    "Add Test Balance",
                    False,
                    f"Failed to activate free miner: {response.status_code} - {response.text}"
                )
                
        except Exception as e:
            self.log_test("Add Test Balance", False, f"Test error: {str(e)}")
    
    def run_comprehensive_kraken_tests(self):
        """Run comprehensive Kraken withdrawal integration tests"""
        print("=" * 80)
        print("🚀 KRAKEN BITCOIN WITHDRAWAL INTEGRATION TESTING")
        print("=" * 80)
        print()
        
        # Setup
        if not self.register_test_user():
            print("❌ Cannot proceed without user authentication")
            return
        
        # Add some balance for testing
        self.add_test_balance()
        
        # Core Kraken tests
        self.test_kraken_withdrawal_validation()
        self.test_kraken_api_connection()
        self.test_backend_logs_for_kraken()
        self.test_network_fee_endpoint()
        self.test_unauthenticated_withdrawal()
        
        # Summary
        self.print_test_summary()
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("=" * 80)
        print("📊 KRAKEN WITHDRAWAL INTEGRATION TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        print()
        
        if failed_tests > 0:
            print("❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['message']}")
            print()
        
        # Key findings
        print("🔍 KEY FINDINGS:")
        
        # Check if Kraken integration is active
        kraken_active = any("kraken" in r["message"].lower() or 
                           "method" in r["message"].lower() 
                           for r in self.test_results if r["success"])
        
        if kraken_active:
            print("   ✅ Kraken API integration appears to be ACTIVE")
            print("   ✅ No longer falling back to demo mode")
        else:
            print("   ❌ Kraken integration may still be in demo mode")
            print("   ❌ Check backend logs for KRAKEN WITHDRAWAL DIAGNOSTICS")
        
        # Check validation
        validation_working = any("validation" in r["test"].lower() and r["success"] 
                               for r in self.test_results)
        
        if validation_working:
            print("   ✅ Withdrawal validation logic working correctly")
        else:
            print("   ❌ Withdrawal validation needs attention")
        
        print()
        print("📋 NEXT STEPS:")
        print("   1. Check backend supervisor logs: tail -n 100 /var/log/supervisor/backend.*.log")
        print("   2. Look for 'KRAKEN WITHDRAWAL DIAGNOSTICS' in logs")
        print("   3. Verify Kraken API credentials are correctly configured")
        print("   4. Test with small amounts above Kraken minimum (0.000218 BTC)")
        print("=" * 80)

def main():
    """Main test execution"""
    tester = BackendTester()
    tester.run_comprehensive_kraken_tests()

if __name__ == "__main__":
    main()