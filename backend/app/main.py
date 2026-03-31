"""
SecureAJob Platform - Main Application Entry Point
Secure Job Search & Professional Networking Platform
CSE 345/545 - Foundations of Computer Security
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.core.security_middleware import SecurityHeadersMiddleware, RateLimitMiddleware
from app.routers import accounts, jobs, messaging, resumes, admin

logger = logging.getLogger("securejob")

# ─── Startup security checks ─────────────────────────────────────────────────
if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 32:
    if not settings.DEBUG:
        raise RuntimeError(
            "FATAL: SECRET_KEY must be at least 32 characters in production. "
            "Set a strong SECRET_KEY in your .env file."
        )
    else:
        logger.warning(
            "WARNING: SECRET_KEY is weak or empty. This is only acceptable in DEBUG mode. "
            "Set a strong SECRET_KEY (32+ chars) before deploying."
        )

# Import all models so Base.metadata sees them
import app.models  # noqa: F401

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="SecureAJob - Secure Job Search & Professional Networking Platform - CSE 345/545 FCS Project",
    docs_url="/docs" if settings.DOCS_ENABLED else None,
    redoc_url="/redoc" if settings.DOCS_ENABLED else None,
    openapi_url="/openapi.json" if settings.DOCS_ENABLED else None,
)

# ─── Middleware stack (order matters — last added = first executed) ───────────

# 1. Security headers on every response
app.add_middleware(SecurityHeadersMiddleware)

# 2. CORS — restrict methods & headers to only what's needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,  # preflight cache 10 min
)

# 3. Global rate limiting & request size enforcement
app.add_middleware(RateLimitMiddleware)

# 4. Trusted host — prevent host-header attacks (allow localhost for dev)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.localhost"],
)

app.include_router(accounts.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(messaging.router, prefix="/api")
app.include_router(resumes.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/")
def root():
    return {
        "platform": settings.APP_NAME,
        "status": "running",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
