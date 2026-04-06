"""User model."""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SAEnum, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    JOB_SEEKER = "job_seeker"
    RECRUITER = "recruiter"
    ADMIN = "admin"


class PrivacyLevel(str, enum.Enum):
    PUBLIC = "public"
    CONNECTIONS = "connections"
    PRIVATE = "private"


class ConnectionStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"


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
    skills = Column(JSON, default=list)           # list of skill strings

    # Privacy opt-outs
    profile_views_opt_out = Column(Boolean, default=False)  # hide from viewer lists

    # PKI — per-user RSA key pair for message signing / E2EE
    rsa_public_key = Column(Text, nullable=True)   # PEM, shared publicly
    rsa_private_key_enc = Column(Text, nullable=True)  # PEM, encrypted at rest

    # 2FA / TOTP
    totp_secret = Column(String(64), nullable=True)
    totp_enabled = Column(Boolean, default=False)

    # Verification
    is_active = Column(Boolean, default=True)
    is_suspended = Column(Boolean, default=False)
    is_email_verified = Column(Boolean, default=False)
    is_phone_verified = Column(Boolean, default=False)
    email_otp = Column(String(64), nullable=True)  # SHA-256 hash
    phone_otp = Column(String(64), nullable=True)  # SHA-256 hash
    otp_expires_at = Column(DateTime(timezone=True), nullable=True)

    # High-risk action OTP (separate from login OTP)
    action_otp = Column(String(64), nullable=True)
    action_otp_expires_at = Column(DateTime(timezone=True), nullable=True)
    action_otp_purpose = Column(String(50), nullable=True)  # e.g. "resume_download", "delete_account"

    # OTP Security — Rate Limiting & Attempt Tracking
    otp_attempts = Column(Integer, default=0)
    otp_locked_until = Column(DateTime(timezone=True), nullable=True)
    otp_requests_count = Column(Integer, default=0)
    otp_requests_window_start = Column(DateTime(timezone=True), nullable=True)

    # Login Security — Rate Limiting & Lockout
    login_attempts = Column(Integer, default=0)
    login_locked_until = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    educations = relationship("Education", back_populates="user", cascade="all, delete-orphan")
    experiences = relationship("Experience", back_populates="user", cascade="all, delete-orphan")
    privacy_settings = relationship("ProfilePrivacy", back_populates="user", uselist=False, cascade="all, delete-orphan")
    sent_connections = relationship("Connection", foreign_keys="Connection.requester_id", back_populates="requester", cascade="all, delete-orphan")
    received_connections = relationship("Connection", foreign_keys="Connection.addressee_id", back_populates="addressee", cascade="all, delete-orphan")


class Education(Base):
    __tablename__ = "educations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    institution = Column(String(200), nullable=False)
    degree = Column(String(100), default="")
    field_of_study = Column(String(100), default="")
    start_year = Column(Integer, nullable=True)
    end_year = Column(Integer, nullable=True)
    description = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="educations")


class Experience(Base):
    __tablename__ = "experiences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company = Column(String(200), nullable=False)
    title = Column(String(200), nullable=False)
    location = Column(String(100), default="")
    start_date = Column(String(20), nullable=True)   # "2022-06"
    end_date = Column(String(20), nullable=True)     # null = current
    is_current = Column(Boolean, default=False)
    description = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="experiences")


class ProfilePrivacy(Base):
    """Per-field privacy settings for a user's profile."""
    __tablename__ = "profile_privacy"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    email_visibility = Column(SAEnum(PrivacyLevel), default=PrivacyLevel.PRIVATE)
    phone_visibility = Column(SAEnum(PrivacyLevel), default=PrivacyLevel.PRIVATE)
    location_visibility = Column(SAEnum(PrivacyLevel), default=PrivacyLevel.PUBLIC)
    bio_visibility = Column(SAEnum(PrivacyLevel), default=PrivacyLevel.PUBLIC)
    education_visibility = Column(SAEnum(PrivacyLevel), default=PrivacyLevel.PUBLIC)
    experience_visibility = Column(SAEnum(PrivacyLevel), default=PrivacyLevel.PUBLIC)
    skills_visibility = Column(SAEnum(PrivacyLevel), default=PrivacyLevel.PUBLIC)
    connections_visibility = Column(SAEnum(PrivacyLevel), default=PrivacyLevel.CONNECTIONS)

    user = relationship("User", back_populates="privacy_settings")


class Connection(Base):
    """Professional connection between two users."""
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    addressee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(SAEnum(ConnectionStatus), default=ConnectionStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    requester = relationship("User", foreign_keys=[requester_id], back_populates="sent_connections")
    addressee = relationship("User", foreign_keys=[addressee_id], back_populates="received_connections")


class ProfileView(Base):
    """Tracks who viewed whose profile."""
    __tablename__ = "profile_views"

    id = Column(Integer, primary_key=True, index=True)
    viewer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    viewed_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    viewed_at = Column(DateTime(timezone=True), server_default=func.now())

    viewer = relationship("User", foreign_keys=[viewer_id])
    viewed = relationship("User", foreign_keys=[viewed_id])
