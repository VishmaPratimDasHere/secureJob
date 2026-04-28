"""Audit logging helper — tamper-evident hash-chained log."""

import hashlib
import json
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import Request
from app.models.audit import AuditLog


def _compute_entry_hash(prev_hash: str, user_id: Optional[int], action: str,
                         target_type: str, target_id: Optional[int],
                         detail: str, ip_address: str, created_at_str: str) -> str:
    """Compute SHA-256 hash chaining this entry to the previous one."""
    content = json.dumps({
        "prev_hash": prev_hash,
        "user_id": user_id,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "detail": detail,
        "ip_address": ip_address,
        "created_at": created_at_str,
    }, sort_keys=True)
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


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

    # Get previous entry hash for chain
    last_entry = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    prev_hash = last_entry.entry_hash if last_entry and last_entry.entry_hash else "0" * 64

    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).isoformat()

    entry_hash = _compute_entry_hash(
        prev_hash, user_id, action, target_type, target_id, detail, ip, now_str
    )

    entry = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=detail,
        ip_address=ip,
        prev_hash=prev_hash,
        entry_hash=entry_hash,
    )
    db.add(entry)
    db.flush()


def verify_chain(db: Session) -> dict:
    """Verify the entire audit log hash chain. Returns status and first broken link if any."""
    logs = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    prev_hash = "0" * 64

    for log in logs:
        created_at_str = log.created_at.isoformat() if log.created_at else ""
        expected = _compute_entry_hash(
            prev_hash, log.user_id, log.action, log.target_type,
            log.target_id, log.detail, log.ip_address, created_at_str
        )
        if log.entry_hash != expected:
            return {
                "valid": False,
                "broken_at_id": log.id,
                "message": f"Chain broken at log entry #{log.id}",
            }
        prev_hash = log.entry_hash

    return {"valid": True, "entries_checked": len(logs), "message": "Audit chain is intact"}
