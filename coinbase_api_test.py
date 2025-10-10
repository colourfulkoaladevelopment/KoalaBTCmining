#!/usr/bin/env python3
"""
Direct Coinbase API Test - Verify BTC Wallet Exists
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv("/app/backend/.env")

def test_coinbase_direct():
    """Test direct Coinbase API to verify BTC wallet exists"""
    print("🔍 Testing Direct Coinbase API Access...")
    
    try:
        # Import Coinbase SDK
        from coinbase.rest import RESTClient
        
        # Get credentials from environment
        coinbase_api_key = os.getenv("COINBASE_API_KEY", "")
        coinbase_private_key = os.getenv("COINBASE_PRIVATE_KEY", "")
        
        if not coinbase_api_key or not coinbase_private_key:
            print("❌ Coinbase credentials not found in environment")
            return False
        
        print("✅ Coinbase credentials found")
        
        # Initialize Coinbase client
        client = RESTClient(api_key=coinbase_api_key, api_secret=coinbase_private_key)
        print("✅ Coinbase client initialized")
        
        # Get accounts
        accounts_response = client.get_accounts()
        print("✅ Successfully called get_accounts()")
        
        if hasattr(accounts_response, 'accounts') and accounts_response.accounts:
            btc_account = None
            all_currencies = []
            
            for account in accounts_response.accounts:
                if hasattr(account, 'currency'):
                    currency = account.currency
                    all_currencies.append(currency)
                    
                    if currency == 'BTC':
                        btc_account = account
                        balance = getattr(account, 'available_balance', {}).get('value', '0') if hasattr(account, 'available_balance') else '0'
                        print(f"🎉 BTC WALLET FOUND! Balance: {balance} BTC")
            
            print(f"📊 All available currencies: {', '.join(all_currencies)}")
            
            if btc_account:
                print("✅ SUCCESS: BTC wallet now exists in Coinbase account!")
                return True
            else:
                print("❌ FAILURE: BTC wallet still missing from Coinbase account")
                return False
        else:
            print("❌ No accounts returned from Coinbase API")
            return False
            
    except ImportError:
        print("❌ coinbase-advanced-py SDK not installed")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Coinbase BTC Wallet Verification Test")
    print("=" * 50)
    
    success = test_coinbase_direct()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 RESULT: BTC wallet verification SUCCESSFUL!")
        print("✅ The user has successfully added a BTC wallet to their Coinbase account")
        print("✅ Coinbase integration should now work for Bitcoin withdrawals")
    else:
        print("❌ RESULT: BTC wallet verification FAILED!")
        print("❌ BTC wallet is still missing from the Coinbase account")
    
    exit(0 if success else 1)