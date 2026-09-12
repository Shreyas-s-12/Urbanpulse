from typing import Any, List
from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    APP_NAME: str = "UrbanPulse Backend"
    APP_VERSION: str = "0.2.0"

    # Default Geographic Intelligence Radius (dynamic center, 50km default radius)
    DEFAULT_INTELLIGENCE_RADIUS_KM: float = Field(
        50.0,
        validation_alias=AliasChoices("DEFAULT_INTELLIGENCE_RADIUS_KM", "INTELLIGENCE_RADIUS_KM"),
    )
    DEMO_MODE: bool = False

    # API & CORS
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    SECRET_KEY: str = "urbanpulse-development-secret-key"

    # Database & Cache
    DATABASE_URL: str = "postgresql+asyncpg://urbanpulse_admin:urbanpulse_secret@localhost:5432/urbanpulse_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # Geospatial, Maps & Weather
    GOOGLE_MAPS_API_KEY: str = ""
    OPENMETEO_API_URL: str = "https://api.open-meteo.com/v1/forecast"
    NOMINATIM_USER_AGENT: str = Field(
        "urbanpulse-platform",
        validation_alias=AliasChoices("NOMINATIM_USER_AGENT", "OPENSTREETMAP_NOMINATIM_USER_AGENT"),
    )

    # AI Providers & Model Hubs
    GOOGLE_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    HUGGINGFACE_API_TOKEN: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("DEBUG", "DEMO_MODE", mode="before")
    @classmethod
    def parse_boolish(cls, value: Any) -> Any:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False
        return value


settings = Settings()
