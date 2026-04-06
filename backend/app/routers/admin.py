"""Admin router — dashboards, stats, moderation, audit logs, chain verification."""

from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_admin_user
from app.core.audit import log_event, verify_chain
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
    db: Session = Depends(get_db),
):
    """List all users (Admin only)."""
    return db.query(User).offset(skip).limit(limit).all()


@router.get("/stats")
def admin_platform_stats(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    suspended_users = db.query(User).filter(User.is_suspended == True).count()
    total_jobs = db.query(JobPosting).count()
    active_jobs = db.query(JobPosting).filter(JobPosting.is_active == True).count()
    total_applications = db.query(Application).count()
    return {
        "users": {"total": total_users, "active": active_users, "suspended": suspended_users},
        "jobs": {"total": total_jobs, "active": active_jobs},
        "applications": {"total": total_applications},
    }


@router.put("/users/{user_id}/suspend")
def suspend_user(
    user_id: int,
    reason: str = "",
    request: Request = None,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Suspend a user account (Admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role.value == "admin":
        raise HTTPException(status_code=403, detail="Cannot suspend admin accounts")
    user.is_suspended = True
    user.is_active = False
    log_event(db, action="admin.suspend_user", request=request, user_id=current_admin.id,
              target_type="user", target_id=user_id, detail=f"Suspended {user.username}: {reason}")
    db.commit()
    return {"message": f"User {user.username} suspended"}


@router.put("/users/{user_id}/unsuspend")
def unsuspend_user(
    user_id: int,
    request: Request = None,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Reinstate a suspended user account (Admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_suspended = False
    user.is_active = True
    log_event(db, action="admin.unsuspend_user", request=request, user_id=current_admin.id,
              target_type="user", target_id=user_id, detail=f"Reinstated {user.username}")
    db.commit()
    return {"message": f"User {user.username} reinstated"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    request: Request = None,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Permanently delete a user account (Admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=403, detail="Cannot delete your own admin account")
    if user.role.value == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin accounts")
    username = user.username
    log_event(db, action="admin.delete_user", request=request, user_id=current_admin.id,
              target_type="user", target_id=user_id, detail=f"Deleted user {username}")
    db.delete(user)
    db.commit()
    return {"message": f"User {username} deleted"}


@router.get("/logs", response_model=list[AuditLogResponse])
def admin_audit_logs(
    skip: int = Query(0, ge=0, le=10000),
    limit: int = Query(100, ge=1, le=500),
    action: str = Query("", description="Filter by action prefix", max_length=100),
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
        d["username"] = log.user.username if log.user else "system"
        results.append(d)
    return results


@router.get("/logs/verify")
def verify_audit_chain(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Verify the tamper-evident audit log hash chain (Admin only)."""
    return verify_chain(db)
