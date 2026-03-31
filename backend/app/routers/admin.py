"""Admin router - dashboards, stats, moderation, and audit logs."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_admin_user
from app.models.user import User
from app.models.job import JobPosting, Application
from app.models.audit import AuditLog
from app.schemas.user import UserResponse
from app.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=list[UserResponse])
def admin_list_users(
    skip: int = Query(0, ge=0, le=10000), 
    limit: int = Query(100, ge=1, le=500),
    current_admin: User = Depends(get_current_admin_user), 
    db: Session = Depends(get_db)
):
    """List all users (Admin only)."""
    return db.query(User).offset(skip).limit(limit).all()


@router.get("/stats")
def admin_platform_stats(
    current_admin: User = Depends(get_current_admin_user), 
    db: Session = Depends(get_db)
):
    """Get basic platform statistics (Admin only)."""
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    
    total_jobs = db.query(JobPosting).count()
    active_jobs = db.query(JobPosting).filter(JobPosting.is_active == True).count()

    total_applications = db.query(Application).count()
    
    return {
        "users": {
            "total": total_users,
            "active": active_users
        },
        "jobs": {
            "total": total_jobs,
            "active": active_jobs
        },
        "applications": {
            "total": total_applications
        }
    }


@router.get("/logs", response_model=list[AuditLogResponse])
def admin_audit_logs(
    skip: int = Query(0, ge=0, le=10000),
    limit: int = Query(100, ge=1, le=500),
    action: str = Query("", description="Filter by action prefix, e.g. 'user.login'", max_length=100),
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Get audit logs (Admin only). Most recent first."""
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.ilike(f"{action}%"))
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for log in logs:
        d = {c.name: getattr(log, c.name) for c in log.__table__.columns}
        d["username"] = (log.user.username if log.user else "system")
        results.append(d)
    return results
