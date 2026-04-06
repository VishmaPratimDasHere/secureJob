"""User schemas for request/response validation."""

from pydantic import BaseModel, EmailStr, validator
from datetime import datetime
import re
from typing import Optional, Literal, List


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str = ""
    phone: Optional[str] = None
    role: Literal["job_seeker", "recruiter"] = "job_seeker"

    @validator('username')
    def validate_username(cls, v):
        if not re.match(r'^[a-zA-Z0-9_]{3,30}$', v):
            raise ValueError('Username must be 3-30 characters, only letters, numbers, and underscores')
        return v

    @validator('phone')
    def validate_phone(cls, v):
        if v and not re.match(r'^\+?[1-9]\d{1,14}$', v):
            raise ValueError('Invalid phone number format')
        return v


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    full_name: str
    headline: str
    location: str
    bio: str = ""
    phone: str = ""
    skills: Optional[List[str]] = []
    is_active: bool
    is_suspended: bool = False
    is_email_verified: bool = False
    is_phone_verified: bool = False
    totp_enabled: bool = False
    profile_views_opt_out: bool = False
    rsa_public_key: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PublicUserResponse(BaseModel):
    """Public profile — only fields allowed by privacy settings."""
    id: int
    username: str
    full_name: str
    headline: str
    location: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[List[str]] = None
    rsa_public_key: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OTPRequest(BaseModel):
    method: Literal["email", "phone"]


class OTPVerify(BaseModel):
    method: Literal["email", "phone"]
    code: str


class LoginOTPRequest(BaseModel):
    identifier: str  # email, phone, or username


class LoginOTPVerify(BaseModel):
    identifier: str
    code: str
    totp_code: Optional[str] = None   # required if 2FA is enabled


class ConnectionResponse(BaseModel):
    id: int
    requester_id: int
    addressee_id: int
    status: str
    requester_name: Optional[str] = None
    addressee_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
