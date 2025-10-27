#!/usr/bin/env python3
"""
Test Kraken Withdrawal Info - Check withdrawal methods and requirements
"""

import os
import sys
import time
import hmac
import hashlib
import base64
import urllib.parse
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

def get_kraken_signature(urlpath, data, secret):
    """Generate HMAC-SHA512 signature for Kraken API"""
    postdata = urllib.parse.urlencode(data)
    encoded = (str(data['nonce']) + postdata).encode()
    message = urlpath.encode() + hashlib.sha256(encoded).digest()
    mac = hmac.new(base64.b64decode(secret), message, hashlib.sha512)
    sigdigest = base64.b64encode(mac.digest())
    return sigdigest.decode()

def test_withdrawal_methods():
    """Get withdrawal methods (whitelisted addresses)"""
    print("=" * 80)
    print("KRAKEN WITHDRAWAL METHODS TEST")
    print("=" * 80)
    
    api_key = os.getenv("KRAKEN_API_KEY", "")
    api_secret = os.getenv("KRAKEN_API_SECRET", "")
    base_url = os.getenv("KRAKEN_BASE_URL", "https://api.kraken.com")
    
    # Get withdrawal methods
    url_path = '/0/private/WithdrawMethods'
    nonce = int(time.time() * 1000000)
    
    data = {
        'nonce': nonce,
        'asset': 'XBT'  # Bitcoin
    }
    
    print(f"\n1. Fetching Withdrawal Methods for Bitcoin...")
    
    signature = get_kraken_signature(url_path, data, api_secret)
    
    headers = {
        'API-Key': api_key,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    try:
        response = requests.post(
            f"{base_url}{url_path}",
            data=data,
            headers=headers,
            timeout=30
        )
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            if 'error' in result and result['error']:
                print(f"\n❌ KRAKEN API ERROR:")
                for error in result['error']:
                    print(f"   - {error}")
                return False
            
            if 'result' in result:
                methods = result['result']
                print(f"\n✅ Withdrawal Methods Retrieved")
                print(f"\n2. Available Withdrawal Methods:")
                
                if not methods:
                    print(f"   ⚠️  NO WITHDRAWAL METHODS FOUND!")
                    print(f"   ")
                    print(f"   This means you have NO whitelisted Bitcoin addresses in Kraken.")
                    print(f"   ")
                    print(f"   TO FIX THIS:")
                    print(f"   1. Login to your Kraken account at https://www.kraken.com")
                    print(f"   2. Go to 'Funding' → 'Withdraw'")
                    print(f"   3. Select 'Bitcoin (XBT)'")
                    print(f"   4. Click 'Add Address' or 'Add Withdrawal Address'")
                    print(f"   5. Enter a Bitcoin address and give it a description/name")
                    print(f"   6. Complete verification (email/2FA)")
                    print(f"   7. Wait for Kraken to approve the address (can take a few minutes)")
                    print(f"   ")
                    print(f"   IMPORTANT: Kraken requires addresses to be whitelisted for security.")
                    print(f"   You cannot withdraw to random addresses via API!")
                    return False
                
                for key, method in methods.items():
                    print(f"\n   Method Key: {key}")
                    print(f"   Details: {method}")
                
                return True
        else:
            print(f"\n❌ HTTP Error: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"\n❌ Request Failed: {e}")
        return False
    
    print("=" * 80)

def check_withdrawal_info():
    """Get withdrawal info (limits, fees)"""
    print("\n" + "=" * 80)
    print("KRAKEN WITHDRAWAL INFO")
    print("=" * 80)
    
    api_key = os.getenv("KRAKEN_API_KEY", "")
    api_secret = os.getenv("KRAKEN_API_SECRET", "")
    base_url = os.getenv("KRAKEN_BASE_URL", "https://api.kraken.com")
    
    url_path = '/0/private/WithdrawInfo'
    nonce = int(time.time() * 1000000)
    
    # Test with a small amount to see fees
    data = {
        'nonce': nonce,
        'asset': 'XBT',
        'key': 'test',  # This will fail but give us fee info
        'amount': '0.0001'
    }
    
    print(f"\n1. Checking Withdrawal Fees and Limits...")
    
    signature = get_kraken_signature(url_path, data, api_secret)
    
    headers = {
        'API-Key': api_key,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    try:
        response = requests.post(
            f"{base_url}{url_path}",
            data=data,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n   Response: {result}")
            
            if 'result' in result:
                info = result['result']
                print(f"\n   Withdrawal Info: {info}")
                
    except Exception as e:
        print(f"   Note: {e}")
    
    print("=" * 80)

if __name__ == "__main__":
    success = test_withdrawal_methods()
    check_withdrawal_info()
    sys.exit(0 if success else 1)
