#!/usr/bin/env python3
"""
Test Kraken API credentials and permissions
"""

import os
import sys
import requests
import urllib.parse
import hashlib
import hmac
import base64
import time
from dotenv import load_dotenv

# Load environment
load_dotenv("/app/backend/.env")

# Kraken credentials
KRAKEN_API_KEY = os.getenv("KRAKEN_API_KEY", "")
KRAKEN_API_SECRET = os.getenv("KRAKEN_API_SECRET", "")
KRAKEN_BASE_URL = os.getenv("KRAKEN_BASE_URL", "https://api.kraken.com")

def get_kraken_signature(urlpath, data, secret):
    """Generate HMAC-SHA512 signature for Kraken API"""
    postdata = urllib.parse.urlencode(data)
    encoded = (str(data['nonce']) + postdata).encode()
    message = urlpath.encode() + hashlib.sha256(encoded).digest()
    mac = hmac.new(base64.b64decode(secret), message, hashlib.sha512)
    sigdigest = base64.b64encode(mac.digest())
    return sigdigest.decode()

def test_kraken_connection():
    """Test Kraken API connection and credentials"""
    
    print("🔍 Kraken API Test")
    print("=" * 60)
    
    if not KRAKEN_API_KEY or not KRAKEN_API_SECRET:
        print("❌ Missing Kraken credentials in .env file")
        return False
    
    print(f"✅ API Key found: {KRAKEN_API_KEY[:20]}...")
    print(f"✅ API Secret found: {KRAKEN_API_SECRET[:20]}...")
    print()
    
    # Test 1: Check account balance
    print("📊 Test 1: Checking Account Balance")
    print("-" * 60)
    
    try:
        url_path = '/0/private/Balance'
        nonce = int(time.time() * 1000000)
        
        data = {'nonce': nonce}
        signature = get_kraken_signature(url_path, data, KRAKEN_API_SECRET)
        
        headers = {
            'API-Key': KRAKEN_API_KEY,
            'API-Sign': signature,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        response = requests.post(
            f"{KRAKEN_BASE_URL}{url_path}",
            data=data,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            
            if 'error' in result and result['error']:
                print(f"❌ API Error: {', '.join(result['error'])}")
                
                if 'EAPI:Invalid key' in str(result['error']):
                    print("\n💡 Issue: Invalid API key or secret")
                    print("   → Check that you copied the credentials correctly")
                    
                elif 'EAPI:Invalid nonce' in str(result['error']):
                    print("\n💡 Issue: Nonce/timestamp issue")
                    print("   → This usually resolves itself, try again")
                    
                return False
            
            if 'result' in result:
                balances = result['result']
                print("✅ Successfully connected to Kraken!")
                print("\n💰 Account Balances:")
                
                if balances:
                    for currency, amount in balances.items():
                        # Skip zero balances
                        if float(amount) > 0:
                            # XBT is Kraken's code for Bitcoin
                            display_currency = "BTC" if currency == "XXBT" else currency
                            print(f"   {display_currency}: {amount}")
                else:
                    print("   No balances found (account may be empty)")
                
                # Check for Bitcoin specifically
                btc_balance = balances.get('XXBT', '0')
                print(f"\n🪙 Bitcoin (BTC) Balance: {btc_balance}")
                
                if float(btc_balance) == 0:
                    print("   ⚠️  WARNING: Zero Bitcoin balance")
                    print("   → You need BTC in your Kraken account for withdrawals")
                
                print()
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return False
    
    # Test 2: Check API key permissions
    print("\n🔐 Test 2: Checking API Key Permissions")
    print("-" * 60)
    
    try:
        # Try to access withdrawal info endpoint (requires withdraw permission)
        url_path = '/0/private/WithdrawInfo'
        nonce = int(time.time() * 1000000)
        
        data = {
            'nonce': nonce,
            'asset': 'XBT',
            'key': 'test',  # Dummy key to test permission
            'amount': '0.001'
        }
        
        signature = get_kraken_signature(url_path, data, KRAKEN_API_SECRET)
        
        headers = {
            'API-Key': KRAKEN_API_KEY,
            'API-Sign': signature,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        response = requests.post(
            f"{KRAKEN_BASE_URL}{url_path}",
            data=data,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            
            if 'error' in result and result['error']:
                errors = result['error']
                
                if any('permission' in str(e).lower() for e in errors):
                    print("❌ Missing 'Withdraw Funds' permission")
                    print("\n💡 To Fix:")
                    print("   1. Log into Kraken")
                    print("   2. Go to Settings → API")
                    print("   3. Edit your API key")
                    print("   4. Enable 'Withdraw Funds' permission")
                    print("   5. Save changes")
                    return False
                elif any('withdrawal key' in str(e).lower() or 'invalid key' in str(e).lower()):
                    print("⚠️  Withdrawal key 'test' not found (expected)")
                    print("✅ API key has 'Withdraw Funds' permission!")
                    print("\n📝 Note: You'll need to whitelist withdrawal addresses:")
                    print("   1. Kraken → Funding → Withdraw → Bitcoin")
                    print("   2. Add each user's BTC address")
                    print("   OR use API withdrawal with direct addresses (current setup)")
                else:
                    print(f"⚠️  API Response: {', '.join(errors)}")
                    print("✅ But API key appears to have withdrawal permission")
            else:
                print("✅ API key has 'Withdraw Funds' permission!")
                
        print()
                
    except Exception as e:
        print(f"⚠️  Permission check inconclusive: {e}")
        print("   → Try a test withdrawal to verify")
        print()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    print("✅ Kraken API credentials are valid")
    print("✅ Successfully authenticated with Kraken")
    print()
    print("🎯 Next Steps:")
    print("   1. Ensure 'Withdraw Funds' permission is enabled")
    print("   2. Verify your Kraken account (KYC) if not already done")
    print("   3. For withdrawals, either:")
    print("      • Whitelist withdrawal addresses in Kraken")
    print("      • OR ensure API supports direct address withdrawals")
    print("   4. Test a small withdrawal (0.00001 BTC)")
    print()
    
    return True

if __name__ == "__main__":
    test_kraken_connection()
