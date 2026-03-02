"""Accounts router - registration, login, OTP verification, profile."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
import time
import logging
from datetime import datetime, timedelta, timezone
from collections import defaultdict

from app.core.database import get_db
from app.core.config import settings
from app.core.security import create_access_token, generate_otp, hash_otp, verify_otp
from app.core.dependencies import get_current_user, get_current_active_user
from app.core.email_service import send_otp_email
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token, OTPRequest, OTPVerify, LoginOTPRequest, LoginOTPVerify
from app.schemas.profile import ProfileUpdate

router = APIRouter(prefix="/accounts", tags=["Accounts"])
logger = logging.getLogger("securejob.otp")

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")

# ─── In-memory rate limiters ────────────────────────────────────────────────
_register_attempts: dict[str, list[datetime]] = defaultdict(list)
REGISTER_MAX_PER_HOUR = 5

LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCKOUT_MINUTES = 15


def _get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_registration_rate(ip: str):
    """Enforce max registrations per IP per hour."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=1)
    _register_attempts[ip] = [t for t in _register_attempts[ip] if t > cutoff]
    if len(_register_attempts[ip]) >= REGISTER_MAX_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many registrations. Try again in an hour.")
    _register_attempts[ip].append(now)


@router.get("/health")
def health_check():
    return {"status": "healthy", "service": "accounts"}


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _check_login_lockout(user: User):
    """Block login if account is locked from too many failed attempts."""
    if user.login_locked_until:
        lock_time = user.login_locked_until.replace(tzinfo=timezone.utc) if user.login_locked_until.tzinfo is None else user.login_locked_until
        if datetime.now(timezone.utc) < lock_time:
            remaining = int((lock_time - datetime.now(timezone.utc)).total_seconds() / 60) + 1
            raise HTTPException(
                status_code=403,
                detail=f"Account locked due to too many failed login attempts. Try again in {remaining} minutes."
            )
        user.login_attempts = 0
        user.login_locked_until = None

def _check_rate_limit(user: User, db: Session):
    """Enforce max 5 OTP requests per hour."""
    now = datetime.now(timezone.utc)
    if not user.otp_requests_window_start or (now - user.otp_requests_window_start.replace(tzinfo=timezone.utc)) > timedelta(hours=1):
        user.otp_requests_count = 0
        user.otp_requests_window_start = now

    if user.otp_requests_count >= settings.OTP_RATE_LIMIT_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many OTP requests. Try again in an hour.")

    user.otp_requests_count += 1
    db.flush()

def _send_otp(user: User, method: str, db: Session):
    """Generates, hashes, stores, and sends an OTP via email."""
    otp = generate_otp()
    otp_hash = hash_otp(otp)
    expire_time = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

    # Always send via email
    user.email_otp = otp_hash
    user.otp_expires_at = expire_time
    user.otp_attempts = 0
    db.commit()
    send_otp_email(user.email, otp)
    return "email"


# ─── REGISTRATION ────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, request: Request, db: Session = Depends(get_db)):
    """Register a new user (passwordless). Automatically sends an OTP."""
    _check_registration_rate(_get_client_ip(request))

    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        phone=user_data.phone,
    )
    db.add(user)
    
    # We flush to get the user ID, but don't commit yet.
    db.flush()

    # Automatically send OTP via email
    method = "email"
    try:
        actual_method = _send_otp(user, method, db)
        db.commit() # Commit only if OTP succeeded
        db.refresh(user)
        logger.info("New user registered: %s (ID: %d)", user.username, user.id)
        
        return {
            "message": "User registered successfully. An OTP has been sent.",
            "method": actual_method,
            "identifier": user.phone if actual_method == "phone" else user.email
        }
    except Exception as e:
        db.rollback() # Rollback user creation
        logger.error("Failed to send OTP during registration: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to send verification code. Please try again.")


# ─── LOGIN (PASSWORDLESS) ────────────────────────────────────────────────────

@router.post("/login/request-otp")
def request_login_otp(req: LoginOTPRequest, db: Session = Depends(get_db)):
    """Request an OTP for passwordless login."""
    user = db.query(User).filter(
        (User.email == req.identifier) | 
        (User.phone == req.identifier) | 
        (User.username == req.identifier)
    ).first()
    
    if not user:
        time.sleep(0.5)
        # return success anyway to prevent enumeration
        return {"message": "If the account exists, an OTP has been sent.", "method": "unknown"}

    _check_login_lockout(user)
    _check_rate_limit(user, db)

    actual_method = _send_otp(user, "email", db)
    return {"message": "OTP sent.", "method": actual_method}


@router.post("/login/verify-otp", response_model=Token)
def verify_login_otp(req: LoginOTPVerify, db: Session = Depends(get_db)):
    """Verify login OTP and return JWT token."""
    time.sleep(0.5)
    
    user = db.query(User).filter(
        (User.email == req.identifier) | 
        (User.phone == req.identifier) | 
        (User.username == req.identifier)
    ).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP or user")

    _check_login_lockout(user)

    if not user.otp_expires_at or user.otp_expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one.")

    stored_otp_hash = user.email_otp

    if not stored_otp_hash or not verify_otp(req.code, stored_otp_hash):
        user.login_attempts = (user.login_attempts or 0) + 1
        if user.login_attempts >= LOGIN_MAX_ATTEMPTS:
            user.login_locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
            db.commit()
            raise HTTPException(status_code=403, detail=f"Too many failed login attempts. Account locked for {LOGIN_LOCKOUT_MINUTES} minutes.")
        db.commit()
        remaining = LOGIN_MAX_ATTEMPTS - user.login_attempts
        raise HTTPException(status_code=401, detail=f"Invalid OTP. {remaining} attempt(s) remaining.")

    # Success
    user.is_email_verified = True
    user.email_otp = None
        
    user.login_attempts = 0
    user.login_locked_until = None
    db.commit()

    token = create_access_token(data={"sub": user.username, "role": user.role.value})
    logger.info("User logged in via OTP: %s", user.username)
    return {"access_token": token}


# ─── PROFILE ─────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def get_user_me(current_user: User = Depends(get_current_active_user)):
    """Get the currently logged-in user profile."""
    return current_user


@router.put("/me", response_model=UserResponse)
def update_user_me(
    profile_data: ProfileUpdate, 
    current_user: User = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Update the currently logged-in user profile."""
    update_data = profile_data.model_dump(exclude_unset=True)
    ALLOWED_FIELDS = {"full_name", "headline", "location", "bio", "phone"}
    for key, value in update_data.items():
        if key in ALLOWED_FIELDS:
            setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user


# ─── EXTRA VERIFICATION (FOR LOGGED IN USERS) ────────────────────────────────

def _check_otp_lockout(user: User):
    if user.otp_locked_until:
        lock_time = user.otp_locked_until.replace(tzinfo=timezone.utc) if user.otp_locked_until.tzinfo is None else user.otp_locked_until
        if datetime.now(timezone.utc) < lock_time:
            remaining = int((lock_time - datetime.now(timezone.utc)).total_seconds() / 60) + 1
            raise HTTPException(status_code=403, detail=f"OTP locked. Try again in {remaining} minutes.")

@router.post("/resend-otp")
def resend_otp(otp_req: OTPRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate and send an OTP via email or SMS for an existing logged-in user."""
    _check_otp_lockout(current_user)
    _check_rate_limit(current_user, db)

    _send_otp(current_user, "email", db)
    return {"message": f"OTP sent to your email. Valid for {settings.OTP_EXPIRY_MINUTES} minutes."}


@router.post("/verify-otp")
def verify_otp_endpoint(otp_data: OTPVerify, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Verify an OTP code for an existing logged-in user."""
    _check_otp_lockout(current_user)

    if not current_user.otp_expires_at or current_user.otp_expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    stored_otp_hash = current_user.email_otp

    if not stored_otp_hash or not verify_otp(otp_data.code, stored_otp_hash):
        current_user.otp_attempts = (current_user.otp_attempts or 0) + 1
        if current_user.otp_attempts >= settings.OTP_MAX_ATTEMPTS:
            current_user.otp_locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)
            db.commit()
            raise HTTPException(status_code=403, detail="Too many failed attempts. Account locked for 30 minutes.")
        db.commit()
        remaining = settings.OTP_MAX_ATTEMPTS - current_user.otp_attempts
        raise HTTPException(status_code=400, detail=f"Invalid OTP. {remaining} attempt(s) remaining.")

    current_user.is_email_verified = True
    current_user.email_otp = None

    current_user.otp_attempts = 0
    current_user.otp_locked_until = None
    db.commit()

    return {"message": f"{otp_data.method.capitalize()} verified successfully!"}
