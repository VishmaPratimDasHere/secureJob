"""Jobs router - company pages, job postings, applications."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.job import Company, JobPosting
from app.schemas.job import CompanyCreate, CompanyResponse, JobPostingCreate, JobPostingResponse

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("/health")
def health_check():
    return {"status": "healthy", "service": "jobs"}


@router.get("/postings", response_model=list[JobPostingResponse])
def list_jobs(db: Session = Depends(get_db)):
    """List all active job postings."""
    return db.query(JobPosting).filter(JobPosting.is_active == True).all()


@router.get("/companies", response_model=list[CompanyResponse])
def list_companies(db: Session = Depends(get_db)):
    """List all companies."""
    return db.query(Company).all()
