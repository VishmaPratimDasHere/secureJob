"""Application configuration using Pydantic Settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "SecureJob Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database (set actual values in .env file)
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "securejob"
    DB_USER: str = ""
    DB_PASSWORD: str = ""

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

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

    class Config:
        env_file = ".env"


settings = Settings()
