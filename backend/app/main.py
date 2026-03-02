"""
SecureAJob Platform - Main Application Entry Point
Secure Job Search & Professional Networking Platform
CSE 345/545 - Foundations of Computer Security
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.routers import accounts, jobs, messaging, resumes, admin

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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "accounts": "/api/accounts/health",
            "jobs": "/api/jobs/health",
            "messaging": "/api/messages/health",
        },
    }


@app.get("/health")
def health():
    return {"status": "healthy", "platform": settings.APP_NAME}
