"""
SecureJob Platform - Main Application Entry Point
Secure Job Search & Professional Networking Platform
CSE 345/545 - Foundations of Computer Security
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.routers import accounts, jobs, messaging

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Secure Job Search & Professional Networking Platform - CSE 345/545 FCS Project",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(accounts.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(messaging.router, prefix="/api")


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
