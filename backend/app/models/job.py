"""Job-related models."""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class ApplicationStatus(str, enum.Enum):
    APPLIED = "applied"
    REVIEWED = "reviewed"
    INTERVIEWED = "interviewed"
    REJECTED = "rejected"
    OFFER = "offer"


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    location = Column(String(100), default="")
    website = Column(String(255), default="")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class JobPosting(Base):
    __tablename__ = "job_postings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    required_skills = Column(String(500), default="")
    location = Column(String(100), default="")
    is_remote = Column(Boolean, default=False)
    salary_range = Column(String(100), default="")
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    posted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    deadline = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("job_postings.id"), nullable=False)
    applicant_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cover_note = Column(Text, default="")
    resume_path = Column(String(500), default="")
    status = Column(SAEnum(ApplicationStatus), default=ApplicationStatus.APPLIED)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
