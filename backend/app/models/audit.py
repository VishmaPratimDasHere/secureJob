"""Admin audit log model — tamper-evident hash-chained log."""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)   # null for system events
    action = Column(String(100), nullable=False)
    target_type = Column(String(50), default="")
    target_id = Column(Integer, nullable=True)
    detail = Column(Text, default="")
    ip_address = Column(String(45), default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Tamper-evident hash chain
    prev_hash = Column(String(64), default="0" * 64)   # SHA-256 of previous entry
    entry_hash = Column(String(64), default="")         # SHA-256(prev_hash + content)

    user = relationship("User", foreign_keys=[user_id])
