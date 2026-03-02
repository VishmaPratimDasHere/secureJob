"""Admin router - dashboards, stats, and moderation."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_admin_user
from app.models.user import User
from app.models.job import JobPosting
from app.schemas.user import UserResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=list[UserResponse])
def admin_list_users(
    skip: int = 0, 
    limit: int = 100,
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
    
    return {
        "users": {
            "total": total_users,
            "active": active_users
        },
        "jobs": {
            "total": total_jobs,
            "active": active_jobs
        }
    }
