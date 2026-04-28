"""Accounts router - registration, login, OTP, 2FA, profile, education, experience, connections, privacy."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import time
import logging
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from typing import List, Optional

from app.core.database import get_db
from app.core.config import settings
from app.core.security import create_access_token, generate_otp, hash_otp, verify_otp
from app.core.dependencies import get_current_user, get_current_active_user
from app.core.email_service import send_otp_email
from app.core.audit import log_event
from app.core.pki import generate_user_keypair
from app.models.user import (
    User, UserRole, Education, Experience, ProfilePrivacy,
    Connection, ConnectionStatus, ProfileView, PrivacyLevel,
)
from app.schemas.user import (
    UserCreate, UserResponse, PublicUserResponse, Token,
    OTPRequest, OTPVerify, LoginOTPRequest, LoginOTPVerify, ConnectionResponse,
)
from app.schemas.profile import (
    ProfileUpdate, EducationCreate, EducationResponse,
    ExperienceCreate, ExperienceResponse, PrivacySettingsUpdate,
)

router = APIRouter(prefix="/accounts", tags=["Accounts"])
logger = logging.getLogger("securejob.accounts")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")

_register_attempts: dict[str, list[datetime]] = defaultdict(list)
REGISTER_MAX_PER_HOUR = 5
LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCKOUT_MINUTES = 15


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_registration_rate(ip: str):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=1)
    _register_attempts[ip] = [t for t in _register_attempts[ip] if t > cutoff]
    if len(_register_attempts[ip]) >= REGISTER_MAX_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many registrations. Try again in an hour.")
    _register_attempts[ip].append(now)


def _check_login_lockout(user: User):
    if user.login_locked_until:
        lock_time = user.login_locked_until.replace(tzinfo=timezone.utc) if user.login_locked_until.tzinfo is None else user.login_locked_until
        if datetime.now(timezone.utc) < lock_time:
            remaining = int((lock_time - datetime.now(timezone.utc)).total_seconds() / 60) + 1
            raise HTTPException(status_code=403, detail=f"Account locked. Try again in {remaining} minutes.")
        user.login_attempts = 0
        user.login_locked_until = None


def _check_rate_limit(user: User, db: Session):
    now = datetime.now(timezone.utc)
    if not user.otp_requests_window_start or (now - user.otp_requests_window_start.replace(tzinfo=timezone.utc)) > timedelta(hours=1):
        user.otp_requests_count = 0
        user.otp_requests_window_start = now
    if user.otp_requests_count >= settings.OTP_RATE_LIMIT_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many OTP requests. Try again in an hour.")
    user.otp_requests_count += 1
    db.flush()


def _send_otp(user: User, method: str, db: Session):
    otp = generate_otp()
    otp_hash = hash_otp(otp)
    expire_time = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
    user.email_otp = otp_hash
    user.otp_expires_at = expire_time
    user.otp_attempts = 0
    db.commit()
    send_otp_email(user.email, otp)
    return "email"


def _send_action_otp(user: User, purpose: str, db: Session):
    """Send OTP for high-risk action verification."""
    otp = generate_otp()
    otp_hash = hash_otp(otp)
    expire_time = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
    user.action_otp = otp_hash
    user.action_otp_expires_at = expire_time
    user.action_otp_purpose = purpose
    db.commit()
    send_otp_email(user.email, otp, subject=f"SecureAJob - Action Verification ({purpose})")
    return expire_time


def _verify_action_otp(user: User, code: str, purpose: str, db: Session):
    """Verify OTP for a high-risk action. Raises HTTPException on failure."""
    if not user.action_otp or not user.action_otp_expires_at:
        raise HTTPException(status_code=400, detail="No pending action OTP. Request one first.")
    if user.action_otp_purpose != purpose:
        raise HTTPException(status_code=400, detail="OTP was issued for a different action.")
    expires = user.action_otp_expires_at.replace(tzinfo=timezone.utc) if user.action_otp_expires_at.tzinfo is None else user.action_otp_expires_at
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one.")
    if not verify_otp(code, user.action_otp):
        raise HTTPException(status_code=401, detail="Invalid OTP.")
    user.action_otp = None
    user.action_otp_expires_at = None
    user.action_otp_purpose = None
    db.flush()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _is_connection(user_id: int, other_id: int, db: Session) -> bool:
    return db.query(Connection).filter(
        ((Connection.requester_id == user_id) & (Connection.addressee_id == other_id) |
         (Connection.requester_id == other_id) & (Connection.addressee_id == user_id)),
        Connection.status == ConnectionStatus.ACCEPTED
    ).first() is not None


def _apply_privacy(profile_data: dict, privacy: Optional[ProfilePrivacy],
                   is_owner: bool, is_connection: bool) -> dict:
    """Redact fields based on privacy settings and viewer relationship."""
    if is_owner:
        return profile_data
    if not privacy:
        return profile_data

    def can_see(level: PrivacyLevel) -> bool:
        if level == PrivacyLevel.PUBLIC:
            return True
        if level == PrivacyLevel.CONNECTIONS:
            return is_connection
        return False  # PRIVATE

    redacted = {**profile_data}
    if not can_see(privacy.email_visibility):
        redacted.pop("email", None)
    if not can_see(privacy.phone_visibility):
        redacted.pop("phone", None)
    if not can_see(privacy.location_visibility):
        redacted.pop("location", None)
    if not can_see(privacy.bio_visibility):
        redacted.pop("bio", None)
    if not can_see(privacy.education_visibility):
        redacted.pop("educations", None)
    if not can_see(privacy.experience_visibility):
        redacted.pop("experiences", None)
    if not can_see(privacy.skills_visibility):
        redacted.pop("skills", None)
    if not can_see(privacy.connections_visibility):
        redacted.pop("connections_count", None)
    return redacted


@router.get("/health")
def health_check():
    return {"status": "healthy", "service": "accounts"}


# ─── REGISTRATION ────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, request: Request, db: Session = Depends(get_db)):
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
        role=UserRole(user_data.role),
    )
    db.add(user)
    db.flush()

    # Generate RSA key pair for this user
    try:
        pub_pem, enc_priv_pem = generate_user_keypair()
        user.rsa_public_key = pub_pem
        user.rsa_private_key_enc = enc_priv_pem
    except Exception as e:
        logger.warning("Failed to generate RSA key pair for user: %s", e)

    # Create default privacy settings
    privacy = ProfilePrivacy(user_id=user.id)
    db.add(privacy)

    try:
        actual_method = _send_otp(user, "email", db)
        log_event(db, action="user.register", request=request, user_id=user.id,
                  target_type="user", target_id=user.id, detail=user.username)
        db.commit()
        db.refresh(user)
        logger.info("New user registered: %s (ID: %d)", user.username, user.id)
        return {
            "message": "User registered successfully. An OTP has been sent.",
            "method": actual_method,
            "identifier": user.email,
        }
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username or email already taken")
    except Exception as e:
        db.rollback()
        logger.error("Failed to send OTP during registration: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to send verification code. Please try again.")


# ─── LOGIN ───────────────────────────────────────────────────────────────────

@router.post("/login/request-otp")
def request_login_otp(req: LoginOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.email == req.identifier) |
        (User.phone == req.identifier) |
        (User.username == req.identifier)
    ).first()
    if not user:
        time.sleep(0.5)
        return {"message": "If the account exists, an OTP has been sent.", "method": "unknown"}
    _check_login_lockout(user)
    _check_rate_limit(user, db)
    actual_method = _send_otp(user, "email", db)
    return {
        "message": "OTP sent.",
        "method": actual_method,
        "requires_totp": user.totp_enabled,
    }


@router.post("/login/verify-otp", response_model=Token)
def verify_login_otp(req: LoginOTPVerify, db: Session = Depends(get_db)):
    time.sleep(0.5)
    user = db.query(User).filter(
        (User.email == req.identifier) |
        (User.phone == req.identifier) |
        (User.username == req.identifier)
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid OTP or user")

    if user.is_suspended:
        raise HTTPException(status_code=403, detail="Account suspended. Contact support.")

    _check_login_lockout(user)

    if not user.otp_expires_at or user.otp_expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one.")

    if not user.email_otp or not verify_otp(req.code, user.email_otp):
        user.login_attempts = (user.login_attempts or 0) + 1
        if user.login_attempts >= LOGIN_MAX_ATTEMPTS:
            user.login_locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
            db.commit()
            raise HTTPException(status_code=403, detail=f"Too many failed attempts. Account locked for {LOGIN_LOCKOUT_MINUTES} minutes.")
        db.commit()
        remaining = LOGIN_MAX_ATTEMPTS - user.login_attempts
        raise HTTPException(status_code=401, detail=f"Invalid OTP. {remaining} attempt(s) remaining.")

    # Check 2FA TOTP if enabled
    if user.totp_enabled:
        if not req.totp_code:
            raise HTTPException(status_code=400, detail="TOTP code required for 2FA.")
        import pyotp
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(req.totp_code, valid_window=1):
            raise HTTPException(status_code=401, detail="Invalid TOTP code.")

    user.is_email_verified = True
    user.email_otp = None
    user.login_attempts = 0
    user.login_locked_until = None

    token = create_access_token(data={"sub": user.username, "role": user.role.value})
    log_event(db, action="user.login", user_id=user.id, target_type="user", target_id=user.id, detail=user.username)
    db.commit()
    logger.info("User logged in: %s", user.username)
    return {"access_token": token}


# ─── PROFILE ─────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def get_user_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_user_me(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    update_data = profile_data.model_dump(exclude_unset=True)
    ALLOWED = {"full_name", "headline", "location", "bio", "phone", "skills", "profile_views_opt_out"}
    for key, value in update_data.items():
        if key in ALLOWED:
            setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users/{user_id}")
def get_public_profile(
    user_id: int,
    request: Request,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a user's public profile (respects privacy settings)."""
    user = db.query(User).filter(User.id == user_id, User.is_active == True, User.is_suspended == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_owner = current_user is not None and current_user.id == user_id
    is_connection = False
    if current_user and not is_owner:
        is_connection = _is_connection(current_user.id, user_id, db)

    # Track profile view
    if current_user and not is_owner and not current_user.profile_views_opt_out:
        view = ProfileView(viewer_id=current_user.id, viewed_id=user_id)
        db.add(view)
        db.commit()

    privacy = user.privacy_settings
    profile = {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name or "",
        "headline": user.headline or "",
        "location": user.location or "",
        "bio": user.bio or "",
        "email": user.email,
        "phone": user.phone or "",
        "skills": user.skills or [],
        "rsa_public_key": user.rsa_public_key,
        "educations": [{"id": e.id, "institution": e.institution, "degree": e.degree,
                        "field_of_study": e.field_of_study, "start_year": e.start_year,
                        "end_year": e.end_year, "description": e.description}
                       for e in user.educations],
        "experiences": [{"id": e.id, "company": e.company, "title": e.title,
                         "location": e.location, "start_date": e.start_date,
                         "end_date": e.end_date, "is_current": e.is_current,
                         "description": e.description}
                        for e in user.experiences],
        "connections_count": db.query(Connection).filter(
            ((Connection.requester_id == user_id) | (Connection.addressee_id == user_id)),
            Connection.status == ConnectionStatus.ACCEPTED
        ).count(),
        "created_at": user.created_at,
    }
    return _apply_privacy(profile, privacy, is_owner, is_connection)


# ─── EDUCATION ───────────────────────────────────────────────────────────────

@router.post("/me/education", response_model=EducationResponse, status_code=201)
def add_education(
    data: EducationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    edu = Education(user_id=current_user.id, **data.model_dump())
    db.add(edu)
    db.commit()
    db.refresh(edu)
    return edu


@router.put("/me/education/{edu_id}", response_model=EducationResponse)
def update_education(
    edu_id: int,
    data: EducationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    edu = db.query(Education).filter(Education.id == edu_id, Education.user_id == current_user.id).first()
    if not edu:
        raise HTTPException(status_code=404, detail="Education entry not found")
    for k, v in data.model_dump().items():
        setattr(edu, k, v)
    db.commit()
    db.refresh(edu)
    return edu


@router.delete("/me/education/{edu_id}", status_code=204)
def delete_education(
    edu_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    edu = db.query(Education).filter(Education.id == edu_id, Education.user_id == current_user.id).first()
    if not edu:
        raise HTTPException(status_code=404, detail="Education entry not found")
    db.delete(edu)
    db.commit()


# ─── EXPERIENCE ──────────────────────────────────────────────────────────────

@router.post("/me/experience", response_model=ExperienceResponse, status_code=201)
def add_experience(
    data: ExperienceCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    exp = Experience(user_id=current_user.id, **data.model_dump())
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.put("/me/experience/{exp_id}", response_model=ExperienceResponse)
def update_experience(
    exp_id: int,
    data: ExperienceCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    exp = db.query(Experience).filter(Experience.id == exp_id, Experience.user_id == current_user.id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience entry not found")
    for k, v in data.model_dump().items():
        setattr(exp, k, v)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/me/experience/{exp_id}", status_code=204)
def delete_experience(
    exp_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    exp = db.query(Experience).filter(Experience.id == exp_id, Experience.user_id == current_user.id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience entry not found")
    db.delete(exp)
    db.commit()


# ─── PRIVACY SETTINGS ────────────────────────────────────────────────────────

@router.get("/me/privacy")
def get_privacy_settings(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    privacy = current_user.privacy_settings
    if not privacy:
        privacy = ProfilePrivacy(user_id=current_user.id)
        db.add(privacy)
        db.commit()
        db.refresh(privacy)
    return {c.name: getattr(privacy, c.name) for c in privacy.__table__.columns}


@router.put("/me/privacy")
def update_privacy_settings(
    data: PrivacySettingsUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    privacy = current_user.privacy_settings
    if not privacy:
        privacy = ProfilePrivacy(user_id=current_user.id)
        db.add(privacy)
        db.flush()

    update = data.model_dump(exclude_unset=True)
    for k, v in update.items():
        if v is not None:
            setattr(privacy, k, PrivacyLevel(v))
    db.commit()
    return {"message": "Privacy settings updated"}


# ─── PROFILE VIEWERS ─────────────────────────────────────────────────────────

@router.get("/me/viewers")
def get_profile_viewers(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get recent profile viewers (last 20). Excludes users who opted out."""
    views = (
        db.query(ProfileView)
        .filter(ProfileView.viewed_id == current_user.id)
        .order_by(ProfileView.viewed_at.desc())
        .limit(50)
        .all()
    )
    viewer_ids_seen = set()
    result = []
    for v in views:
        if v.viewer_id in viewer_ids_seen:
            continue
        viewer_ids_seen.add(v.viewer_id)
        viewer = db.query(User).filter(User.id == v.viewer_id).first()
        if viewer and not viewer.profile_views_opt_out:
            result.append({
                "viewer_id": viewer.id,
                "viewer_username": viewer.username,
                "viewer_name": viewer.full_name or viewer.username,
                "viewed_at": v.viewed_at,
            })
        if len(result) >= 20:
            break

    total = db.query(ProfileView).filter(ProfileView.viewed_id == current_user.id).count()
    return {"total_views": total, "recent_viewers": result}


# ─── CONNECTIONS ─────────────────────────────────────────────────────────────

@router.post("/connections/request/{addressee_id}", status_code=201)
def send_connection_request(
    addressee_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if addressee_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot connect with yourself")
    addressee = db.query(User).filter(User.id == addressee_id, User.is_active == True).first()
    if not addressee:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(Connection).filter(
        ((Connection.requester_id == current_user.id) & (Connection.addressee_id == addressee_id)) |
        ((Connection.requester_id == addressee_id) & (Connection.addressee_id == current_user.id))
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Connection request already exists")
    conn = Connection(requester_id=current_user.id, addressee_id=addressee_id)
    db.add(conn)
    db.commit()
    return {"message": "Connection request sent", "connection_id": conn.id}


@router.put("/connections/{connection_id}/accept")
def accept_connection(
    connection_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    conn = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.addressee_id == current_user.id,
        Connection.status == ConnectionStatus.PENDING,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Pending connection request not found")
    conn.status = ConnectionStatus.ACCEPTED
    db.commit()
    return {"message": "Connection accepted"}


@router.delete("/connections/{connection_id}", status_code=204)
def remove_connection(
    connection_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    conn = db.query(Connection).filter(
        Connection.id == connection_id,
        (Connection.requester_id == current_user.id) | (Connection.addressee_id == current_user.id),
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()


@router.get("/connections")
def list_connections(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """List current user's accepted connections."""
    connections = db.query(Connection).filter(
        ((Connection.requester_id == current_user.id) | (Connection.addressee_id == current_user.id)),
        Connection.status == ConnectionStatus.ACCEPTED,
    ).all()
    result = []
    for c in connections:
        other_id = c.addressee_id if c.requester_id == current_user.id else c.requester_id
        other = db.query(User).filter(User.id == other_id).first()
        result.append({
            "connection_id": c.id,
            "user_id": other_id,
            "username": other.username if other else "",
            "full_name": other.full_name if other else "",
            "headline": other.headline if other else "",
            "connected_at": c.updated_at,
        })
    return result


@router.get("/connections/pending")
def list_pending_requests(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """List incoming pending connection requests."""
    pending = db.query(Connection).filter(
        Connection.addressee_id == current_user.id,
        Connection.status == ConnectionStatus.PENDING,
    ).all()
    result = []
    for c in pending:
        requester = db.query(User).filter(User.id == c.requester_id).first()
        result.append({
            "connection_id": c.id,
            "requester_id": c.requester_id,
            "username": requester.username if requester else "",
            "full_name": requester.full_name if requester else "",
            "requested_at": c.created_at,
        })
    return result


# ─── OTP FOR HIGH-RISK ACTIONS ───────────────────────────────────────────────

@router.post("/action-otp/request")
def request_action_otp(
    purpose: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Request an OTP for a high-risk action (resume_download, delete_account, password_reset)."""
    ALLOWED_PURPOSES = {"resume_download", "delete_account", "password_reset", "totp_disable"}
    if purpose not in ALLOWED_PURPOSES:
        raise HTTPException(status_code=400, detail=f"Unknown purpose. Allowed: {ALLOWED_PURPOSES}")
    _check_rate_limit(current_user, db)
    expires_at = _send_action_otp(current_user, purpose, db)
    return {"message": "Action OTP sent to your email.", "expires_at": expires_at}


@router.post("/action-otp/verify")
def verify_action_otp_endpoint(
    purpose: str,
    code: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Verify action OTP — returns a one-time token usable for the protected action."""
    _verify_action_otp(current_user, code, purpose, db)
    db.commit()
    # Issue a short-lived token scoped to this action
    token = create_access_token(
        data={"sub": current_user.username, "role": current_user.role.value, "action": purpose},
        expires_delta=timedelta(minutes=5),
    )
    return {"verified": True, "action_token": token}


# ─── PASSWORD RESET ──────────────────────────────────────────────────────────

@router.post("/password-reset/request")
def request_password_reset(email: str, db: Session = Depends(get_db)):
    """Request a password reset OTP (public endpoint)."""
    user = db.query(User).filter(User.email == email).first()
    if user:
        _send_action_otp(user, "password_reset", db)
    # Always return same message (prevent enumeration)
    return {"message": "If the email exists, a reset OTP has been sent."}


@router.post("/password-reset/verify")
def verify_password_reset(
    email: str,
    code: str,
    db: Session = Depends(get_db),
):
    """Verify password reset OTP and return a reset token."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request.")
    _verify_action_otp(user, code, "password_reset", db)
    db.commit()
    token = create_access_token(
        data={"sub": user.username, "role": user.role.value, "action": "password_reset"},
        expires_delta=timedelta(minutes=10),
    )
    return {"reset_token": token}


# ─── ACCOUNT DELETION ────────────────────────────────────────────────────────

@router.delete("/me", status_code=204)
def delete_account(
    otp_code: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete own account — requires action OTP verification."""
    _verify_action_otp(current_user, otp_code, "delete_account", db)
    log_event(db, action="user.delete", user_id=current_user.id,
              target_type="user", target_id=current_user.id, detail=current_user.username)
    db.delete(current_user)
    db.commit()


# ─── 2FA / TOTP ──────────────────────────────────────────────────────────────

@router.post("/2fa/setup")
def setup_totp(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Generate a TOTP secret and return the provisioning URI for a QR code."""
    import pyotp
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current_user.email, issuer_name="SecureAJob")
    # Store secret temporarily (not yet enabled)
    current_user.totp_secret = secret
    db.commit()
    return {"secret": secret, "provisioning_uri": uri}


@router.post("/2fa/enable")
def enable_totp(
    totp_code: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Confirm TOTP setup by verifying the first code."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="Run /2fa/setup first.")
    import pyotp
    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(totp_code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code.")
    current_user.totp_enabled = True
    db.commit()
    return {"message": "2FA enabled successfully."}


@router.post("/2fa/disable")
def disable_totp(
    otp_code: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Disable 2FA — requires action OTP verification."""
    _verify_action_otp(current_user, otp_code, "totp_disable", db)
    current_user.totp_enabled = False
    current_user.totp_secret = None
    db.commit()
    return {"message": "2FA disabled."}


# ─── EXISTING OTP ENDPOINTS ──────────────────────────────────────────────────

def _check_otp_lockout(user: User):
    if user.otp_locked_until:
        lock_time = user.otp_locked_until.replace(tzinfo=timezone.utc) if user.otp_locked_until.tzinfo is None else user.otp_locked_until
        if datetime.now(timezone.utc) < lock_time:
            remaining = int((lock_time - datetime.now(timezone.utc)).total_seconds() / 60) + 1
            raise HTTPException(status_code=403, detail=f"OTP locked. Try again in {remaining} minutes.")


@router.post("/resend-otp")
def resend_otp(otp_req: OTPRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_otp_lockout(current_user)
    _check_rate_limit(current_user, db)
    _send_otp(current_user, "email", db)
    return {"message": f"OTP sent to your email. Valid for {settings.OTP_EXPIRY_MINUTES} minutes."}


@router.post("/verify-otp")
def verify_otp_endpoint(otp_data: OTPVerify, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_otp_lockout(current_user)
    if not current_user.otp_expires_at or current_user.otp_expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
    if not current_user.email_otp or not verify_otp(otp_data.code, current_user.email_otp):
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
    return {"message": "Email verified successfully!"}


# ─── PUBLIC KEY ──────────────────────────────────────────────────────────────

@router.get("/users/{user_id}/pubkey")
def get_user_public_key(user_id: int, db: Session = Depends(get_db)):
    """Return a user's RSA public key (used for E2EE / message verification)."""
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user or not user.rsa_public_key:
        raise HTTPException(status_code=404, detail="Public key not found")
    return {"user_id": user_id, "public_key": user.rsa_public_key}
