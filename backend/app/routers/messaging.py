"""Messaging router - placeholder for encrypted messaging."""

from fastapi import APIRouter

router = APIRouter(prefix="/messages", tags=["Messaging"])


@router.get("/health")
def health_check():
    return {"status": "healthy", "service": "messaging"}
