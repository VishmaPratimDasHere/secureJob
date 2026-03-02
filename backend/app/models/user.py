"""User model."""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    JOB_SEEKER = "job_seeker"
    RECRUITER = "recruiter"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    role = Column(SAEnum(UserRole), default=UserRole.JOB_SEEKER, nullable=False)

    # Profile fields
    full_name = Column(String(100), default="")
    headline = Column(String(200), default="")
    location = Column(String(100), default="")
    bio = Column(String(1000), default="")
    phone = Column(String(15), default="")

    # Verification
    is_active = Column(Boolean, default=True)
    is_email_verified = Column(Boolean, default=False)
    is_phone_verified = Column(Boolean, default=False)
    email_otp = Column(String(64), nullable=True)  # SHA-256 hash
    phone_otp = Column(String(64), nullable=True)  # SHA-256 hash
    otp_expires_at = Column(DateTime(timezone=True), nullable=True)

    # OTP Security — Rate Limiting & Attempt Tracking
    otp_attempts = Column(Integer, default=0)           # wrong attempts counter
    otp_locked_until = Column(DateTime(timezone=True), nullable=True)  # lockout timestamp
    otp_requests_count = Column(Integer, default=0)     # requests this hour
    otp_requests_window_start = Column(DateTime(timezone=True), nullable=True)  # hour window start

    # Login Security — Rate Limiting & Lockout
    login_attempts = Column(Integer, default=0)
    login_locked_until = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
