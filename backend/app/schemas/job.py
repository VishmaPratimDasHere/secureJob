"""Job-related schemas."""

from pydantic import BaseModel, validator
from datetime import datetime
from typing import Optional


# ─── Company ──────────────────────────────────────────────────────────────────

class CompanyCreate(BaseModel):
    name: str
    description: str = ""
    location: str = ""
    website: str = ""

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Company name is required')
        if len(v) > 200:
            raise ValueError('Company name must be at most 200 characters')
        return v.strip()

    @validator('description')
    def validate_description(cls, v):
        if v and len(v) > 5000:
            raise ValueError('Description must be at most 5000 characters')
        return v

    @validator('website')
    def validate_website(cls, v):
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError('Website must start with http:// or https://')
        if v and len(v) > 500:
            raise ValueError('Website URL must be at most 500 characters')
        return v


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None

    @validator('name')
    def validate_name(cls, v):
        if v is not None and len(v) > 200:
            raise ValueError('Company name must be at most 200 characters')
        return v

    @validator('website')
    def validate_website(cls, v):
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError('Website must start with http:// or https://')
        return v


class CompanyResponse(BaseModel):
    id: int
    name: str
    description: str
    location: str
    website: str
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Job Posting ──────────────────────────────────────────────────────────────

class JobPostingCreate(BaseModel):
    title: str
    description: str
    required_skills: str = ""
    location: str = ""
    is_remote: bool = False
    salary_range: str = ""
    company_id: int
    deadline: Optional[datetime] = None

    @validator('title')
    def validate_title(cls, v):
        if not v or not v.strip():
            raise ValueError('Job title is required')
        if len(v) > 200:
            raise ValueError('Title must be at most 200 characters')
        return v.strip()

    @validator('description')
    def validate_description(cls, v):
        if not v or not v.strip():
            raise ValueError('Job description is required')
        if len(v) > 10000:
            raise ValueError('Description must be at most 10000 characters')
        return v


class JobPostingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[str] = None
    location: Optional[str] = None
    is_remote: Optional[bool] = None
    salary_range: Optional[str] = None
    is_active: Optional[bool] = None
    deadline: Optional[datetime] = None


class JobPostingResponse(BaseModel):
    id: int
    title: str
    description: str
    required_skills: str
    location: str
    is_remote: bool
    salary_range: str
    company_id: int
    posted_by: int
    is_active: bool
    deadline: Optional[datetime] = None
    created_at: datetime
    company_name: str = ""

    class Config:
        from_attributes = True


# ─── Application ──────────────────────────────────────────────────────────────

class ApplicationCreate(BaseModel):
    job_id: int
    cover_note: str = ""


class ApplicationStatusUpdate(BaseModel):
    status: str          # "reviewed", "interviewed", "rejected", "offer"
    reviewer_note: str = ""


class ApplicationResponse(BaseModel):
    id: int
    job_id: int
    applicant_id: int
    cover_note: str
    resume_path: str
    status: str
    reviewer_note: str = ""
    created_at: datetime
    updated_at: datetime
    job_title: str = ""
    company_name: str = ""
    applicant_name: str = ""

    class Config:
        from_attributes = True
