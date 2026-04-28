"""Resumes router — encrypted upload, PKI integrity verification, access-controlled download."""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import os
import io
import hashlib
import logging
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.config import settings
from app.core.security import JWT_ISSUER, JWT_AUDIENCE
from app.models.user import User, UserRole
from app.models.job import Application
from app.core.encryption import encrypt_file, decrypt_file
from app.core.pki import server_sign, server_verify
from app.core.audit import log_event

router = APIRouter(prefix="/resumes", tags=["Resumes"])
logger = logging.getLogger("securejob.resumes")

UPLOAD_DIR = "storage"
MAX_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}
FILE_MAGIC_BYTES = {
    ".pdf": b"%PDF",
    ".docx": b"PK\x03\x04",
    ".doc": b"\xd0\xcf\x11\xe0",
}


# ─── R2 helpers ──────────────────────────────────────────────────────────────

def _get_r2_client():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def _r2_upload(key: str, data: bytes):
    _get_r2_client().put_object(Bucket=settings.R2_BUCKET_NAME, Key=key, Body=data)


def _r2_download(key: str) -> bytes:
    return _get_r2_client().get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)["Body"].read()


def _r2_exists(key: str) -> bool:
    try:
        _get_r2_client().head_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        return True
    except Exception:
        return False


# ─── Validation ──────────────────────────────────────────────────────────────

def _validate_file(file: UploadFile, content: bytes):
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_FILE_SIZE // (1024*1024)}MB.")
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    expected_magic = FILE_MAGIC_BYTES.get(ext)
    if expected_magic and not content[:len(expected_magic)].startswith(expected_magic):
        raise HTTPException(status_code=400, detail=f"File content doesn't match extension '{ext}'.")
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid content type '{file.content_type}'.")


# ─── Storage helpers ─────────────────────────────────────────────────────────

def _store(key: str, data: bytes):
    if settings.R2_CONFIGURED:
        _r2_upload(key, data)
    else:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        with open(os.path.join(UPLOAD_DIR, key), "wb") as f:
            f.write(data)


def _load(key: str) -> bytes:
    if settings.R2_CONFIGURED:
        return _r2_download(key)
    path = os.path.join(UPLOAD_DIR, key)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Resume not found")
    with open(path, "rb") as f:
        return f.read()


def _exists(key: str) -> bool:
    if settings.R2_CONFIGURED:
        return _r2_exists(key)
    return os.path.exists(os.path.join(UPLOAD_DIR, key))


# ─── Access control ──────────────────────────────────────────────────────────

def _can_access_resume(requester: User, owner_id: int, db: Session) -> bool:
    """
    Owner, platform admin, or recruiter who has an application from the owner
    for one of their job postings.
    """
    if requester.id == owner_id:
        return True
    if requester.role == UserRole.ADMIN:
        return True
    if requester.role == UserRole.RECRUITER:
        # Check that requester has a job, and owner applied to it
        return db.query(Application).join(
            Application.job
        ).filter(
            Application.applicant_id == owner_id,
            Application.job.has(posted_by=requester.id)
        ).first() is not None
    return False


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Upload and encrypt a resume. Signs SHA-256 hash for integrity verification (PKI)."""
    content = await file.read()
    _validate_file(file, content)

    encrypted_content = encrypt_file(content)

    # PKI: sign SHA-256 of the plaintext file
    file_hash = hashlib.sha256(content).hexdigest()
    try:
        signature = server_sign(file_hash.encode("utf-8"))
    except Exception as e:
        logger.warning("Could not sign resume: %s", e)
        signature = ""

    original_name = file.filename or "resume"
    safe_name = os.path.basename(original_name)
    meta_content = f"{safe_name}\n{file.content_type or 'application/octet-stream'}\n{file_hash}\n{signature}"

    enc_key = f"{current_user.id}_resume.enc"
    meta_key = f"{current_user.id}_resume.meta"

    _store(enc_key, encrypted_content)
    _store(meta_key, meta_content.encode())

    log_event(db, action="resume.upload", user_id=current_user.id,
              target_type="user", target_id=current_user.id, detail=safe_name)
    db.commit()
    logger.info("Resume uploaded for user %d", current_user.id)
    return {"message": "Resume uploaded and encrypted successfully", "filename": safe_name, "integrity_signed": bool(signature)}


@router.get("/download")
async def download_my_resume(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Download and decrypt own resume (no extra OTP needed — owner access)."""
    return _download_resume_for(current_user.id, current_user, db)


@router.get("/download/{owner_id}")
async def download_resume_for_user(
    owner_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Download a specific user's resume.
    Allowed: owner, authorized recruiters (applicant applied to their job), admins.
    Recruiters must supply a valid action token via /action-otp flow.
    """
    if not _can_access_resume(current_user, owner_id, db):
        raise HTTPException(status_code=403, detail="Access denied. You are not authorized to download this resume.")
    log_event(db, action="resume.download", user_id=current_user.id,
              target_type="user", target_id=owner_id,
              detail=f"Downloaded resume for user {owner_id}")
    db.commit()
    return _download_resume_for(owner_id, current_user, db)


def _download_resume_for(owner_id: int, requester: User, db: Session):
    enc_key = f"{owner_id}_resume.enc"
    meta_key = f"{owner_id}_resume.meta"

    if not _exists(enc_key):
        raise HTTPException(status_code=404, detail="Resume not found")

    encrypted_content = _load(enc_key)
    try:
        meta_raw = _load(meta_key).decode()
    except Exception:
        meta_raw = None

    try:
        decrypted_content = decrypt_file(encrypted_content)
    except Exception:
        raise HTTPException(status_code=500, detail="Error decrypting file")

    download_name = "resume.pdf"
    content_type = "application/octet-stream"
    integrity_ok = None

    if meta_raw:
        lines = meta_raw.split("\n")
        if len(lines) >= 1:
            download_name = lines[0]
        if len(lines) >= 2:
            content_type = lines[1]
        if len(lines) >= 4:
            stored_hash = lines[2]
            stored_sig = lines[3]
            actual_hash = hashlib.sha256(decrypted_content).hexdigest()
            if actual_hash != stored_hash:
                logger.error("Resume integrity check FAILED for user %d", owner_id)
                raise HTTPException(status_code=500, detail="Resume integrity check failed — file may be tampered.")
            integrity_ok = server_verify(stored_hash.encode("utf-8"), stored_sig)
            if not integrity_ok:
                logger.warning("Resume PKI signature verification failed for user %d", owner_id)

    headers = {
        "Content-Disposition": f'attachment; filename="{download_name}"',
        "X-Integrity-Verified": str(integrity_ok) if integrity_ok is not None else "unknown",
    }
    return StreamingResponse(io.BytesIO(decrypted_content), media_type=content_type, headers=headers)


@router.get("/status")
def resume_status(current_user: User = Depends(get_current_active_user)):
    """Check if current user has an uploaded resume."""
    enc_key = f"{current_user.id}_resume.enc"
    has_resume = _exists(enc_key)
    return {"has_resume": has_resume}
