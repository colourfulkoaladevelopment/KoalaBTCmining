from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, validator
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import os
import uuid
import random
import string
import logging
from dotenv import load_dotenv
from jose import jwt, JWTError
from passlib.context import CryptContext
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
)
import asyncio
from contextlib import asynccontextmanager

load_dotenv()

# Payment Processing Configuration
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "")
PAYPAL_MODE = os.getenv("PAYPAL_MODE", "sandbox")  # sandbox or live
COINBASE_COMMERCE_API_KEY = os.getenv("COINBASE_COMMERCE_API_KEY", "")
COINBASE_WEBHOOK_SECRET = os.getenv("COINBASE_WEBHOOK_SECRET", "")

# Promo Codes Configuration
PROMO_CODES = {
    "WELCOME10": {"discount_percent": 10, "max_uses": 1000, "used": 0},
    "CRYPTO20": {"discount_percent": 20, "max_uses": 500, "used": 0},
    "NEWUSER15": {"discount_percent": 15, "max_uses": 2000, "used": 0}
}

# Bitcoin wallet configuration (add these to your .env file in production)
BITCOIN_WALLET_TYPE = os.getenv("BITCOIN_WALLET_TYPE", "demo")  # demo, bitgo, coinbase, rpc
BITGO_API_KEY = os.getenv("BITGO_API_KEY", "")
BITGO_WALLET_ID = os.getenv("BITGO_WALLET_ID", "")
BITGO_WALLET_PASSPHRASE = os.getenv("BITGO_WALLET_PASSPHRASE", "")
BITGO_ENV = os.getenv("BITGO_ENV", "test")  # test or prod
COINBASE_API_KEY = os.getenv("COINBASE_API_KEY", "")
BITCOIN_RPC_USER = os.getenv("BITCOIN_RPC_USER", "")
BITCOIN_RPC_PASSWORD = os.getenv("BITCOIN_RPC_PASSWORD", "")
BITCOIN_RPC_URL = os.getenv("BITCOIN_RPC_URL", "http://localhost:8332")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
db = client.bitcoin_mining_db

# Collections
users_collection = db.users
user_sessions_collection = db.user_sessions
miners_collection = db.miners
transactions_collection = db.transactions
mining_sessions_collection = db.mining_sessions
devices_collection = db.devices
referrals_collection = db.referrals
purchases_collection = db.purchases

# Security setup
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

import hashlib
# Temporarily use simple hashing for testing
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
push_client = PushClient()

# Initialize scheduler
scheduler = AsyncIOScheduler()

# Pydantic models
class User(BaseModel):
    id: Optional[str] = Field(alias="_id")
    email: str
    name: str
    picture: Optional[str] = None
    referral_code: str
    referred_by: Optional[str] = None
    bitcoin_balance: float = 0.0
    total_earnings: float = 0.0
    total_referral_rewards: float = 0.0
    total_cashed_out: float = 0.0
    created_at: datetime = datetime.utcnow()
    
    class Config:
        populate_by_name = True
        allow_population_by_field_name = True
        arbitrary_types_allowed = True

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = datetime.utcnow()

class Device(BaseModel):
    id: Optional[str] = Field(alias="_id")
    user_id: str
    expo_push_token: str
    device_type: str  # ios, android
    app_version: str
    is_active: bool = True
    created_at: datetime = datetime.utcnow()

class Miner(BaseModel):
    id: Optional[str] = Field(alias="_id")
    user_id: str
    name: str
    hash_rate: float
    miner_type: str  # free, premium, ad
    status: str = "inactive"  # active, inactive, expired
    duration_hours: float = 24.0
    time_remaining: float = 0.0
    total_earned: float = 0.0
    purchase_price: float = 0.0
    created_at: datetime = datetime.utcnow()
    expires_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None

class MiningSession(BaseModel):
    id: Optional[str] = Field(alias="_id")
    user_id: str
    miner_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    hash_rate: float
    bitcoins_mined: float = 0.0
    status: str = "active"  # active, completed, expired

class Transaction(BaseModel):
    id: Optional[str] = Field(alias="_id")
    user_id: str
    transaction_type: str  # purchase, earning, withdrawal, referral_reward
    amount: float
    description: str
    miner_id: Optional[str] = None
    created_at: datetime = datetime.utcnow()

class Referral(BaseModel):
    id: Optional[str] = Field(alias="_id")
    referrer_id: str
    referee_id: str
    reward_given: bool = False
    commission_earned: float = 0.0
    created_at: datetime = datetime.utcnow()

class Purchase(BaseModel):
    id: Optional[str] = Field(alias="_id")
    user_id: str
    miner_name: str
    hash_rate: float
    price: float
    payment_method: str
    payment_status: str = "pending"
    created_at: datetime = datetime.utcnow()

# Request/Response models
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    referral_code: Optional[str] = None

class CreateMinerRequest(BaseModel):
    name: str
    hash_rate: float
    miner_type: str
    duration_hours: float = 24.0
    purchase_price: float = 0.0

class DeviceRegistration(BaseModel):
    expo_push_token: str
    device_type: str
    app_version: str
    
    @validator('expo_push_token')
    def validate_expo_token(cls, v):
        if not v.startswith('ExponentPushToken['):
            raise ValueError('Invalid Expo push token format')
        return v

# Helper functions
def generate_referral_code() -> str:
    """Generate unique referral code"""
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        existing = users_collection.find_one({"referral_code": code})
        if not existing:
            return code

def hash_password(password: str) -> str:
    # Simple hash for testing - NOT for production use
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password

def create_access_token(data: Dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Get current authenticated user"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check session in database
        session = user_sessions_collection.find_one({
            "session_token": token,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        
        if not session:
            raise HTTPException(status_code=401, detail="Session expired")
        
        user = users_collection.find_one({"_id": session["user_id"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user["id"] = str(user["_id"])
        return user
        
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def send_push_notification(user_id: str, title: str, body: str, data: Dict[str, Any] = None):
    """Send push notification to user's devices"""
    try:
        devices = list(devices_collection.find({"user_id": user_id, "is_active": True}))
        
        for device in devices:
            try:
                message = PushMessage(
                    to=device["expo_push_token"],
                    title=title,
                    body=body,
                    data=data or {},
                    sound="default",
                    badge=1
                )
                
                response = push_client.publish(message)
                response.validate_response()
                logger.info(f"Notification sent to device {device['_id']}")
                
            except DeviceNotRegisteredError:
                devices_collection.update_one(
                    {"_id": device["_id"]},
                    {"$set": {"is_active": False}}
                )
                logger.warning(f"Device {device['_id']} token invalid, deactivated")
            except Exception as e:
                logger.error(f"Error sending notification: {e}")
                
    except Exception as e:
        logger.error(f"Error in send_push_notification: {e}")

# Background tasks
async def check_expired_miners():
    """Check for expired miners and send notifications"""
    try:
        current_time = datetime.utcnow()
        expired_miners = list(miners_collection.find({
            "status": "active",
            "expires_at": {"$lte": current_time}
        }))
        
        for miner in expired_miners:
            # Deactivate miner
            miners_collection.update_one(
                {"_id": miner["_id"]},
                {"$set": {"status": "expired", "time_remaining": 0}}
            )
            
            # Send notification
            miner_type_text = {
                "free": "free miner",
                "ad": "ad-boost miner",
                "premium": "premium miner"
            }.get(miner["miner_type"], "miner")
            
            await send_push_notification(
                user_id=miner["user_id"],
                title="Miner Deactivated ⚠️",
                body=f"Your {miner_type_text} has expired and been deactivated.",
                data={
                    "type": "miner_expired",
                    "miner_id": str(miner["_id"]),
                    "miner_type": miner["miner_type"]
                }
            )
            
            logger.info(f"Expired miner {miner['_id']} for user {miner['user_id']}")
        
        # Update active miners' time remaining
        active_miners = list(miners_collection.find({"status": "active"}))
        for miner in active_miners:
            if miner.get("expires_at"):
                time_remaining = (miner["expires_at"] - current_time).total_seconds() / 3600
                miners_collection.update_one(
                    {"_id": miner["_id"]},
                    {"$set": {"time_remaining": max(0, time_remaining)}}
                )
        
    except Exception as e:
        logger.error(f"Error in check_expired_miners: {e}")

async def process_mining_earnings():
    """Process mining earnings for active miners"""
    try:
        active_miners = list(miners_collection.find({"status": "active"}))
        
        for miner in active_miners:
            # Calculate earnings (ultra-low rate - another 10x reduction)
            base_rate = 0.000000000000083  # BTC per GH/s per 5 seconds (10x lower than previous)
            earnings = miner["hash_rate"] * base_rate
            
            # Update miner earnings
            miners_collection.update_one(
                {"_id": miner["_id"]},
                {"$inc": {"total_earned": earnings}}
            )
            
            # Update user balance
            users_collection.update_one(
                {"_id": miner["user_id"]},
                {"$inc": {"bitcoin_balance": earnings, "total_earnings": earnings}}
            )
            
            # Record transaction
            transaction = {
                "user_id": miner["user_id"],
                "transaction_type": "earning",
                "amount": earnings,
                "description": f"Mining earnings from {miner['name']}",
                "miner_id": str(miner["_id"]),
                "created_at": datetime.utcnow()
            }
            transactions_collection.insert_one(transaction)
        
    except Exception as e:
        logger.error(f"Error in process_mining_earnings: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    scheduler.start()
    
    # Schedule background tasks to run every 5 seconds for more visible updates
    scheduler.add_job(
        check_expired_miners,
        IntervalTrigger(seconds=5),  # Check every 5 seconds instead of 60
        id="check_expired_miners",
        replace_existing=True
    )
    
    scheduler.add_job(
        process_mining_earnings,
        IntervalTrigger(seconds=5),  # Process earnings every 5 seconds for visible changes
        id="process_mining_earnings",
        replace_existing=True
    )
    
    logger.info("Bitcoin Mining Simulator API started")
    yield
    
    # Shutdown
    scheduler.shutdown()

app = FastAPI(
    title="Bitcoin Mining Simulator API",
    description="Complete Bitcoin mining simulator with authentication, payments, and referrals",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication routes
@app.post("/api/auth/register")
async def register(request: RegisterRequest):
    """Register new user"""
    # Check if user exists
    existing_user = users_collection.find_one({"email": request.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    referral_code = generate_referral_code()
    
    user_data = {
        "_id": user_id,
        "email": request.email,
        "name": request.name,
        "password_hash": hash_password(request.password),
        "referral_code": referral_code,
        "referred_by": request.referral_code,
        "bitcoin_balance": 0.0,
        "total_earnings": 0.0,
        "total_referral_rewards": 0.0,
        "total_cashed_out": 0.0,  # Track total withdrawals
        "created_at": datetime.utcnow()
    }
    
    users_collection.insert_one(user_data)
    
    # Handle referral if provided
    if request.referral_code:
        referrer = users_collection.find_one({"referral_code": request.referral_code})
        if referrer:
            # Create referral record
            referral_data = {
                "referrer_id": str(referrer["_id"]),
                "referee_id": user_id,
                "reward_given": False,
                "commission_earned": 0.0,
                "created_at": datetime.utcnow()
            }
            referrals_collection.insert_one(referral_data)
            
            # Give referral rewards (100 GH/s miner for 30 days)
            reward_miner_data = {
                "_id": str(uuid.uuid4()),
                "user_id": str(referrer["_id"]),
                "name": "Referral Reward Miner",
                "hash_rate": 100.0,
                "miner_type": "referral_reward",
                "status": "inactive",
                "duration_hours": 720.0,  # 30 days
                "time_remaining": 720.0,
                "total_earned": 0.0,
                "purchase_price": 0.0,
                "created_at": datetime.utcnow()
            }
            miners_collection.insert_one(reward_miner_data)
            
            # Give same reward to new user
            new_user_miner_data = {
                "_id": str(uuid.uuid4()),
                "user_id": user_id,
                "name": "Welcome Referral Miner",
                "hash_rate": 100.0,
                "miner_type": "referral_reward",
                "status": "inactive",
                "duration_hours": 720.0,
                "time_remaining": 720.0,
                "total_earned": 0.0,
                "purchase_price": 0.0,
                "created_at": datetime.utcnow()
            }
            miners_collection.insert_one(new_user_miner_data)
    
    # Create session
    session_token = create_access_token({"sub": user_id})
    session_data = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.utcnow() + timedelta(days=7),
        "created_at": datetime.utcnow()
    }
    user_sessions_collection.insert_one(session_data)
    
    return {
        "message": "Registration successful",
        "user": {
            "id": user_id,
            "name": request.name,
            "email": request.email,
            "referral_code": referral_code
        },
        "access_token": session_token,
        "token_type": "bearer"
    }

@app.post("/api/auth/login")
async def login(request: LoginRequest):
    """Login user"""
    user = users_collection.find_one({"email": request.email})
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    session_token = create_access_token({"sub": str(user["_id"])})
    session_data = {
        "user_id": str(user["_id"]),
        "session_token": session_token,
        "expires_at": datetime.utcnow() + timedelta(days=7),
        "created_at": datetime.utcnow()
    }
    user_sessions_collection.insert_one(session_data)
    
    return {
        "message": "Login successful",
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "referral_code": user["referral_code"]
        },
        "access_token": session_token,
        "token_type": "bearer"
    }

@app.get("/api/auth/me")
async def get_current_user_info(current_user: Dict = Depends(get_current_user)):
    """Get current user information"""
    
    # Ensure data consistency: total_earnings should never be less than current balance
    current_balance = current_user.get("bitcoin_balance", 0.0)
    current_total_earnings = current_user.get("total_earnings", 0.0)
    
    if current_total_earnings < current_balance:
        # Fix data inconsistency - update total_earnings to match balance
        users_collection.update_one(
            {"_id": current_user["id"]},
            {"$set": {"total_earnings": current_balance}}
        )
        logger.info(f"Fixed total_earnings for user {current_user['id']}: updated from {current_total_earnings} to {current_balance}")
        current_total_earnings = current_balance
    
    return {
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "referral_code": current_user["referral_code"],
        "bitcoin_balance": current_balance,
        "total_earnings": current_total_earnings,
        "total_referral_rewards": current_user.get("total_referral_rewards", 0.0),
        "total_cashed_out": current_user.get("total_cashed_out", 0.0),
        "created_at": current_user["created_at"]
    }

@app.post("/api/auth/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Logout user"""
    token = credentials.credentials
    user_sessions_collection.delete_one({"session_token": token})
    return {"message": "Logout successful"}

# Device management
@app.post("/api/devices/register")
async def register_device(
    device_data: DeviceRegistration,
    current_user: Dict = Depends(get_current_user)
):
    """Register device for push notifications"""
    # Check if device already exists
    existing_device = devices_collection.find_one({
        "user_id": current_user["id"],
        "expo_push_token": device_data.expo_push_token
    })
    
    if existing_device:
        # Update existing device
        devices_collection.update_one(
            {"_id": existing_device["_id"]},
            {"$set": {
                "device_type": device_data.device_type,
                "app_version": device_data.app_version,
                "is_active": True
            }}
        )
        return {"message": "Device updated successfully"}
    
    # Create new device
    device_id = str(uuid.uuid4())
    new_device = {
        "_id": device_id,
        "user_id": current_user["id"],
        "expo_push_token": device_data.expo_push_token,
        "device_type": device_data.device_type,
        "app_version": device_data.app_version,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    
    devices_collection.insert_one(new_device)
    return {"message": "Device registered successfully"}

# Wallet endpoints
@app.get("/api/wallet/balance")
async def get_wallet_balance(current_user: Dict = Depends(get_current_user)):
    """Get user wallet balance and stats"""
    # Calculate today's earnings
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_earnings_pipeline = [
        {"$match": {
            "user_id": current_user["id"],
            "transaction_type": "earning",
            "created_at": {"$gte": today_start}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    
    today_earnings_result = list(transactions_collection.aggregate(today_earnings_pipeline))
    today_total = today_earnings_result[0]["total"] if today_earnings_result else 0.0
    
    # Count miners
    total_miners = miners_collection.count_documents({"user_id": current_user["id"]})
    active_miners = miners_collection.count_documents({
        "user_id": current_user["id"],
        "status": "active"
    })
    
    # Calculate current hash rate
    current_hash_rate_pipeline = [
        {"$match": {"user_id": current_user["id"], "status": "active"}},
        {"$group": {"_id": None, "total_hash_rate": {"$sum": "$hash_rate"}}}
    ]
    
    hash_rate_result = list(miners_collection.aggregate(current_hash_rate_pipeline))
    current_hash_rate = hash_rate_result[0]["total_hash_rate"] if hash_rate_result else 0.0
    
    return {
        "total_balance": current_user.get("bitcoin_balance", 0.0),
        "today_earnings": today_total,
        "total_miners": total_miners,
        "active_miners": active_miners,
        "current_hash_rate": current_hash_rate,
        "total_referral_rewards": current_user.get("total_referral_rewards", 0.0)
    }

# Miner management
@app.get("/api/miners/list")
async def get_user_miners(current_user: Dict = Depends(get_current_user)):
    """Get user's miners"""
    miners = list(miners_collection.find({"user_id": current_user["id"]}))
    
    miners_list = []
    for miner in miners:
        miners_list.append({
            "id": str(miner["_id"]),
            "name": miner["name"],
            "hash_rate": miner["hash_rate"],
            "miner_type": miner["miner_type"],
            "status": miner["status"],
            "duration_hours": miner["duration_hours"],
            "time_remaining": miner.get("time_remaining", 0.0),
            "total_earned": miner.get("total_earned", 0.0),
            "purchase_price": miner.get("purchase_price", 0.0),
            "created_at": miner["created_at"],
            "expires_at": miner.get("expires_at"),
            "activated_at": miner.get("activated_at")
        })
    
    return {"miners": miners_list}

@app.post("/api/miners/{miner_id}/activate")
async def activate_miner(miner_id: str, current_user: Dict = Depends(get_current_user)):
    """Activate a miner"""
    miner = miners_collection.find_one({
        "_id": miner_id,
        "user_id": current_user["id"]
    })
    
    if not miner:
        raise HTTPException(status_code=404, detail="Miner not found")
    
    if miner["status"] == "active":
        raise HTTPException(status_code=400, detail="Miner is already active")
    
    # Activate miner
    now = datetime.utcnow()
    expires_at = now + timedelta(hours=miner["duration_hours"])
    
    miners_collection.update_one(
        {"_id": miner_id},
        {"$set": {
            "status": "active",
            "activated_at": now,
            "expires_at": expires_at,
            "time_remaining": miner["duration_hours"]
        }}
    )
    
    return {"message": "Miner activated successfully"}

@app.post("/api/miners/activate-free")
async def activate_free_miner(current_user: Dict = Depends(get_current_user)):
    """Activate or create free daily miner (1 GH/s for 24h)"""
    # Check if user already has an active free miner today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    existing_free = miners_collection.find_one({
        "user_id": current_user["id"],
        "miner_type": "free",
        "created_at": {"$gte": today_start}
    })
    
    if existing_free and existing_free["status"] == "active":
        raise HTTPException(status_code=400, detail="Free miner already active today")
    
    # Create or reactivate free miner
    now = datetime.utcnow()
    expires_at = now + timedelta(hours=24)
    
    if existing_free:
        # Reactivate existing free miner
        miners_collection.update_one(
            {"_id": existing_free["_id"]},
            {"$set": {
                "status": "active",
                "activated_at": now,
                "expires_at": expires_at,
                "time_remaining": 24.0
            }}
        )
        miner_id = existing_free["_id"]
    else:
        # Create new free miner
        miner_id = str(uuid.uuid4())
        free_miner_data = {
            "_id": miner_id,
            "user_id": current_user["id"],
            "name": "Daily Free Miner",
            "hash_rate": 1.0,
            "miner_type": "free",
            "status": "active",
            "duration_hours": 24.0,
            "time_remaining": 24.0,
            "total_earned": 0.0,
            "purchase_price": 0.0,
            "created_at": now,
            "activated_at": now,
            "expires_at": expires_at
        }
        miners_collection.insert_one(free_miner_data)
    
    return {"message": "Free miner activated successfully", "miner_id": miner_id}

@app.post("/api/miners/watch-ad")
async def activate_ad_miner(current_user: Dict = Depends(get_current_user)):
    """Activate ad miner (2 GH/s for 30 minutes, stackable up to 24h)"""
    # Find existing ad miner or create new one
    ad_miner = miners_collection.find_one({
        "user_id": current_user["id"],
        "miner_type": "ad",
        "name": "Ad Boost Miner"
    })
    
    now = datetime.utcnow()
    
    if ad_miner:
        # Extend existing ad miner time (max 24 hours)
        current_remaining = max(0, ad_miner.get("time_remaining", 0.0))
        new_time_remaining = min(current_remaining + 0.5, 24.0)  # Add 30 minutes, cap at 24h
        
        expires_at = now + timedelta(hours=new_time_remaining)
        
        miners_collection.update_one(
            {"_id": ad_miner["_id"]},
            {"$set": {
                "status": "active" if new_time_remaining > 0 else "inactive",
                "time_remaining": new_time_remaining,
                "expires_at": expires_at,
                "activated_at": now if ad_miner["status"] != "active" else ad_miner.get("activated_at")
            }}
        )
    else:
        # Create new ad miner
        miner_id = str(uuid.uuid4())
        expires_at = now + timedelta(minutes=30)
        
        ad_miner_data = {
            "_id": miner_id,
            "user_id": current_user["id"],
            "name": "Ad Boost Miner",
            "hash_rate": 2.0,
            "miner_type": "ad",
            "status": "active",
            "duration_hours": 0.5,
            "time_remaining": 0.5,
            "total_earned": 0.0,
            "purchase_price": 0.0,
            "created_at": now,
            "activated_at": now,
            "expires_at": expires_at
        }
        miners_collection.insert_one(ad_miner_data)
    
    return {"message": "Ad miner boost activated successfully"}

# Store endpoints
@app.get("/api/store/miners")
async def get_store_miners():
    """Get available miners for purchase"""
    store_miners = [
        {"id": "miner_100gh", "name": "Standard Miner", "hash_rate": 100.0, "price": 7.99, "duration_days": 30},
        {"id": "miner_200gh", "name": "Advanced Miner", "hash_rate": 200.0, "price": 14.99, "duration_days": 30},
        {"id": "miner_400gh", "name": "Pro Miner", "hash_rate": 400.0, "price": 29.99, "duration_days": 30},
        {"id": "miner_1th", "name": "Elite Miner", "hash_rate": 1000.0, "price": 79.99, "duration_days": 30},
        {"id": "miner_2th", "name": "Master Miner", "hash_rate": 2000.0, "price": 159.99, "duration_days": 30},
        {"id": "miner_4th", "name": "Supreme Miner", "hash_rate": 4000.0, "price": 299.99, "duration_days": 30},
        {"id": "miner_6th", "name": "Ultimate Miner", "hash_rate": 6000.0, "price": 449.99, "duration_days": 30},
        {"id": "miner_8th", "name": "Legendary Miner", "hash_rate": 8000.0, "price": 599.99, "duration_days": 30},
        {"id": "miner_10th", "name": "Mythical Miner", "hash_rate": 10000.0, "price": 999.99, "duration_days": 30}
    ]
    
    return {"miners": store_miners}

@app.post("/api/store/purchase")
async def purchase_miner(
    purchase_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Purchase a miner (simulated payment)"""
    miner_id = str(uuid.uuid4())
    auto_activate = purchase_data.get("auto_activate", False)
    
    # Create purchased miner - auto-activate as requested
    now = datetime.utcnow()
    status = "active" if auto_activate else "inactive"
    expires_at = now + timedelta(hours=purchase_data["duration_days"] * 24) if auto_activate else None
    
    purchased_miner = {
        "_id": miner_id,
        "user_id": current_user["id"],
        "name": purchase_data["name"],
        "hash_rate": purchase_data["hash_rate"],
        "miner_type": "premium",
        "status": status,
        "duration_hours": purchase_data["duration_days"] * 24,
        "time_remaining": purchase_data["duration_days"] * 24,
        "total_earned": 0.0,
        "purchase_price": purchase_data["price"],
        "activated_at": now if auto_activate else None,
        "expires_at": expires_at,
        "created_at": now
    }
    
    miners_collection.insert_one(purchased_miner)
    
    # Record purchase transaction
    purchase_record = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "miner_name": purchase_data["name"],
        "hash_rate": purchase_data["hash_rate"],
        "price": purchase_data["price"],
        "payment_method": purchase_data.get("payment_method", "credit_card"),
        "payment_status": "completed",
        "auto_activated": auto_activate,
        "created_at": now
    }
    purchases_collection.insert_one(purchase_record)
    
    # Handle referral commission (10% of hash rate) - also auto-activate if parent miner is activated
    if current_user.get("referred_by"):
        referrer = users_collection.find_one({"referral_code": current_user["referred_by"]})
        if referrer:
            commission_hash_rate = purchase_data["hash_rate"] * 0.1
            commission_miner_id = str(uuid.uuid4())
            
            # Create commission miner for referrer - also auto-activate
            commission_miner = {
                "_id": commission_miner_id,
                "user_id": str(referrer["_id"]),
                "name": f"Referral Commission: {purchase_data['name']}",
                "hash_rate": commission_hash_rate,
                "miner_type": "referral_commission",
                "status": status,  # Same status as main purchase
                "duration_hours": purchase_data["duration_days"] * 24,
                "time_remaining": purchase_data["duration_days"] * 24,
                "total_earned": 0.0,
                "purchase_price": 0.0,
                "activated_at": now if auto_activate else None,
                "expires_at": expires_at,
                "created_at": now
            }
            miners_collection.insert_one(commission_miner)
            
            # Update referral record
            referrals_collection.update_one(
                {"referrer_id": str(referrer["_id"]), "referee_id": current_user["id"]},
                {"$inc": {"commission_earned": commission_hash_rate}}
            )
            
            # Update referrer's total referral rewards
            users_collection.update_one(
                {"_id": referrer["_id"]},
                {"$inc": {"total_referral_rewards": commission_hash_rate}}
            )
    
    return {
        "message": "Miner purchased successfully",
        "miner_id": miner_id,
        "purchase_id": purchase_record["_id"]
    }

# Referral endpoints
@app.get("/api/referrals/stats")
async def get_referral_stats(current_user: Dict = Depends(get_current_user)):
    """Get referral statistics"""
    referrals = list(referrals_collection.find({"referrer_id": current_user["id"]}))
    
    total_referrals = len(referrals)
    total_commission = sum(r.get("commission_earned", 0.0) for r in referrals)
    
    # Get referral miners count
    referral_miners = miners_collection.count_documents({
        "user_id": current_user["id"],
        "miner_type": {"$in": ["referral_reward", "referral_commission"]}
    })
    
    return {
        "referral_code": current_user["referral_code"],
        "total_referrals": total_referrals,
        "total_commission": total_commission,
        "referral_miners": referral_miners,
        "total_referral_rewards": current_user.get("total_referral_rewards", 0.0)
    }

# Support endpoints
@app.post("/api/support/contact")
async def submit_contact_form(
    contact_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Submit contact support form and send email to support team"""
    try:
        # Validate required fields
        name = contact_data.get("name", "").strip()
        email = contact_data.get("email", "").strip()
        subject = contact_data.get("subject", "").strip()
        message = contact_data.get("message", "").strip()
        
        if not name or not email or not subject or not message:
            raise HTTPException(status_code=400, detail="All fields (name, email, subject, message) are required")
        
        # Store support ticket in database
        support_ticket = {
            "user_id": current_user["id"],
            "name": name,
            "email": email,
            "subject": subject,
            "message": message,
            "status": "open",
            "created_at": datetime.utcnow()
        }
        
        result = db.support_tickets.insert_one(support_ticket)
        ticket_id = str(result.inserted_id)
        
        # Send email to support team (colourfulkoaladevelopment@gmail.com)
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            # Gmail SMTP configuration
            smtp_server = "smtp.gmail.com"
            smtp_port = 587
            sender_email = "colourfulkoaladevelopment@gmail.com"
            sender_password = "kwkg czgx shbd btrp"
            recipient_email = "colourfulkoaladevelopment@gmail.com"
            
            # Create email message
            email_subject = f"Bitcoin Mining App Support Request - {subject}"
            
            msg = MIMEMultipart()
            msg['From'] = sender_email
            msg['To'] = recipient_email
            msg['Subject'] = email_subject
            
            # Create HTML email body
            email_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #FFD700; text-align: center;">🚀 Bitcoin Mining App Support Request</h2>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Contact Information</h3>
                        <p><strong>Name:</strong> {name}</p>
                        <p><strong>Email:</strong> {email}</p>
                        <p><strong>Subject:</strong> {subject}</p>
                        <p><strong>Ticket ID:</strong> {ticket_id}</p>
                    </div>
                    
                    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">User Details</h3>
                        <p><strong>User ID:</strong> {current_user['id']}</p>
                        <p><strong>Account Email:</strong> {current_user['email']}</p>
                        <p><strong>Submitted At:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
                    </div>
                    
                    <div style="background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">📝 Message</h3>
                        <p style="white-space: pre-wrap; background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #FFD700;">{message}</p>
                    </div>
                    
                    <hr style="margin: 30px 0; border: none; border-top: 2px solid #FFD700;">
                    <p style="text-align: center; color: #666; font-size: 12px;">
                        This email was automatically generated from the Bitcoin Mining App support system.
                    </p>
                </div>
            </body>
            </html>
            """
            
            msg.attach(MIMEText(email_body, 'html'))
            
            # Send email using Gmail SMTP
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()  # Enable security
            server.login(sender_email, sender_password)
            text = msg.as_string()
            server.sendmail(sender_email, recipient_email, text)
            server.quit()
            
            logger.info(f"✅ Support email sent successfully to {recipient_email}: {email_subject}")
            
        except Exception as email_error:
            logger.error(f"❌ Failed to send support email: {email_error}")
            # Continue execution even if email fails - still create the ticket
        
        return {
            "message": "Support request submitted successfully. We'll get back to you soon!",
            "ticket_id": ticket_id
        }
        
    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception as e:
        logger.error(f"Error submitting contact form: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit support request")

# Get live Bitcoin price
@app.get("/api/bitcoin/price")
async def get_bitcoin_price():
    """Get current Bitcoin price in USD"""
    try:
        # Using CoinGecko API for live Bitcoin price
        import requests
        response = requests.get(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            btc_price = data["bitcoin"]["usd"]
            
            return {
                "btc_price_usd": btc_price,
                "last_updated": datetime.utcnow().isoformat(),
                "source": "CoinGecko API"
            }
        else:
            # Fallback price if API fails
            return {
                "btc_price_usd": 50000.0,  # Fallback price
                "last_updated": datetime.utcnow().isoformat(),
                "source": "Fallback (API unavailable)"
            }
            
    except Exception as e:
        logger.error(f"Error fetching Bitcoin price: {e}")
        # Return fallback price
        return {
            "btc_price_usd": 50000.0,
            "last_updated": datetime.utcnow().isoformat(),
            "source": "Fallback (Error occurred)"
        }

# Bitcoin withdrawal endpoints
@app.post("/api/withdraw/bitcoin")
async def withdraw_bitcoin(
    withdrawal_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Process Bitcoin withdrawal to external wallet"""
    try:
        address = withdrawal_data.get("address", "").strip()
        amount = float(withdrawal_data.get("amount", 0))
        
        if not address:
            raise HTTPException(status_code=400, detail="Bitcoin address is required")
        
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Withdrawal amount must be greater than 0")
        
        # Check user balance
        user = users_collection.find_one({"_id": current_user["id"]})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        current_balance = user.get("bitcoin_balance", 0)
        
        # Minimum withdrawal check
        min_withdrawal = 0.00001  # Minimum 0.00001 BTC as requested
        if amount < min_withdrawal:
            raise HTTPException(
                status_code=400, 
                detail=f"Minimum withdrawal amount is {min_withdrawal} BTC"
            )
        
        # Calculate processing fee (0.5% as requested)
        processing_fee = amount * 0.005  # 0.5% fee
        total_deduction = amount + processing_fee
        
        if total_deduction > current_balance:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient balance. Available: {current_balance:.8f} BTC, Required: {total_deduction:.8f} BTC (including 0.5% fee)"
            )
        
        # Get current Bitcoin price for USD value calculation
        try:
            import requests
            price_response = requests.get(
                "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
                timeout=5
            )
            btc_price = 50000.0  # fallback
            if price_response.status_code == 200:
                btc_price = price_response.json()["bitcoin"]["usd"]
        except Exception:
            btc_price = 50000.0  # fallback price
        
        usd_value = amount * btc_price
        
        # Create withdrawal record
        withdrawal_id = str(uuid.uuid4())
        withdrawal_record = {
            "_id": withdrawal_id,
            "user_id": current_user["id"],
            "bitcoin_address": address,
            "amount_btc": amount,
            "processing_fee_btc": processing_fee,
            "total_deducted_btc": total_deduction,
            "usd_value": usd_value,
            "btc_price_at_withdrawal": btc_price,
            "status": "pending",
            "transaction_hash": None,
            "created_at": datetime.utcnow(),
            "processed_at": None,
            "notes": ""
        }
        
        db.withdrawals.insert_one(withdrawal_record)
        
        # Update user balance (deduct amount + fee)
        new_balance = current_balance - total_deduction
        users_collection.update_one(
            {"_id": current_user["id"]},
            {
                "$set": {"bitcoin_balance": new_balance},
                "$inc": {"total_cashed_out": amount}  # Track only the withdrawal amount, not fee
            }
        )
        
        # Record transaction for balance tracking
        transaction_record = {
            "_id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "type": "withdrawal",
            "amount": -total_deduction,  # Negative for withdrawal (includes fee)
            "balance_after": new_balance,
            "description": f"Bitcoin withdrawal to {address[:10]}...{address[-6:]} + 0.5% fee",
            "withdrawal_id": withdrawal_id,
            "created_at": datetime.utcnow()
        }
        transactions_collection.insert_one(transaction_record)
        
        logger.info(f"Bitcoin withdrawal created: {amount} BTC to {address} (User: {current_user['id']})")
        
        try:
            # Process actual Bitcoin transaction from backend wallet to user address
            tx_hash = await process_bitcoin_withdrawal(address, amount, withdrawal_id)
            
            if tx_hash:
                # Update withdrawal record with successful transaction
                db.withdrawals.update_one(
                    {"_id": withdrawal_id},
                    {"$set": {
                        "transaction_hash": tx_hash,
                        "status": "completed",
                        "processed_at": datetime.utcnow()
                    }}
                )
                logger.info(f"✅ Bitcoin withdrawal completed: {amount} BTC sent to {address} (TX: {tx_hash})")
                
                return {
                    "success": True,
                    "withdrawal_id": withdrawal_id,
                    "amount_btc": amount,
                    "processing_fee_btc": processing_fee,
                    "total_deducted_btc": total_deduction,
                    "usd_value": round(usd_value, 2),
                    "bitcoin_address": address,
                    "status": "completed",
                    "message": "Withdrawal completed successfully.",
                    "estimated_confirmation_time": "Completed"
                }
            else:
                raise Exception("Bitcoin transaction failed")
                
        except Exception as wallet_error:
            logger.error(f"❌ Bitcoin wallet integration error: {wallet_error}")
            
            # Mark withdrawal as failed
            db.withdrawals.update_one(
                {"_id": withdrawal_id},
                {"$set": {
                    "status": "failed",
                    "notes": f"Wallet integration error: {str(wallet_error)}",
                    "processed_at": datetime.utcnow()
                }}
            )
            
            # Refund user balance since withdrawal failed
            users_collection.update_one(
                {"_id": current_user["id"]},
                {
                    "$set": {"bitcoin_balance": current_balance},  # Restore original balance
                    "$inc": {"total_cashed_out": -amount}  # Subtract from total cashed out
                }
            )
            
            # Remove the transaction record since it failed
            transactions_collection.delete_one({"withdrawal_id": withdrawal_id})
            
            raise HTTPException(
                status_code=500, 
                detail="Bitcoin network error occurred. Your balance has been restored. Please try again later."
            )
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid withdrawal amount")
    except Exception as e:
        logger.error(f"Error processing Bitcoin withdrawal: {e}")
        raise HTTPException(status_code=500, detail="Failed to process withdrawal")

async def process_bitcoin_withdrawal(address: str, amount: float, withdrawal_id: str) -> str:
    """Process Bitcoin withdrawal using configured wallet service"""
    
    if BITCOIN_WALLET_TYPE == "bitgo":
        return await bitgo_send_bitcoin(address, amount, withdrawal_id)
    elif BITCOIN_WALLET_TYPE == "coinbase":
        return await coinbase_send_bitcoin(address, amount, withdrawal_id)
    elif BITCOIN_WALLET_TYPE == "rpc":
        return await bitcoin_rpc_send(address, amount, withdrawal_id)
    else:
        # Demo mode - simulate transaction
        return await demo_bitcoin_transaction(address, amount, withdrawal_id)

async def bitgo_send_bitcoin(address: str, amount: float, withdrawal_id: str) -> str:
    """Send Bitcoin using BitGo API"""
    try:
        import requests
        
        # Determine BitGo API URL based on environment
        base_url = "https://app.bitgo.com" if BITGO_ENV == "prod" else "https://test.bitgo.com"
        
        headers = {
            'Authorization': f'Bearer {BITGO_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'address': address,
            'amount': str(int(amount * 100000000)),  # Convert to satoshis
            'walletPassphrase': BITGO_WALLET_PASSPHRASE,
            'comment': f'Mining withdrawal {withdrawal_id}',
            'feeRate': 1000  # Satoshis per kilobyte (1 sat/byte)
        }
        
        response = requests.post(
            f'{base_url}/api/v2/btc/wallet/{BITGO_WALLET_ID}/sendcoins',
            headers=headers,
            json=data,
            timeout=60  # Increased timeout for Bitcoin transactions
        )
        
        if response.status_code == 200:
            result = response.json()
            tx_hash = result.get('hash', result.get('txid'))
            logger.info(f"✅ BitGo transaction successful: {tx_hash}")
            return tx_hash
        else:
            error_msg = f"BitGo API error ({response.status_code}): {response.text}"
            logger.error(error_msg)
            raise Exception(error_msg)
            
    except Exception as e:
        logger.error(f"BitGo withdrawal failed: {e}")
        raise e

async def coinbase_send_bitcoin(address: str, amount: float, withdrawal_id: str) -> str:
    """Send Bitcoin using Coinbase Commerce API"""
    try:
        # This would require coinbase-commerce-python package
        # pip install coinbase-commerce
        
        from coinbase_commerce.client import Client
        from coinbase_commerce.webhook import Webhook
        
        client = Client(api_key=COINBASE_API_KEY)
        
        charge_data = {
            'name': f'Mining Withdrawal {withdrawal_id}',
            'description': f'Bitcoin withdrawal to {address}',
            'local_price': {
                'amount': str(amount),
                'currency': 'BTC'
            },
            'pricing_type': 'fixed_price'
        }
        
        charge = client.charge.create(**charge_data)
        return charge.id  # Return charge ID as transaction reference
        
    except Exception as e:
        logger.error(f"Coinbase Commerce withdrawal failed: {e}")
        raise e

async def bitcoin_rpc_send(address: str, amount: float, withdrawal_id: str) -> str:
    """Send Bitcoin using Bitcoin Core RPC"""
    try:
        import requests
        import json
        
        rpc_data = {
            'jsonrpc': '1.0',
            'id': withdrawal_id,
            'method': 'sendtoaddress',
            'params': [address, amount, f'Mining withdrawal {withdrawal_id}']
        }
        
        response = requests.post(
            BITCOIN_RPC_URL,
            auth=(BITCOIN_RPC_USER, BITCOIN_RPC_PASSWORD),
            data=json.dumps(rpc_data),
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if 'result' in result and result['result']:
                return result['result']  # Transaction hash
            else:
                raise Exception(f"RPC error: {result.get('error', 'Unknown error')}")
        else:
            raise Exception(f"RPC connection error: {response.status_code}")
            
    except Exception as e:
        logger.error(f"Bitcoin RPC withdrawal failed: {e}")
        raise e

async def demo_bitcoin_transaction(address: str, amount: float, withdrawal_id: str) -> str:
    """Simulate Bitcoin transaction for demo purposes"""
    try:
        # Simulate processing time
        await asyncio.sleep(2)
        
        # Generate a realistic-looking transaction hash for demo
        import hashlib
        tx_data = f"{withdrawal_id}{address}{amount}{datetime.utcnow().isoformat()}"
        tx_hash = hashlib.sha256(tx_data.encode()).hexdigest()
        
        logger.info(f"🎯 DEMO MODE: Simulated Bitcoin transaction - {amount} BTC to {address}")
        return tx_hash
        
    except Exception as e:
        logger.error(f"Demo transaction simulation failed: {e}")
        raise e

# Password reset endpoints
@app.post("/api/auth/forgot-password")
async def forgot_password(email_data: Dict[str, str]):
    """Send password reset email"""
    try:
        email = email_data.get("email", "").strip().lower()
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        # Check if user exists
        user = users_collection.find_one({"email": email})
        
        # Always return success for security (don't reveal if email exists)
        if user:
            # Generate reset token
            reset_token = str(uuid.uuid4())
            reset_expires = datetime.utcnow() + timedelta(hours=1)  # Token expires in 1 hour
            
            # Store reset token in database
            users_collection.update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "reset_token": reset_token,
                    "reset_token_expires": reset_expires
                }}
            )
            
            # In production, send email with reset link
            # For now, just log it
            logger.info(f"Password reset requested for {email}. Reset token: {reset_token}")
            
            # You would send an email with a link like:
            # https://your-app.com/reset-password?token={reset_token}
        
        return {"message": "If an account with this email exists, you will receive password reset instructions."}
        
    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception as e:
        logger.error(f"Error in forgot password: {e}")
        raise HTTPException(status_code=500, detail="Failed to process password reset request")

@app.post("/api/auth/reset-password")
async def reset_password(reset_data: Dict[str, str]):
    """Reset password using token"""
    try:
        token = reset_data.get("token", "").strip()
        new_password = reset_data.get("new_password", "").strip()
        
        if not token or not new_password:
            raise HTTPException(status_code=400, detail="Token and new password are required")
        
        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
        
        # Find user with valid reset token
        user = users_collection.find_one({
            "reset_token": token,
            "reset_token_expires": {"$gt": datetime.utcnow()}
        })
        
        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
        # Hash new password
        hashed_password = hash_password(new_password)
        
        # Update password and remove reset token
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "password_hash": hashed_password,
                "updated_at": datetime.utcnow()
            }, "$unset": {
                "reset_token": "",
                "reset_token_expires": ""
            }}
        )
        
        logger.info(f"Password reset successful for user {user['email']}")
        
        return {"message": "Password has been reset successfully. You can now log in with your new password."}
        
    except Exception as e:
        logger.error(f"Error in reset password: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset password")

# Reset test account endpoint
@app.post("/api/test/reset-account")
async def reset_test_account(current_user: Dict = Depends(get_current_user)):
    """Reset test account - clear balance and miners for testing"""
    try:
        user_id = current_user["id"]
        
        # Reset user balance and earnings
        users_collection.update_one(
            {"_id": user_id},
            {"$set": {
                "bitcoin_balance": 0.0,
                "total_earnings": 0.0,
                "total_referral_rewards": 0.0,
                "total_cashed_out": 0.0
            }}
        )
        
        # Remove all miners for this user
        miners_collection.delete_many({"user_id": user_id})
        
        # Remove all transactions for this user
        transactions_collection.delete_many({"user_id": user_id})
        
        # Remove all mining sessions for this user
        mining_sessions_collection.delete_many({"user_id": user_id})
        
        # Remove all purchases for this user
        purchases_collection.delete_many({"user_id": user_id})
        
        # Remove all withdrawals for this user
        db.withdrawals.delete_many({"user_id": user_id})
        
        logger.info(f"Test account reset completed for user {user_id}")
        
        return {
            "message": "Test account reset successfully",
            "reset_items": [
                "Bitcoin balance set to 0",
                "All miners removed",
                "All transactions cleared",
                "All mining sessions cleared",
                "All purchases cleared",
                "All withdrawals cleared"
            ]
        }
        
    except Exception as e:
        logger.error(f"Error resetting test account: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset test account")

# Health check
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Bitcoin Mining API is running"}

# Payment Processing System

class PaymentProcessor:
    def __init__(self):
        self.paypal_client = None
        self.setup_paypal()
    
    def setup_paypal(self):
        """Initialize PayPal SDK client"""
        try:
            from paypalcheckoutsdk.core import SandboxEnvironment, LiveEnvironment, PayPalHttpClient
            
            if PAYPAL_MODE == "live":
                environment = LiveEnvironment(client_id=PAYPAL_CLIENT_ID, client_secret=PAYPAL_CLIENT_SECRET)
            else:
                environment = SandboxEnvironment(client_id=PAYPAL_CLIENT_ID, client_secret=PAYPAL_CLIENT_SECRET)
            
            self.paypal_client = PayPalHttpClient(environment)
        except Exception as e:
            logger.error(f"Failed to setup PayPal client: {e}")
    
    def validate_promo_code(self, promo_code: str) -> Dict[str, Any]:
        """Validate promo code and return discount info"""
        if not promo_code:
            return {"valid": False, "discount_percent": 0}
        
        promo_code = promo_code.upper().strip()
        if promo_code in PROMO_CODES:
            promo_info = PROMO_CODES[promo_code]
            if promo_info["used"] < promo_info["max_uses"]:
                return {
                    "valid": True,
                    "discount_percent": promo_info["discount_percent"],
                    "code": promo_code
                }
        
        return {"valid": False, "discount_percent": 0}
    
    def apply_promo_code(self, promo_code: str):
        """Apply promo code and increment usage"""
        if promo_code and promo_code in PROMO_CODES:
            PROMO_CODES[promo_code]["used"] += 1
    
    def calculate_total_with_discount(self, original_price: float, discount_percent: int) -> Dict[str, float]:
        """Calculate final price with discount"""
        discount_amount = original_price * (discount_percent / 100)
        final_price = original_price - discount_amount
        
        return {
            "original_price": round(original_price, 2),
            "discount_percent": discount_percent,
            "discount_amount": round(discount_amount, 2),
            "final_price": round(final_price, 2)
        }

# Initialize payment processor
payment_processor = PaymentProcessor()

# Payment Processing Endpoints

@app.post("/api/payments/validate-promo")
async def validate_promo_code(promo_data: Dict[str, Any]):
    """Validate promo code"""
    try:
        promo_code = promo_data.get("promo_code", "")
        original_price = float(promo_data.get("price", 0))
        
        validation_result = payment_processor.validate_promo_code(promo_code)
        
        if validation_result["valid"]:
            pricing = payment_processor.calculate_total_with_discount(
                original_price, 
                validation_result["discount_percent"]
            )
            
            return {
                "valid": True,
                "promo_code": validation_result["code"],
                "discount_percent": validation_result["discount_percent"],
                **pricing
            }
        else:
            return {
                "valid": False,
                "message": "Invalid or expired promo code",
                "original_price": original_price,
                "final_price": original_price
            }
            
    except Exception as e:
        logger.error(f"Error validating promo code: {e}")
        raise HTTPException(status_code=400, detail="Invalid promo code request")

@app.post("/api/payments/create-paypal-order")
async def create_paypal_order(order_data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    """Create PayPal order for miner purchase"""
    try:
        from paypalcheckoutsdk.orders import OrdersCreateRequest
        
        miner_id = order_data.get("miner_id")
        promo_code = order_data.get("promo_code", "")
        subscription_type = order_data.get("subscription_type", "one_time")  # one_time or recurring
        
        # Get miner details
        store_miners = [
            {"id": "miner_100gh", "name": "Standard Miner", "hash_rate": 100.0, "price": 7.99, "duration_days": 30},
            {"id": "miner_200gh", "name": "Advanced Miner", "hash_rate": 200.0, "price": 14.99, "duration_days": 30},
            {"id": "miner_400gh", "name": "Pro Miner", "hash_rate": 400.0, "price": 29.99, "duration_days": 30},
            {"id": "miner_1th", "name": "Elite Miner", "hash_rate": 1000.0, "price": 79.99, "duration_days": 30},
            {"id": "miner_2th", "name": "Master Miner", "hash_rate": 2000.0, "price": 159.99, "duration_days": 30},
            {"id": "miner_4th", "name": "Supreme Miner", "hash_rate": 4000.0, "price": 299.99, "duration_days": 30},
            {"id": "miner_6th", "name": "Ultimate Miner", "hash_rate": 6000.0, "price": 449.99, "duration_days": 30},
            {"id": "miner_8th", "name": "Legendary Miner", "hash_rate": 8000.0, "price": 599.99, "duration_days": 30},
            {"id": "miner_10th", "name": "Mythical Miner", "hash_rate": 10000.0, "price": 999.99, "duration_days": 30}
        ]
        
        miner = next((m for m in store_miners if m["id"] == miner_id), None)
        if not miner:
            raise HTTPException(status_code=404, detail="Miner not found")
        
        # Apply promo code if provided
        original_price = miner["price"]
        promo_validation = payment_processor.validate_promo_code(promo_code)
        
        if promo_validation["valid"]:
            pricing = payment_processor.calculate_total_with_discount(
                original_price, 
                promo_validation["discount_percent"]
            )
            final_price = pricing["final_price"]
            discount_amount = pricing["discount_amount"]
        else:
            final_price = original_price
            discount_amount = 0
        
        # Create PayPal order
        request = OrdersCreateRequest()
        request.prefer('return=representation')
        
        order_body = {
            "intent": "CAPTURE",
            "application_context": {
                "brand_name": "Bitcoin Mining Simulator",
                "landing_page": "BILLING",
                "user_action": "PAY_NOW"
            },
            "purchase_units": [{
                "reference_id": f"{miner_id}_{current_user['id']}_{uuid.uuid4()}",
                "description": f"{miner['name']} - {miner['hash_rate']} GH/s for {miner['duration_days']} days",
                "amount": {
                    "currency_code": "USD",
                    "value": f"{final_price:.2f}",
                    "breakdown": {
                        "item_total": {
                            "currency_code": "USD",
                            "value": f"{final_price:.2f}"
                        }
                    }
                },
                "items": [{
                    "name": miner["name"],
                    "description": f"{miner['hash_rate']} GH/s mining power for {miner['duration_days']} days",
                    "unit_amount": {
                        "currency_code": "USD",
                        "value": f"{final_price:.2f}"
                    },
                    "quantity": "1",
                    "category": "DIGITAL_GOODS"
                }]
            }]
        }
        
        request.request_body(order_body)
        response = payment_processor.paypal_client.execute(request)
        
        # Store order information for later processing
        order_info = {
            "_id": response.result.id,
            "user_id": current_user["id"],
            "miner_id": miner_id,
            "miner_data": miner,
            "original_price": original_price,
            "final_price": final_price,
            "discount_amount": discount_amount,
            "promo_code": promo_code if promo_validation["valid"] else None,
            "subscription_type": subscription_type,
            "status": "created",
            "created_at": datetime.utcnow()
        }
        db.paypal_orders.insert_one(order_info)
        
        return {
            "order_id": response.result.id,
            "links": [{"rel": link.rel, "href": link.href} for link in response.result.links],
            "miner_name": miner["name"],
            "original_price": original_price,
            "final_price": final_price,
            "discount_amount": discount_amount,
            "promo_code": promo_code if promo_validation["valid"] else None
        }
        
    except Exception as e:
        logger.error(f"Error creating PayPal order: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment order")

@app.post("/api/payments/capture-paypal-order")
async def capture_paypal_order(order_data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    """Capture PayPal order and activate miner"""
    try:
        from paypalcheckoutsdk.orders import OrdersCaptureRequest
        
        order_id = order_data.get("order_id")
        if not order_id:
            raise HTTPException(status_code=400, detail="Order ID is required")
        
        # Get stored order information
        stored_order = db.paypal_orders.find_one({"_id": order_id})
        if not stored_order or stored_order["user_id"] != current_user["id"]:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Capture PayPal payment
        request = OrdersCaptureRequest(order_id)
        response = payment_processor.paypal_client.execute(request)
        
        if response.result.status == "COMPLETED":
            # Apply promo code if used
            if stored_order.get("promo_code"):
                payment_processor.apply_promo_code(stored_order["promo_code"])
            
            # Create and activate the miner
            miner_data = stored_order["miner_data"]
            new_miner = {
                "_id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "name": miner_data["name"],
                "hash_rate": miner_data["hash_rate"],
                "miner_type": "premium",
                "status": "active",  # Auto-activate premium miners
                "duration_hours": miner_data["duration_days"] * 24,
                "time_remaining": miner_data["duration_days"] * 24,
                "total_earned": 0.0,
                "purchase_price": stored_order["final_price"],
                "payment_method": "paypal",
                "payment_id": response.result.id,
                "activated_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(days=miner_data["duration_days"]),
                "created_at": datetime.utcnow()
            }
            
            miners_collection.insert_one(new_miner)
            
            # Update order status
            db.paypal_orders.update_one(
                {"_id": order_id},
                {"$set": {
                    "status": "completed",
                    "captured_at": datetime.utcnow(),
                    "miner_id": new_miner["_id"],
                    "payment_details": response.result.dict()
                }}
            )
            
            # Record transaction
            transaction_record = {
                "_id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "transaction_type": "miner_purchase",
                "amount": stored_order["final_price"],
                "currency": "USD",
                "payment_method": "paypal",
                "payment_id": response.result.id,
                "miner_id": new_miner["_id"],
                "miner_name": miner_data["name"],
                "description": f"Purchased {miner_data['name']} via PayPal",
                "promo_code": stored_order.get("promo_code"),
                "discount_amount": stored_order.get("discount_amount", 0),
                "created_at": datetime.utcnow()
            }
            transactions_collection.insert_one(transaction_record)
            
            return {
                "success": True,
                "message": "Payment completed and miner activated!",
                "miner_id": new_miner["_id"],
                "miner_name": miner_data["name"],
                "hash_rate": miner_data["hash_rate"],
                "duration_days": miner_data["duration_days"],
                "amount_paid": stored_order["final_price"],
                "payment_id": response.result.id,
                "expires_at": new_miner["expires_at"].isoformat()
            }
        else:
            raise HTTPException(status_code=400, detail="Payment capture failed")
            
    except Exception as e:
        logger.error(f"Error capturing PayPal order: {e}")
        raise HTTPException(status_code=500, detail="Failed to process payment")

@app.post("/api/payments/create-crypto-payment")
async def create_crypto_payment(payment_data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    """Create cryptocurrency payment via Coinbase Commerce"""
    try:
        miner_id = payment_data.get("miner_id")
        promo_code = payment_data.get("promo_code", "")
        
        # Get miner details (same as PayPal)
        store_miners = [
            {"id": "miner_100gh", "name": "Standard Miner", "hash_rate": 100.0, "price": 7.99, "duration_days": 30},
            {"id": "miner_200gh", "name": "Advanced Miner", "hash_rate": 200.0, "price": 14.99, "duration_days": 30},
            {"id": "miner_400gh", "name": "Pro Miner", "hash_rate": 400.0, "price": 29.99, "duration_days": 30},
            {"id": "miner_1th", "name": "Elite Miner", "hash_rate": 1000.0, "price": 79.99, "duration_days": 30},
            {"id": "miner_2th", "name": "Master Miner", "hash_rate": 2000.0, "price": 159.99, "duration_days": 30},
            {"id": "miner_4th", "name": "Supreme Miner", "hash_rate": 4000.0, "price": 299.99, "duration_days": 30},
            {"id": "miner_6th", "name": "Ultimate Miner", "hash_rate": 6000.0, "price": 449.99, "duration_days": 30},
            {"id": "miner_8th", "name": "Legendary Miner", "hash_rate": 8000.0, "price": 599.99, "duration_days": 30},
            {"id": "miner_10th", "name": "Mythical Miner", "hash_rate": 10000.0, "price": 999.99, "duration_days": 30}
        ]
        
        miner = next((m for m in store_miners if m["id"] == miner_id), None)
        if not miner:
            raise HTTPException(status_code=404, detail="Miner not found")
        
        # Apply promo code
        original_price = miner["price"]
        promo_validation = payment_processor.validate_promo_code(promo_code)
        
        if promo_validation["valid"]:
            pricing = payment_processor.calculate_total_with_discount(
                original_price, 
                promo_validation["discount_percent"]
            )
            final_price = pricing["final_price"]
            discount_amount = pricing["discount_amount"]
        else:
            final_price = original_price
            discount_amount = 0
        
        # Create Coinbase Commerce charge using API
        if not COINBASE_COMMERCE_API_KEY:
            raise HTTPException(status_code=500, detail="Cryptocurrency payments not configured")
        
        charge_data = {
            "name": f"{miner['name']} - Bitcoin Mining Rental",
            "description": f"{miner['name']} with {miner['hash_rate']} GH/s for {miner['duration_days']} days",
            "pricing_type": "fixed_price",
            "local_price": {
                "amount": f"{final_price:.2f}",
                "currency": "USD"
            },
            "metadata": {
                "user_id": current_user["id"],
                "miner_id": miner_id,
                "promo_code": promo_code if promo_validation["valid"] else None,
                "original_price": f"{original_price:.2f}",
                "discount_amount": f"{discount_amount:.2f}"
            }
        }
        
        # Make API request to Coinbase Commerce
        headers = {
            "Content-Type": "application/json",
            "X-CC-Api-Key": COINBASE_COMMERCE_API_KEY,
            "X-CC-Version": "2018-03-22"
        }
        
        response = requests.post(
            "https://api.commerce.coinbase.com/charges",
            json=charge_data,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 201:
            charge_result = response.json()
            charge_info = charge_result["data"]
            
            # Store charge info for webhook processing
            crypto_order = {
                "_id": charge_info["id"],
                "user_id": current_user["id"],
                "miner_id": miner_id,
                "miner_data": miner,
                "original_price": original_price,
                "final_price": final_price,
                "discount_amount": discount_amount,
                "promo_code": promo_code if promo_validation["valid"] else None,
                "status": "pending",
                "created_at": datetime.utcnow(),
                "expires_at": charge_info["expires_at"],
                "hosted_url": charge_info["hosted_url"]
            }
            db.crypto_orders.insert_one(crypto_order)
            
            return {
                "charge_id": charge_info["id"],
                "hosted_url": charge_info["hosted_url"],
                "miner_name": miner["name"],
                "original_price": original_price,
                "final_price": final_price,
                "discount_amount": discount_amount,
                "promo_code": promo_code if promo_validation["valid"] else None,
                "expires_at": charge_info["expires_at"]
            }
        else:
            logger.error(f"Coinbase Commerce API error: {response.text}")
            raise HTTPException(status_code=500, detail="Failed to create cryptocurrency payment")
            
    except Exception as e:
        logger.error(f"Error creating crypto payment: {e}")
        raise HTTPException(status_code=500, detail="Failed to create cryptocurrency payment")

@app.post("/api/payments/coinbase-webhook")
async def coinbase_webhook(request: Request):
    """Handle Coinbase Commerce webhook notifications"""
    try:
        body = await request.body()
        
        # Verify webhook signature if secret is configured
        if COINBASE_WEBHOOK_SECRET:
            signature = request.headers.get("X-CC-Webhook-Signature")
            if not signature:
                raise HTTPException(status_code=400, detail="Missing webhook signature")
            
            expected_signature = hmac.new(
                COINBASE_WEBHOOK_SECRET.encode('utf-8'),
                body,
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(expected_signature, signature):
                raise HTTPException(status_code=400, detail="Invalid webhook signature")
        
        # Parse webhook data
        webhook_data = json.loads(body.decode('utf-8'))
        event_type = webhook_data.get("type")
        charge_data = webhook_data.get("data", {})
        
        charge_id = charge_data.get("id")
        if not charge_id:
            return {"status": "ignored", "reason": "no_charge_id"}
        
        # Get stored order
        stored_order = db.crypto_orders.find_one({"_id": charge_id})
        if not stored_order:
            return {"status": "ignored", "reason": "order_not_found"}
        
        if event_type == "charge:confirmed":
            # Payment confirmed - activate miner
            if stored_order.get("promo_code"):
                payment_processor.apply_promo_code(stored_order["promo_code"])
            
            miner_data = stored_order["miner_data"]
            new_miner = {
                "_id": str(uuid.uuid4()),
                "user_id": stored_order["user_id"],
                "name": miner_data["name"],
                "hash_rate": miner_data["hash_rate"],
                "miner_type": "premium",
                "status": "active",  # Auto-activate premium miners
                "duration_hours": miner_data["duration_days"] * 24,
                "time_remaining": miner_data["duration_days"] * 24,
                "total_earned": 0.0,
                "purchase_price": stored_order["final_price"],
                "payment_method": "cryptocurrency",
                "payment_id": charge_id,
                "activated_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(days=miner_data["duration_days"]),
                "created_at": datetime.utcnow()
            }
            
            miners_collection.insert_one(new_miner)
            
            # Update order status
            db.crypto_orders.update_one(
                {"_id": charge_id},
                {"$set": {
                    "status": "completed",
                    "confirmed_at": datetime.utcnow(),
                    "miner_id": new_miner["_id"]
                }}
            )
            
            # Record transaction
            transaction_record = {
                "_id": str(uuid.uuid4()),
                "user_id": stored_order["user_id"],
                "transaction_type": "miner_purchase",
                "amount": stored_order["final_price"],
                "currency": "USD",
                "payment_method": "cryptocurrency",
                "payment_id": charge_id,
                "miner_id": new_miner["_id"],
                "miner_name": miner_data["name"],
                "description": f"Purchased {miner_data['name']} via cryptocurrency",
                "promo_code": stored_order.get("promo_code"),
                "discount_amount": stored_order.get("discount_amount", 0),
                "created_at": datetime.utcnow()
            }
            transactions_collection.insert_one(transaction_record)
            
            logger.info(f"Cryptocurrency payment confirmed and miner activated: {new_miner['_id']}")
        
        elif event_type == "charge:failed":
            # Payment failed
            db.crypto_orders.update_one(
                {"_id": charge_id},
                {"$set": {
                    "status": "failed",
                    "failed_at": datetime.utcnow()
                }}
            )
            logger.info(f"Cryptocurrency payment failed: {charge_id}")
        
        return {"status": "processed", "event": event_type}
        
    except Exception as e:
        logger.error(f"Error processing Coinbase webhook: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

@app.get("/api/payments/available-promos")
async def get_available_promos():
    """Get available promo codes for frontend display"""
    try:
        available_promos = []
        for code, info in PROMO_CODES.items():
            if info["used"] < info["max_uses"]:
                available_promos.append({
                    "code": code,
                    "discount_percent": info["discount_percent"],
                    "remaining_uses": info["max_uses"] - info["used"]
                })
        
        return {
            "available_promos": available_promos,
            "total_available": len(available_promos)
        }
        
    except Exception as e:
        logger.error(f"Error getting available promos: {e}")
        return {"available_promos": [], "total_available": 0}

@app.get("/api/payments/user-purchases")
async def get_user_purchases(current_user: Dict = Depends(get_current_user)):
    """Get user's purchase history"""
    try:
        # Get transactions
        user_transactions = list(transactions_collection.find({
            "user_id": current_user["id"],
            "transaction_type": "miner_purchase"
        }).sort("created_at", -1))
        
        # Convert ObjectId to string and format for frontend
        formatted_transactions = []
        for transaction in user_transactions:
            formatted_transactions.append({
                "transaction_id": transaction["_id"],
                "amount": transaction["amount"],
                "currency": transaction.get("currency", "USD"),
                "payment_method": transaction["payment_method"],
                "miner_name": transaction["miner_name"],
                "description": transaction["description"],
                "promo_code": transaction.get("promo_code"),
                "discount_amount": transaction.get("discount_amount", 0),
                "created_at": transaction["created_at"].isoformat(),
                "status": "completed"
            })
        
        return {
            "purchases": formatted_transactions,
            "total_purchases": len(formatted_transactions),
            "total_spent": sum(t["amount"] for t in user_transactions)
        }
        
    except Exception as e:
        logger.error(f"Error getting user purchases: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve purchase history")

# Add payment configuration to .env file
@app.post("/api/admin/configure-payments")
async def configure_payments(config_data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    """Admin endpoint to configure payment settings"""
    try:
        # This would be protected with admin authentication in production
        if current_user["email"] != "admin@example.com":  # Simple admin check
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Update payment configuration
        # In production, this would update environment variables or database config
        
        return {"message": "Payment configuration updated successfully"}
        
    except Exception as e:
        logger.error(f"Error configuring payments: {e}")
        raise HTTPException(status_code=500, detail="Failed to configure payments")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)