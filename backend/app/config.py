from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    CORS_ORIGIN: str
    SESSION_SECRET_KEY: str

    model_config = SettingsConfigDict(env_file=".env")

    @field_validator("DATABASE_URL")
    @classmethod
    def _forca_driver_psycopg(cls, v: str) -> str:
        # Render entrega postgres:// / postgresql:// sem driver; SQLAlchemy 2.0 exige postgresql+psycopg://
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+psycopg://", 1)
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v


settings = Settings()
