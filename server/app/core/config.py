from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(default="AI Hoops Cloud API", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    debug: bool = Field(default=True, alias="DEBUG")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    database_url_override: str | None = Field(default=None, alias="DATABASE_URL")

    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_db: str = Field(default="ai_hoops", alias="POSTGRES_DB")
    postgres_user: str = Field(default="postgres", alias="POSTGRES_USER")
    postgres_password: str = Field(default="postgres", alias="POSTGRES_PASSWORD")

    jwt_secret_key: str = Field(default="change-me", alias="JWT_SECRET_KEY")
    jwt_refresh_secret_key: str = Field(default="change-me-too", alias="JWT_REFRESH_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=60,
        alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")

    cors_origins: list[str] = Field(default=["http://localhost:3000"], alias="CORS_ORIGINS")

    session_cookie_name: str = Field(default="ai-hoops-session", alias="SESSION_COOKIE_NAME")
    session_cookie_secure: bool = Field(default=False, alias="SESSION_COOKIE_SECURE")
    session_cookie_samesite: str = Field(default="lax", alias="SESSION_COOKIE_SAMESITE")
    session_cookie_domain: str | None = Field(default=None, alias="SESSION_COOKIE_DOMAIN")

    verification_code_expire_seconds: int = Field(
        default=300,
        alias="VERIFICATION_CODE_EXPIRE_SECONDS",
    )
    verification_code_resend_cooldown_seconds: int = Field(
        default=60,
        alias="VERIFICATION_CODE_RESEND_COOLDOWN_SECONDS",
    )
    verification_code_max_attempts: int = Field(
        default=5,
        alias="VERIFICATION_CODE_MAX_ATTEMPTS",
    )

    smtp_host: str = Field(default="smtp.gmail.com", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_username: str = Field(default="eltonw482@gmail.com", alias="SMTP_USERNAME")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    smtp_from_email: str = Field(default="eltonw482@gmail.com", alias="SMTP_FROM_EMAIL")
    smtp_from_name: str = Field(default="AI Hoops Cloud", alias="SMTP_FROM_NAME")
    smtp_starttls: bool = Field(default=True, alias="SMTP_STARTTLS")

    upload_video_bucket: str = Field(default="user-videos", alias="UPLOAD_VIDEO_BUCKET")
    template_video_bucket: str = Field(default="template-videos", alias="TEMPLATE_VIDEO_BUCKET")

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.production", ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override

        return (
            "postgresql+psycopg://"
            f"{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def session_cookie_max_age(self) -> int:
        return self.refresh_token_expire_days * 24 * 60 * 60

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
