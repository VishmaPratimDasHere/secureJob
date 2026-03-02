"""User schemas for request/response validation."""

from pydantic import BaseModel, EmailStr, validator
from datetime import datetime
import re
from typing import Optional, Literal


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str = ""
    phone: Optional[str] = None

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
    is_active: bool
    is_email_verified: bool = False
    is_phone_verified: bool = False
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
    identifier: str  # email or phone

class LoginOTPVerify(BaseModel):
    identifier: str
    code: str
