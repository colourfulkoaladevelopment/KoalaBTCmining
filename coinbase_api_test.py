#!/usr/bin/env python3
"""
Direct Coinbase API test to isolate the issue
"""

import os
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

def test_coinbase_api():
    """Test Coinbase API directly"""
    
    print("🔍 DIRECT COINBASE API TEST")
    print("=" * 40)
    
    # Get credentials
    api_key = os.getenv("COINBASE_API_KEY", "")
    private_key = os.getenv("COINBASE_PRIVATE_KEY", "")
    
    print(f"API Key: {api_key[:20]}..." if api_key else "API Key: NOT SET")
    print(f"Private Key: {'SET' if private_key else 'NOT SET'}")
    print()
    
    if not api_key or not private_key:
        print("❌ Coinbase credentials not properly configured")
        return False
    
    try:
        print("1️⃣ Testing Coinbase import...")
        from coinbase.rest import RESTClient
        print("✅ Coinbase import successful")
        
        print("\n2️⃣ Testing Coinbase client initialization...")
        client = RESTClient(api_key=api_key, api_secret=private_key)
        print("✅ Coinbase client initialized")
        
        print("\n3️⃣ Testing Coinbase account access...")
        accounts_response = client.get_accounts()
        print("✅ Coinbase accounts retrieved")
        
        # Check if we have accounts
        if hasattr(accounts_response, 'accounts') and accounts_response.accounts:
            print(f"   Found {len(accounts_response.accounts)} accounts")
            
            # Look for BTC account
            btc_account = None
            for account in accounts_response.accounts:
                if hasattr(account, 'currency') and account.currency == 'BTC':
                    btc_account = account
                    break
            
            if btc_account:
                print(f"✅ BTC account found: {btc_account.uuid if hasattr(btc_account, 'uuid') else 'unknown'}")
                if hasattr(btc_account, 'available_balance'):
                    balance = btc_account.available_balance
                    print(f"   Available balance: {balance.value if hasattr(balance, 'value') else 'unknown'} {balance.currency if hasattr(balance, 'currency') else ''}")
                return True
            else:
                print("❌ No BTC account found")
                print("   Available accounts:")
                for account in accounts_response.accounts:
                    currency = account.currency if hasattr(account, 'currency') else 'unknown'
                    print(f"   - {currency}")
                return False
        else:
            print("❌ No accounts found or unexpected response format")
            print(f"   Response type: {type(accounts_response)}")
            print(f"   Response: {accounts_response}")
            return False
            
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Coinbase API error: {e}")
        print(f"   Error type: {type(e).__name__}")
        return False

def main():
    print("🚀 COINBASE API DIRECT TEST")
    print("=" * 40)
    
    success = test_coinbase_api()
    
    print("\n" + "=" * 40)
    if success:
        print("🎉 Coinbase API test successful!")
        print("   The issue might be in the withdrawal logic, not the API connection.")
    else:
        print("🚨 Coinbase API test failed!")
        print("   This explains why withdrawals are failing with 500 errors.")

if __name__ == "__main__":
    main()