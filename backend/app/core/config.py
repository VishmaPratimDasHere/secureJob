"""Application configuration using Pydantic Settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "SecureAJob Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database (set actual values in .env file)
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "securejob"
    DB_USER: str = ""
    DB_PASSWORD: str = ""
    DB_SSLMODE: str = ""  # e.g. "require" for Aiven
    USE_SQLITE: bool = False  # Set to true to force SQLite even if DB creds are present

    @property
    def DATABASE_URL(self) -> str:
        if not self.USE_SQLITE and self.DB_USER and self.DB_PASSWORD:
            url = f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            if self.DB_SSLMODE:
                url += f"?sslmode={self.DB_SSLMODE}"
            return url
        # Fallback to SQLite for local development without PostgreSQL
        return "sqlite:///./securejob.db"

    @property
    def DOCS_ENABLED(self) -> bool:
        return self.DEBUG

    # Security (set actual value in .env file)
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS
    CORS_ORIGINS: list[str] = [
        "https://localhost",
        "https://localhost:3000",
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    # SMTP Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    # Twilio SMS (Verify API)
    TWILIO_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE: str = ""
    TWILIO_VERIFY_SID: str = ""

    # OTP Security
    OTP_EXPIRY_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RATE_LIMIT_PER_HOUR: int = 5

    # Cloudflare R2 (S3-compatible storage)
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "securejob-resumes"

    @property
    def R2_ENDPOINT_URL(self) -> str:
        if self.R2_ACCOUNT_ID:
            return f"https://{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        return ""

    @property
    def R2_CONFIGURED(self) -> bool:
        return bool(self.R2_ACCOUNT_ID and self.R2_ACCESS_KEY_ID and self.R2_SECRET_ACCESS_KEY)

    class Config:
        env_file = ".env"


settings = Settings()
