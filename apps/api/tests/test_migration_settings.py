import pytest
from pydantic import ValidationError

from app.db.migrations import MigrationSettings


@pytest.fixture(autouse=True)
def clean_database_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BEAUTYDOCS_DATABASE_URL", raising=False)
    monkeypatch.delenv("BEAUTYDOCS_MIGRATION_DATABASE_URL", raising=False)


def test_online_migration_requires_explicit_database() -> None:
    settings = MigrationSettings(_env_file=None)
    with pytest.raises(ValueError, match="BEAUTYDOCS_MIGRATION_DATABASE_URL"):
        settings.sqlalchemy_url()
    assert settings.sqlalchemy_url(offline=True) == "postgresql+asyncpg://"


def test_migration_credentials_take_precedence(monkeypatch: pytest.MonkeyPatch) -> None:
    migrator = "postgresql+asyncpg://migrator:p%25ss@localhost/new_database"
    monkeypatch.setenv("BEAUTYDOCS_DATABASE_URL", "postgresql+asyncpg://app@localhost/new_database")
    monkeypatch.setenv("BEAUTYDOCS_MIGRATION_DATABASE_URL", migrator)
    monkeypatch.setenv("BEAUTYDOCS_ENVIRONMENT", "production")
    settings = MigrationSettings(_env_file=None)
    assert settings.sqlalchemy_url() == migrator
    assert "p%25ss" not in repr(settings)


def test_existing_migration_invocations_remain_supported(monkeypatch: pytest.MonkeyPatch) -> None:
    url = "postgresql+asyncpg://migrator@localhost/test_database"
    monkeypatch.setenv("BEAUTYDOCS_DATABASE_URL", url)
    assert MigrationSettings(_env_file=None).sqlalchemy_url() == url


@pytest.mark.parametrize("url", ["", "sqlite:///test.db", "postgresql://user@localhost/db"])
def test_invalid_migration_urls_are_rejected(url: str) -> None:
    with pytest.raises(ValidationError):
        MigrationSettings(_env_file=None, migration_database_url=url)
