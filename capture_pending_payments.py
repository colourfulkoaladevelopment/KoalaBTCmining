#!/usr/bin/env python3
"""
Manually capture pending PayPal payments
"""

import os
import sys
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime, timedelta
import uuid

# Load environment
load_dotenv("/app/backend/.env")

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "test_database")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# PayPal setup
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "")
PAYPAL_MODE = os.getenv("PAYPAL_MODE", "sandbox")

def capture_pending_payments():
    """Capture all pending PayPal payments"""
    
    print("🔍 Looking for pending PayPal payments...")
    
    # Find all orders with status 'created'
    pending_orders = list(db.paypal_orders.find({"status": "created"}))
    
    if not pending_orders:
        print("✅ No pending payments found!")
        return
    
    print(f"📋 Found {len(pending_orders)} pending payment(s)")
    
    try:
        from paypalcheckoutsdk.core import SandboxEnvironment, LiveEnvironment, PayPalHttpClient
        from paypalcheckoutsdk.orders import OrdersCaptureRequest
        
        # Setup PayPal client
        if PAYPAL_MODE == "live":
            environment = LiveEnvironment(client_id=PAYPAL_CLIENT_ID, client_secret=PAYPAL_CLIENT_SECRET)
        else:
            environment = SandboxEnvironment(client_id=PAYPAL_CLIENT_ID, client_secret=PAYPAL_CLIENT_SECRET)
        
        paypal_client = PayPalHttpClient(environment)
        
        for order in pending_orders:
            order_id = order["_id"]
            user_id = order["user_id"]
            miner_data = order["miner_data"]
            
            print(f"\n{'='*60}")
            print(f"📦 Processing Order: {order_id}")
            print(f"   User: {user_id}")
            print(f"   Miner: {miner_data['name']} ({miner_data['hash_rate']} GH/s)")
            print(f"   Price: ${order['final_price']}")
            
            try:
                # Attempt to capture the payment
                request = OrdersCaptureRequest(order_id)
                response = paypal_client.execute(request)
                
                if response.result.status == "COMPLETED":
                    print(f"✅ Payment captured successfully!")
                    
                    # Create and activate the miner
                    new_miner = {
                        "_id": str(uuid.uuid4()),
                        "user_id": user_id,
                        "name": miner_data["name"],
                        "hash_rate": miner_data["hash_rate"],
                        "miner_type": "premium",
                        "status": "active",
                        "duration_hours": miner_data["duration_days"] * 24,
                        "time_remaining": miner_data["duration_days"] * 24,
                        "total_earned": 0.0,
                        "purchase_price": order["final_price"],
                        "payment_method": "paypal",
                        "payment_id": response.result.id,
                        "activated_at": datetime.utcnow(),
                        "expires_at": datetime.utcnow() + timedelta(days=miner_data["duration_days"]),
                        "created_at": datetime.utcnow()
                    }
                    
                    db.miners.insert_one(new_miner)
                    print(f"⛏️  Miner activated: {new_miner['_id']}")
                    
                    # Update order status
                    db.paypal_orders.update_one(
                        {"_id": order_id},
                        {"$set": {
                            "status": "completed",
                            "captured_at": datetime.utcnow(),
                            "miner_id": new_miner["_id"],
                            "payment_details": response.result.dict(),
                            "manually_captured": True
                        }}
                    )
                    
                    # Record transaction
                    transaction_record = {
                        "_id": str(uuid.uuid4()),
                        "user_id": user_id,
                        "transaction_type": "miner_purchase",
                        "amount": order["final_price"],
                        "currency": "USD",
                        "payment_method": "paypal",
                        "payment_id": response.result.id,
                        "miner_id": new_miner["_id"],
                        "miner_name": miner_data["name"],
                        "description": f"Purchased {miner_data['name']} via PayPal (manually captured)",
                        "promo_code": order.get("promo_code"),
                        "discount_amount": order.get("discount_amount", 0),
                        "created_at": datetime.utcnow()
                    }
                    db.transactions.insert_one(transaction_record)
                    
                    print(f"💾 Transaction recorded: {transaction_record['_id']}")
                    print(f"✅ Order {order_id} completed successfully!")
                    
                else:
                    print(f"⚠️  Payment status: {response.result.status}")
                    print(f"   This order may need manual review")
                    
            except Exception as e:
                print(f"❌ Error capturing payment: {e}")
                print(f"   Order {order_id} may have already been captured or cancelled")
                
    except ImportError:
        print("❌ PayPal SDK not installed!")
        return
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        return
    
    print(f"\n{'='*60}")
    print("✅ Pending payment processing complete!")

if __name__ == "__main__":
    capture_pending_payments()
