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
            "password": "testpass123"
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
            "password": "testpass123",
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
            "password": "testpass123"
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
    """Test getting current user info - UPDATED to include total_cashed_out"""
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
        required_fields = ["id", "name", "email", "referral_code", "bitcoin_balance", "total_earnings", "total_cashed_out"]
        
        if not all(field in user_info for field in required_fields):
            results.failure("Auth Me", f"Missing required fields: {required_fields}")
            return False
        
        # NEW: Specifically test total_cashed_out field
        total_cashed_out = user_info.get("total_cashed_out")
        if total_cashed_out is None:
            results.failure("Auth Me (total_cashed_out)", "total_cashed_out field missing")
            return False
        elif total_cashed_out == 0.0:
            results.success("Auth Me (total_cashed_out initialized)")
        else:
            results.success(f"Auth Me (total_cashed_out: {total_cashed_out})")
            
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

def test_forgot_password_system():
    """Test forgot password functionality"""
    try:
        if not test_users:
            results.failure("Forgot Password", "No test users available")
            return False
            
        user_email = test_users[0]["email"]
        
        # Test 1: Valid email
        response = requests.post(f"{API_BASE}/auth/forgot-password", 
                               json={"email": user_email}, timeout=10)
        
        if response.status_code != 200:
            results.failure("Forgot Password (Valid Email)", f"HTTP {response.status_code}: {response.text}")
            return False
            
        result = response.json()
        expected_message = "If an account with this email exists, you will receive password reset instructions."
        if expected_message not in result.get("message", ""):
            results.failure("Forgot Password (Valid Email)", f"Unexpected message: {result}")
            return False
            
        results.success("Forgot Password (Valid Email)")
        
        # Test 2: Empty email
        response = requests.post(f"{API_BASE}/auth/forgot-password", 
                               json={"email": ""}, timeout=10)
        
        if response.status_code == 400:
            results.success("Forgot Password (Empty Email Validation)")
        else:
            results.failure("Forgot Password (Empty Email Validation)", f"Expected 400, got {response.status_code}")
            
        # Test 3: Non-existent email (should still return success for security)
        response = requests.post(f"{API_BASE}/auth/forgot-password", 
                               json={"email": "nonexistent@example.com"}, timeout=10)
        
        if response.status_code == 200:
            results.success("Forgot Password (Non-existent Email Security)")
        else:
            results.failure("Forgot Password (Non-existent Email Security)", f"Expected 200, got {response.status_code}")
            
        return True
        
    except Exception as e:
        results.failure("Forgot Password", str(e))
        return False

def test_bitcoin_withdrawal_system():
    """Test Bitcoin withdrawal functionality with total_cashed_out tracking"""
    try:
        if not auth_tokens:
            results.failure("Bitcoin Withdrawal", "No auth tokens available")
            return False
            
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        
        # Get initial user info to check total_cashed_out
        user_response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
        if user_response.status_code != 200:
            results.failure("Bitcoin Withdrawal (Get User Info)", "Could not get user info")
            return False
            
        initial_user_data = user_response.json()
        initial_balance = initial_user_data.get("bitcoin_balance", 0)
        initial_cashed_out = initial_user_data.get("total_cashed_out", 0)
        
        print(f"💰 Initial Balance: {initial_balance} BTC, Initial Cashed Out: {initial_cashed_out} BTC")
        
        # Test 1: Valid withdrawal request (small amount)
        test_address = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"  # Valid Bitcoin address
        test_amount = 0.001  # Minimum withdrawal amount
        
        withdrawal_data = {
            "address": test_address,
            "amount": test_amount,
            "network": "bitcoin"
        }
        
        response = requests.post(f"{API_BASE}/withdraw/bitcoin", json=withdrawal_data, headers=headers, timeout=10)
        
        if initial_balance >= test_amount:
            if response.status_code == 200:
                result = response.json()
                if "withdrawal_id" in result and result.get("status") == "processing":
                    results.success("Bitcoin Withdrawal (Valid Request)")
                    
                    # NEW: Check if total_cashed_out was updated
                    updated_user_response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
                    if updated_user_response.status_code == 200:
                        updated_user_data = updated_user_response.json()
                        new_balance = updated_user_data.get("bitcoin_balance", 0)
                        new_cashed_out = updated_user_data.get("total_cashed_out", 0)
                        
                        expected_balance = initial_balance - test_amount
                        expected_cashed_out = initial_cashed_out + test_amount
                        
                        if abs(new_balance - expected_balance) < 0.00000001:  # Account for floating point precision
                            results.success("Bitcoin Withdrawal (Balance Update)")
                        else:
                            results.failure("Bitcoin Withdrawal (Balance Update)", f"Expected {expected_balance}, got {new_balance}")
                        
                        if abs(new_cashed_out - expected_cashed_out) < 0.00000001:
                            results.success("Bitcoin Withdrawal (total_cashed_out Update)")
                            print(f"✅ total_cashed_out correctly updated: {initial_cashed_out} → {new_cashed_out}")
                        else:
                            results.failure("Bitcoin Withdrawal (total_cashed_out Update)", f"Expected {expected_cashed_out}, got {new_cashed_out}")
                    else:
                        results.failure("Bitcoin Withdrawal (Post-withdrawal Check)", "Could not get updated user info")
                else:
                    results.failure("Bitcoin Withdrawal (Valid Request)", f"Unexpected response: {result}")
            else:
                results.failure("Bitcoin Withdrawal (Valid Request)", f"HTTP {response.status_code}: {response.text}")
        else:
            # Expect insufficient balance error
            if response.status_code == 400 and "Insufficient balance" in response.text:
                results.success("Bitcoin Withdrawal (Insufficient Balance Check)")
            else:
                results.failure("Bitcoin Withdrawal (Insufficient Balance Check)", f"Expected balance error, got: {response.text}")
        
        # Test 2: Empty address validation
        withdrawal_data = {
            "address": "",
            "amount": 0.001,
            "network": "bitcoin"
        }
        
        response = requests.post(f"{API_BASE}/withdraw/bitcoin", json=withdrawal_data, headers=headers, timeout=10)
        
        if response.status_code == 400 and "address is required" in response.text:
            results.success("Bitcoin Withdrawal (Empty Address Validation)")
        else:
            results.failure("Bitcoin Withdrawal (Empty Address Validation)", f"Expected address error, got: {response.status_code} - {response.text}")
        
        # Test 3: Below minimum amount validation
        withdrawal_data = {
            "address": test_address,
            "amount": 0.0001,  # Below minimum
            "network": "bitcoin"
        }
        
        response = requests.post(f"{API_BASE}/withdraw/bitcoin", json=withdrawal_data, headers=headers, timeout=10)
        
        if response.status_code == 400 and ("Minimum withdrawal" in response.text or "Insufficient balance" in response.text):
            results.success("Bitcoin Withdrawal (Minimum Amount Check)")
        else:
            results.failure("Bitcoin Withdrawal (Minimum Amount Check)", f"Expected minimum or balance error, got: {response.text}")
        
        # Test 4: Lightning Network support
        lightning_address = "lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w"
        
        withdrawal_data = {
            "address": lightning_address,
            "amount": 0.001,
            "network": "lightning"
        }
        
        response = requests.post(f"{API_BASE}/withdraw/bitcoin", json=withdrawal_data, headers=headers, timeout=10)
        
        # Get current balance for Lightning test
        current_user_response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
        if current_user_response.status_code == 200:
            current_balance = current_user_response.json().get("bitcoin_balance", 0)
            
            if current_balance >= 0.001:
                if response.status_code == 200:
                    results.success("Bitcoin Withdrawal (Lightning Network)")
                else:
                    results.failure("Bitcoin Withdrawal (Lightning Network)", f"HTTP {response.status_code}: {response.text}")
            else:
                if response.status_code == 400 and "Insufficient balance" in response.text:
                    results.success("Bitcoin Withdrawal (Lightning Network Balance Check)")
                else:
                    results.failure("Bitcoin Withdrawal (Lightning Network Balance Check)", f"Expected balance error, got: {response.text}")
        
        return True
        
    except Exception as e:
        results.failure("Bitcoin Withdrawal", str(e))
        return False

def test_contact_support_system():
    """Test enhanced contact support system with Gmail SMTP"""
    try:
        if not auth_tokens:
            results.failure("Contact Support", "No auth tokens available")
            return False
            
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        
        # Test 1: Valid support request - GMAIL SMTP TEST
        support_data = {
            "name": "Bitcoin Mining App Tester",
            "email": "tester@bitcoinmining.app",
            "subject": "🚀 AUTOMATED TEST - Gmail SMTP Integration Verification",
            "message": f"""This is an automated test message to verify Gmail SMTP functionality in the Bitcoin Mining App.

TEST DETAILS:
- Test Time: {datetime.utcnow().isoformat()}
- Purpose: Verify Gmail SMTP email sending capability
- Expected Recipient: colourfulkoaladevelopment@gmail.com
- Gmail Credentials: colourfulkoaladevelopment@gmail.com with app password

FUNCTIONALITY BEING TESTED:
✅ Contact form submission
✅ Email content formatting (HTML)
✅ Gmail SMTP connection (smtp.gmail.com:587)
✅ Authentication with app password
✅ Email delivery to support team

If you receive this email, the Gmail SMTP integration is working correctly!

This test verifies that user support requests are properly sent to the support team via Gmail SMTP."""
        }
        
        response = requests.post(f"{API_BASE}/support/contact", json=support_data, headers=headers, timeout=15)
        
        if response.status_code != 200:
            results.failure("Gmail SMTP Contact Form", f"HTTP {response.status_code}: {response.text}")
            return False
            
        result = response.json()
        if "ticket_id" not in result or "submitted successfully" not in result.get("message", ""):
            results.failure("Gmail SMTP Contact Form", f"Unexpected response: {result}")
            return False
            
        print(f"📧 Gmail SMTP Test Email Sent! Check colourfulkoaladevelopment@gmail.com")
        print(f"   Subject: {support_data['subject']}")
        print(f"   Ticket ID: {result['ticket_id']}")
        results.success("Gmail SMTP Contact Form (Email Sent)")
        
        # Test 2: Missing fields validation
        incomplete_data = {
            "name": "Test User",
            "email": "",  # Missing email
            "subject": "Test Subject",
            "message": ""  # Missing message
        }
        
        response = requests.post(f"{API_BASE}/support/contact", json=incomplete_data, headers=headers, timeout=10)
        
        if response.status_code == 400:
            response_data = response.json()
            if "required" in response_data.get("detail", "").lower():
                results.success("Contact Support (Field Validation)")
            else:
                results.failure("Contact Support (Field Validation)", f"Unexpected error: {response_data.get('detail')}")
        else:
            results.failure("Contact Support (Field Validation)", f"Expected 400, got {response.status_code}")
        
        # Test 3: Long message handling
        long_message = "This is a comprehensive test message for the Bitcoin Mining App support system. " * 50  # ~4000 characters
        
        support_data = {
            "name": "Long Message Tester",
            "email": "longtest@example.com",
            "subject": "Long Message Handling Test",
            "message": long_message
        }
        
        response = requests.post(f"{API_BASE}/support/contact", json=support_data, headers=headers, timeout=15)
        
        if response.status_code == 200:
            results.success("Contact Support (Long Message Handling)")
        else:
            results.failure("Contact Support (Long Message Handling)", f"HTTP {response.status_code}: {response.text}")
        
        return True
        
    except Exception as e:
        results.failure("Contact Support", str(e))
        return False

def test_multiple_withdrawals_total_cashed_out():
    """Test multiple withdrawals accumulate total_cashed_out correctly"""
    try:
        if not auth_tokens:
            results.failure("Multiple Withdrawals", "No auth tokens available")
            return False
            
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        
        # Get initial user state
        user_response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
        if user_response.status_code != 200:
            results.failure("Multiple Withdrawals (Initial State)", "Could not get user info")
            return False
            
        initial_data = user_response.json()
        initial_balance = initial_data.get("bitcoin_balance", 0)
        initial_cashed_out = initial_data.get("total_cashed_out", 0)
        
        print(f"💰 Starting Multiple Withdrawals Test:")
        print(f"   Initial Balance: {initial_balance} BTC")
        print(f"   Initial Cashed Out: {initial_cashed_out} BTC")
        
        # Test multiple withdrawal attempts
        test_amounts = [0.001, 0.002, 0.003]  # Small amounts
        test_address = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
        
        successful_withdrawals = 0
        total_withdrawn = 0.0
        
        for i, amount in enumerate(test_amounts):
            print(f"   Attempting withdrawal {i+1}: {amount} BTC")
            
            withdrawal_data = {
                "address": test_address,
                "amount": amount,
                "network": "bitcoin"
            }
            
            response = requests.post(f"{API_BASE}/withdraw/bitcoin", json=withdrawal_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                successful_withdrawals += 1
                total_withdrawn += amount
                results.success(f"Multiple Withdrawals (Attempt {i+1})")
                print(f"   ✅ Withdrawal {i+1} successful: {amount} BTC")
            elif response.status_code == 400 and "Insufficient balance" in response.text:
                results.success(f"Multiple Withdrawals (Insufficient Balance {i+1})")
                print(f"   ⚠️  Withdrawal {i+1} failed: Insufficient balance (expected)")
                break  # Stop trying if we run out of balance
            else:
                results.failure(f"Multiple Withdrawals (Attempt {i+1})", f"HTTP {response.status_code}: {response.text}")
                print(f"   ❌ Withdrawal {i+1} failed unexpectedly")
        
        # Check final state
        final_user_response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
        if final_user_response.status_code == 200:
            final_data = final_user_response.json()
            final_balance = final_data.get("bitcoin_balance", 0)
            final_cashed_out = final_data.get("total_cashed_out", 0)
            
            expected_balance = initial_balance - total_withdrawn
            expected_cashed_out = initial_cashed_out + total_withdrawn
            
            print(f"   Final Balance: {final_balance} BTC (expected: {expected_balance})")
            print(f"   Final Cashed Out: {final_cashed_out} BTC (expected: {expected_cashed_out})")
            
            # Check balance accuracy
            if abs(final_balance - expected_balance) < 0.00000001:
                results.success("Multiple Withdrawals (Final Balance)")
            else:
                results.failure("Multiple Withdrawals (Final Balance)", f"Expected {expected_balance}, got {final_balance}")
            
            # Check total_cashed_out accumulation
            if abs(final_cashed_out - expected_cashed_out) < 0.00000001:
                results.success("Multiple Withdrawals (total_cashed_out Accumulation)")
                print(f"   ✅ total_cashed_out correctly accumulated: {initial_cashed_out} → {final_cashed_out}")
            else:
                results.failure("Multiple Withdrawals (total_cashed_out Accumulation)", f"Expected {expected_cashed_out}, got {final_cashed_out}")
        else:
            results.failure("Multiple Withdrawals (Final Check)", "Could not get final user state")
        
        return True
        
    except Exception as e:
        results.failure("Multiple Withdrawals", str(e))
        return False

def test_enhanced_miners_auto_activation():
    """Test enhanced miners management with auto-activation"""
    try:
        if not auth_tokens:
            results.failure("Auto-Activation", "No auth tokens available")
            return False
            
        headers = {"Authorization": f"Bearer {auth_tokens[0]}"}
        
        # Get available miners from store
        response = requests.get(f"{API_BASE}/store/miners", timeout=10)
        if response.status_code != 200:
            results.failure("Auto-Activation (Get Store)", "Could not get store miners")
            return False
            
        miners = response.json()["miners"]
        test_miner = miners[0]  # Use cheapest miner for testing
        
        # Test 1: Purchase with auto-activation enabled
        purchase_data = {
            "name": f"{test_miner['name']} (Auto)",
            "hash_rate": test_miner["hash_rate"],
            "price": test_miner["price"],
            "duration_days": test_miner["duration_days"],
            "payment_method": "credit_card",
            "auto_activate": True  # Key feature to test
        }
        
        response = requests.post(f"{API_BASE}/store/purchase", json=purchase_data, headers=headers, timeout=10)
        
        if response.status_code != 200:
            results.failure("Auto-Activation Purchase", f"HTTP {response.status_code}: {response.text}")
            return False
            
        result = response.json()
        miner_id = result.get("miner_id")
        
        if not miner_id:
            results.failure("Auto-Activation Purchase", "No miner_id returned")
            return False
        
        # Verify the miner was auto-activated
        miners_response = requests.get(f"{API_BASE}/miners/list", headers=headers, timeout=10)
        if miners_response.status_code != 200:
            results.failure("Auto-Activation Verification", "Could not get miners list")
            return False
            
        miners_data = miners_response.json()
        purchased_miner = None
        
        for miner in miners_data.get("miners", []):
            if miner["id"] == miner_id:
                purchased_miner = miner
                break
        
        if not purchased_miner:
            results.failure("Auto-Activation Verification", "Purchased miner not found")
            return False
            
        if purchased_miner["status"] == "active":
            results.success("Auto-Activation Purchase (Enabled)")
        else:
            results.failure("Auto-Activation Purchase (Enabled)", f"Miner not activated. Status: {purchased_miner['status']}")
        
        # Test 2: Purchase without auto-activation
        purchase_data = {
            "name": f"{test_miner['name']} (Manual)",
            "hash_rate": test_miner["hash_rate"],
            "price": test_miner["price"],
            "duration_days": test_miner["duration_days"],
            "payment_method": "credit_card",
            "auto_activate": False  # Should remain inactive
        }
        
        response = requests.post(f"{API_BASE}/store/purchase", json=purchase_data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            miner_id = result.get("miner_id")
            
            if miner_id:
                # Verify the miner remained inactive
                miners_response = requests.get(f"{API_BASE}/miners/list", headers=headers, timeout=10)
                if miners_response.status_code == 200:
                    miners_data = miners_response.json()
                    purchased_miner = None
                    
                    for miner in miners_data.get("miners", []):
                        if miner["id"] == miner_id:
                            purchased_miner = miner
                            break
                    
                    if purchased_miner and purchased_miner["status"] == "inactive":
                        results.success("Auto-Activation Purchase (Disabled)")
                    else:
                        results.failure("Auto-Activation Purchase (Disabled)", f"Miner unexpectedly activated. Status: {purchased_miner.get('status', 'not found')}")
                else:
                    results.failure("Auto-Activation Purchase (Disabled)", "Could not verify miner status")
            else:
                results.failure("Auto-Activation Purchase (Disabled)", "No miner_id returned")
        else:
            results.failure("Auto-Activation Purchase (Disabled)", f"HTTP {response.status_code}: {response.text}")
        
        return True
        
    except Exception as e:
        results.failure("Auto-Activation", str(e))
        return False

def test_logout():
    """Test user logout"""
    try:
        if not auth_tokens:
            results.failure("Logout", "No auth tokens available")
            return False
            
        # Use the last token for logout test to avoid interfering with other tests
        logout_token = auth_tokens[-1] if len(auth_tokens) > 1 else auth_tokens[0]
        headers = {"Authorization": f"Bearer {logout_token}"}
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
    
    # NEW: Test forgot password system
    print("\n🔑 Testing Forgot Password System...")
    test_forgot_password_system()
    
    # Device management tests
    print("\n📱 Testing Device Management...")
    test_device_registration()
    
    # Wallet and balance tests
    print("\n💰 Testing Wallet System...")
    test_wallet_balance()
    
    # NEW: Test Bitcoin withdrawal system
    print("\n💸 Testing Bitcoin Withdrawal System...")
    test_bitcoin_withdrawal_system()
    
    # NEW: Test multiple withdrawals total_cashed_out accumulation
    print("\n💰 Testing Multiple Withdrawals (total_cashed_out Accumulation)...")
    test_multiple_withdrawals_total_cashed_out()
    
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
    
    # NEW: Test enhanced miners management with auto-activation
    print("\n🔧 Testing Enhanced Miners Management (Auto-Activation)...")
    test_enhanced_miners_auto_activation()
    
    # Referral system tests
    print("\n👥 Testing Referral System...")
    test_referral_stats()
    
    # NEW: Test enhanced contact support system
    print("\n📧 Testing Enhanced Contact Support System...")
    test_contact_support_system()
    
    # Logout tests
    print("\n🚪 Testing Logout...")
    test_logout()
    
    # Final summary
    results.summary()
    
    return results.failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)