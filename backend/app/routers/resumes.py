"""Resumes router - encrypted resume upload and download."""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import os
import io
import logging

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.config import settings
from app.models.user import User
from app.core.encryption import encrypt_file, decrypt_file

router = APIRouter(prefix="/resumes", tags=["Resumes"])
logger = logging.getLogger("secureajob.resumes")

UPLOAD_DIR = "storage"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}


# ─── R2 Client ───────────────────────────────────────────────────────────────

def _get_r2_client():
    """Create a boto3 S3 client pointed at Cloudflare R2."""
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def _r2_upload(key: str, data: bytes):
    """Upload bytes to R2."""
    client = _get_r2_client()
    client.put_object(Bucket=settings.R2_BUCKET_NAME, Key=key, Body=data)


def _r2_download(key: str) -> bytes:
    """Download bytes from R2."""
    client = _get_r2_client()
    response = client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
    return response["Body"].read()


def _r2_exists(key: str) -> bool:
    """Check if a key exists in R2."""
    client = _get_r2_client()
    try:
        client.head_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        return True
    except client.exceptions.ClientError:
        return False
    except Exception:
        return False


# ─── Validation ──────────────────────────────────────────────────────────────

def _validate_file(file: UploadFile, content: bytes):
    """C-3: Validate file type and size."""
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB."
        )

    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid content type '{file.content_type}'. Upload a PDF or DOCX file."
        )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_active_user)
):
    """Upload and encrypt a resume. Stores to Cloudflare R2 if configured, else local disk."""
    content = await file.read()
    _validate_file(file, content)
    
    encrypted_content = encrypt_file(content)
    
    original_name = file.filename or "resume"
    safe_name = os.path.basename(original_name)
    meta_content = f"{safe_name}\n{file.content_type or 'application/octet-stream'}"
    
    enc_key = f"{current_user.id}_resume.enc"
    meta_key = f"{current_user.id}_resume.meta"

    if settings.R2_CONFIGURED:
        try:
            _r2_upload(enc_key, encrypted_content)
            _r2_upload(meta_key, meta_content.encode())
            logger.info("Resume uploaded to R2 for user %d", current_user.id)
        except Exception as e:
            logger.error("R2 upload failed: %s", e)
            raise HTTPException(status_code=500, detail="Failed to upload resume to cloud storage.")
    else:
        # Local filesystem fallback
        if not os.path.exists(UPLOAD_DIR):
            os.makedirs(UPLOAD_DIR)
        with open(os.path.join(UPLOAD_DIR, enc_key), "wb") as f:
            f.write(encrypted_content)
        with open(os.path.join(UPLOAD_DIR, meta_key), "w") as f:
            f.write(meta_content)
        logger.info("Resume uploaded to local storage for user %d", current_user.id)
        
    return {"message": "Resume uploaded and encrypted successfully", "filename": safe_name}


@router.get("/download")
async def download_resume(current_user: User = Depends(get_current_active_user)):
    """Download and decrypt a resume from R2 or local storage."""
    enc_key = f"{current_user.id}_resume.enc"
    meta_key = f"{current_user.id}_resume.meta"
    
    encrypted_content = None
    meta_text = None

    if settings.R2_CONFIGURED:
        try:
            if not _r2_exists(enc_key):
                raise HTTPException(status_code=404, detail="Resume not found")
            encrypted_content = _r2_download(enc_key)
            try:
                meta_text = _r2_download(meta_key).decode()
            except Exception:
                meta_text = None
        except HTTPException:
            raise
        except Exception as e:
            logger.error("R2 download failed: %s", e)
            raise HTTPException(status_code=500, detail="Failed to download resume from cloud storage.")
    else:
        file_path = os.path.join(UPLOAD_DIR, enc_key)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Resume not found")
        with open(file_path, "rb") as f:
            encrypted_content = f.read()
        meta_path = os.path.join(UPLOAD_DIR, meta_key)
        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                meta_text = f.read().strip()

    try:
        decrypted_content = decrypt_file(encrypted_content)
    except Exception:
        raise HTTPException(status_code=500, detail="Error decrypting file")

    download_name = "resume.pdf"
    content_type = "application/octet-stream"
    if meta_text:
        lines = meta_text.split("\n")
        if len(lines) >= 1:
            download_name = lines[0]
        if len(lines) >= 2:
            content_type = lines[1]

    return StreamingResponse(
        io.BytesIO(decrypted_content), 
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'}
    )
