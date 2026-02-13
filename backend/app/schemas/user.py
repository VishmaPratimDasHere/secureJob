"""User schemas for request/response validation."""

from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str = ""


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    full_name: str
    headline: str
    location: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
