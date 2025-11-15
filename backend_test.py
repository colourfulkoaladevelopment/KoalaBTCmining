#!/usr/bin/env python3
"""
Backend Testing Script for Admin Account Crash Investigation
Tests API endpoints with admin user colourfulkoaladevelopment@gmail.com
"""

import requests
import json
from pymongo import MongoClient
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

# Configuration
BACKEND_URL = "https://btc-simulator.preview.emergentagent.com/api"
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "bitcoin_mining_db")

# Admin user credentials
ADMIN_EMAIL = "colourfulkoaladevelopment@gmail.com"

# Test results
test_results = {
    "total_tests": 0,
    "passed": 0,
    "failed": 0,
    "errors": []
}

def log_test(test_name, passed, message=""):
    """Log test result"""
    test_results["total_tests"] += 1
    if passed:
        test_results["passed"] += 1
        print(f"✅ {test_name}: PASSED")
    else:
        test_results["failed"] += 1
        test_results["errors"].append(f"{test_name}: {message}")
        print(f"❌ {test_name}: FAILED - {message}")
    if message and passed:
        print(f"   ℹ️  {message}")

def print_section(title):
    """Print section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)

def print_json(data, indent=2):
    """Pretty print JSON data"""
    print(json.dumps(data, indent=indent, default=str))

def connect_to_mongodb():
    """Connect to MongoDB and return database"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        # Test connection
        client.server_info()
        log_test("MongoDB Connection", True, f"Connected to {MONGO_URL}")
        return db
    except Exception as e:
        log_test("MongoDB Connection", False, str(e))
        return None

def investigate_admin_user_in_db(db):
    """Query and analyze admin user record from MongoDB"""
    print_section("MONGODB INVESTIGATION: Admin User Record")
    
    try:
        users_collection = db.users
        admin_user = users_collection.find_one({"email": ADMIN_EMAIL})
        
        if not admin_user:
            log_test("Find Admin User in DB", False, f"User {ADMIN_EMAIL} not found in database")
            return None
        
        log_test("Find Admin User in DB", True, f"Found user with ID: {admin_user.get('_id')}")
        
        print("\n📋 ADMIN USER RECORD:")
        print_json(admin_user)
        
        # Check for required fields
        print("\n🔍 FIELD VALIDATION:")
        required_fields = [
            "email", "name", "referral_code", "bitcoin_balance", 
            "total_earnings", "total_referral_rewards", "total_cashed_out", "created_at"
        ]
        
        missing_fields = []
        null_fields = []
        
        for field in required_fields:
            if field not in admin_user:
                missing_fields.append(field)
                print(f"  ❌ Missing field: {field}")
            elif admin_user[field] is None:
                null_fields.append(field)
                print(f"  ⚠️  Null field: {field}")
            else:
                print(f"  ✅ {field}: {admin_user[field]} (type: {type(admin_user[field]).__name__})")
        
        if missing_fields:
            log_test("Required Fields Check", False, f"Missing fields: {', '.join(missing_fields)}")
        elif null_fields:
            log_test("Required Fields Check", False, f"Null fields: {', '.join(null_fields)}")
        else:
            log_test("Required Fields Check", True, "All required fields present and non-null")
        
        # Check miners for this user
        print("\n🔍 MINERS INVESTIGATION:")
        miners_collection = db.miners
        admin_miners = list(miners_collection.find({"user_id": admin_user.get("_id")}))
        
        print(f"  Total miners: {len(admin_miners)}")
        
        if admin_miners:
            print("\n  📋 MINERS LIST:")
            for i, miner in enumerate(admin_miners, 1):
                print(f"\n  Miner #{i}:")
                print_json(miner, indent=4)
                
                # Check for corrupted data in miners
                miner_issues = []
                if "hash_rate" in miner and not isinstance(miner["hash_rate"], (int, float)):
                    miner_issues.append(f"hash_rate has wrong type: {type(miner['hash_rate'])}")
                if "status" in miner and miner["status"] not in ["active", "inactive", "expired"]:
                    miner_issues.append(f"invalid status: {miner['status']}")
                if "time_remaining" in miner and not isinstance(miner["time_remaining"], (int, float)):
                    miner_issues.append(f"time_remaining has wrong type: {type(miner['time_remaining'])}")
                
                if miner_issues:
                    print(f"    ⚠️  Issues found: {', '.join(miner_issues)}")
        
        if admin_miners:
            log_test("Admin Miners Data", True, f"Found {len(admin_miners)} miners")
        else:
            log_test("Admin Miners Data", True, "No miners found (empty array)")
        
        return admin_user
        
    except Exception as e:
        log_test("MongoDB Investigation", False, str(e))
        return None

def compare_with_normal_user(db):
    """Compare admin user with a normal user"""
    print_section("COMPARISON: Admin vs Normal User")
    
    try:
        users_collection = db.users
        
        # Find a normal user (not admin)
        normal_user = users_collection.find_one({
            "email": {"$ne": ADMIN_EMAIL}
        })
        
        if not normal_user:
            log_test("Find Normal User", False, "No other users found for comparison")
            return
        
        log_test("Find Normal User", True, f"Found user: {normal_user.get('email')}")
        
        admin_user = users_collection.find_one({"email": ADMIN_EMAIL})
        
        print("\n📊 FIELD COMPARISON:")
        print(f"{'Field':<30} {'Admin':<30} {'Normal':<30}")
        print("-" * 90)
        
        all_fields = set(list(admin_user.keys()) + list(normal_user.keys()))
        
        differences = []
        for field in sorted(all_fields):
            admin_val = admin_user.get(field, "MISSING")
            normal_val = normal_user.get(field, "MISSING")
            
            admin_str = str(admin_val)[:28] if admin_val != "MISSING" else "MISSING"
            normal_str = str(normal_val)[:28] if normal_val != "MISSING" else "MISSING"
            
            marker = "⚠️ " if admin_val == "MISSING" or type(admin_val) != type(normal_val) else "  "
            print(f"{marker}{field:<28} {admin_str:<30} {normal_str:<30}")
            
            if admin_val == "MISSING":
                differences.append(f"{field} missing in admin")
            elif normal_val != "MISSING" and type(admin_val) != type(normal_val):
                differences.append(f"{field} type mismatch: admin={type(admin_val).__name__}, normal={type(normal_val).__name__}")
        
        if differences:
            log_test("User Structure Comparison", False, f"Differences found: {'; '.join(differences)}")
        else:
            log_test("User Structure Comparison", True, "Admin and normal user have same structure")
        
    except Exception as e:
        log_test("User Comparison", False, str(e))

def test_admin_login():
    """Test admin user login - but we don't have password, so we'll create a test token"""
    print_section("API TESTING: Admin User Endpoints")
    
    # We need to get the admin user's actual session token from database
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Find admin user
        admin_user = db.users.find_one({"email": ADMIN_EMAIL})
        if not admin_user:
            log_test("Get Admin User ID", False, "Admin user not found")
            return None
        
        user_id = admin_user["_id"]
        
        # Find an active session for this user
        session = db.user_sessions.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)]  # Get most recent session
        )
        
        if session:
            token = session["session_token"]
            log_test("Get Admin Session Token", True, f"Found existing session token")
            return token
        else:
            log_test("Get Admin Session Token", False, "No active session found. Admin needs to login first.")
            return None
            
    except Exception as e:
        log_test("Get Admin Session Token", False, str(e))
        return None

def test_api_endpoint(endpoint, token, test_name):
    """Test an API endpoint with admin token"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{BACKEND_URL}{endpoint}"
        
        print(f"\n🔍 Testing: {endpoint}")
        response = requests.get(url, headers=headers, timeout=10)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response:")
            print_json(data, indent=6)
            
            # Check for null/undefined values in response
            null_fields = []
            def check_nulls(obj, path=""):
                if isinstance(obj, dict):
                    for key, value in obj.items():
                        current_path = f"{path}.{key}" if path else key
                        if value is None:
                            null_fields.append(current_path)
                        elif isinstance(value, (dict, list)):
                            check_nulls(value, current_path)
                elif isinstance(obj, list):
                    for i, item in enumerate(obj):
                        check_nulls(item, f"{path}[{i}]")
            
            check_nulls(data)
            
            if null_fields:
                log_test(test_name, False, f"Response contains null fields: {', '.join(null_fields)}")
            else:
                log_test(test_name, True, "Response valid with no null fields")
            
            return data
        else:
            error_msg = response.text
            log_test(test_name, False, f"HTTP {response.status_code}: {error_msg}")
            return None
            
    except Exception as e:
        log_test(test_name, False, str(e))
        return None

def main():
    """Main test execution"""
    print("\n" + "="*80)
    print("  ADMIN ACCOUNT CRASH INVESTIGATION")
    print("  User: colourfulkoaladevelopment@gmail.com")
    print("="*80)
    
    # Step 1: Connect to MongoDB
    db = connect_to_mongodb()
    if not db:
        print("\n❌ Cannot proceed without database connection")
        return
    
    # Step 2: Investigate admin user in database
    admin_user = investigate_admin_user_in_db(db)
    
    # Step 3: Compare with normal user
    compare_with_normal_user(db)
    
    # Step 4: Test API endpoints with admin token
    token = test_admin_login()
    
    if token:
        print_section("API ENDPOINT TESTING")
        
        # Test all endpoints mentioned in review request
        test_api_endpoint("/auth/me", token, "GET /api/auth/me")
        test_api_endpoint("/miners/list", token, "GET /api/miners/list")
        test_api_endpoint("/wallet/balance", token, "GET /api/wallet/balance")
        test_api_endpoint("/wallet/status", token, "GET /api/wallet/status")
        test_api_endpoint("/referrals/stats", token, "GET /api/referrals/stats")
    else:
        print("\n⚠️  Cannot test API endpoints without valid session token")
        print("   Admin user needs to login first to create a session")
    
    # Print summary
    print_section("TEST SUMMARY")
    print(f"Total Tests: {test_results['total_tests']}")
    print(f"Passed: {test_results['passed']} ✅")
    print(f"Failed: {test_results['failed']} ❌")
    
    if test_results['errors']:
        print("\n❌ FAILED TESTS:")
        for error in test_results['errors']:
            print(f"  - {error}")
    
    print("\n" + "="*80)
    
    if test_results['failed'] == 0:
        print("✅ ALL TESTS PASSED - No issues found with admin account")
    else:
        print("⚠️  ISSUES DETECTED - See details above")
    
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
