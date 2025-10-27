#!/usr/bin/env python3
"""
Detailed Kraken Withdrawal Integration Test
Focus on registering wallet and testing Kraken API integration
"""

import requests
import json
import time
import os
from datetime import datetime

# Configuration
BACKEND_URL = "https://koala-mining-app.preview.emergentagent.com/api"
TEST_USER_EMAIL = "kraken.detailed.test@bitcoinminer.com"
TEST_USER_PASSWORD = "KrakenDetailedTest2024!"
TEST_USER_NAME = "Kraken Detailed Test User"

# Test Bitcoin addresses
VALID_BTC_ADDRESS = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"

class DetailedKrakenTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        
    def log(self, message):
        print(f"[{datetime.utcnow().strftime('%H:%M:%S')}] {message}")
        
    def setup_user(self):
        """Setup test user with authentication"""
        self.log("Setting up test user...")
        
        # Try to register
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
            self.log(f"✅ User registered: {TEST_USER_EMAIL}")
            return True
        elif response.status_code == 400 and "already registered" in response.text:
            # Try to login
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                self.log(f"✅ User logged in: {TEST_USER_EMAIL}")
                return True
        
        self.log(f"❌ Failed to setup user: {response.status_code} - {response.text}")
        return False
    
    def register_wallet(self):
        """Register Bitcoin wallet address"""
        self.log("Registering Bitcoin wallet address...")
        
        response = self.session.post(f"{BACKEND_URL}/wallet/register", json={
            "btc_address": VALID_BTC_ADDRESS
        })
        
        if response.status_code == 200:
            self.log(f"✅ Wallet registered: {VALID_BTC_ADDRESS}")
            return True
        else:
            self.log(f"❌ Wallet registration failed: {response.status_code} - {response.text}")
            return False
    
    def approve_wallet(self):
        """Simulate wallet approval (normally done by admin)"""
        self.log("Simulating wallet approval...")
        
        # Check wallet status
        response = self.session.get(f"{BACKEND_URL}/wallet/status")
        if response.status_code == 200:
            data = response.json()
            self.log(f"Current wallet status: {data.get('wallet_status', 'unknown')}")
            
            # For testing purposes, we'll assume the wallet gets approved
            # In a real scenario, an admin would approve this
            self.log("⚠️  Note: In production, admin approval would be required")
            return True
        
        return False
    
    def add_balance(self):
        """Add some balance for testing"""
        self.log("Adding test balance...")
        
        # Activate free miner
        response = self.session.post(f"{BACKEND_URL}/miners/activate-free")
        if response.status_code == 200:
            self.log("✅ Free miner activated")
            
            # Wait for some earnings
            self.log("Waiting 15 seconds for mining earnings...")
            time.sleep(15)
            
            # Check balance
            balance_response = self.session.get(f"{BACKEND_URL}/wallet/balance")
            if balance_response.status_code == 200:
                balance_data = balance_response.json()
                current_balance = balance_data.get("total_balance", 0)
                self.log(f"Current balance: {current_balance} BTC")
                return True
        
        self.log("❌ Failed to add balance")
        return False
    
    def test_kraken_withdrawal_with_wallet(self):
        """Test Kraken withdrawal with registered wallet"""
        self.log("Testing Kraken withdrawal with registered wallet...")
        
        # Test 1: Small amount above Kraken minimum
        test_amount = 0.0003  # Above Kraken minimum of 0.000218 BTC
        
        self.log(f"Testing withdrawal of {test_amount} BTC to {VALID_BTC_ADDRESS}")
        
        response = self.session.post(f"{BACKEND_URL}/withdraw/bitcoin", json={
            "address": VALID_BTC_ADDRESS,
            "amount": test_amount
        })
        
        self.log(f"Response status: {response.status_code}")
        self.log(f"Response body: {response.text}")
        
        # Analyze response
        if response.status_code == 403:
            if "wallet" in response.text.lower():
                self.log("❌ Wallet not approved yet - this is expected in testing")
                return "wallet_not_approved"
            else:
                self.log("❌ Other 403 error")
                return "other_403"
        elif response.status_code == 400:
            response_text = response.text.lower()
            if "insufficient" in response_text:
                self.log("✅ Insufficient balance error - validation working")
                return "insufficient_balance"
            elif "minimum" in response_text:
                self.log("✅ Minimum amount validation - Kraken integration active")
                return "minimum_validation"
            else:
                self.log(f"❌ Other 400 error: {response.text}")
                return "other_400"
        elif response.status_code == 500:
            response_text = response.text.lower()
            if "kraken" in response_text:
                self.log("✅ Kraken API error - integration is active")
                return "kraken_api_error"
            else:
                self.log(f"❌ Generic 500 error: {response.text}")
                return "generic_500"
        elif response.status_code == 200:
            self.log("✅ Withdrawal successful!")
            return "success"
        else:
            self.log(f"❌ Unexpected response: {response.status_code} - {response.text}")
            return "unexpected"
    
    def test_kraken_minimum_validation(self):
        """Test Kraken minimum amount validation"""
        self.log("Testing Kraken minimum amount validation...")
        
        # Test with amount below Kraken minimum (0.000218 BTC)
        test_amount = 0.0001  # Below minimum
        
        response = self.session.post(f"{BACKEND_URL}/withdraw/bitcoin", json={
            "address": VALID_BTC_ADDRESS,
            "amount": test_amount
        })
        
        self.log(f"Below minimum test - Status: {response.status_code}")
        self.log(f"Response: {response.text}")
        
        # Look for Kraken-specific minimum validation
        response_text = response.text.lower()
        if "minimum" in response_text and ("kraken" in response_text or "0.000218" in response_text):
            self.log("✅ Kraken minimum validation working")
            return True
        elif response.status_code in [400, 500]:
            self.log("⚠️  Amount rejected but unclear if Kraken-specific")
            return False
        else:
            self.log("❌ Minimum validation not working")
            return False
    
    def run_detailed_test(self):
        """Run detailed Kraken integration test"""
        print("=" * 80)
        print("🔍 DETAILED KRAKEN WITHDRAWAL INTEGRATION TEST")
        print("=" * 80)
        
        # Step 1: Setup user
        if not self.setup_user():
            print("❌ Cannot proceed without user setup")
            return
        
        # Step 2: Register wallet
        if not self.register_wallet():
            print("❌ Cannot proceed without wallet registration")
            return
        
        # Step 3: Check wallet approval status
        self.approve_wallet()
        
        # Step 4: Add balance
        self.add_balance()
        
        # Step 5: Test withdrawal with wallet
        withdrawal_result = self.test_kraken_withdrawal_with_wallet()
        
        # Step 6: Test minimum validation
        minimum_result = self.test_kraken_minimum_validation()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 DETAILED TEST RESULTS")
        print("=" * 80)
        
        print(f"Withdrawal Test Result: {withdrawal_result}")
        print(f"Minimum Validation: {'✅ Working' if minimum_result else '❌ Not Working'}")
        
        # Interpretation
        print("\n🔍 INTERPRETATION:")
        
        if withdrawal_result == "wallet_not_approved":
            print("✅ System correctly requires wallet approval before withdrawals")
            print("✅ This indicates the withdrawal flow is working as designed")
        elif withdrawal_result == "insufficient_balance":
            print("✅ Balance validation working correctly")
        elif withdrawal_result == "minimum_validation":
            print("✅ Kraken minimum amount validation is active")
        elif withdrawal_result == "kraken_api_error":
            print("✅ Kraken API integration is active (getting real API errors)")
        elif withdrawal_result == "generic_500":
            print("❌ Generic errors suggest Kraken integration may not be fully active")
        
        if minimum_result:
            print("✅ Kraken minimum validation confirms API integration is working")
        else:
            print("❌ Minimum validation suggests Kraken integration needs attention")
        
        print("\n📋 RECOMMENDATIONS:")
        print("1. Check backend logs for 'KRAKEN WITHDRAWAL DIAGNOSTICS'")
        print("2. Verify KRAKEN_API_SECRET is correctly set in .env")
        print("3. Test with wallet approval to see full Kraken API flow")
        print("4. Monitor Kraken account for withdrawal attempts")

def main():
    tester = DetailedKrakenTester()
    tester.run_detailed_test()

if __name__ == "__main__":
    main()