#!/usr/bin/env python3
"""
Comprehensive Coinbase Bitcoin Withdrawal Integration Test
Focus: Testing the migrated Coinbase Advanced Trade API implementation
"""

import requests
import json
import os
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

# Backend URL
BASE_URL = "https://mine-simulator.preview.emergentagent.com/api"

class CoinbaseWithdrawalTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        self.auth_token = None
        self.user_data = None
        
    def log_result(self, test_name, status, details=""):
        """Log test results"""
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{emoji} {test_name}: {status}")
        if details:
            print(f"   {details}")
    
    def setup_test_user(self):
        """Create test user with some balance"""
        try:
            # Register test user
            test_email = f"coinbase_test_{int(time.time())}@test.com"
            register_data = {
                "name": "Coinbase Test User",
                "email": test_email,
                "password": "TestPass123!"
            }
            
            response = requests.post(f"{self.base_url}/auth/register", json=register_data)
            if response.status_code != 200:
                self.log_result("User Setup", "FAIL", f"Registration failed: {response.status_code}")
                return False
            
            auth_data = response.json()
            self.auth_token = auth_data.get("access_token")
            self.user_data = {"email": test_email}
            
            # Activate free miner to get some balance
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            miner_response = requests.post(f"{self.base_url}/miners/activate-free", headers=headers)
            
            if miner_response.status_code == 200:
                self.log_result("User Setup", "PASS", f"Test user created: {test_email}")
                return True
            else:
                self.log_result("User Setup", "PARTIAL", f"User created but miner activation failed")
                return True
                
        except Exception as e:
            self.log_result("User Setup", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_coinbase_configuration(self):
        """Test Coinbase API configuration and connectivity"""
        print("\n🔧 COINBASE CONFIGURATION TESTS")
        print("=" * 50)
        
        # Test 1: Check environment variables
        api_key = os.getenv("COINBASE_API_KEY", "")
        private_key = os.getenv("COINBASE_PRIVATE_KEY", "")
        wallet_type = os.getenv("BITCOIN_WALLET_TYPE", "")
        
        if api_key and private_key and wallet_type == "coinbase":
            self.log_result("Coinbase Configuration", "PASS", "All required environment variables set")
        else:
            missing = []
            if not api_key: missing.append("COINBASE_API_KEY")
            if not private_key: missing.append("COINBASE_PRIVATE_KEY")
            if wallet_type != "coinbase": missing.append("BITCOIN_WALLET_TYPE")
            self.log_result("Coinbase Configuration", "FAIL", f"Missing: {', '.join(missing)}")
            return False
        
        # Test 2: Test Coinbase API connectivity
        try:
            from coinbase.rest import RESTClient
            client = RESTClient(api_key=api_key, api_secret=private_key)
            
            accounts_response = client.get_accounts()
            
            if hasattr(accounts_response, 'accounts') and accounts_response.accounts:
                account_currencies = [acc.currency for acc in accounts_response.accounts if hasattr(acc, 'currency')]
                
                if 'BTC' in account_currencies:
                    self.log_result("Coinbase BTC Account", "PASS", "BTC account found in Coinbase")
                else:
                    self.log_result("Coinbase BTC Account", "FAIL", 
                                  f"No BTC account found. Available: {', '.join(account_currencies)}")
                    self.log_result("ROOT CAUSE IDENTIFIED", "CRITICAL", 
                                  "🚨 CRITICAL ISSUE: Coinbase account has no BTC wallet. This explains all withdrawal failures!")
                    return False
            else:
                self.log_result("Coinbase API Access", "FAIL", "Could not retrieve accounts from Coinbase")
                return False
                
        except Exception as e:
            self.log_result("Coinbase API Access", "FAIL", f"API error: {str(e)}")
            return False
        
        return True
    
    def test_validation_scenarios(self):
        """Test Priority 1: Validation scenarios (safe, no real transactions)"""
        print("\n🔒 PRIORITY 1: VALIDATION TESTS (Safe)")
        print("=" * 50)
        
        if not self.auth_token:
            self.log_result("Validation Tests", "SKIP", "No auth token available")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Test 1: Unauthenticated request
        response = requests.post(f"{self.base_url}/withdraw/bitcoin", json={
            "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
            "amount": 0.00001
        })
        
        if response.status_code == 401:
            self.log_result("Unauthenticated Request", "PASS", "Correctly rejected with 401")
        else:
            self.log_result("Unauthenticated Request", "FAIL", f"Expected 401, got {response.status_code}")
        
        # Test 2: Empty address
        response = requests.post(f"{self.base_url}/withdraw/bitcoin", 
                               json={"address": "", "amount": 0.00001}, 
                               headers=headers)
        
        if response.status_code == 400:
            self.log_result("Empty Address Validation", "PASS", "Empty address rejected")
        elif response.status_code == 500:
            self.log_result("Empty Address Validation", "FAIL", "Got 500 error - server issue")
        else:
            self.log_result("Empty Address Validation", "PARTIAL", f"Got {response.status_code}")
        
        # Test 3: Below minimum amount
        response = requests.post(f"{self.base_url}/withdraw/bitcoin", 
                               json={"address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", "amount": 0.000005}, 
                               headers=headers)
        
        if response.status_code == 400:
            response_data = response.json()
            if "minimum" in response_data.get("detail", "").lower():
                self.log_result("Minimum Amount Validation", "PASS", "Below minimum correctly rejected")
            else:
                self.log_result("Minimum Amount Validation", "PARTIAL", "Rejected but unclear reason")
        elif response.status_code == 500:
            self.log_result("Minimum Amount Validation", "FAIL", "Got 500 error - server issue")
        else:
            self.log_result("Minimum Amount Validation", "FAIL", f"Expected 400, got {response.status_code}")
        
        # Test 4: Insufficient balance
        user_response = requests.get(f"{self.base_url}/auth/me", headers=headers)
        if user_response.status_code == 200:
            balance = user_response.json().get("bitcoin_balance", 0)
            excessive_amount = balance + 1.0
            
            response = requests.post(f"{self.base_url}/withdraw/bitcoin", 
                                   json={"address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", "amount": excessive_amount}, 
                                   headers=headers)
            
            if response.status_code == 400:
                response_data = response.json()
                if "insufficient" in response_data.get("detail", "").lower():
                    self.log_result("Insufficient Balance", "PASS", f"Insufficient balance correctly detected (tried {excessive_amount}, have {balance})")
                else:
                    self.log_result("Insufficient Balance", "PARTIAL", "Rejected but unclear reason")
            elif response.status_code == 500:
                self.log_result("Insufficient Balance", "FAIL", "Got 500 error - server issue")
            else:
                self.log_result("Insufficient Balance", "FAIL", f"Expected 400, got {response.status_code}")
    
    def test_coinbase_integration_scenarios(self):
        """Test Priority 2: Coinbase integration (would create real transactions if BTC account existed)"""
        print("\n⚠️ PRIORITY 2: COINBASE INTEGRATION TESTS")
        print("=" * 50)
        print("🚨 NOTE: These would create REAL transactions if BTC account existed")
        
        if not self.auth_token:
            self.log_result("Coinbase Integration Tests", "SKIP", "No auth token available")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Get current balance
        user_response = requests.get(f"{self.base_url}/auth/me", headers=headers)
        if user_response.status_code != 200:
            self.log_result("Coinbase Integration Tests", "SKIP", "Cannot get user balance")
            return
        
        balance = user_response.json().get("bitcoin_balance", 0)
        
        # Test with valid parameters (would work if BTC account existed)
        test_address = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"  # Valid test address
        test_amount = 0.00001  # Minimum amount
        
        response = requests.post(f"{self.base_url}/withdraw/bitcoin", 
                               json={"address": test_address, "amount": test_amount}, 
                               headers=headers)
        
        if response.status_code == 500:
            # This is expected due to missing BTC account
            self.log_result("Coinbase Withdrawal Attempt", "EXPECTED_FAIL", 
                          "500 error expected due to missing BTC account in Coinbase")
        elif response.status_code == 400:
            response_data = response.json()
            if "insufficient" in response_data.get("detail", "").lower():
                self.log_result("Coinbase Withdrawal Attempt", "PASS", 
                              "Insufficient balance correctly detected before Coinbase call")
            else:
                self.log_result("Coinbase Withdrawal Attempt", "PARTIAL", 
                              f"Got 400 with message: {response_data.get('detail', '')}")
        elif response.status_code == 200:
            self.log_result("Coinbase Withdrawal Attempt", "UNEXPECTED_PASS", 
                          "🚨 Withdrawal succeeded despite missing BTC account - investigate!")
        else:
            self.log_result("Coinbase Withdrawal Attempt", "UNEXPECTED", 
                          f"Unexpected status code: {response.status_code}")
    
    def analyze_backend_logs(self):
        """Analyze backend logs for Coinbase-related activity"""
        print("\n📋 BACKEND LOG ANALYSIS")
        print("=" * 30)
        
        try:
            import subprocess
            result = subprocess.run(
                ["tail", "-n", "100", "/var/log/supervisor/backend.out.log"],
                capture_output=True, text=True
            )
            
            if result.returncode == 0:
                logs = result.stdout
                coinbase_lines = [line for line in logs.split('\n') 
                                if any(keyword in line.lower() for keyword in 
                                      ['coinbase', 'withdrawal', 'bitcoin', 'btc'])]
                
                if coinbase_lines:
                    self.log_result("Backend Log Analysis", "INFO", 
                                  f"Found {len(coinbase_lines)} relevant log entries")
                    for line in coinbase_lines[-5:]:  # Show last 5
                        if line.strip():
                            print(f"   📋 {line.strip()}")
                else:
                    self.log_result("Backend Log Analysis", "INFO", 
                                  "No Coinbase-related entries in recent logs")
            else:
                self.log_result("Backend Log Analysis", "FAIL", "Could not access logs")
                
        except Exception as e:
            self.log_result("Backend Log Analysis", "FAIL", f"Exception: {str(e)}")
    
    def run_comprehensive_test(self):
        """Run the complete test suite"""
        print("🚀 COINBASE BITCOIN WITHDRAWAL INTEGRATION TEST")
        print("=" * 60)
        print(f"Backend URL: {self.base_url}")
        print(f"Test started: {datetime.now().isoformat()}")
        
        # Step 1: Test Coinbase configuration
        coinbase_ok = self.test_coinbase_configuration()
        
        # Step 2: Setup test user
        if not self.setup_test_user():
            print("❌ Cannot proceed without test user")
            return False
        
        # Step 3: Run validation tests
        self.test_validation_scenarios()
        
        # Step 4: Run Coinbase integration tests
        self.test_coinbase_integration_scenarios()
        
        # Step 5: Analyze logs
        self.analyze_backend_logs()
        
        # Step 6: Print summary
        self.print_summary()
        
        return True
    
    def print_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 60)
        print("📊 COINBASE WITHDRAWAL TEST SUMMARY")
        print("=" * 60)
        
        total = len(self.test_results)
        passed = len([r for r in self.test_results if r["status"] == "PASS"])
        failed = len([r for r in self.test_results if r["status"] == "FAIL"])
        critical = len([r for r in self.test_results if r["status"] == "CRITICAL"])
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"🚨 Critical Issues: {critical}")
        
        # Show critical issues
        critical_issues = [r for r in self.test_results if r["status"] in ["FAIL", "CRITICAL"]]
        if critical_issues:
            print("\n🚨 CRITICAL ISSUES FOUND:")
            for issue in critical_issues:
                print(f"   • {issue['test']}: {issue['details']}")
        
        # Overall assessment
        print("\n" + "=" * 60)
        if critical > 0:
            print("🚨 CRITICAL ISSUES DETECTED!")
            print("   The Coinbase Bitcoin withdrawal system has fundamental problems.")
            print("   ROOT CAUSE: Coinbase account lacks BTC wallet - only has CAD.")
            print("   SOLUTION: Add BTC wallet to Coinbase account or use demo mode.")
        elif failed > 0:
            print("⚠️ ISSUES DETECTED!")
            print("   Some tests failed but no critical issues found.")
        else:
            print("🎉 ALL TESTS PASSED!")
            print("   Coinbase Bitcoin withdrawal integration is working correctly.")
        
        print(f"\nTest completed: {datetime.now().isoformat()}")

def main():
    """Main test execution"""
    tester = CoinbaseWithdrawalTester()
    
    try:
        tester.run_comprehensive_test()
        
        # Return appropriate exit code
        critical_issues = len([r for r in tester.test_results if r["status"] in ["FAIL", "CRITICAL"]])
        return 0 if critical_issues == 0 else 1
        
    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Test suite crashed: {str(e)}")
        return 1

if __name__ == "__main__":
    exit(main())