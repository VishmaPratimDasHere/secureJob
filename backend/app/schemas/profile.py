"""Profile schemas for user profile updates."""

from pydantic import BaseModel
from typing import Optional

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    headline: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
