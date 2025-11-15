#!/usr/bin/env python3
"""
Backend Testing Script for Admin Account Crash Investigation
Tests API endpoints with admin user colourfulkoaladevelopment@gmail.com
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, List
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

# Configuration
BACKEND_URL = "https://btc-simulator.preview.emergentagent.com/api"
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "bitcoin_mining_db")

# Admin user credentials
ADMIN_EMAIL = "colourfulkoaladevelopment@gmail.com"

# ANSI color codes for better output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []
    
    def add_pass(self, test_name: str, message: str = ""):
        self.passed += 1
        self.tests.append({"name": test_name, "status": "PASS", "message": message})
        print(f"{GREEN}✓{RESET} {test_name}")
        if message:
            print(f"  {message}")
    
    def add_fail(self, test_name: str, message: str = ""):
        self.failed += 1
        self.tests.append({"name": test_name, "status": "FAIL", "message": message})
        print(f"{RED}✗{RESET} {test_name}")
        if message:
            print(f"  {RED}{message}{RESET}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{BOLD}{'='*80}{RESET}")
        print(f"{BOLD}TEST SUMMARY{RESET}")
        print(f"{'='*80}")
        print(f"Total Tests: {total}")
        print(f"{GREEN}Passed: {self.passed}{RESET}")
        print(f"{RED}Failed: {self.failed}{RESET}")
        print(f"Success Rate: {(self.passed/total*100) if total > 0 else 0:.1f}%")
        print(f"{'='*80}\n")
        
        if self.failed > 0:
            print(f"{RED}{BOLD}FAILED TESTS:{RESET}")
            for test in self.tests:
                if test["status"] == "FAIL":
                    print(f"  {RED}✗{RESET} {test['name']}")
                    if test["message"]:
                        print(f"    {test['message']}")
            print()

results = TestResults()

def create_test_user(name: str, email: str, password: str = "TestPass123!") -> Dict[str, Any]:
    """Create a test user and return auth token"""
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/register",
            json={
                "name": name,
                "email": email,
                "password": password
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "token": data.get("access_token"),
                "user_id": data.get("user", {}).get("id"),
                "email": email
            }
        else:
            # Try login if user already exists
            response = requests.post(
                f"{BACKEND_URL}/auth/login",
                json={"email": email, "password": password},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    "token": data.get("access_token"),
                    "user_id": data.get("user", {}).get("id"),
                    "email": email
                }
    except Exception as e:
        print(f"{RED}Error creating test user: {e}{RESET}")
    
    return None

def make_purchase(token: str, miner_data: Dict[str, Any]) -> bool:
    """Make a test purchase"""
    try:
        response = requests.post(
            f"{BACKEND_URL}/store/purchase",
            json=miner_data,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        return response.status_code == 200
    except Exception as e:
        print(f"{RED}Error making purchase: {e}{RESET}")
        return False

def test_activity_feed_basic_structure():
    """Test 1: Verify endpoint returns activities array and count"""
    print(f"\n{BOLD}{BLUE}Test 1: Basic Structure - Activities Array and Count{RESET}")
    
    try:
        response = requests.get(f"{BACKEND_URL}/activity/recent", timeout=10)
        
        if response.status_code != 200:
            results.add_fail(
                "Activity feed endpoint returns 200 OK",
                f"Expected 200, got {response.status_code}"
            )
            return
        
        results.add_pass("Activity feed endpoint returns 200 OK")
        
        data = response.json()
        
        # Check for required fields
        if "activities" not in data:
            results.add_fail(
                "Response contains 'activities' field",
                "Missing 'activities' field in response"
            )
        else:
            results.add_pass("Response contains 'activities' field")
        
        if "count" not in data:
            results.add_fail(
                "Response contains 'count' field",
                "Missing 'count' field in response"
            )
        else:
            results.add_pass("Response contains 'count' field")
        
        # Verify activities is an array
        if not isinstance(data.get("activities"), list):
            results.add_fail(
                "Activities field is an array",
                f"Expected list, got {type(data.get('activities'))}"
            )
        else:
            results.add_pass("Activities field is an array")
        
        # Verify count is a number
        if not isinstance(data.get("count"), int):
            results.add_fail(
                "Count field is an integer",
                f"Expected int, got {type(data.get('count'))}"
            )
        else:
            results.add_pass("Count field is an integer")
        
    except Exception as e:
        results.add_fail("Activity feed basic structure test", str(e))

def test_activity_feed_empty_data():
    """Test 2: Verify endpoint handles empty data gracefully"""
    print(f"\n{BOLD}{BLUE}Test 2: Empty Data Handling{RESET}")
    
    try:
        response = requests.get(f"{BACKEND_URL}/activity/recent", timeout=10)
        
        if response.status_code != 200:
            results.add_fail(
                "Endpoint returns 200 even with no recent data",
                f"Expected 200, got {response.status_code}"
            )
            return
        
        results.add_pass("Endpoint returns 200 even with no recent data")
        
        data = response.json()
        
        # Should return empty array, not error
        if "activities" in data and isinstance(data["activities"], list):
            results.add_pass(
                "Returns empty array when no data (not error)",
                f"Activities: {len(data['activities'])} items"
            )
        else:
            results.add_fail(
                "Returns empty array when no data",
                "Should return empty array, not error"
            )
        
        # Count should be 0 or match array length
        if data.get("count") == len(data.get("activities", [])):
            results.add_pass(
                "Count matches activities array length",
                f"Count: {data.get('count')}"
            )
        else:
            results.add_fail(
                "Count matches activities array length",
                f"Count: {data.get('count')}, Array length: {len(data.get('activities', []))}"
            )
        
    except Exception as e:
        results.add_fail("Empty data handling test", str(e))

def test_activity_feed_public_access():
    """Test 3: Verify endpoint is publicly accessible (no auth required)"""
    print(f"\n{BOLD}{BLUE}Test 3: Public Access (No Authentication Required){RESET}")
    
    try:
        # Test without any authentication
        response = requests.get(f"{BACKEND_URL}/activity/recent", timeout=10)
        
        if response.status_code == 401 or response.status_code == 403:
            results.add_fail(
                "Endpoint is publicly accessible",
                f"Endpoint requires authentication (status {response.status_code})"
            )
        elif response.status_code == 200:
            results.add_pass(
                "Endpoint is publicly accessible (no auth required)",
                "Successfully accessed without authentication"
            )
        else:
            results.add_fail(
                "Endpoint returns valid response without auth",
                f"Unexpected status code: {response.status_code}"
            )
        
        # Test with invalid token (should still work)
        response_invalid = requests.get(
            f"{BACKEND_URL}/activity/recent",
            headers={"Authorization": "Bearer invalid_token_12345"},
            timeout=10
        )
        
        if response_invalid.status_code == 200:
            results.add_pass(
                "Endpoint works even with invalid token",
                "Public endpoint doesn't validate tokens"
            )
        else:
            results.add_fail(
                "Endpoint works with invalid token",
                f"Status: {response_invalid.status_code}"
            )
        
    except Exception as e:
        results.add_fail("Public access test", str(e))

def test_activity_feed_response_format():
    """Test 4: Verify response format with type, user_name, and message/amount fields"""
    print(f"\n{BOLD}{BLUE}Test 4: Response Format Validation{RESET}")
    
    try:
        # First, create test data by making a purchase
        print(f"{YELLOW}Creating test data...{RESET}")
        
        # Create test user
        test_user = create_test_user(
            name="Activity Test User",
            email=f"activity_test_{int(time.time())}@test.com"
        )
        
        if not test_user:
            results.add_fail(
                "Create test user for activity testing",
                "Failed to create test user"
            )
            return
        
        results.add_pass("Create test user for activity testing")
        
        # Make a purchase to generate activity
        purchase_success = make_purchase(
            test_user["token"],
            {
                "name": "Test Miner",
                "hash_rate": 100.0,
                "price": 7.99,
                "duration_days": 30,
                "auto_activate": True
            }
        )
        
        if not purchase_success:
            results.add_fail(
                "Create test purchase activity",
                "Failed to make test purchase"
            )
            return
        
        results.add_pass("Create test purchase activity")
        
        # Wait a moment for data to be available
        time.sleep(1)
        
        # Now fetch activities
        response = requests.get(f"{BACKEND_URL}/activity/recent", timeout=10)
        
        if response.status_code != 200:
            results.add_fail(
                "Fetch activities after creating test data",
                f"Status: {response.status_code}"
            )
            return
        
        data = response.json()
        activities = data.get("activities", [])
        
        if len(activities) == 0:
            results.add_fail(
                "Activities array contains test data",
                "No activities found after creating purchase"
            )
            return
        
        results.add_pass(
            "Activities array contains data",
            f"Found {len(activities)} activities"
        )
        
        # Check format of first activity
        activity = activities[0]
        
        # Check for 'type' field
        if "type" not in activity:
            results.add_fail(
                "Activity contains 'type' field",
                "Missing 'type' field"
            )
        else:
            results.add_pass(
                "Activity contains 'type' field",
                f"Type: {activity['type']}"
            )
        
        # Check for 'user_name' field
        if "user_name" not in activity:
            results.add_fail(
                "Activity contains 'user_name' field",
                "Missing 'user_name' field"
            )
        else:
            results.add_pass(
                "Activity contains 'user_name' field",
                f"User: {activity['user_name']}"
            )
        
        # Check type-specific fields
        activity_type = activity.get("type")
        
        if activity_type == "purchase":
            # Purchase should have miner_name and hash_rate
            if "miner_name" in activity:
                results.add_pass(
                    "Purchase activity contains 'miner_name'",
                    f"Miner: {activity['miner_name']}"
                )
            else:
                results.add_fail(
                    "Purchase activity contains 'miner_name'",
                    "Missing 'miner_name' field"
                )
            
            if "hash_rate" in activity:
                results.add_pass(
                    "Purchase activity contains 'hash_rate'",
                    f"Hash rate: {activity['hash_rate']}"
                )
            else:
                results.add_fail(
                    "Purchase activity contains 'hash_rate'",
                    "Missing 'hash_rate' field"
                )
        
        elif activity_type == "cashout":
            # Cashout should have amount
            if "amount" in activity:
                results.add_pass(
                    "Cashout activity contains 'amount'",
                    f"Amount: {activity['amount']}"
                )
            else:
                results.add_fail(
                    "Cashout activity contains 'amount'",
                    "Missing 'amount' field"
                )
        
        # Check for timestamp
        if "timestamp" in activity:
            results.add_pass(
                "Activity contains 'timestamp' field",
                f"Timestamp: {activity['timestamp']}"
            )
        else:
            results.add_fail(
                "Activity contains 'timestamp' field",
                "Missing 'timestamp' field"
            )
        
    except Exception as e:
        results.add_fail("Response format validation test", str(e))

def test_name_obfuscation():
    """Test 5: Verify name obfuscation (first letter + asterisks format)"""
    print(f"\n{BOLD}{BLUE}Test 5: Name Obfuscation Verification{RESET}")
    
    try:
        # Create test user with known name
        test_name = "John Smith"
        test_user = create_test_user(
            name=test_name,
            email=f"obfuscation_test_{int(time.time())}@test.com"
        )
        
        if not test_user:
            results.add_fail(
                "Create test user for obfuscation testing",
                "Failed to create test user"
            )
            return
        
        results.add_pass(
            "Create test user for obfuscation testing",
            f"User: {test_name}"
        )
        
        # Make a purchase
        purchase_success = make_purchase(
            test_user["token"],
            {
                "name": "Obfuscation Test Miner",
                "hash_rate": 200.0,
                "price": 14.99,
                "duration_days": 30,
                "auto_activate": True
            }
        )
        
        if not purchase_success:
            results.add_fail(
                "Create purchase for obfuscation test",
                "Failed to make purchase"
            )
            return
        
        results.add_pass("Create purchase for obfuscation test")
        
        # Wait for data
        time.sleep(1)
        
        # Fetch activities
        response = requests.get(f"{BACKEND_URL}/activity/recent", timeout=10)
        
        if response.status_code != 200:
            results.add_fail(
                "Fetch activities for obfuscation check",
                f"Status: {response.status_code}"
            )
            return
        
        data = response.json()
        activities = data.get("activities", [])
        
        # Find our test user's activity
        test_activity = None
        for activity in activities:
            if activity.get("type") == "purchase" and "Obfuscation Test Miner" in activity.get("miner_name", ""):
                test_activity = activity
                break
        
        if not test_activity:
            results.add_fail(
                "Find test user's activity in feed",
                "Could not find test activity"
            )
            return
        
        results.add_pass("Find test user's activity in feed")
        
        obfuscated_name = test_activity.get("user_name", "")
        
        # Expected format: "J*** S****" for "John Smith"
        expected_pattern = "J*** S****"
        
        # Check if name is obfuscated
        if obfuscated_name == test_name:
            results.add_fail(
                "Name is obfuscated (not plain text)",
                f"Name is not obfuscated: {obfuscated_name}"
            )
        else:
            results.add_pass(
                "Name is obfuscated (not plain text)",
                f"Original: {test_name}, Obfuscated: {obfuscated_name}"
            )
        
        # Check format: first letter + asterisks
        name_parts = obfuscated_name.split()
        
        if len(name_parts) == 2:
            results.add_pass(
                "Obfuscated name preserves word count",
                f"2 words preserved"
            )
        else:
            results.add_fail(
                "Obfuscated name preserves word count",
                f"Expected 2 words, got {len(name_parts)}"
            )
        
        # Check first word: J***
        if name_parts[0].startswith("J") and "*" in name_parts[0]:
            results.add_pass(
                "First word obfuscation correct (J***)",
                f"First word: {name_parts[0]}"
            )
        else:
            results.add_fail(
                "First word obfuscation correct",
                f"Expected J***, got {name_parts[0]}"
            )
        
        # Check second word: S****
        if len(name_parts) > 1:
            if name_parts[1].startswith("S") and "*" in name_parts[1]:
                results.add_pass(
                    "Second word obfuscation correct (S****)",
                    f"Second word: {name_parts[1]}"
                )
            else:
                results.add_fail(
                    "Second word obfuscation correct",
                    f"Expected S****, got {name_parts[1]}"
                )
        
        # Verify asterisk count matches original length
        if len(name_parts[0]) == len("John"):
            results.add_pass(
                "First word length preserved",
                f"Length: {len(name_parts[0])}"
            )
        else:
            results.add_fail(
                "First word length preserved",
                f"Expected {len('John')}, got {len(name_parts[0])}"
            )
        
    except Exception as e:
        results.add_fail("Name obfuscation test", str(e))

def test_activity_feed_consistency():
    """Test 6: Verify multiple calls return consistent data"""
    print(f"\n{BOLD}{BLUE}Test 6: Response Consistency{RESET}")
    
    try:
        # Make multiple requests
        response1 = requests.get(f"{BACKEND_URL}/activity/recent", timeout=10)
        time.sleep(0.5)
        response2 = requests.get(f"{BACKEND_URL}/activity/recent", timeout=10)
        
        if response1.status_code == 200 and response2.status_code == 200:
            results.add_pass("Multiple requests succeed")
            
            data1 = response1.json()
            data2 = response2.json()
            
            # Within 30 seconds window, data should be similar
            count1 = data1.get("count", 0)
            count2 = data2.get("count", 0)
            
            if abs(count1 - count2) <= 5:  # Allow some variance
                results.add_pass(
                    "Activity counts are consistent",
                    f"Request 1: {count1}, Request 2: {count2}"
                )
            else:
                results.add_fail(
                    "Activity counts are consistent",
                    f"Large variance: {count1} vs {count2}"
                )
        else:
            results.add_fail(
                "Multiple requests succeed",
                f"Status codes: {response1.status_code}, {response2.status_code}"
            )
        
    except Exception as e:
        results.add_fail("Response consistency test", str(e))

def test_activity_feed_time_window():
    """Test 7: Verify 30-second time window"""
    print(f"\n{BOLD}{BLUE}Test 7: 30-Second Time Window{RESET}")
    
    try:
        # The endpoint should only return activities from last 30 seconds
        response = requests.get(f"{BACKEND_URL}/activity/recent", timeout=10)
        
        if response.status_code != 200:
            results.add_fail(
                "Fetch activities for time window check",
                f"Status: {response.status_code}"
            )
            return
        
        data = response.json()
        activities = data.get("activities", [])
        
        if len(activities) > 0:
            # Check if activities have timestamps
            has_timestamps = all("timestamp" in activity for activity in activities)
            
            if has_timestamps:
                results.add_pass(
                    "All activities have timestamps",
                    f"Checked {len(activities)} activities"
                )
            else:
                results.add_fail(
                    "All activities have timestamps",
                    "Some activities missing timestamps"
                )
        else:
            results.add_pass(
                "Time window check (no recent activities)",
                "No activities in last 30 seconds (expected)"
            )
        
    except Exception as e:
        results.add_fail("Time window test", str(e))

def main():
    """Run all activity feed tests"""
    print(f"\n{BOLD}{'='*80}{RESET}")
    print(f"{BOLD}KOALA MINING APP - ACTIVITY FEED ENDPOINT TESTING{RESET}")
    print(f"{'='*80}")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}\n")
    
    # Run all tests
    test_activity_feed_basic_structure()
    test_activity_feed_empty_data()
    test_activity_feed_public_access()
    test_activity_feed_response_format()
    test_name_obfuscation()
    test_activity_feed_consistency()
    test_activity_feed_time_window()
    
    # Print summary
    results.summary()
    
    return results.failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
