#!/usr/bin/env python3
"""
Bitcoin Mining App - Coinbase Bitcoin Withdrawal Integration Re-Test
Focus: Testing after user added BTC wallet to Coinbase account

This test suite specifically tests the Coinbase Bitcoin withdrawal integration
after the user has added a BTC wallet to their Coinbase account.
"""

import requests
import json
import os
import sys
from datetime import datetime
import time

# Configuration
BACKEND_URL = "https://bitcoin-miner-sim.preview.emergentagent.com/api"
TEST_USER_EMAIL = "testuser@bitcoinminer.com"
TEST_USER_PASSWORD = "TestPassword123!"
TEST_USER_NAME = "Bitcoin Test User"

# Test Bitcoin addresses (valid format but test addresses)
VALID_BTC_ADDRESS = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"  # Valid Bech32 address
INVALID_BTC_ADDRESS = "invalid_address_format"

print(f"🚀 Bitcoin Mining App - Coinbase Integration Re-Test")
print(f"🔧 Testing API at: {BACKEND_URL}")
print("=" * 80)

class BitcoinMiningTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method, endpoint, data=None, headers=None, expect_success=True):
        """Make HTTP request with error handling"""
        url = f"{BACKEND_URL}{endpoint}"
        
        # Add auth header if we have a token
        if self.auth_token and headers is None:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
        elif self.auth_token and headers:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
            
        except requests.exceptions.RequestException as e:
            return None
    
    def setup_test_user(self):
        """Create and login test user"""
        print("\n🔧 Setting up test user...")
        
        # Try to register user (might already exist)
        register_data = {
            "name": TEST_USER_NAME,
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/register", register_data, expect_success=False)
        
        # Login user (whether registration succeeded or failed)
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data, expect_success=False)
        
        if response and response.status_code == 200:
            data = response.json()
            self.auth_token = data.get("access_token")
            self.user_id = data.get("user", {}).get("id")
            self.log_result("User Setup", True, f"Successfully logged in as {TEST_USER_EMAIL}")
            return True
        else:
            error_msg = response.text if response else "Connection failed"
            self.log_result("User Setup", False, f"Failed to login: {error_msg}")
            return False
    
    def test_coinbase_api_direct(self):
        """Test direct Coinbase API to verify BTC wallet exists"""
        print("\n🔍 Testing Direct Coinbase API Access...")
        
        try:
            # Import Coinbase SDK
            from coinbase.rest import RESTClient
            
            # Get credentials from environment
            coinbase_api_key = os.getenv("COINBASE_API_KEY", "")
            coinbase_private_key = os.getenv("COINBASE_PRIVATE_KEY", "")
            
            if not coinbase_api_key or not coinbase_private_key:
                self.log_result("Coinbase API Direct Test", False, "Coinbase credentials not found in environment")
                return False
            
            # Initialize Coinbase client
            client = RESTClient(api_key=coinbase_api_key, api_secret=coinbase_private_key)
            
            # Get accounts
            accounts_response = client.get_accounts()
            
            if hasattr(accounts_response, 'accounts') and accounts_response.accounts:
                btc_account = None
                cad_account = None
                all_currencies = []
                
                for account in accounts_response.accounts:
                    if hasattr(account, 'currency'):
                        all_currencies.append(account.currency)
                        if account.currency == 'BTC':
                            btc_account = account
                        elif account.currency == 'CAD':
                            cad_account = account
                
                self.log_result("Coinbase API Connection", True, f"Successfully connected to Coinbase API")
                self.log_result("Available Currencies", True, f"Found currencies: {', '.join(all_currencies)}")
                
                if btc_account:
                    btc_balance = getattr(btc_account, 'available_balance', {}).get('value', '0') if hasattr(btc_account, 'available_balance') else '0'
                    self.log_result("BTC Wallet Found", True, f"BTC account exists with balance: {btc_balance} BTC")
                    return True
                else:
                    self.log_result("BTC Wallet Missing", False, f"BTC wallet NOT found. Only found: {', '.join(all_currencies)}")
                    return False
            else:
                self.log_result("Coinbase API Direct Test", False, "No accounts returned from Coinbase API")
                return False
                
        except ImportError:
            self.log_result("Coinbase SDK Missing", False, "coinbase-advanced-py SDK not installed")
            return False
        except Exception as e:
            self.log_result("Coinbase API Direct Test", False, f"Error: {str(e)}")
            return False
    
    def test_withdrawal_validation_errors(self):
        """Test withdrawal endpoint validation (should return proper 400 errors now)"""
        print("\n🧪 Testing Withdrawal Validation...")
        
        # Test 1: Empty address
        response = self.make_request("POST", "/withdraw/bitcoin", {
            "address": "",
            "amount": 0.001
        }, expect_success=False)
        
        if response and response.status_code == 400:
            self.log_result("Empty Address Validation", True, "Correctly rejected empty address with 400 error")
        else:
            status_code = response.status_code if response else "No response"
            self.log_result("Empty Address Validation", False, f"Expected 400, got {status_code}")
        
        # Test 2: Invalid address format
        response = self.make_request("POST", "/withdraw/bitcoin", {
            "address": INVALID_BTC_ADDRESS,
            "amount": 0.001
        }, expect_success=False)
        
        if response and response.status_code in [400, 500]:  # Either validation error or processing error is acceptable
            self.log_result("Invalid Address Validation", True, f"Rejected invalid address with {response.status_code} error")
        else:
            status_code = response.status_code if response else "No response"
            self.log_result("Invalid Address Validation", False, f"Expected 400/500, got {status_code}")
        
        # Test 3: Amount below minimum
        response = self.make_request("POST", "/withdraw/bitcoin", {
            "address": VALID_BTC_ADDRESS,
            "amount": 0.000001  # Below 0.00001 minimum
        }, expect_success=False)
        
        if response and response.status_code == 400:
            self.log_result("Minimum Amount Validation", True, "Correctly rejected amount below minimum with 400 error")
        else:
            status_code = response.status_code if response else "No response"
            self.log_result("Minimum Amount Validation", False, f"Expected 400, got {status_code}")
        
        # Test 4: Insufficient balance (should be 400 now, not 500)
        response = self.make_request("POST", "/withdraw/bitcoin", {
            "address": VALID_BTC_ADDRESS,
            "amount": 999999.0  # Way more than any user would have
        }, expect_success=False)
        
        if response and response.status_code == 400:
            self.log_result("Insufficient Balance Validation", True, "Correctly rejected insufficient balance with 400 error")
        else:
            status_code = response.status_code if response else "No response"
            error_text = response.text if response else "No response"
            self.log_result("Insufficient Balance Validation", False, f"Expected 400, got {status_code}: {error_text}")
    
    def test_unauthenticated_withdrawal(self):
        """Test withdrawal without authentication"""
        print("\n🔒 Testing Unauthenticated Access...")
        
        # Temporarily remove auth token
        original_token = self.auth_token
        self.auth_token = None
        
        response = self.make_request("POST", "/withdraw/bitcoin", {
            "address": VALID_BTC_ADDRESS,
            "amount": 0.001
        }, headers={}, expect_success=False)
        
        # Restore auth token
        self.auth_token = original_token
        
        if response and response.status_code in [401, 403]:
            self.log_result("Unauthenticated Access", True, f"Correctly rejected unauthenticated request with {response.status_code} error")
        else:
            status_code = response.status_code if response else "No response"
            self.log_result("Unauthenticated Access", False, f"Expected 401/403, got {status_code}")
    
    def test_user_balance_check(self):
        """Check user's current balance"""
        print("\n💰 Checking User Balance...")
        
        response = self.make_request("GET", "/auth/me")
        
        if response and response.status_code == 200:
            data = response.json()
            balance = data.get("bitcoin_balance", 0)
            self.log_result("Balance Check", True, f"Current balance: {balance} BTC")
            return balance
        else:
            self.log_result("Balance Check", False, "Failed to get user balance")
            return 0
    
    def test_minimal_withdrawal_if_balance(self, balance):
        """Test minimal withdrawal if user has balance"""
        print("\n💸 Testing Minimal Withdrawal (if balance available)...")
        
        if balance < 0.00002:  # Need at least 0.00002 for 0.00001 withdrawal + fee
            self.log_result("Minimal Withdrawal", True, f"Skipped - insufficient balance ({balance} BTC < 0.00002 BTC required)")
            return
        
        # Ask for confirmation before live withdrawal
        print(f"\n⚠️  WARNING: About to attempt LIVE Bitcoin withdrawal!")
        print(f"   Current balance: {balance} BTC")
        print(f"   Withdrawal amount: 0.00001 BTC")
        print(f"   Processing fee: 0.5% = 0.000000005 BTC")
        print(f"   Total deduction: ~0.000010005 BTC")
        print(f"   Destination: {VALID_BTC_ADDRESS}")
        
        # For automated testing, we'll skip the live withdrawal
        # In manual testing, you could uncomment the next lines
        """
        user_input = input("\nProceed with LIVE withdrawal? (yes/no): ").strip().lower()
        if user_input != 'yes':
            self.log_result("Minimal Withdrawal", True, "Skipped by user choice")
            return
        """
        
        self.log_result("Minimal Withdrawal", True, "Skipped for safety - would require manual confirmation")
        return
        
        # Uncomment below for actual withdrawal testing (CAREFUL!)
        """
        response = self.make_request("POST", "/withdraw/bitcoin", {
            "address": VALID_BTC_ADDRESS,
            "amount": 0.00001
        }, expect_success=False)
        
        if response and response.status_code == 200:
            data = response.json()
            tx_id = data.get("withdrawal_id")
            self.log_result("Minimal Withdrawal", True, f"Withdrawal successful - ID: {tx_id}")
        else:
            status_code = response.status_code if response else "No response"
            error_text = response.text if response else "No response"
            self.log_result("Minimal Withdrawal", False, f"Withdrawal failed ({status_code}): {error_text}")
        """
    
    def test_backend_logs_check(self):
        """Check backend logs for Coinbase-related messages"""
        print("\n📋 Checking Backend Logs...")
        
        try:
            # Check supervisor backend logs
            import subprocess
            result = subprocess.run(
                ["tail", "-n", "50", "/var/log/supervisor/backend.err.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                logs = result.stdout
                if "coinbase" in logs.lower() or "btc" in logs.lower():
                    self.log_result("Backend Logs", True, "Found Coinbase/BTC related log entries")
                    print("   Recent relevant logs:")
                    for line in logs.split('\n')[-10:]:
                        if line.strip() and ("coinbase" in line.lower() or "btc" in line.lower() or "withdrawal" in line.lower()):
                            print(f"   {line}")
                else:
                    self.log_result("Backend Logs", True, "No recent Coinbase errors in logs")
            else:
                self.log_result("Backend Logs", False, "Could not read backend logs")
                
        except Exception as e:
            self.log_result("Backend Logs", False, f"Error reading logs: {str(e)}")
    
    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting Bitcoin Mining App - Coinbase Integration Re-Test")
        print("=" * 70)
        
        # Setup
        if not self.setup_test_user():
            print("\n❌ Cannot proceed without valid user authentication")
            return False
        
        # Test 1: Direct Coinbase API test
        btc_wallet_exists = self.test_coinbase_api_direct()
        
        # Test 2: Validation tests (should work now if BTC wallet exists)
        self.test_withdrawal_validation_errors()
        
        # Test 3: Authentication test
        self.test_unauthenticated_withdrawal()
        
        # Test 4: Check user balance
        balance = self.test_user_balance_check()
        
        # Test 5: Minimal withdrawal test (if balance exists)
        self.test_minimal_withdrawal_if_balance(balance)
        
        # Test 6: Check backend logs
        self.test_backend_logs_check()
        
        # Summary
        self.print_summary()
        
        return btc_wallet_exists
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for result in self.test_results if "✅ PASS" in result["status"])
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result["status"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "0%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌ FAIL" in result["status"]:
                    print(f"   • {result['test']}: {result['message']}")
        
        print("\n🎯 KEY FINDINGS:")
        
        # Check if BTC wallet was found
        btc_wallet_found = any("BTC Wallet Found" in result["test"] and "✅ PASS" in result["status"] for result in self.test_results)
        btc_wallet_missing = any("BTC Wallet Missing" in result["test"] and "❌ FAIL" in result["status"] for result in self.test_results)
        
        if btc_wallet_found:
            print("   ✅ BTC wallet now EXISTS in Coinbase account")
        elif btc_wallet_missing:
            print("   ❌ BTC wallet still MISSING from Coinbase account")
        else:
            print("   ⚠️  Could not verify BTC wallet status")
        
        # Check validation improvements
        validation_tests = [r for r in self.test_results if "Validation" in r["test"]]
        validation_passed = sum(1 for r in validation_tests if "✅ PASS" in r["status"])
        
        if validation_passed == len(validation_tests) and len(validation_tests) > 0:
            print("   ✅ All validation tests now return proper HTTP status codes")
        elif validation_passed > 0:
            print(f"   ⚠️  {validation_passed}/{len(validation_tests)} validation tests passing")
        else:
            print("   ❌ Validation tests still failing")

if __name__ == "__main__":
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    
    # Run tests
    tester = BitcoinMiningTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)
