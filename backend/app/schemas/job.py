"""Job-related schemas."""

from pydantic import BaseModel
from datetime import datetime


class CompanyCreate(BaseModel):
    name: str
    description: str = ""
    location: str = ""
    website: str = ""


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


class JobPostingCreate(BaseModel):
    title: str
    description: str
    required_skills: str = ""
    location: str = ""
    is_remote: bool = False
    salary_range: str = ""
    company_id: int


class JobPostingResponse(BaseModel):
    id: int
    title: str
    description: str
    required_skills: str
    location: str
    is_remote: bool
    salary_range: str
    company_id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
