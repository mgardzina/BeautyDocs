"""Database configuration for Alembic, independent of API service secrets."""

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import Settings


class MigrationSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="BEAUTYDOCS_", env_file=".env", extra="ignore"
    )

    migration_database_url: SecretStr | None = None
    database_url: SecretStr | None = None

    @field_validator("migration_database_url", "database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr | None) -> SecretStr | None:
        return Settings.validate_database_url(value)

    def sqlalchemy_url(self, *, offline: bool = False) -> str:
        credential = self.migration_database_url or self.database_url
        if credential is not None:
            return credential.get_secret_value()
        if offline:
            # SQL generation needs a dialect, but never connects to a database.
            return "postgresql+asyncpg://"
        raise ValueError(
            "Set BEAUTYDOCS_MIGRATION_DATABASE_URL to the PostgreSQL migration role URL "
            "before running Alembic. BEAUTYDOCS_DATABASE_URL is a legacy fallback."
        )
