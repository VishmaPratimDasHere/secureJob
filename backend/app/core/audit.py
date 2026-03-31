"""Audit logging helper — call from any router to record an event."""

from typing import Optional
from sqlalchemy.orm import Session
from fastapi import Request
from app.models.audit import AuditLog


def log_event(
    db: Session,
    *,
    action: str,
    request: Optional[Request] = None,
    user_id: Optional[int] = None,
    target_type: str = "",
    target_id: Optional[int] = None,
    detail: str = "",
):
    ip = ""
    if request:
        forwarded = request.headers.get("X-Forwarded-For")
        ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "")

    entry = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=detail,
        ip_address=ip,
    )
    db.add(entry)
    db.flush()
