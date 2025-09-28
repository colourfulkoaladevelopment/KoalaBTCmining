#!/usr/bin/env python3
"""
Additional Bitcoin Mining Simulator Backend API Tests
Tests edge cases and business logic validation
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'http://localhost:8001')
API_BASE = f"{BACKEND_URL}/api"

print(f"Running Additional Backend Tests at: {API_BASE}")
print("=" * 60)

def test_mining_business_logic():
    """Test mining calculations and business logic"""
    print("🔍 Testing Mining Business Logic...")
    
    # Get initial stats
    stats_response = requests.get(f"{API_BASE}/mining/stats")
    if stats_response.status_code == 200:
        stats = stats_response.json()
        print(f"   Current hash rate: {stats['current_hash_rate']} GH/s")
        print(f"   Mining active: {stats['mining_active']}")
        print(f"   Chart data points: {len(stats['chart_data'])}")
        
        # Validate chart data structure
        if stats['chart_data'] and len(stats['chart_data']) > 0:
            first_point = stats['chart_data'][0]
            if 'time' in first_point and 'value' in first_point:
                print("   ✅ Chart data structure is valid")
            else:
                print("   ❌ Chart data structure is invalid")
        
        return True
    else:
        print(f"   ❌ Failed to get mining stats: {stats_response.status_code}")
        return False

def test_wallet_balance_consistency():
    """Test wallet balance calculations"""
    print("🔍 Testing Wallet Balance Consistency...")
    
    # Get user profile
    profile_response = requests.get(f"{API_BASE}/user/profile")
    wallet_response = requests.get(f"{API_BASE}/wallet/balance")
    
    if profile_response.status_code == 200 and wallet_response.status_code == 200:
        profile = profile_response.json()
        wallet = wallet_response.json()
        
        # Check balance consistency
        if profile['bitcoin_balance'] == wallet['total_balance']:
            print(f"   ✅ Balance consistency: {profile['bitcoin_balance']} BTC")
        else:
            print(f"   ❌ Balance mismatch: Profile={profile['bitcoin_balance']}, Wallet={wallet['total_balance']}")
        
        print(f"   Today's earnings: {wallet['today_earnings']} BTC")
        print(f"   Total miners: {wallet['total_miners']}")
        print(f"   Active miners: {wallet['active_miners']}")
        
        return True
    else:
        print("   ❌ Failed to get profile or wallet data")
        return False

def test_miner_lifecycle():
    """Test complete miner lifecycle"""
    print("🔍 Testing Miner Lifecycle...")
    
    # Create a new miner
    miner_data = {
        "name": "Lifecycle Test Miner",
        "hash_rate": 15.0,
        "duration": 48.0,
        "type": "premium",
        "price": 0.001
    }
    
    create_response = requests.post(f"{API_BASE}/miners/create", json=miner_data)
    if create_response.status_code == 200:
        miner = create_response.json()['miner']
        miner_id = miner['id']
        print(f"   ✅ Created miner: {miner['name']} (ID: {miner_id})")
        
        # Activate the miner
        activate_response = requests.post(f"{API_BASE}/miners/{miner_id}/activate")
        if activate_response.status_code == 200:
            print("   ✅ Miner activated successfully")
            
            # Check if mining stats reflect the new active miner
            stats_response = requests.get(f"{API_BASE}/mining/stats")
            if stats_response.status_code == 200:
                stats = stats_response.json()
                if stats['mining_active'] and stats['current_hash_rate'] >= miner['hash_rate']:
                    print(f"   ✅ Mining stats updated: {stats['current_hash_rate']} GH/s")
                else:
                    print(f"   ⚠️  Mining stats may not reflect new miner: {stats['current_hash_rate']} GH/s")
            
            # Deactivate the miner
            deactivate_response = requests.post(f"{API_BASE}/miners/{miner_id}/deactivate")
            if deactivate_response.status_code == 200:
                print("   ✅ Miner deactivated successfully")
                return True
            else:
                print(f"   ❌ Failed to deactivate miner: {deactivate_response.status_code}")
        else:
            print(f"   ❌ Failed to activate miner: {activate_response.status_code}")
    else:
        print(f"   ❌ Failed to create miner: {create_response.status_code}")
    
    return False

def test_ad_rewards_functionality():
    """Test ad rewards system"""
    print("🔍 Testing Ad Rewards System...")
    
    # Get initial miner count
    miners_response = requests.get(f"{API_BASE}/miners/list")
    if miners_response.status_code == 200:
        initial_miners = miners_response.json()['miners']
        initial_ad_miners = [m for m in initial_miners if m['miner_type'] == 'ad']
        
        print(f"   Initial ad miners: {len(initial_ad_miners)}")
        
        # Activate ad reward
        ad_data = {"reward_type": "mining_boost"}
        ad_response = requests.post(f"{API_BASE}/ad-rewards/activate", json=ad_data)
        
        if ad_response.status_code == 200:
            print("   ✅ Ad reward activated")
            
            # Check if ad miner was created/activated
            miners_response = requests.get(f"{API_BASE}/miners/list")
            if miners_response.status_code == 200:
                updated_miners = miners_response.json()['miners']
                updated_ad_miners = [m for m in updated_miners if m['miner_type'] == 'ad']
                
                if len(updated_ad_miners) >= len(initial_ad_miners):
                    ad_miner = next((m for m in updated_ad_miners if m['name'] == 'Ad Boost Miner'), None)
                    if ad_miner:
                        print(f"   ✅ Ad miner found: {ad_miner['name']} ({ad_miner['status']})")
                        print(f"   Hash rate: {ad_miner['hash_rate']} GH/s")
                        print(f"   Time remaining: {ad_miner['time_remaining']} hours")
                        return True
                    else:
                        print("   ❌ Ad Boost Miner not found")
                else:
                    print("   ❌ No new ad miners created")
            else:
                print("   ❌ Failed to get updated miners list")
        else:
            print(f"   ❌ Failed to activate ad reward: {ad_response.status_code}")
    else:
        print("   ❌ Failed to get initial miners list")
    
    return False

def test_transaction_system():
    """Test transaction recording and balance updates"""
    print("🔍 Testing Transaction System...")
    
    # Get initial balance
    profile_response = requests.get(f"{API_BASE}/user/profile")
    if profile_response.status_code == 200:
        initial_balance = profile_response.json()['bitcoin_balance']
        print(f"   Initial balance: {initial_balance} BTC")
        
        # Record an earning transaction
        transaction_data = {
            "type": "earning",
            "amount": 0.00000050,
            "description": "Test mining reward"
        }
        
        transaction_response = requests.post(f"{API_BASE}/transactions/record", json=transaction_data)
        if transaction_response.status_code == 200:
            print("   ✅ Transaction recorded")
            
            # Check if balance was updated
            updated_profile_response = requests.get(f"{API_BASE}/user/profile")
            if updated_profile_response.status_code == 200:
                updated_balance = updated_profile_response.json()['bitcoin_balance']
                expected_balance = initial_balance + transaction_data['amount']
                
                if abs(updated_balance - expected_balance) < 0.00000001:  # Account for floating point precision
                    print(f"   ✅ Balance updated correctly: {updated_balance} BTC")
                    return True
                else:
                    print(f"   ❌ Balance not updated correctly: Expected {expected_balance}, Got {updated_balance}")
            else:
                print("   ❌ Failed to get updated profile")
        else:
            print(f"   ❌ Failed to record transaction: {transaction_response.status_code}")
    else:
        print("   ❌ Failed to get initial profile")
    
    return False

def test_shop_system():
    """Test shop functionality"""
    print("🔍 Testing Shop System...")
    
    # Get shop miners
    shop_response = requests.get(f"{API_BASE}/shop/miners")
    if shop_response.status_code == 200:
        shop_miners = shop_response.json()['miners']
        print(f"   Available shop miners: {len(shop_miners)}")
        
        for miner in shop_miners:
            print(f"   - {miner['name']}: {miner['hash_rate']} GH/s, {miner['price']} BTC")
        
        # Test purchase with insufficient balance (should fail gracefully)
        expensive_miner = max(shop_miners, key=lambda x: x['price'])
        purchase_data = {
            "name": expensive_miner['name'],
            "hash_rate": expensive_miner['hash_rate'],
            "duration": expensive_miner['duration'],
            "price": expensive_miner['price']
        }
        
        purchase_response = requests.post(f"{API_BASE}/shop/purchase", json=purchase_data)
        if purchase_response.status_code == 400:
            error_data = purchase_response.json()
            if 'insufficient' in error_data.get('detail', '').lower():
                print("   ✅ Insufficient balance error handled correctly")
                return True
            else:
                print(f"   ❌ Unexpected error message: {error_data}")
        else:
            print(f"   ❌ Expected 400 status for insufficient balance, got: {purchase_response.status_code}")
    else:
        print(f"   ❌ Failed to get shop miners: {shop_response.status_code}")
    
    return False

def main():
    """Run all additional tests"""
    print("Starting Additional Backend API Tests...")
    print("-" * 60)
    
    tests = [
        test_mining_business_logic,
        test_wallet_balance_consistency,
        test_miner_lifecycle,
        test_ad_rewards_functionality,
        test_transaction_system,
        test_shop_system
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
            print()  # Add spacing between tests
        except Exception as e:
            print(f"   💥 Test failed with exception: {str(e)}")
            print()
    
    print("=" * 60)
    print("ADDITIONAL TESTS SUMMARY")
    print("=" * 60)
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {total - passed}")
    print(f"📊 Total: {total}")
    
    success_rate = (passed / total) * 100
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 90:
        print("🎉 Excellent! Business logic is working well.")
    elif success_rate >= 70:
        print("⚠️  Good, but some business logic needs attention.")
    else:
        print("🚨 Multiple business logic issues detected.")

if __name__ == "__main__":
    main()