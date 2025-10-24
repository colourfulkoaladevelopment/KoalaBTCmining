#!/usr/bin/env python3
"""
Debug test for Coinbase Bitcoin withdrawal integration
"""

import requests
import json
import os
from datetime import datetime

# Backend URL
BASE_URL = "https://koala-crypto-mine.preview.emergentagent.com/api"

def test_coinbase_withdrawal():
    """Test Coinbase withdrawal with detailed error reporting"""
    
    print("🔍 COINBASE WITHDRAWAL DEBUG TEST")
    print("=" * 50)
    
    # Step 1: Register test user
    print("1️⃣ Registering test user...")
    test_email = f"coinbase_test_{int(datetime.now().timestamp())}@test.com"
    
    register_data = {
        "name": "Coinbase Tester",
        "email": test_email,
        "password": "TestPass123!"
    }
    
    response = requests.post(f"{BASE_URL}/auth/register", json=register_data)
    if response.status_code != 200:
        print(f"❌ Registration failed: {response.status_code} - {response.text}")
        return
    
    auth_data = response.json()
    token = auth_data.get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"✅ User registered: {test_email}")
    
    # Step 2: Check initial balance
    print("\n2️⃣ Checking user balance...")
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    if response.status_code != 200:
        print(f"❌ Failed to get user info: {response.status_code}")
        return
    
    user_info = response.json()
    balance = user_info.get("bitcoin_balance", 0)
    print(f"✅ Current balance: {balance} BTC")
    
    # Step 3: Test withdrawal with insufficient balance (should fail gracefully)
    print("\n3️⃣ Testing withdrawal with insufficient balance...")
    withdrawal_data = {
        "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
        "amount": 0.00001
    }
    
    response = requests.post(f"{BASE_URL}/withdraw/bitcoin", json=withdrawal_data, headers=headers)
    print(f"Response Status: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print(f"Response Body: {response.text}")
    
    if response.status_code == 400:
        response_data = response.json()
        if "insufficient" in response_data.get("detail", "").lower():
            print("✅ Insufficient balance correctly detected")
        else:
            print(f"⚠️ Got 400 but unexpected message: {response_data}")
    elif response.status_code == 500:
        print("❌ Got 500 error - this indicates a server-side issue")
        print("   This suggests the Coinbase integration has a problem")
    else:
        print(f"❌ Unexpected status code: {response.status_code}")
    
    # Step 4: Test with empty address
    print("\n4️⃣ Testing withdrawal with empty address...")
    withdrawal_data = {
        "address": "",
        "amount": 0.00001
    }
    
    response = requests.post(f"{BASE_URL}/withdraw/bitcoin", json=withdrawal_data, headers=headers)
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {response.text}")
    
    if response.status_code == 400:
        response_data = response.json()
        if "address" in response_data.get("detail", "").lower():
            print("✅ Empty address correctly detected")
        else:
            print(f"⚠️ Got 400 but unexpected message: {response_data}")
    elif response.status_code == 500:
        print("❌ Got 500 error - this indicates a server-side issue")
    
    # Step 5: Check backend environment variables
    print("\n5️⃣ Checking Coinbase configuration...")
    print("   (This test cannot directly access env vars, but we can infer from behavior)")
    
    # Step 6: Test minimum amount validation
    print("\n6️⃣ Testing minimum amount validation...")
    withdrawal_data = {
        "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
        "amount": 0.000005  # Below minimum
    }
    
    response = requests.post(f"{BASE_URL}/withdraw/bitcoin", json=withdrawal_data, headers=headers)
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {response.text}")
    
    if response.status_code == 400:
        response_data = response.json()
        if "minimum" in response_data.get("detail", "").lower():
            print("✅ Minimum amount validation working")
        else:
            print(f"⚠️ Got 400 but unexpected message: {response_data}")
    elif response.status_code == 500:
        print("❌ Got 500 error - this indicates a server-side issue")

def check_coinbase_credentials():
    """Check if Coinbase credentials are properly configured"""
    print("\n🔑 COINBASE CREDENTIALS CHECK")
    print("=" * 40)
    
    # Read backend .env file
    try:
        with open("/app/backend/.env", "r") as f:
            env_content = f.read()
        
        # Check for Coinbase configuration
        if "COINBASE_API_KEY=" in env_content:
            print("✅ COINBASE_API_KEY found in .env")
        else:
            print("❌ COINBASE_API_KEY not found in .env")
        
        if "COINBASE_PRIVATE_KEY=" in env_content:
            print("✅ COINBASE_PRIVATE_KEY found in .env")
        else:
            print("❌ COINBASE_PRIVATE_KEY not found in .env")
        
        if "BITCOIN_WALLET_TYPE=coinbase" in env_content:
            print("✅ BITCOIN_WALLET_TYPE set to coinbase")
        else:
            print("❌ BITCOIN_WALLET_TYPE not set to coinbase")
            
    except Exception as e:
        print(f"❌ Could not read .env file: {e}")

def main():
    print("🚀 COINBASE BITCOIN WITHDRAWAL DEBUG")
    print("=" * 50)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test started: {datetime.now().isoformat()}")
    print()
    
    check_coinbase_credentials()
    test_coinbase_withdrawal()
    
    print("\n" + "=" * 50)
    print("🏁 DEBUG TEST COMPLETED")

if __name__ == "__main__":
    main()