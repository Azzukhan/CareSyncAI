from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "CareSync Backend"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    cors_origins: str = (
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8080,http://localhost:8080"
    )

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/caresync"

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120

    apple_wallet_team_id: str | None = None
    apple_wallet_pass_type_id: str | None = None
    apple_wallet_organization_name: str = "CareSync"
    apple_wallet_certificate_p12_path: str | None = None
    apple_wallet_certificate_p12_password: str | None = None
    apple_wallet_wwdr_certificate_path: str | None = None

    google_wallet_issuer_id: str | None = None
    google_wallet_service_account_json_path: str | None = None

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"


@lru_cache
def get_settings() -> Settings:
    return Settings()
