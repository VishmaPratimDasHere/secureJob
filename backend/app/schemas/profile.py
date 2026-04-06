"""Profile schemas for user profile updates, education, experience, privacy."""

from pydantic import BaseModel, validator
from typing import Optional, List
import re


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    headline: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[List[str]] = None
    profile_views_opt_out: Optional[bool] = None

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

    @validator('skills')
    def validate_skills(cls, v):
        if v is not None:
            if len(v) > 30:
                raise ValueError('Maximum 30 skills allowed')
            v = [s.strip()[:50] for s in v if s.strip()]
        return v


class EducationCreate(BaseModel):
    institution: str
    degree: Optional[str] = ""
    field_of_study: Optional[str] = ""
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    description: Optional[str] = ""

    @validator('institution')
    def validate_institution(cls, v):
        if not v or len(v.strip()) < 1:
            raise ValueError('Institution name is required')
        return v.strip()[:200]


class EducationResponse(BaseModel):
    id: int
    institution: str
    degree: str
    field_of_study: str
    start_year: Optional[int]
    end_year: Optional[int]
    description: str

    class Config:
        from_attributes = True


class ExperienceCreate(BaseModel):
    company: str
    title: str
    location: Optional[str] = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: Optional[bool] = False
    description: Optional[str] = ""

    @validator('company', 'title')
    def validate_required(cls, v):
        if not v or len(v.strip()) < 1:
            raise ValueError('Field is required')
        return v.strip()[:200]


class ExperienceResponse(BaseModel):
    id: int
    company: str
    title: str
    location: str
    start_date: Optional[str]
    end_date: Optional[str]
    is_current: bool
    description: str

    class Config:
        from_attributes = True


class PrivacySettingsUpdate(BaseModel):
    email_visibility: Optional[str] = None
    phone_visibility: Optional[str] = None
    location_visibility: Optional[str] = None
    bio_visibility: Optional[str] = None
    education_visibility: Optional[str] = None
    experience_visibility: Optional[str] = None
    skills_visibility: Optional[str] = None
    connections_visibility: Optional[str] = None

    @validator('email_visibility', 'phone_visibility', 'location_visibility',
               'bio_visibility', 'education_visibility', 'experience_visibility',
               'skills_visibility', 'connections_visibility')
    def validate_privacy_level(cls, v):
        if v is not None and v not in ('public', 'connections', 'private'):
            raise ValueError('Must be public, connections, or private')
        return v
