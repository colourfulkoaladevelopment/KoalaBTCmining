#!/usr/bin/env python3
"""
Test Kraken API Connection
This script tests if the Kraken API credentials are valid and can connect to Kraken
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

def test_kraken_balance():
    """Test Kraken API by fetching account balance"""
    print("=" * 80)
    print("KRAKEN API CONNECTION TEST")
    print("=" * 80)
    
    # Get credentials
    api_key = os.getenv("KRAKEN_API_KEY", "")
    api_secret = os.getenv("KRAKEN_API_SECRET", "")
    base_url = os.getenv("KRAKEN_BASE_URL", "https://api.kraken.com")
    
    print(f"\n1. Checking Credentials:")
    print(f"   API Key: {'✓ Present' if api_key else '✗ Missing'} ({len(api_key)} chars)")
    print(f"   API Secret: {'✓ Present' if api_secret else '✗ Missing'} ({len(api_secret)} chars)")
    print(f"   Base URL: {base_url}")
    
    if not api_key or not api_secret:
        print("\n❌ ERROR: Kraken credentials not configured!")
        return False
    
    # Test API call - Get account balance
    url_path = '/0/private/Balance'
    nonce = int(time.time() * 1000000)
    
    data = {
        'nonce': nonce
    }
    
    print(f"\n2. Generating API Signature...")
    try:
        signature = get_kraken_signature(url_path, data, api_secret)
        print(f"   ✓ Signature generated successfully")
    except Exception as e:
        print(f"   ✗ Signature generation failed: {e}")
        return False
    
    headers = {
        'API-Key': api_key,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    print(f"\n3. Sending Balance Request to Kraken...")
    print(f"   URL: {base_url}{url_path}")
    
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
            print(f"\n4. Kraken Response:")
            print(f"   {result}")
            
            if 'error' in result and result['error']:
                print(f"\n❌ KRAKEN API ERROR:")
                for error in result['error']:
                    print(f"   - {error}")
                return False
            
            if 'result' in result:
                print(f"\n✅ SUCCESS! Connected to Kraken API")
                print(f"\n5. Account Balances:")
                balances = result['result']
                if balances:
                    for currency, amount in balances.items():
                        # Only show non-zero balances
                        if float(amount) > 0:
                            print(f"   {currency}: {amount}")
                    
                    # Check for Bitcoin
                    if 'XXBT' in balances or 'XBT' in balances:
                        btc_balance = balances.get('XXBT', balances.get('XBT', '0'))
                        print(f"\n   Bitcoin Balance: {btc_balance} BTC")
                    else:
                        print(f"\n   ⚠️  No Bitcoin balance found in account")
                else:
                    print(f"   (No balances or all zero)")
                
                return True
        else:
            print(f"\n❌ HTTP Error: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"\n❌ Request Failed: {e}")
        return False
    
    print("=" * 80)

if __name__ == "__main__":
    success = test_kraken_balance()
    sys.exit(0 if success else 1)
