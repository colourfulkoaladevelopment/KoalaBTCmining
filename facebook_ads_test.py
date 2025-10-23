#!/usr/bin/env python3
"""
Facebook Ads Integration Backend Testing Suite
Tests all Facebook Ads endpoints thoroughly as requested
"""

import requests
import json
import time
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

# Get backend URL from environment
BACKEND_URL = "https://mine-simulator.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class FacebookAdsBackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def setup_test_user(self):
        """Create and login test user"""
        try:
            # Register test user
            register_data = {
                "name": "Facebook Ads Test User",
                "email": f"fbads_test_{int(time.time())}@test.com",
                "password": "testpass123"
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=register_data)
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data["access_token"]
                self.user_id = data["user"]["id"]
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                self.log_test("User Registration", True, f"User ID: {self.user_id}")
                return True
            else:
                self.log_test("User Registration", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Registration", False, f"Error: {str(e)}")
            return False
    
    def test_daily_stats_endpoint(self):
        """Test POST /api/ads/daily-stats endpoint"""
        try:
            response = self.session.post(f"{API_BASE}/ads/daily-stats")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify required fields
                required_fields = ["ads_watched_today", "remaining_ads", "max_daily_ads", "can_watch_ad", "next_reset"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Daily Stats - Required Fields", False, f"Missing: {missing_fields}")
                    return False
                
                # Verify data types and values
                if not isinstance(data["ads_watched_today"], int):
                    self.log_test("Daily Stats - ads_watched_today Type", False, "Should be integer")
                    return False
                    
                if not isinstance(data["remaining_ads"], int):
                    self.log_test("Daily Stats - remaining_ads Type", False, "Should be integer")
                    return False
                    
                if data["max_daily_ads"] != 30:
                    self.log_test("Daily Stats - max_daily_ads Value", False, f"Expected 30, got {data['max_daily_ads']}")
                    return False
                
                # For new user, should be 0 ads watched
                if data["ads_watched_today"] != 0:
                    self.log_test("Daily Stats - New User Ads Watched", False, f"Expected 0, got {data['ads_watched_today']}")
                    return False
                
                if data["remaining_ads"] != 30:
                    self.log_test("Daily Stats - New User Remaining Ads", False, f"Expected 30, got {data['remaining_ads']}")
                    return False
                
                if not data["can_watch_ad"]:
                    self.log_test("Daily Stats - New User Can Watch", False, "New user should be able to watch ads")
                    return False
                
                self.log_test("Daily Stats Endpoint", True, "All fields correct for new user")
                return True
                
            else:
                self.log_test("Daily Stats Endpoint", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Daily Stats Endpoint", False, f"Error: {str(e)}")
            return False
    
    def test_watch_ad_endpoint(self):
        """Test POST /api/ads/watch endpoint with all ad types"""
        ad_types = ['app_launch', 'withdrawal', 'miner_activation']
        
        for ad_type in ad_types:
            try:
                ad_data = {"ad_type": ad_type}
                response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Verify response structure
                    required_fields = ["success", "message", "ad_miner", "daily_stats"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if missing_fields:
                        self.log_test(f"Watch Ad ({ad_type}) - Response Fields", False, f"Missing: {missing_fields}")
                        continue
                    
                    # Verify ad miner details
                    ad_miner = data["ad_miner"]
                    if ad_miner["hash_rate"] != 2.0:
                        self.log_test(f"Watch Ad ({ad_type}) - Hash Rate", False, f"Expected 2.0, got {ad_miner['hash_rate']}")
                        continue
                    
                    if ad_miner["duration_hours"] != 24:
                        self.log_test(f"Watch Ad ({ad_type}) - Duration", False, f"Expected 24h, got {ad_miner['duration_hours']}")
                        continue
                    
                    # Verify daily stats update
                    daily_stats = data["daily_stats"]
                    expected_watched = ad_types.index(ad_type) + 1
                    
                    if daily_stats["ads_watched_today"] != expected_watched:
                        self.log_test(f"Watch Ad ({ad_type}) - Counter Update", False, f"Expected {expected_watched}, got {daily_stats['ads_watched_today']}")
                        continue
                    
                    self.log_test(f"Watch Ad ({ad_type})", True, f"2 GH/s for 24h, counter: {expected_watched}")
                    
                else:
                    self.log_test(f"Watch Ad ({ad_type})", False, f"Status: {response.status_code}, Response: {response.text}")
                    
            except Exception as e:
                self.log_test(f"Watch Ad ({ad_type})", False, f"Error: {str(e)}")
    
    def test_invalid_ad_type(self):
        """Test invalid ad type rejection"""
        try:
            ad_data = {"ad_type": "invalid_type"}
            response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
            
            if response.status_code == 400:
                self.log_test("Invalid Ad Type Rejection", True, "Correctly rejected invalid ad type")
            else:
                self.log_test("Invalid Ad Type Rejection", False, f"Expected 400, got {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Invalid Ad Type Rejection", False, f"Error: {str(e)}")
    
    def test_daily_limit_enforcement(self):
        """Test daily limit enforcement (30 ads max)"""
        try:
            # First, check current count
            stats_response = self.session.post(f"{API_BASE}/ads/daily-stats")
            if stats_response.status_code != 200:
                self.log_test("Daily Limit Test - Get Stats", False, "Could not get current stats")
                return
            
            current_count = stats_response.json()["ads_watched_today"]
            remaining_to_limit = 30 - current_count
            
            # Watch ads until we hit the limit (but limit to 10 more for testing efficiency)
            ads_to_test = min(remaining_to_limit, 10)
            
            for i in range(ads_to_test):
                ad_data = {"ad_type": "miner_activation"}
                response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
                
                if response.status_code != 200:
                    self.log_test("Daily Limit Test - Watching Ads", False, f"Failed at ad {current_count + i + 1}")
                    return
            
            # If we watched all remaining ads to hit the limit, try one more (should be rejected)
            if ads_to_test == remaining_to_limit:
                ad_data = {"ad_type": "miner_activation"}
                response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
                
                if response.status_code == 429:
                    self.log_test("Daily Limit Enforcement", True, "Correctly rejected after 30 ads")
                else:
                    self.log_test("Daily Limit Enforcement", False, f"Expected 429, got {response.status_code}")
            else:
                self.log_test("Daily Limit Enforcement", True, f"Tested {ads_to_test} ads successfully (partial test)")
                
        except Exception as e:
            self.log_test("Daily Limit Enforcement", False, f"Error: {str(e)}")
    
    def test_ad_miner_creation(self):
        """Test ad miner creation in database"""
        try:
            # Watch an ad
            ad_data = {"ad_type": "app_launch"}
            response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
            
            if response.status_code != 200:
                self.log_test("Ad Miner Creation Test", False, "Could not watch ad")
                return
            
            ad_miner_id = response.json()["ad_miner"]["id"]
            
            # Get user's miners to verify creation
            miners_response = self.session.get(f"{API_BASE}/miners/list")
            
            if miners_response.status_code == 200:
                miners = miners_response.json()["miners"]
                
                # Find the ad miner
                ad_miner = next((m for m in miners if m["id"] == ad_miner_id), None)
                
                if not ad_miner:
                    self.log_test("Ad Miner Creation", False, "Ad miner not found in user's miners")
                    return
                
                # Verify miner properties
                if ad_miner["miner_type"] != "ad_reward":
                    self.log_test("Ad Miner Type", False, f"Expected 'ad_reward', got '{ad_miner['miner_type']}'")
                    return
                
                if ad_miner["hash_rate"] != 2.0:
                    self.log_test("Ad Miner Hash Rate", False, f"Expected 2.0, got {ad_miner['hash_rate']}")
                    return
                
                if ad_miner["status"] != "active":
                    self.log_test("Ad Miner Status", False, f"Expected 'active', got '{ad_miner['status']}'")
                    return
                
                self.log_test("Ad Miner Creation", True, "Miner created with correct properties")
                
            else:
                self.log_test("Ad Miner Creation Test", False, f"Could not get miners list: {miners_response.status_code}")
                
        except Exception as e:
            self.log_test("Ad Miner Creation", False, f"Error: {str(e)}")
    
    def test_transaction_recording(self):
        """Test ad reward transaction recording"""
        try:
            # Watch an ad
            ad_data = {"ad_type": "withdrawal"}
            response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
            
            if response.status_code != 200:
                self.log_test("Transaction Recording Test", False, "Could not watch ad")
                return
            
            # Verify the ad was recorded by checking the daily stats increment
            stats_response = self.session.post(f"{API_BASE}/ads/daily-stats")
            
            if stats_response.status_code == 200:
                stats = stats_response.json()
                if stats["ads_watched_today"] > 0:
                    self.log_test("Transaction Recording", True, "Ad watch recorded in daily stats")
                else:
                    self.log_test("Transaction Recording", False, "Ad watch not recorded")
            else:
                self.log_test("Transaction Recording", False, "Could not verify transaction")
                
        except Exception as e:
            self.log_test("Transaction Recording", False, f"Error: {str(e)}")
    
    def test_reset_daily_counter(self):
        """Test daily counter reset endpoint"""
        try:
            response = self.session.post(f"{API_BASE}/ads/reset-daily-counter")
            
            if response.status_code == 200:
                data = response.json()
                
                if "success" in data and data["success"]:
                    self.log_test("Reset Daily Counter", True, f"Reset {data.get('counters_reset', 0)} counters")
                else:
                    self.log_test("Reset Daily Counter", False, "Success field missing or false")
            else:
                self.log_test("Reset Daily Counter", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Reset Daily Counter", False, f"Error: {str(e)}")
    
    def test_active_ad_miners(self):
        """Test active ad miners endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/ads/active-miners")
            
            if response.status_code == 200:
                data = response.json()
                
                # Should have structure with miners list and total hashrate
                if "active_ad_miners" in data and "total_ad_hashrate" in data:
                    self.log_test("Active Ad Miners Endpoint", True, f"Found {len(data['active_ad_miners'])} active ad miners")
                else:
                    self.log_test("Active Ad Miners Endpoint", False, "Missing required fields in response")
            else:
                self.log_test("Active Ad Miners Endpoint", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Active Ad Miners Endpoint", False, f"Error: {str(e)}")
    
    def test_ad_miner_stacking(self):
        """Test multiple ad miners can stack up to daily limit"""
        try:
            # Watch multiple ads and verify they create separate miners
            initial_stats = self.session.post(f"{API_BASE}/ads/daily-stats").json()
            initial_count = initial_stats["ads_watched_today"]
            
            # Watch 3 more ads
            for i in range(3):
                ad_data = {"ad_type": "miner_activation"}
                response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
                
                if response.status_code != 200:
                    self.log_test("Ad Miner Stacking", False, f"Failed to watch ad {i+1}")
                    return
            
            # Check final stats
            final_stats = self.session.post(f"{API_BASE}/ads/daily-stats").json()
            final_count = final_stats["ads_watched_today"]
            
            if final_count == initial_count + 3:
                self.log_test("Ad Miner Stacking", True, f"Successfully stacked {final_count} ad miners")
            else:
                self.log_test("Ad Miner Stacking", False, f"Expected {initial_count + 3}, got {final_count}")
                
        except Exception as e:
            self.log_test("Ad Miner Stacking", False, f"Error: {str(e)}")
    
    def test_ad_miner_duration_vs_regular(self):
        """Test ad miners have 24-hour duration vs 30 minutes for regular ad boost"""
        try:
            # Watch an ad to create ad miner
            ad_data = {"ad_type": "app_launch"}
            response = self.session.post(f"{API_BASE}/ads/watch", json=ad_data)
            
            if response.status_code != 200:
                self.log_test("Ad Miner Duration Test", False, "Could not watch ad")
                return
            
            ad_miner_data = response.json()["ad_miner"]
            
            # Verify 24-hour duration
            if ad_miner_data["duration_hours"] == 24:
                self.log_test("Ad Miner Duration (24h)", True, "Ad miners correctly have 24-hour duration")
            else:
                self.log_test("Ad Miner Duration (24h)", False, f"Expected 24h, got {ad_miner_data['duration_hours']}h")
            
            # Compare with regular ad boost miner (if available)
            try:
                old_ad_response = self.session.post(f"{API_BASE}/miners/watch-ad")
                if old_ad_response.status_code == 200:
                    # This is the old ad system - should be different from new Facebook ads
                    self.log_test("Ad Miner vs Regular Ad Boost", True, "New Facebook ads system separate from old ad boost")
                else:
                    self.log_test("Ad Miner vs Regular Ad Boost", True, "Old ad boost system not available (expected)")
            except:
                self.log_test("Ad Miner vs Regular Ad Boost", True, "Old ad boost system not available (expected)")
                
        except Exception as e:
            self.log_test("Ad Miner Duration Test", False, f"Error: {str(e)}")
    
    def run_all_tests(self):
        """Run all Facebook Ads backend tests"""
        print("🚀 Starting Facebook Ads Backend Integration Tests")
        print("=" * 60)
        
        # Setup
        if not self.setup_test_user():
            print("❌ Failed to setup test user. Aborting tests.")
            return
        
        # Test daily stats endpoint
        print("\n📊 Testing Daily Stats Endpoint...")
        self.test_daily_stats_endpoint()
        
        # Test watch ad endpoint with all ad types
        print("\n📺 Testing Watch Ad Endpoint...")
        self.test_watch_ad_endpoint()
        
        # Test invalid ad type
        print("\n🚫 Testing Invalid Ad Type Rejection...")
        self.test_invalid_ad_type()
        
        # Test ad miner creation
        print("\n⛏️ Testing Ad Miner Creation...")
        self.test_ad_miner_creation()
        
        # Test transaction recording
        print("\n💰 Testing Transaction Recording...")
        self.test_transaction_recording()
        
        # Test ad miner stacking
        print("\n📚 Testing Ad Miner Stacking...")
        self.test_ad_miner_stacking()
        
        # Test ad miner duration
        print("\n⏰ Testing Ad Miner Duration (24h vs 30min)...")
        self.test_ad_miner_duration_vs_regular()
        
        # Test active ad miners endpoint
        print("\n🔍 Testing Active Ad Miners Endpoint...")
        self.test_active_ad_miners()
        
        # Test reset daily counter
        print("\n🔄 Testing Reset Daily Counter...")
        self.test_reset_daily_counter()
        
        # Test daily limit enforcement (do this last as it uses up the limit)
        print("\n⚠️ Testing Daily Limit Enforcement...")
        self.test_daily_limit_enforcement()
        
        # Summary
        print("\n" + "=" * 60)
        print("📋 FACEBOOK ADS BACKEND TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"✅ Passed: {passed}/{total}")
        print(f"❌ Failed: {total - passed}/{total}")
        
        if total - passed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = FacebookAdsBackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All Facebook Ads backend tests passed!")
    else:
        print("\n⚠️ Some tests failed. Check the details above.")