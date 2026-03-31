"""Audit log schemas."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    target_type: str
    target_id: Optional[int] = None
    detail: str
    ip_address: str
    created_at: datetime
    username: str = ""

    class Config:
        from_attributes = True
