"""Job-related models."""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class ApplicationStatus(str, enum.Enum):
    APPLIED = "applied"
    REVIEWED = "reviewed"
    INTERVIEWED = "interviewed"
    REJECTED = "rejected"
    OFFER = "offer"


class JobType(str, enum.Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    INTERNSHIP = "internship"
    CONTRACT = "contract"


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    location = Column(String(100), default="")
    website = Column(String(255), default="")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", foreign_keys=[owner_id])
    job_postings = relationship("JobPosting", back_populates="company")


class JobPosting(Base):
    __tablename__ = "job_postings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    required_skills = Column(String(500), default="")
    location = Column(String(100), default="")
    is_remote = Column(Boolean, default=False)
    job_type = Column(SAEnum(JobType), default=JobType.FULL_TIME, nullable=False)
    salary_range = Column(String(100), default="")
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    posted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    deadline = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="job_postings")
    poster = relationship("User", foreign_keys=[posted_by])
    applications = relationship("Application", back_populates="job")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("job_postings.id"), nullable=False)
    applicant_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cover_note = Column(Text, default="")
    resume_path = Column(String(500), default="")
    status = Column(SAEnum(ApplicationStatus), default=ApplicationStatus.APPLIED)
    reviewer_note = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    job = relationship("JobPosting", back_populates="applications")
    applicant = relationship("User", foreign_keys=[applicant_id])
