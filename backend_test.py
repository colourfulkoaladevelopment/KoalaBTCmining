#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Bitcoin Mining Simulator
Tests all authentication, mining, referral, and store functionality
"""

import requests
import json
import time
import random
import string
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

# Get backend URL from frontend .env
FRONTEND_ENV_PATH = "/app/frontend/.env"
BACKEND_URL = None

try:
    with open(FRONTEND_ENV_PATH, 'r') as f:
        for line in f:
            if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                BACKEND_URL = line.split('=', 1)[1].strip().strip('"')
                break
except:
    pass

if not BACKEND_URL:
    BACKEND_URL = "http://localhost:8001"

API_BASE = f"{BACKEND_URL}/api"

print(f"🔧 Testing Bitcoin Mining Simulator API at: {API_BASE}")
print("=" * 80)

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def success(self, test_name):
        self.passed += 1
        print(f"✅ {test_name}")
        
    def failure(self, test_name, error):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ {test_name}: {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print("\n" + "=" * 80)
        print(f"📊 TEST SUMMARY: {self.passed}/{total} passed")
        if self.errors:
            print("\n🚨 FAILED TESTS:")
            for error in self.errors:
                print(f"   • {error}")
        print("=" * 80)

results = TestResults()

def generate_test_email():
    """Generate unique test email"""
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"testuser_{random_suffix}@example.com"

def generate_test_name():
    """Generate test user name"""
    names = ["Alice Johnson", "Bob Smith", "Carol Davis", "David Wilson", "Emma Brown"]
    return random.choice(names)

# Test data storage
test_users = []
auth_tokens = []

def test_health_check():
    """Test API health check"""
    try:
        response = requests.get(f"{API_BASE}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                results.success("Health Check")
                return True
            else:
                results.failure("Health Check", f"Unhealthy status: {data}")
                return False
        else:
            results.failure("Health Check", f"HTTP {response.status_code}")
            return False
    except Exception as e:
        results.failure("Health Check", str(e))
        return False

def test_user_registration():
    """Test user registration with and without referral codes"""
    try:
        # Test 1: Register first user (referrer)
        referrer_email = generate_test_email()
        referrer_data = {
            "name": generate_test_name(),
            "email": referrer_email,
            "password": "SecurePass123!"
        }
        
        response = requests.post(f"{API_BASE}/auth/register", json=referrer_data, timeout=10)
        if response.status_code != 200:
            results.failure("User Registration (Referrer)", f"HTTP {response.status_code}: {response.text}")
            return False
            
        referrer_result = response.json()
        if not all(key in referrer_result for key in ["user", "access_token", "message"]):
            results.failure("User Registration (Referrer)", "Missing required fields in response")
            return False
            
        referrer_user = referrer_result["user"]
        referrer_token = referrer_result["access_token"]
        referral_code = referrer_user["referral_code"]
        
        test_users.append({
            "email": referrer_email,
            "user_data": referrer_user,
            "token": referrer_token,
            "role": "referrer"
        })
        auth_tokens.append(referrer_token)
        
        results.success("User Registration (Referrer)")
        
        # Test 2: Register second user with referral code
        referee_email = generate_test_email()
        referee_data = {
            "name": generate_test_name(),
            "email": referee_email,
            "password": "SecurePass123!",
            "referral_code": referral_code
        }
        
        response = requests.post(f"{API_BASE}/auth/register", json=referee_data, timeout=10)
        if response.status_code != 200:
            results.failure("User Registration (With Referral)", f"HTTP {response.status_code}: {response.text}")
            return False
            
        referee_result = response.json()
        referee_user = referee_result["user"]
        referee_token = referee_result["access_token"]
        
        test_users.append({
            "email": referee_email,
            "user_data": referee_user,
            "token": referee_token,
            "role": "referee"
        })
        auth_tokens.append(referee_token)
        
        results.success("User Registration (With Referral)")
        
        # Test 3: Try to register with existing email
        response = requests.post(f"{API_BASE}/auth/register", json=referrer_data, timeout=10)
        if response.status_code == 400:
            results.success("User Registration (Duplicate Email Check)")
        else:
            results.failure("User Registration (Duplicate Email Check)", f"Expected 400, got {response.status_code}")
            
        return True
        
    except Exception as e:
        results.failure("User Registration", str(e))
        return False

def test_user_login():
    """Test user login functionality"""
    try:
        if not test_users:
            results.failure("User Login", "No test users available")
            return False
            
        user = test_users[0]
        login_data = {
            "email": user["email"],
            "password": "SecurePass123!"
        }
        
        response = requests.post(f"{API_BASE}/auth/login", json=login_data, timeout=10)
        if response.status_code != 200:
            results.failure("User Login", f"HTTP {response.status_code}: {response.text}")
            return False
            
        login_result = response.json()
        if not all(key in login_result for key in ["user", "access_token", "message"]):
            results.failure("User Login", "Missing required fields in response")
            return False
            
        results.success("User Login")
        
        # Test invalid credentials
        invalid_login = {
            "email": user["email"],
            "password": "WrongPassword"
        }
        
        response = requests.post(f"{API_BASE}/auth/login", json=invalid_login, timeout=10)
        if response.status_code == 401:
            results.success("User Login (Invalid Credentials)")
        else:
            results.failure("User Login (Invalid Credentials)", f"Expected 401, got {response.status_code}")
            
        return True
        
    except Exception as e:
        results.failure("User Login", str(e))
        return False

def test_auth_me():
    """Test getting current user info"""
    try:
        if not auth_tokens:
            results.failure("Auth Me", "No auth tokens available")
            return False
            
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
        
        if response.status_code != 200:
            results.failure("Auth Me", f"HTTP {response.status_code}: {response.text}")
            return False
            
        user_info = response.json()
        required_fields = ["id", "name", "email", "referral_code", "bitcoin_balance", "total_earnings"]
        
        if not all(field in user_info for field in required_fields):
            results.failure("Auth Me", f"Missing required fields: {required_fields}")
            return False
            
        results.success("Auth Me")
        return True
        
    except Exception as e:
        results.failure("Auth Me", str(e))
        return False

def test_device_registration():
    """Test device registration for push notifications"""
    try:
        if not auth_tokens:
            results.failure("Device Registration", "No auth tokens available")
            return False
            
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        device_data = {
            "expo_push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
            "device_type": "android",
            "app_version": "1.0.0"
        }
        
        response = requests.post(f"{API_BASE}/devices/register", json=device_data, headers=headers, timeout=10)
        
        if response.status_code != 200:
            results.failure("Device Registration", f"HTTP {response.status_code}: {response.text}")
            return False
            
        result = response.json()
        if "message" not in result:
            results.failure("Device Registration", "Missing message in response")
            return False
            
        results.success("Device Registration")
        
        # Test invalid token format
        invalid_device_data = {
            "expo_push_token": "InvalidTokenFormat",
            "device_type": "ios",
            "app_version": "1.0.0"
        }
        
        response = requests.post(f"{API_BASE}/devices/register", json=invalid_device_data, headers=headers, timeout=10)
        if response.status_code == 422:  # Validation error
            results.success("Device Registration (Invalid Token)")
        else:
            results.failure("Device Registration (Invalid Token)", f"Expected 422, got {response.status_code}")
            
        return True
        
    except Exception as e:
        results.failure("Device Registration", str(e))
        return False

def test_wallet_balance():
    """Test wallet balance endpoint"""
    try:
        if not auth_tokens:
            results.failure("Wallet Balance", "No auth tokens available")
            return False
            
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        response = requests.get(f"{API_BASE}/wallet/balance", headers=headers, timeout=10)
        
        if response.status_code != 200:
            results.failure("Wallet Balance", f"HTTP {response.status_code}: {response.text}")
            return False
            
        balance_data = response.json()
        required_fields = ["total_balance", "today_earnings", "total_miners", "active_miners", "current_hash_rate"]
        
        if not all(field in balance_data for field in required_fields):
            results.failure("Wallet Balance", f"Missing required fields: {required_fields}")
            return False
            
        # New users should start with 0 balance
        if balance_data["total_balance"] != 0.0:
            results.failure("Wallet Balance", f"New user should have 0 balance, got {balance_data['total_balance']}")
            return False
            
        results.success("Wallet Balance")
        return True
        
    except Exception as e:
        results.failure("Wallet Balance", str(e))
        return False

def test_miners_list():
    """Test getting user's miners list"""
    try:
        if not auth_tokens:
            results.failure("Miners List", "No auth tokens available")
            return False
            
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        response = requests.get(f"{API_BASE}/miners/list", headers=headers, timeout=10)
        
        if response.status_code != 200:
            results.failure("Miners List", f"HTTP {response.status_code}: {response.text}")
            return False
            
        miners_data = response.json()
        if "miners" not in miners_data:
            results.failure("Miners List", "Missing 'miners' field in response")
            return False
            
        miners = miners_data["miners"]
        
        # Check if referral reward miners were created (should have 2 users with referral miners)
        referral_miners = [m for m in miners if m["miner_type"] in ["referral_reward"]]
        if len(referral_miners) > 0:
            results.success("Miners List (Referral Miners Created)")
        else:
            results.failure("Miners List (Referral Miners)", "No referral reward miners found")
            
        results.success("Miners List")
        return True
        
    except Exception as e:
        results.failure("Miners List", str(e))
        return False

def test_free_daily_miner():
    """Test activating free daily miner"""
    try:
        if not auth_tokens:
            results.failure("Free Daily Miner", "No auth tokens available")
            return False
            
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        response = requests.post(f"{API_BASE}/miners/activate-free", headers=headers, timeout=10)
        
        if response.status_code != 200:
            results.failure("Free Daily Miner", f"HTTP {response.status_code}: {response.text}")
            return False
            
        result = response.json()
        if not all(key in result for key in ["message", "miner_id"]):
            results.failure("Free Daily Miner", "Missing required fields in response")
            return False
            
        results.success("Free Daily Miner")
        
        # Test trying to activate again (should fail)
        response = requests.post(f"{API_BASE}/miners/activate-free", headers=headers, timeout=10)
        if response.status_code == 400:
            results.success("Free Daily Miner (Duplicate Prevention)")
        else:
            results.failure("Free Daily Miner (Duplicate Prevention)", f"Expected 400, got {response.status_code}")
            
        return True
        
    except Exception as e:
        results.failure("Free Daily Miner", str(e))
        return False

def test_ad_mining():
    """Test ad mining boost system"""
    try:
        if not auth_tokens:
            results.failure("Ad Mining", "No auth tokens available")
            return False
            
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        
        # Test first ad watch
        response = requests.post(f"{API_BASE}/miners/watch-ad", headers=headers, timeout=10)
        
        if response.status_code != 200:
            results.failure("Ad Mining", f"HTTP {response.status_code}: {response.text}")
            return False
            
        result = response.json()
        if "message" not in result:
            results.failure("Ad Mining", "Missing message in response")
            return False
            
        results.success("Ad Mining (First Ad)")
        
        # Test stacking ads (should work)
        response = requests.post(f"{API_BASE}/miners/watch-ad", headers=headers, timeout=10)
        if response.status_code == 200:
            results.success("Ad Mining (Stacking)")
        else:
            results.failure("Ad Mining (Stacking)", f"HTTP {response.status_code}: {response.text}")
            
        return True
        
    except Exception as e:
        results.failure("Ad Mining", str(e))
        return False

def test_store_miners():
    """Test store miners endpoint"""
    try:
        response = requests.get(f"{API_BASE}/store/miners", timeout=10)
        
        if response.status_code != 200:
            results.failure("Store Miners", f"HTTP {response.status_code}: {response.text}")
            return False
            
        store_data = response.json()
        if "miners" not in store_data:
            results.failure("Store Miners", "Missing 'miners' field in response")
            return False
            
        miners = store_data["miners"]
        if len(miners) == 0:
            results.failure("Store Miners", "No miners available in store")
            return False
            
        # Check required fields for each miner
        required_fields = ["id", "name", "hash_rate", "price", "duration_days"]
        for miner in miners:
            if not all(field in miner for field in required_fields):
                results.failure("Store Miners", f"Miner missing required fields: {required_fields}")
                return False
                
        results.success("Store Miners")
        return True
        
    except Exception as e:
        results.failure("Store Miners", str(e))
        return False

def test_store_purchase():
    """Test store purchase functionality"""
    try:
        if not auth_tokens:
            results.failure("Store Purchase", "No auth tokens available")
            return False
            
        # First get available miners
        response = requests.get(f"{API_BASE}/store/miners", timeout=10)
        if response.status_code != 200:
            results.failure("Store Purchase", "Could not get store miners")
            return False
            
        miners = response.json()["miners"]
        test_miner = miners[0]  # Use first miner for testing
        
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        purchase_data = {
            "name": test_miner["name"],
            "hash_rate": test_miner["hash_rate"],
            "price": test_miner["price"],
            "duration_days": test_miner["duration_days"],
            "payment_method": "credit_card"
        }
        
        response = requests.post(f"{API_BASE}/store/purchase", json=purchase_data, headers=headers, timeout=10)
        
        if response.status_code != 200:
            results.failure("Store Purchase", f"HTTP {response.status_code}: {response.text}")
            return False
            
        result = response.json()
        if not all(key in result for key in ["message", "miner_id", "purchase_id"]):
            results.failure("Store Purchase", "Missing required fields in response")
            return False
            
        results.success("Store Purchase")
        return True
        
    except Exception as e:
        results.failure("Store Purchase", str(e))
        return False

def test_referral_stats():
    """Test referral statistics endpoint"""
    try:
        if not auth_tokens:
            results.failure("Referral Stats", "No auth tokens available")
            return False
            
        # Test for referrer (first user)
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        response = requests.get(f"{API_BASE}/referrals/stats", headers=headers, timeout=10)
        
        if response.status_code != 200:
            results.failure("Referral Stats", f"HTTP {response.status_code}: {response.text}")
            return False
            
        stats = response.json()
        required_fields = ["referral_code", "total_referrals", "total_commission", "referral_miners"]
        
        if not all(field in stats for field in required_fields):
            results.failure("Referral Stats", f"Missing required fields: {required_fields}")
            return False
            
        # Should have 1 referral since we registered a user with referral code
        if stats["total_referrals"] != 1:
            results.failure("Referral Stats", f"Expected 1 referral, got {stats['total_referrals']}")
            return False
            
        results.success("Referral Stats")
        return True
        
    except Exception as e:
        results.failure("Referral Stats", str(e))
        return False

def test_miner_activation():
    """Test miner activation functionality"""
    try:
        if not auth_tokens:
            results.failure("Miner Activation", "No auth tokens available")
            return False
            
        # Get user's miners first
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        response = requests.get(f"{API_BASE}/miners/list", headers=headers, timeout=10)
        
        if response.status_code != 200:
            results.failure("Miner Activation", "Could not get miners list")
            return False
            
        miners = response.json()["miners"]
        inactive_miners = [m for m in miners if m["status"] == "inactive"]
        
        if not inactive_miners:
            results.failure("Miner Activation", "No inactive miners to test activation")
            return False
            
        # Activate first inactive miner
        miner_id = inactive_miners[0]["id"]
        response = requests.post(f"{API_BASE}/miners/{miner_id}/activate", headers=headers, timeout=10)
        
        if response.status_code != 200:
            results.failure("Miner Activation", f"HTTP {response.status_code}: {response.text}")
            return False
            
        result = response.json()
        if "message" not in result:
            results.failure("Miner Activation", "Missing message in response")
            return False
            
        results.success("Miner Activation")
        
        # Test activating already active miner (should fail)
        response = requests.post(f"{API_BASE}/miners/{miner_id}/activate", headers=headers, timeout=10)
        if response.status_code == 400:
            results.success("Miner Activation (Already Active)")
        else:
            results.failure("Miner Activation (Already Active)", f"Expected 400, got {response.status_code}")
            
        return True
        
    except Exception as e:
        results.failure("Miner Activation", str(e))
        return False

def test_logout():
    """Test user logout"""
    try:
        if not auth_tokens:
            results.failure("Logout", "No auth tokens available")
            return False
            
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        response = requests.post(f"{API_BASE}/auth/logout", headers=headers, timeout=10)
        
        if response.status_code != 200:
            results.failure("Logout", f"HTTP {response.status_code}: {response.text}")
            return False
            
        result = response.json()
        if "message" not in result:
            results.failure("Logout", "Missing message in response")
            return False
            
        results.success("Logout")
        
        # Test using logged out token (should fail)
        response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
        if response.status_code == 401:
            results.success("Logout (Token Invalidation)")
        else:
            results.failure("Logout (Token Invalidation)", f"Expected 401, got {response.status_code}")
            
        return True
        
    except Exception as e:
        results.failure("Logout", str(e))
        return False

def run_all_tests():
    """Run all backend API tests"""
    print("🚀 Starting comprehensive backend API testing...\n")
    
    # Core API tests
    if not test_health_check():
        print("❌ Health check failed - stopping tests")
        return
    
    # Authentication flow tests
    print("\n🔐 Testing Authentication System...")
    test_user_registration()
    test_user_login()
    test_auth_me()
    
    # Device management tests
    print("\n📱 Testing Device Management...")
    test_device_registration()
    
    # Wallet and balance tests
    print("\n💰 Testing Wallet System...")
    test_wallet_balance()
    
    # Mining system tests
    print("\n⛏️ Testing Mining System...")
    test_miners_list()
    test_free_daily_miner()
    test_ad_mining()
    test_miner_activation()
    
    # Store system tests
    print("\n🏪 Testing Store System...")
    test_store_miners()
    test_store_purchase()
    
    # Referral system tests
    print("\n👥 Testing Referral System...")
    test_referral_stats()
    
    # Logout tests
    print("\n🚪 Testing Logout...")
    test_logout()
    
    # Final summary
    results.summary()
    
    return results.failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)