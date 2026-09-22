from __future__ import annotations

import base64
import binascii
import re
from functools import lru_cache
from ipaddress import IPv4Network, IPv6Network, ip_network
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import BeforeValidator, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from sqlalchemy.engine import make_url


def _split_csv(value: object) -> object:
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return value


CsvList = Annotated[list[str], NoDecode, BeforeValidator(_split_csv)]
IpNetwork = IPv4Network | IPv6Network


class Settings(BaseSettings):
    """Runtime configuration read from `BEAUTYDOCS_*` environment variables."""

    model_config = SettingsConfigDict(
        env_prefix="BEAUTYDOCS_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "BeautyDocs API"
    app_version: str = "0.1.0"
    environment: Literal["local", "test", "staging", "production"] = "local"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    docs_enabled: bool = True
    public_web_url: str | None = None

    database_url: SecretStr | None = None
    legacy_service_key: SecretStr | None = Field(default=None, min_length=32, repr=False)
    database_pool_size: int = Field(default=5, ge=1, le=50)
    database_max_overflow: int = Field(default=5, ge=0, le=100)
    database_pool_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    database_pool_recycle_seconds: int = Field(default=1_800, ge=60, le=86_400)
    database_connect_timeout_seconds: float = Field(default=5.0, gt=0, le=60)
    database_statement_timeout_ms: int = Field(default=15_000, ge=100, le=120_000)

    auth_allowed_origins: CsvList = Field(default_factory=lambda: ["http://localhost:3000"])
    auth_session_cookie_name: str = "beautydocs_session"
    auth_session_ttl_seconds: int = Field(default=43_200, ge=300, le=2_592_000)
    auth_login_max_attempts: int = Field(default=5, ge=3, le=20)
    auth_lockout_seconds: int = Field(default=900, ge=60, le=86_400)
    auth_mfa_challenge_ttl_seconds: int = Field(default=300, ge=120, le=900)
    auth_mfa_max_attempts: int = Field(default=5, ge=3, le=10)
    auth_mfa_resend_cooldown_seconds: int = Field(default=60, ge=30, le=300)
    mfa_encryption_key: SecretStr | None = Field(default=None, repr=False)
    # HMAC key for short-lived client check-in QR tokens (stateless, rotating).
    check_in_signing_key: SecretStr | None = Field(default=None, repr=False)
    check_in_token_ttl_seconds: int = Field(default=90, ge=30, le=300)

    consumer_session_cookie_name: str = "beautydocs_consumer_session"
    consumer_session_ttl_seconds: int = Field(default=2_592_000, ge=3_600, le=7_776_000)
    consumer_claim_ttl_seconds: int = Field(default=1_800, ge=300, le=86_400)
    google_client_id: str | None = Field(default=None, max_length=255)

    email_smtp_host: str | None = Field(default=None, max_length=255)
    email_smtp_port: int = Field(default=587, ge=1, le=65_535)
    email_smtp_username: str | None = Field(default=None, max_length=320)
    email_smtp_password: SecretStr | None = Field(default=None, repr=False)
    email_smtp_security: Literal["starttls", "ssl", "none"] = "starttls"
    email_smtp_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    email_from_address: str | None = Field(default=None, max_length=320)
    email_from_name: str = Field(default="BeautyDocs", min_length=1, max_length=120)

    regon_api_key: SecretStr | None = Field(default=None, repr=False)
    regon_api_url: str = "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc"
    regon_api_timeout_seconds: float = Field(default=10.0, gt=0, le=30)

    smsapi_token: SecretStr | None = None
    sms_sender_name: str = Field(default="BeautyDocs", min_length=1, max_length=11)
    signature_otp_ttl_seconds: int = Field(default=300, ge=120, le=900)
    signature_otp_max_attempts: int = Field(default=3, ge=1, le=10)
    signature_otp_resend_cooldown_seconds: int = Field(default=60, ge=30, le=300)

    chat_upload_directory: Path = Path(".data/chat-attachments")
    chat_upload_max_bytes: int = Field(default=8 * 1024 * 1024, ge=1024, le=25 * 1024 * 1024)

    tenant_root_domain: str = "beautydocs.pl"
    reserved_subdomains: CsvList = Field(
        default_factory=lambda: [
            "admin",
            "api",
            "app",
            "assets",
            "forms",
            "mail",
            "static",
            "status",
            "support",
            "www",
        ]
    )
    allow_localhost_tenants: bool = True

    cors_allowed_origins: CsvList = Field(default_factory=list)
    cors_allow_credentials: bool = True

    trusted_proxy_cidrs: CsvList = Field(default_factory=list)
    internal_tenant_header_secret: SecretStr | None = None
    internal_tenant_header_name: str = "X-BeautyDocs-Tenant"
    internal_tenant_secret_header_name: str = "X-BeautyDocs-Internal-Secret"

    @field_validator("api_v1_prefix")
    @classmethod
    def validate_api_prefix(cls, value: str) -> str:
        normalized = "/" + value.strip("/")
        if normalized == "/":
            raise ValueError("API prefix cannot be the root path")
        return normalized

    @field_validator("public_web_url")
    @classmethod
    def validate_public_web_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().rstrip("/")
        try:
            parsed = urlsplit(normalized)
            _ = parsed.port
        except ValueError as exc:
            raise ValueError("public_web_url must be an exact HTTP origin") from exc
        if (
            parsed.scheme not in {"http", "https"}
            or parsed.hostname is None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("public_web_url must be an exact HTTP origin")
        return normalized

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None:
            return None

        raw_url = value.get_secret_value()
        if not raw_url:
            raise ValueError("database_url cannot be empty")
        try:
            parsed_url = make_url(raw_url)
        except Exception as exc:
            raise ValueError("database_url is not a valid SQLAlchemy URL") from exc

        if parsed_url.drivername != "postgresql+asyncpg":
            raise ValueError("database_url must use the postgresql+asyncpg driver")
        if not parsed_url.username or not parsed_url.database:
            raise ValueError("database_url must include a username and database name")
        if parsed_url.host is None and not parsed_url.query.get("host"):
            raise ValueError("database_url must include a host or Unix socket path")
        return value

    @field_validator("tenant_root_domain")
    @classmethod
    def normalize_root_domain(cls, value: str) -> str:
        normalized = value.strip().lower().rstrip(".")
        if not normalized or ":" in normalized or "/" in normalized:
            raise ValueError("tenant_root_domain must be a hostname")
        return normalized

    @field_validator("cors_allowed_origins")
    @classmethod
    def normalize_origins(cls, values: list[str]) -> list[str]:
        return [value.rstrip("/") for value in values]

    @field_validator("auth_allowed_origins")
    @classmethod
    def validate_auth_origins(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        for value in values:
            origin = value.strip().rstrip("/")
            try:
                parsed = urlsplit(origin)
                _ = parsed.port
            except ValueError as exc:
                raise ValueError("auth_allowed_origins must contain exact HTTP origins") from exc
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.netloc
                or parsed.hostname is None
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError("auth_allowed_origins must contain exact HTTP origins")
            normalized.append(origin)
        if not normalized:
            raise ValueError("auth_allowed_origins cannot be empty")
        return normalized

    @field_validator("auth_session_cookie_name")
    @classmethod
    def validate_session_cookie_name(cls, value: str) -> str:
        if value != "beautydocs_session":
            raise ValueError("auth_session_cookie_name must be beautydocs_session")
        return value

    @field_validator("consumer_session_cookie_name")
    @classmethod
    def validate_consumer_session_cookie_name(cls, value: str) -> str:
        if value != "beautydocs_consumer_session":
            raise ValueError("consumer_session_cookie_name must be beautydocs_consumer_session")
        return value

    @field_validator("google_client_id")
    @classmethod
    def validate_google_client_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not re.fullmatch(
            r"[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com",
            normalized,
        ):
            raise ValueError("google_client_id must be a Google Web client ID")
        return normalized

    @field_validator("regon_api_url")
    @classmethod
    def validate_regon_api_url(cls, value: str) -> str:
        parsed = urlsplit(value.strip())
        if (
            parsed.scheme != "https"
            or parsed.hostname
            not in {
                "wyszukiwarkaregon.stat.gov.pl",
                "wyszukiwarkaregontest.stat.gov.pl",
            }
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("regon_api_url must be an official HTTPS GUS BIR endpoint")
        return value.strip()

    @field_validator("reserved_subdomains")
    @classmethod
    def normalize_reserved_subdomains(cls, values: list[str]) -> list[str]:
        normalized = [value.strip().lower() for value in values]
        if any(not value or not value.replace("-", "").isalnum() for value in normalized):
            raise ValueError("reserved_subdomains contains an invalid hostname label")
        return normalized

    @field_validator("trusted_proxy_cidrs")
    @classmethod
    def validate_proxy_cidrs(cls, values: list[str]) -> list[str]:
        for value in values:
            ip_network(value, strict=False)
        return values

    @model_validator(mode="after")
    def validate_security_settings(self) -> Settings:
        if self.cors_allow_credentials and "*" in self.cors_allowed_origins:
            raise ValueError("CORS wildcard cannot be used with credentials")

        has_proxy_ranges = bool(self.trusted_proxy_cidrs)
        has_internal_secret = self.internal_tenant_header_secret is not None
        if has_proxy_ranges != has_internal_secret:
            raise ValueError(
                "trusted_proxy_cidrs and internal_tenant_header_secret must be configured together"
            )
        if (
            self.internal_tenant_header_secret is not None
            and not self.internal_tenant_header_secret.get_secret_value()
        ):
            raise ValueError("internal_tenant_header_secret cannot be empty")

        if self.environment in {"staging", "production"} and self.allow_localhost_tenants:
            raise ValueError("localhost tenant resolution must be disabled outside local/test")

        if self.environment in {"staging", "production"} and any(
            not origin.startswith("https://") for origin in self.auth_allowed_origins
        ):
            raise ValueError("auth origins must use HTTPS outside local/test")

        if (
            self.environment in {"staging", "production"}
            and self.public_web_url is not None
            and not self.public_web_url.startswith("https://")
        ):
            raise ValueError("public_web_url must use HTTPS outside local/test")

        if self.environment == "production" and self.debug:
            raise ValueError("debug mode cannot be enabled in production")

        if self.mfa_encryption_key is not None:
            raw_key = self.mfa_encryption_key.get_secret_value()
            try:
                decoded = base64.urlsafe_b64decode(raw_key + "=" * (-len(raw_key) % 4))
            except (binascii.Error, ValueError) as exc:
                raise ValueError("mfa_encryption_key must be URL-safe base64") from exc
            if len(decoded) != 32:
                raise ValueError("mfa_encryption_key must decode to exactly 32 bytes")
        elif self.environment == "production":
            raise ValueError("mfa_encryption_key is required in production")

        has_smtp_username = self.email_smtp_username is not None
        has_smtp_password = self.email_smtp_password is not None
        if has_smtp_username != has_smtp_password:
            raise ValueError(
                "email_smtp_username and email_smtp_password must be configured together"
            )

        return self

    @property
    def parsed_trusted_proxy_networks(self) -> tuple[IpNetwork, ...]:
        return tuple(ip_network(value, strict=False) for value in self.trusted_proxy_cidrs)

    @property
    def sqlalchemy_database_url(self) -> str | None:
        if self.database_url is None:
            return None
        return self.database_url.get_secret_value()

    @property
    def auth_cookie_secure(self) -> bool:
        return self.environment in {"staging", "production"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
