"""Profile schemas for user profile updates."""

from pydantic import BaseModel, validator
from typing import Optional
import re

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    headline: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None

    @validator('full_name')
    def validate_full_name(cls, v):
        if v is not None and len(v) > 100:
            raise ValueError('Full name must be at most 100 characters')
        return v

    @validator('headline')
    def validate_headline(cls, v):
        if v is not None and len(v) > 200:
            raise ValueError('Headline must be at most 200 characters')
        return v

    @validator('location')
    def validate_location(cls, v):
        if v is not None and len(v) > 100:
            raise ValueError('Location must be at most 100 characters')
        return v

    @validator('bio')
    def validate_bio(cls, v):
        if v is not None and len(v) > 1000:
            raise ValueError('Bio must be at most 1000 characters')
        return v

    @validator('phone')
    def validate_phone(cls, v):
        if v is not None and v and not re.match(r'^\+?[1-9]\d{1,14}$', v):
            raise ValueError('Invalid phone number format')
        return v
