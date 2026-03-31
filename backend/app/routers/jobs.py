"""Jobs router — company CRUD, job postings CRUD, search, and applications."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.audit import log_event
from app.models.user import User, UserRole
from app.models.job import Company, JobPosting, Application, ApplicationStatus
from app.schemas.job import (
    CompanyCreate, CompanyUpdate, CompanyResponse,
    JobPostingCreate, JobPostingUpdate, JobPostingResponse,
    ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse,
)

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("/health")
def health_check():
    return {"status": "healthy", "service": "jobs"}


# ═══════════════════════════════════════════════════════════════════════════════
# COMPANIES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/companies", response_model=list[CompanyResponse])
def list_companies(db: Session = Depends(get_db)):
    """List all companies (public)."""
    return db.query(Company).all()


@router.get("/my-companies", response_model=list[CompanyResponse])
def my_companies(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List companies owned by the current user."""
    return db.query(Company).filter(Company.owner_id == current_user.id).all()


@router.get("/companies/{company_id}", response_model=CompanyResponse)
def get_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.post("/companies", response_model=CompanyResponse, status_code=201)
def create_company(
    data: CompanyCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a company (recruiter or admin)."""
    if current_user.role not in (UserRole.RECRUITER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only recruiters can create companies")
    company = Company(**data.model_dump(), owner_id=current_user.id)
    db.add(company)
    db.flush()
    log_event(db, action="company.create", request=request, user_id=current_user.id,
              target_type="company", target_id=company.id, detail=company.name)
    db.commit()
    db.refresh(company)
    return company


@router.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    data: CompanyUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(company, k, v)
    log_event(db, action="company.update", request=request, user_id=current_user.id,
              target_type="company", target_id=company.id)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/companies/{company_id}", status_code=204)
def delete_company(
    company_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    log_event(db, action="company.delete", request=request, user_id=current_user.id,
              target_type="company", target_id=company.id, detail=company.name)
    db.delete(company)
    db.commit()


@router.get("/companies/{company_id}/jobs", response_model=list[JobPostingResponse])
def list_company_jobs(company_id: int, db: Session = Depends(get_db)):
    """Jobs belonging to a company."""
    jobs = db.query(JobPosting).filter(
        JobPosting.company_id == company_id, JobPosting.is_active == True
    ).all()
    return [_job_to_response(j) for j in jobs]


# ═══════════════════════════════════════════════════════════════════════════════
# JOB POSTINGS
# ═══════════════════════════════════════════════════════════════════════════════

def _job_to_response(job: JobPosting) -> dict:
    d = {c.name: getattr(job, c.name) for c in job.__table__.columns}
    d["company_name"] = job.company.name if job.company else ""
    return d


@router.get("/postings", response_model=list[JobPostingResponse])
def list_jobs(
    q: str = Query("", description="Search in title, skills, location", max_length=200),
    location: str = Query("", description="Filter by location", max_length=100),
    remote: Optional[bool] = Query(None, description="Filter remote jobs"),
    skip: int = Query(0, ge=0, le=10000),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List/search active job postings (public)."""
    query = db.query(JobPosting).join(Company).filter(JobPosting.is_active == True)

    if q:
        pattern = f"%{q}%"
        query = query.filter(
            or_(
                JobPosting.title.ilike(pattern),
                JobPosting.required_skills.ilike(pattern),
                JobPosting.location.ilike(pattern),
                Company.name.ilike(pattern),
            )
        )
    if location:
        query = query.filter(JobPosting.location.ilike(f"%{location}%"))
    if remote is not None:
        query = query.filter(JobPosting.is_remote == remote)

    jobs = query.offset(skip).limit(limit).all()
    return [_job_to_response(j) for j in jobs]


@router.get("/postings/{job_id}", response_model=JobPostingResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_response(job)


@router.post("/postings", response_model=JobPostingResponse, status_code=201)
def create_job(
    data: JobPostingCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a job posting (recruiter who owns the company, or admin)."""
    company = db.query(Company).filter(Company.id == data.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="You don't own this company")

    job = JobPosting(**data.model_dump(), posted_by=current_user.id)
    db.add(job)
    db.flush()
    log_event(db, action="job.create", request=request, user_id=current_user.id,
              target_type="job", target_id=job.id, detail=job.title)
    db.commit()
    db.refresh(job)
    return _job_to_response(job)


@router.put("/postings/{job_id}", response_model=JobPostingResponse)
def update_job(
    job_id: int,
    data: JobPostingUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.posted_by != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(job, k, v)
    log_event(db, action="job.update", request=request, user_id=current_user.id,
              target_type="job", target_id=job.id)
    db.commit()
    db.refresh(job)
    return _job_to_response(job)


@router.delete("/postings/{job_id}", status_code=204)
def delete_job(
    job_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.posted_by != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    log_event(db, action="job.delete", request=request, user_id=current_user.id,
              target_type="job", target_id=job.id, detail=job.title)
    db.delete(job)
    db.commit()


# Recruiter convenience: my own job postings
@router.get("/my-postings", response_model=list[JobPostingResponse])
def my_postings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    jobs = db.query(JobPosting).filter(JobPosting.posted_by == current_user.id).all()
    return [_job_to_response(j) for j in jobs]


# ═══════════════════════════════════════════════════════════════════════════════
# APPLICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _app_to_response(app: Application) -> dict:
    d = {c.name: getattr(app, c.name) for c in app.__table__.columns}
    d["status"] = app.status.value if app.status else "applied"
    d["job_title"] = app.job.title if app.job else ""
    d["company_name"] = app.job.company.name if app.job and app.job.company else ""
    d["applicant_name"] = app.applicant.full_name or app.applicant.username if app.applicant else ""
    return d


@router.post("/applications", response_model=ApplicationResponse, status_code=201)
def apply_to_job(
    data: ApplicationCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Apply to a job posting (job_seeker only)."""
    if current_user.role != UserRole.JOB_SEEKER:
        raise HTTPException(status_code=403, detail="Only job seekers can apply")

    job = db.query(JobPosting).filter(JobPosting.id == data.job_id, JobPosting.is_active == True).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or inactive")

    existing = db.query(Application).filter(
        Application.job_id == data.job_id, Application.applicant_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already applied to this job")

    app = Application(
        job_id=data.job_id,
        applicant_id=current_user.id,
        cover_note=data.cover_note,
    )
    db.add(app)
    db.flush()
    log_event(db, action="application.create", request=request, user_id=current_user.id,
              target_type="application", target_id=app.id, detail=f"Applied to job {job.title}")
    db.commit()
    db.refresh(app)
    return _app_to_response(app)


@router.get("/applications/mine", response_model=list[ApplicationResponse])
def my_applications(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get all applications by the current job seeker."""
    apps = db.query(Application).filter(Application.applicant_id == current_user.id).all()
    return [_app_to_response(a) for a in apps]


@router.get("/postings/{job_id}/applications", response_model=list[ApplicationResponse])
def list_job_applications(
    job_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List applications for a specific job (recruiter who posted it, or admin)."""
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.posted_by != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    apps = db.query(Application).filter(Application.job_id == job_id).all()
    return [_app_to_response(a) for a in apps]


@router.put("/applications/{application_id}/status", response_model=ApplicationResponse)
def update_application_status(
    application_id: int,
    data: ApplicationStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update application status (recruiter who owns the job, or admin)."""
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.posted_by != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        new_status = ApplicationStatus(data.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {[s.value for s in ApplicationStatus]}")

    old_status = app.status.value
    app.status = new_status
    if data.reviewer_note:
        app.reviewer_note = data.reviewer_note
    log_event(db, action="application.status_change", request=request, user_id=current_user.id,
              target_type="application", target_id=app.id,
              detail=f"{old_status} -> {new_status.value}")
    db.commit()
    db.refresh(app)
    return _app_to_response(app)
