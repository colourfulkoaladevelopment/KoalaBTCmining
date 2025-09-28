from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
from typing import List, Optional
import os
from dotenv import load_dotenv
import uuid

load_dotenv()

app = FastAPI(title="Bitcoin Mining Simulator API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
db = client.bitcoin_mining_db

# Collections
users_collection = db.users
miners_collection = db.miners
transactions_collection = db.transactions
mining_sessions_collection = db.mining_sessions

# Pydantic models
class User(BaseModel):
    id: Optional[str] = None
    username: str
    email: str
    bitcoin_balance: float = 0.0
    total_earnings: float = 0.0
    created_at: datetime = datetime.now()
    last_active: datetime = datetime.now()

class MinerConfig(BaseModel):
    id: Optional[str] = None
    user_id: str
    name: str
    hash_rate: float
    status: str = "inactive"  # active, inactive, deprecated
    time_remaining: float = 0.0
    total_earned: float = 0.0
    miner_type: str = "free"  # free, premium, ad
    purchase_price: float = 0.0
    created_at: datetime = datetime.now()
    expires_at: Optional[datetime] = None

class Transaction(BaseModel):
    id: Optional[str] = None
    user_id: str
    transaction_type: str  # purchase, earning, withdrawal
    amount: float
    description: str
    created_at: datetime = datetime.now()

class MiningSession(BaseModel):
    id: Optional[str] = None
    user_id: str
    miner_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    hash_rate: float
    bitcoins_mined: float = 0.0
    status: str = "active"  # active, completed, paused

# Helper functions
def get_current_user():
    # Simplified user system - in production, implement proper authentication
    user = users_collection.find_one({"username": "demo_user"})
    if not user:
        # Create demo user
        demo_user = {
            "username": "demo_user",
            "email": "demo@example.com",
            "bitcoin_balance": 0.00012845,
            "total_earnings": 0.0,
            "created_at": datetime.now(),
            "last_active": datetime.now()
        }
        users_collection.insert_one(demo_user)
        user = users_collection.find_one({"username": "demo_user"})
    
    user["id"] = str(user["_id"])
    return user

def calculate_mining_earnings(hash_rate: float, hours: float) -> float:
    # Simplified Bitcoin mining calculation
    # In reality, this depends on difficulty, block rewards, etc.
    btc_per_ghash_per_hour = 0.00000001  # Very simplified rate
    return hash_rate * hours * btc_per_ghash_per_hour

# API Routes

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "Bitcoin Mining API is running"}

@app.get("/api/user/profile")
async def get_user_profile():
    user = get_current_user()
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "bitcoin_balance": user["bitcoin_balance"],
        "total_earnings": user.get("total_earnings", 0.0),
        "created_at": user["created_at"],
        "last_active": user["last_active"]
    }

@app.get("/api/wallet/balance")
async def get_wallet_balance():
    user = get_current_user()
    
    # Calculate today's earnings
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_earnings = transactions_collection.aggregate([
        {
            "$match": {
                "user_id": user["id"],
                "transaction_type": "earning",
                "created_at": {"$gte": today_start}
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$amount"}
            }
        }
    ])
    
    today_total = 0.0
    for result in today_earnings:
        today_total = result["total"]
    
    # Count miners
    total_miners = miners_collection.count_documents({"user_id": user["id"]})
    active_miners = miners_collection.count_documents({
        "user_id": user["id"],
        "status": "active"
    })
    
    return {
        "total_balance": user["bitcoin_balance"],
        "today_earnings": today_total,
        "total_miners": total_miners,
        "active_miners": active_miners
    }

@app.get("/api/miners/list")
async def get_user_miners():
    user = get_current_user()
    miners = list(miners_collection.find({"user_id": user["id"]}))
    
    miners_list = []
    for miner in miners:
        miners_list.append({
            "id": str(miner["_id"]),
            "name": miner["name"],
            "hash_rate": miner["hash_rate"],
            "status": miner["status"],
            "time_remaining": miner["time_remaining"],
            "total_earned": miner["total_earned"],
            "miner_type": miner["miner_type"],
            "created_at": miner["created_at"]
        })
    
    return {"miners": miners_list}

@app.post("/api/miners/create")
async def create_miner(miner_data: dict):
    user = get_current_user()
    
    new_miner = {
        "user_id": user["id"],
        "name": miner_data["name"],
        "hash_rate": miner_data["hash_rate"],
        "status": "inactive",
        "time_remaining": miner_data.get("duration", 24.0),
        "total_earned": 0.0,
        "miner_type": miner_data.get("type", "free"),
        "purchase_price": miner_data.get("price", 0.0),
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(hours=miner_data.get("duration", 24.0))
    }
    
    result = miners_collection.insert_one(new_miner)
    new_miner["id"] = str(result.inserted_id)
    
    return {"message": "Miner created successfully", "miner": new_miner}

@app.post("/api/miners/{miner_id}/activate")
async def activate_miner(miner_id: str):
    user = get_current_user()
    
    # Update miner status
    result = miners_collection.update_one(
        {"_id": ObjectId(miner_id), "user_id": user["id"]},
        {"$set": {"status": "active"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Miner not found")
    
    # Start mining session
    miner = miners_collection.find_one({"_id": ObjectId(miner_id)})
    mining_session = {
        "user_id": user["id"],
        "miner_id": miner_id,
        "start_time": datetime.now(),
        "hash_rate": miner["hash_rate"],
        "bitcoins_mined": 0.0,
        "status": "active"
    }
    
    mining_sessions_collection.insert_one(mining_session)
    
    return {"message": "Miner activated successfully"}

@app.post("/api/miners/{miner_id}/deactivate")
async def deactivate_miner(miner_id: str):
    user = get_current_user()
    
    # Update miner status
    result = miners_collection.update_one(
        {"_id": ObjectId(miner_id), "user_id": user["id"]},
        {"$set": {"status": "inactive"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Miner not found")
    
    # End mining session
    mining_sessions_collection.update_many(
        {"miner_id": miner_id, "status": "active"},
        {"$set": {"status": "completed", "end_time": datetime.now()}}
    )
    
    return {"message": "Miner deactivated successfully"}

@app.post("/api/ad-rewards/activate")
async def activate_ad_reward(ad_data: dict):
    user = get_current_user()
    
    # Create or activate ad miner
    ad_miner = miners_collection.find_one({
        "user_id": user["id"],
        "miner_type": "ad",
        "name": "Ad Boost Miner"
    })
    
    if not ad_miner:
        # Create new ad miner
        new_ad_miner = {
            "user_id": user["id"],
            "name": "Ad Boost Miner",
            "hash_rate": 12.4,
            "status": "active",
            "time_remaining": 24.0,
            "total_earned": 0.0,
            "miner_type": "ad",
            "purchase_price": 0.0,
            "created_at": datetime.now(),
            "expires_at": datetime.now() + timedelta(hours=24)
        }
        miners_collection.insert_one(new_ad_miner)
    else:
        # Reactivate existing ad miner
        miners_collection.update_one(
            {"_id": ad_miner["_id"]},
            {
                "$set": {
                    "status": "active",
                    "time_remaining": 24.0,
                    "expires_at": datetime.now() + timedelta(hours=24)
                }
            }
        )
    
    return {"message": "Ad reward activated! Free mining for 24 hours."}

@app.get("/api/mining/stats")
async def get_mining_stats():
    user = get_current_user()
    
    # Get current hash rate from active miners
    active_miners = list(miners_collection.find({
        "user_id": user["id"],
        "status": "active"
    }))
    
    current_hash_rate = sum(miner["hash_rate"] for miner in active_miners)
    
    # Generate 24h earnings chart data (simplified)
    chart_data = []
    for hour in range(0, 25, 4):  # Every 4 hours
        base_earning = 0.00000012
        variation = (hour * 0.000000002) + (0.000000005 * (hour % 3))
        chart_data.append({
            "time": f"{hour:02d}:00",
            "value": base_earning + variation
        })
    
    return {
        "current_hash_rate": current_hash_rate,
        "mining_active": len(active_miners) > 0,
        "chart_data": chart_data
    }

@app.post("/api/transactions/record")
async def record_transaction(transaction_data: dict):
    user = get_current_user()
    
    new_transaction = {
        "user_id": user["id"],
        "transaction_type": transaction_data["type"],
        "amount": transaction_data["amount"],
        "description": transaction_data["description"],
        "created_at": datetime.now()
    }
    
    result = transactions_collection.insert_one(new_transaction)
    
    # Update user balance if it's an earning
    if transaction_data["type"] == "earning":
        users_collection.update_one(
            {"_id": ObjectId(user["id"])},
            {
                "$inc": {
                    "bitcoin_balance": transaction_data["amount"],
                    "total_earnings": transaction_data["amount"]
                }
            }
        )
    
    return {"message": "Transaction recorded successfully", "transaction_id": str(result.inserted_id)}

@app.get("/api/shop/miners")
async def get_shop_miners():
    shop_miners = [
        {
            "id": "basic_miner",
            "name": "Basic Miner",
            "hash_rate": 15.0,
            "duration": 168,  # 1 week in hours
            "price": 0.001,
            "description": "Entry-level miner for beginners"
        },
        {
            "id": "pro_miner",
            "name": "Pro Miner",
            "hash_rate": 45.0,
            "duration": 168,
            "price": 0.0025,
            "description": "High-performance miner for serious miners"
        },
        {
            "id": "enterprise_miner",
            "name": "Enterprise Miner",
            "hash_rate": 100.0,
            "duration": 720,  # 30 days
            "price": 0.01,
            "description": "Professional-grade mining power"
        }
    ]
    
    return {"miners": shop_miners}

@app.post("/api/shop/purchase")
async def purchase_miner(purchase_data: dict):
    user = get_current_user()
    
    # Check if user has sufficient balance
    if user["bitcoin_balance"] < purchase_data["price"]:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Deduct balance
    users_collection.update_one(
        {"_id": ObjectId(user["id"])},
        {"$inc": {"bitcoin_balance": -purchase_data["price"]}}
    )
    
    # Create new miner
    new_miner = {
        "user_id": user["id"],
        "name": purchase_data["name"],
        "hash_rate": purchase_data["hash_rate"],
        "status": "inactive",
        "time_remaining": purchase_data["duration"],
        "total_earned": 0.0,
        "miner_type": "premium",
        "purchase_price": purchase_data["price"],
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(hours=purchase_data["duration"])
    }
    
    result = miners_collection.insert_one(new_miner)
    
    # Record transaction
    transaction = {
        "user_id": user["id"],
        "transaction_type": "purchase",
        "amount": -purchase_data["price"],
        "description": f"Purchased {purchase_data['name']}",
        "created_at": datetime.now()
    }
    transactions_collection.insert_one(transaction)
    
    return {"message": "Miner purchased successfully", "miner_id": str(result.inserted_id)}

# Initialize demo data
@app.on_event("startup")
async def startup_event():
    user = get_current_user()
    
    # Create some demo miners if none exist
    existing_miners = miners_collection.count_documents({"user_id": user["id"]})
    if existing_miners == 0:
        demo_miners = [
            {
                "user_id": user["id"],
                "name": "Free Miner #1",
                "hash_rate": 5.6,
                "status": "active",
                "time_remaining": 23.5,
                "total_earned": 0.00000123,
                "miner_type": "free",
                "purchase_price": 0.0,
                "created_at": datetime.now(),
                "expires_at": datetime.now() + timedelta(hours=24)
            },
            {
                "user_id": user["id"],
                "name": "Premium Miner Pro",
                "hash_rate": 25.8,
                "status": "active",
                "time_remaining": 71.2,
                "total_earned": 0.00000567,
                "miner_type": "premium",
                "purchase_price": 0.002,
                "created_at": datetime.now(),
                "expires_at": datetime.now() + timedelta(hours=72)
            },
            {
                "user_id": user["id"],
                "name": "Ad Boost Miner",
                "hash_rate": 12.4,
                "status": "inactive",
                "time_remaining": 0.0,
                "total_earned": 0.00000089,
                "miner_type": "ad",
                "purchase_price": 0.0,
                "created_at": datetime.now(),
                "expires_at": None
            }
        ]
        
        miners_collection.insert_many(demo_miners)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)