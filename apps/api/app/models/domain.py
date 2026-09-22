"""BeautyDocs 2.0 multi-tenant domain model.

Tenant-owned relationships use composite foreign keys containing tenant_id.
This prevents accidental cross-salon links even if application validation is
missed. PostgreSQL RLS adds a second, independent isolation boundary.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.services.booking_schedule import default_booking_schedule


def json_document_type() -> JSON:
    """Portable JSON for metadata tests, native JSONB on PostgreSQL."""

    return JSON().with_variant(JSONB(), "postgresql")


class TenantStatus(StrEnum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    ARCHIVED = "ARCHIVED"


class MembershipRole(StrEnum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    STAFF = "STAFF"
    READ_ONLY = "READ_ONLY"


class TemplateStatus(StrEnum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    RETIRED = "RETIRED"


class VisitStatus(StrEnum):
    PLANNED = "PLANNED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class SubmissionStatus(StrEnum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    SIGNED = "SIGNED"
    VOID = "VOID"


class VerificationStatus(StrEnum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    EXPIRED = "EXPIRED"
    FAILED = "FAILED"


class SignatureSignerType(StrEnum):
    CLIENT = "CLIENT"
    PRACTITIONER = "PRACTITIONER"


class ConsumerChallengeStatus(StrEnum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    EXPIRED = "EXPIRED"
    FAILED = "FAILED"


class MfaMethod(StrEnum):
    SMS = "SMS"
    TOTP = "TOTP"


class MfaChallengePurpose(StrEnum):
    ENROLLMENT = "ENROLLMENT"
    LOGIN = "LOGIN"
    DISABLE = "DISABLE"
    CHANGE = "CHANGE"


class ClientNoteCategory(StrEnum):
    NOTATKA = "NOTATKA"
    ALERGIA = "ALERGIA"
    UWAGA = "UWAGA"
    PREFERENCJA = "PREFERENCJA"


class SalonNotificationKind(StrEnum):
    PRACTITIONER_SIGNATURE_REQUIRED = "PRACTITIONER_SIGNATURE_REQUIRED"


class SalonNotificationSeverity(StrEnum):
    INFO = "INFO"
    ACTION_REQUIRED = "ACTION_REQUIRED"


class ChatSenderType(StrEnum):
    CONSUMER = "CONSUMER"
    SALON = "SALON"
    SYSTEM = "SYSTEM"


class ChatMessageKind(StrEnum):
    TEXT = "TEXT"
    ATTACHMENT = "ATTACHMENT"
    VISIT_CREATED = "VISIT_CREATED"
    VISIT_RESCHEDULED = "VISIT_RESCHEDULED"
    VISIT_CANCELLED = "VISIT_CANCELLED"
    VISIT_REMINDER = "VISIT_REMINDER"


class CatalogItemKind(StrEnum):
    MEDICINE = "MEDICINE"
    TREATMENT_SUBSTANCE = "TREATMENT_SUBSTANCE"
    DEVICE = "DEVICE"
    COSMETIC = "COSMETIC"


class CatalogItemSource(StrEnum):
    RPL = "RPL"
    BEAUTYDOCS = "BEAUTYDOCS"
    SALON = "SALON"


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class TenantOwnedMixin:
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )


class Tenant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tenants"
    __table_args__ = (
        CheckConstraint("slug = lower(slug)", name="slug_lowercase"),
        CheckConstraint(
            "status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')",
            name="status_allowed",
        ),
    )

    slug: Mapped[str] = mapped_column(String(63), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    legal_name: Mapped[str] = mapped_column(String(250), nullable=False)
    nip: Mapped[str | None] = mapped_column(String(20))
    regon: Mapped[str | None] = mapped_column(String(14))
    krs: Mapped[str | None] = mapped_column(String(10))
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    privacy_contact_email: Mapped[str] = mapped_column(String(320), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    website_url: Mapped[str | None] = mapped_column(String(2048))
    public_profile: Mapped[dict[str, Any]] = mapped_column(
        json_document_type(), nullable=False, default=dict, server_default="{}"
    )
    logo_image: Mapped[str | None] = mapped_column(Text)
    address_line1: Mapped[str | None] = mapped_column(String(250))
    address_line2: Mapped[str | None] = mapped_column(String(250))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    city: Mapped[str | None] = mapped_column(String(120))
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, server_default="PL")
    directory_visible: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    booking_schedule: Mapped[dict[str, Any]] = mapped_column(
        json_document_type(),
        nullable=False,
        default=default_booking_schedule,
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=TenantStatus.ACTIVE.value
    )
    deletion_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "email_normalized = lower(email_normalized)",
            name="email_normalized_lowercase",
        ),
        CheckConstraint(
            "failed_login_attempts >= 0",
            name="failed_login_attempts_nonnegative",
        ),
        CheckConstraint(
            "verification_attempts >= 0",
            name="verification_attempts_nonnegative",
        ),
        CheckConstraint(
            "verification_code_hash IS NULL OR verification_code_hash ~ '^[0-9a-f]{64}$'",
            name="verification_code_hash_sha256",
        ),
        CheckConstraint(
            "mfa_method IS NULL OR mfa_method IN ('SMS', 'TOTP')",
            name="mfa_method_allowed",
        ),
        CheckConstraint(
            "(mfa_method IS NULL AND mfa_phone_normalized IS NULL "
            "AND mfa_totp_secret_encrypted IS NULL AND mfa_enabled_at IS NULL "
            "AND mfa_last_used_counter IS NULL) OR "
            "(mfa_method = 'SMS' AND mfa_phone_normalized IS NOT NULL "
            "AND mfa_totp_secret_encrypted IS NULL AND mfa_enabled_at IS NOT NULL "
            "AND mfa_last_used_counter IS NULL) OR "
            "(mfa_method = 'TOTP' AND mfa_phone_normalized IS NULL "
            "AND mfa_totp_secret_encrypted IS NOT NULL AND mfa_enabled_at IS NOT NULL)",
            name="mfa_configuration_valid",
        ),
    )

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_normalized: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone_normalized: Mapped[str | None] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_login_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Account e-mail/SMS verification for self-service registration.
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_code_hash: Mapped[str | None] = mapped_column(String(64))
    verification_code_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    # Self-managed signature used when this user acts as a practitioner.
    signature_data_url: Mapped[str | None] = mapped_column(Text)
    signature_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Optional second factor. TOTP secrets are encrypted by the application.
    mfa_method: Mapped[str | None] = mapped_column(String(16))
    mfa_phone_normalized: Mapped[str | None] = mapped_column(String(32))
    mfa_totp_secret_encrypted: Mapped[str | None] = mapped_column(Text)
    mfa_enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    mfa_last_used_counter: Mapped[int | None] = mapped_column(BigInteger)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserGoogleIdentity(UUIDPrimaryKeyMixin, Base):
    """Google identity linked to an owner or staff BeautyDocs account."""

    __tablename__ = "user_google_identities"
    __table_args__ = (
        UniqueConstraint("google_subject", name="uq_user_google_identity_subject"),
        UniqueConstraint("user_id", name="uq_user_google_identity_user"),
        Index("ix_user_google_identity_email", "email_normalized"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    google_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_normalized: Mapped[str] = mapped_column(String(320), nullable=False)
    hosted_domain: Mapped[str | None] = mapped_column(String(255))
    email_verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_login_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class OwnerRegistration(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A pending salon-owner sign-up.

    The e-mail-first flow captures and verifies the e-mail here before the
    account, salon and company data are collected on the post-verification
    step. This row holds only the verification code and a short-lived
    completion token; it is deleted once a real User/Tenant pair is created.
    Like ``users``/``tenants`` it is a global (non-tenant) table with no RLS,
    since registration happens before any tenant context exists.
    """

    __tablename__ = "owner_registrations"
    __table_args__ = (
        UniqueConstraint("email_normalized", name="uq_owner_registration_email"),
        CheckConstraint(
            "email_normalized = lower(email_normalized)",
            name="owner_registration_email_lowercase",
        ),
        CheckConstraint(
            "verification_attempts >= 0",
            name="owner_registration_attempts_nonnegative",
        ),
        CheckConstraint(
            "verification_code_hash IS NULL OR verification_code_hash ~ '^[0-9a-f]{64}$'",
            name="owner_registration_code_hash_sha256",
        ),
        CheckConstraint(
            "registration_token_hash IS NULL OR registration_token_hash ~ '^[0-9a-f]{64}$'",
            name="owner_registration_token_hash_sha256",
        ),
    )

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_normalized: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    verification_code_hash: Mapped[str | None] = mapped_column(String(64))
    verification_code_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    verification_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    registration_token_hash: Mapped[str | None] = mapped_column(String(64))
    registration_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )


class ConsumerRegistration(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A pending client (consumer) sign-up.

    Mirrors :class:`OwnerRegistration` for the consumer portal: the e-mail is
    captured and verified before the name and password are collected on the
    post-verification step, at which point a real ``ConsumerAccount`` is
    created. A global (non-tenant) table with no RLS.
    """

    __tablename__ = "consumer_registrations"
    __table_args__ = (
        UniqueConstraint("email_normalized", name="uq_consumer_registration_email"),
        CheckConstraint(
            "email_normalized = lower(email_normalized)",
            name="consumer_registration_email_lowercase",
        ),
        CheckConstraint(
            "verification_attempts >= 0",
            name="consumer_registration_attempts_nonnegative",
        ),
        CheckConstraint(
            "verification_code_hash IS NULL OR verification_code_hash ~ '^[0-9a-f]{64}$'",
            name="consumer_registration_code_hash_sha256",
        ),
        CheckConstraint(
            "registration_token_hash IS NULL OR registration_token_hash ~ '^[0-9a-f]{64}$'",
            name="consumer_registration_token_hash_sha256",
        ),
    )

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_normalized: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    verification_code_hash: Mapped[str | None] = mapped_column(String(64))
    verification_code_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    verification_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    registration_token_hash: Mapped[str | None] = mapped_column(String(64))
    registration_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )


class AuthSession(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        CheckConstraint(
            "char_length(token_digest) = 64",
            name="token_digest_sha256",
        ),
        CheckConstraint(
            "token_digest ~ '^[0-9a-f]{64}$'",
            name="token_digest_lowercase_hex",
        ),
        CheckConstraint(
            "expires_at > created_at",
            name="expiry_after_creation",
        ),
        Index("ix_auth_sessions_user_expires", "user_id", "expires_at"),
        Index("ix_auth_sessions_expires", "expires_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_digest: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserMfaChallenge(UUIDPrimaryKeyMixin, Base):
    """Short-lived proof used while enrolling, logging in, or disabling MFA."""

    __tablename__ = "user_mfa_challenges"
    __table_args__ = (
        CheckConstraint(
            "purpose IN ('ENROLLMENT', 'LOGIN', 'DISABLE', 'CHANGE')",
            name="purpose_allowed",
        ),
        CheckConstraint("method IN ('SMS', 'TOTP')", name="method_allowed"),
        CheckConstraint(
            "status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED')",
            name="status_allowed",
        ),
        CheckConstraint("attempt_count >= 0", name="attempt_count_nonnegative"),
        CheckConstraint("expires_at > created_at", name="expiry_after_creation"),
        Index("ix_user_mfa_challenges_user_created", "user_id", "created_at"),
        Index("ix_user_mfa_challenges_expires", "expires_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    purpose: Mapped[str] = mapped_column(String(16), nullable=False)
    method: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=VerificationStatus.PENDING.value
    )
    otp_digest: Mapped[str | None] = mapped_column(String(255))
    phone_normalized: Mapped[str | None] = mapped_column(String(32))
    totp_secret_encrypted: Mapped[str | None] = mapped_column(Text)
    destination_masked: Mapped[str | None] = mapped_column(String(64))
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    provider: Mapped[str | None] = mapped_column(String(32))
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    requested_ip_address: Mapped[str | None] = mapped_column(String(64))
    requested_user_agent: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ConsumerAccount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Global identity owned by a salon client, not by a tenant."""

    __tablename__ = "consumer_accounts"
    __table_args__ = (
        UniqueConstraint("phone_normalized", name="uq_consumer_accounts_phone"),
        Index("ix_consumer_accounts_email_normalized", "email_normalized"),
        Index("ix_consumer_accounts_created", "created_at"),
        CheckConstraint(
            "verification_attempts >= 0",
            name="consumer_verification_attempts_nonnegative",
        ),
        CheckConstraint(
            "verification_code_hash IS NULL OR verification_code_hash ~ '^[0-9a-f]{64}$'",
            name="consumer_verification_code_hash_sha256",
        ),
        CheckConstraint(
            "mfa_method IS NULL OR mfa_method IN ('SMS', 'TOTP')",
            name="consumer_mfa_method_allowed",
        ),
        CheckConstraint(
            "(mfa_method IS NULL AND mfa_phone_normalized IS NULL "
            "AND mfa_totp_secret_encrypted IS NULL AND mfa_enabled_at IS NULL "
            "AND mfa_last_used_counter IS NULL) OR "
            "(mfa_method = 'SMS' AND mfa_phone_normalized IS NOT NULL "
            "AND mfa_totp_secret_encrypted IS NULL AND mfa_enabled_at IS NOT NULL "
            "AND mfa_last_used_counter IS NULL) OR "
            "(mfa_method = 'TOTP' AND mfa_phone_normalized IS NULL "
            "AND mfa_totp_secret_encrypted IS NOT NULL AND mfa_enabled_at IS NOT NULL)",
            name="consumer_mfa_configuration_valid",
        ),
    )

    phone: Mapped[str | None] = mapped_column(String(32))
    phone_normalized: Mapped[str | None] = mapped_column(String(32))
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320))
    email_normalized: Mapped[str | None] = mapped_column(String(320))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_code_hash: Mapped[str | None] = mapped_column(String(64))
    verification_code_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    birth_date: Mapped[date | None] = mapped_column(Date)
    street: Mapped[str | None] = mapped_column(String(250))
    house_number: Mapped[str | None] = mapped_column(String(30))
    apartment_number: Mapped[str | None] = mapped_column(String(30))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    city: Mapped[str | None] = mapped_column(String(120))
    medical_profile: Mapped[dict[str, Any]] = mapped_column(
        json_document_type(), nullable=False, default=dict
    )
    medical_profile_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    signature_data_url: Mapped[str | None] = mapped_column(Text)
    signature_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    phone_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Optional second factor. TOTP secrets are encrypted by the application.
    # Deliberately separate from `phone`/`phone_normalized` above, so enabling
    # SMS MFA always (re-)confirms a number rather than silently reusing the
    # profile contact number.
    mfa_method: Mapped[str | None] = mapped_column(String(16))
    mfa_phone_normalized: Mapped[str | None] = mapped_column(String(32))
    mfa_totp_secret_encrypted: Mapped[str | None] = mapped_column(Text)
    mfa_enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    mfa_last_used_counter: Mapped[int | None] = mapped_column(BigInteger)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ConsumerMfaChallenge(UUIDPrimaryKeyMixin, Base):
    """Short-lived proof used while enrolling, logging in, or disabling MFA.

    Mirrors ``UserMfaChallenge`` but for client (``ConsumerAccount``) logins.
    Consumer data is not tenant-owned and does not use row-level security, so
    unlike its owner/staff counterpart this table has no RLS policy — access
    is scoped by ``consumer_account_id`` at the query level, same as every
    other consumer table.
    """

    __tablename__ = "consumer_mfa_challenges"
    __table_args__ = (
        CheckConstraint(
            "purpose IN ('ENROLLMENT', 'LOGIN', 'DISABLE', 'CHANGE')",
            name="purpose_allowed",
        ),
        CheckConstraint("method IN ('SMS', 'TOTP')", name="method_allowed"),
        CheckConstraint(
            "status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED')",
            name="status_allowed",
        ),
        CheckConstraint("attempt_count >= 0", name="attempt_count_nonnegative"),
        CheckConstraint("expires_at > created_at", name="expiry_after_creation"),
        Index("ix_consumer_mfa_challenges_account_created", "consumer_account_id", "created_at"),
        Index("ix_consumer_mfa_challenges_expires", "expires_at"),
    )

    consumer_account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("consumer_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    purpose: Mapped[str] = mapped_column(String(16), nullable=False)
    method: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=VerificationStatus.PENDING.value
    )
    otp_digest: Mapped[str | None] = mapped_column(String(255))
    phone_normalized: Mapped[str | None] = mapped_column(String(32))
    totp_secret_encrypted: Mapped[str | None] = mapped_column(Text)
    destination_masked: Mapped[str | None] = mapped_column(String(64))
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    provider: Mapped[str | None] = mapped_column(String(32))
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    requested_ip_address: Mapped[str | None] = mapped_column(String(64))
    requested_user_agent: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ConsumerGoogleIdentity(UUIDPrimaryKeyMixin, Base):
    """Google subject linked to one global consumer account."""

    __tablename__ = "consumer_google_identities"
    __table_args__ = (
        UniqueConstraint("google_subject", name="uq_consumer_google_identity_subject"),
        UniqueConstraint(
            "consumer_account_id",
            name="uq_consumer_google_identity_account",
        ),
        Index("ix_consumer_google_identity_email", "email_normalized"),
    )

    consumer_account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("consumer_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    google_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_normalized: Mapped[str] = mapped_column(String(320), nullable=False)
    hosted_domain: Mapped[str | None] = mapped_column(String(255))
    email_verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_login_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ConsumerSession(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "consumer_sessions"
    __table_args__ = (
        CheckConstraint(
            "char_length(token_digest) = 64",
            name="token_digest_sha256",
        ),
        CheckConstraint(
            "expires_at > created_at",
            name="expiry_after_creation",
        ),
        Index("ix_consumer_sessions_account_expires", "consumer_account_id", "expires_at"),
        Index("ix_consumer_sessions_expires", "expires_at"),
    )

    consumer_account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("consumer_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_digest: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ConsumerLoginChallenge(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "consumer_login_challenges"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED')",
            name="status_allowed",
        ),
        CheckConstraint("attempt_count >= 0", name="attempt_count_nonnegative"),
        Index(
            "ix_consumer_login_challenges_phone_created",
            "phone_normalized",
            "created_at",
        ),
    )

    phone_normalized: Mapped[str] = mapped_column(String(32), nullable=False)
    destination_masked: Mapped[str] = mapped_column(String(64), nullable=False)
    otp_digest: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        server_default=ConsumerChallengeStatus.PENDING.value,
    )
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    provider: Mapped[str | None] = mapped_column(String(32))
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    requested_ip_address: Mapped[str | None] = mapped_column(String(64))
    requested_user_agent: Mapped[str | None] = mapped_column(String(512))
    verified_ip_address: Mapped[str | None] = mapped_column(String(64))
    verified_user_agent: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ConsumerDocumentClaim(UUIDPrimaryKeyMixin, Base):
    """Short-lived proof that the browser completed a submission SMS flow."""

    __tablename__ = "consumer_document_claims"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "form_submission_id"],
            ["form_submissions.tenant_id", "form_submissions.id"],
            name="fk_consumer_claim_submission",
            ondelete="CASCADE",
        ),
        CheckConstraint("char_length(token_digest) = 64", name="token_digest_sha256"),
        Index("ix_consumer_document_claims_expires", "expires_at"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    form_submission_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    phone_normalized: Mapped[str] = mapped_column(String(32), nullable=False)
    token_digest: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ConsumerSubmissionLink(UUIDPrimaryKeyMixin, Base):
    """Explicit client-controlled access to a signed salon document."""

    __tablename__ = "consumer_submission_links"
    __table_args__ = (
        UniqueConstraint(
            "consumer_account_id",
            "form_submission_id",
            name="uq_consumer_submission_link_account_submission",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "client_id"],
            ["clients.tenant_id", "clients.id"],
            name="fk_consumer_submission_link_client",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "form_submission_id"],
            ["form_submissions.tenant_id", "form_submissions.id"],
            name="fk_consumer_submission_link_submission",
            ondelete="CASCADE",
        ),
        Index(
            "ix_consumer_submission_links_account_shared",
            "consumer_account_id",
            "shared_at",
        ),
    )

    consumer_account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("consumer_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    form_submission_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    shared_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    profile_imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ConsumerAppointment(UUIDPrimaryKeyMixin, Base):
    """Consumer-owned link to a tenant visit created through online booking."""

    __tablename__ = "consumer_appointments"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "visit_id",
            name="uq_consumer_appointment_tenant_visit",
        ),
        UniqueConstraint(
            "booking_token_digest",
            name="uq_consumer_appointment_booking_token",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "visit_id"],
            ["visits.tenant_id", "visits.id"],
            name="fk_consumer_appointment_visit",
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "char_length(booking_token_digest) = 64",
            name="booking_token_digest_sha256",
        ),
        Index(
            "ix_consumer_appointments_account_created",
            "consumer_account_id",
            "created_at",
        ),
    )

    consumer_account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("consumer_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    visit_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    booking_token_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ChatConversation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One durable conversation between a consumer account and a salon."""

    __tablename__ = "chat_conversations"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_chat_conversation_tenant_id"),
        UniqueConstraint(
            "tenant_id",
            "consumer_account_id",
            name="uq_chat_conversation_tenant_consumer",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "assigned_team_member_id"],
            ["team_members.tenant_id", "team_members.id"],
            name="fk_chat_conversation_assigned_team_member",
            ondelete="RESTRICT",
        ),
        Index(
            "ix_chat_conversations_consumer_last_message",
            "consumer_account_id",
            "last_message_at",
        ),
        Index(
            "ix_chat_conversations_tenant_last_message",
            "tenant_id",
            "last_message_at",
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    consumer_account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("consumer_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    assigned_team_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    last_message_body: Mapped[str | None] = mapped_column(String(500))
    last_message_sender_type: Mapped[str | None] = mapped_column(String(16))
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consumer_last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    salon_last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ChatMessage(UUIDPrimaryKeyMixin, Base):
    """Immutable text message belonging to a BeautyDocs chat conversation."""

    __tablename__ = "chat_messages"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "conversation_id"],
            ["chat_conversations.tenant_id", "chat_conversations.id"],
            name="fk_chat_message_conversation",
            ondelete="CASCADE",
        ),
        UniqueConstraint("tenant_id", "id", name="uq_chat_message_tenant_id"),
        UniqueConstraint(
            "conversation_id",
            "event_key",
            name="uq_chat_message_conversation_event",
        ),
        CheckConstraint(
            "sender_type IN ('CONSUMER', 'SALON', 'SYSTEM')",
            name="sender_type_allowed",
        ),
        CheckConstraint(
            "kind IN ('TEXT', 'ATTACHMENT', 'VISIT_CREATED', "
            "'VISIT_RESCHEDULED', 'VISIT_CANCELLED', 'VISIT_REMINDER')",
            name="kind_allowed",
        ),
        CheckConstraint(
            "char_length(body) BETWEEN 1 AND 4000",
            name="body_length",
        ),
        Index(
            "ix_chat_messages_conversation_created",
            "conversation_id",
            "created_at",
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    sender_type: Mapped[str] = mapped_column(String(16), nullable=False)
    sender_name: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default=ChatMessageKind.TEXT.value
    )
    event_key: Mapped[str | None] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ChatAttachment(UUIDPrimaryKeyMixin, Base):
    """Metadata linking a protected file object to one immutable chat message."""

    __tablename__ = "chat_attachments"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_chat_attachment_tenant_id"),
        ForeignKeyConstraint(
            ["tenant_id", "conversation_id"],
            ["chat_conversations.tenant_id", "chat_conversations.id"],
            name="fk_chat_attachment_conversation",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "message_id"],
            ["chat_messages.tenant_id", "chat_messages.id"],
            name="fk_chat_attachment_message",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "file_object_id"],
            ["file_objects.tenant_id", "file_objects.id"],
            name="fk_chat_attachment_file_object",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "char_length(file_name) BETWEEN 1 AND 255",
            name="file_name_length",
        ),
        Index(
            "ix_chat_attachments_message_created",
            "message_id",
            "created_at",
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    message_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    file_object_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TenantMembership(UUIDPrimaryKeyMixin, TimestampMixin, TenantOwnedMixin, Base):
    __tablename__ = "tenant_memberships"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_membership_tenant_id"),
        UniqueConstraint("tenant_id", "user_id", name="uq_membership_tenant_user"),
        CheckConstraint(
            "role IN ('OWNER', 'ADMIN', 'STAFF', 'READ_ONLY')",
            name="role_allowed",
        ),
        Index("ix_memberships_tenant_role", "tenant_id", "role"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=MembershipRole.STAFF.value
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class StaffInvitation(UUIDPrimaryKeyMixin, TimestampMixin, TenantOwnedMixin, Base):
    """One-time invitation that creates a staff account in exactly one salon."""

    __tablename__ = "staff_invitations"
    __table_args__ = (
        UniqueConstraint("token_digest", name="uq_staff_invitation_token_digest"),
        ForeignKeyConstraint(
            ["tenant_id", "invited_by_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_staff_invitation_invited_by_membership",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "email_normalized = lower(email_normalized)",
            name="email_normalized_lowercase",
        ),
        CheckConstraint(
            "char_length(token_digest) = 64 AND token_digest ~ '^[0-9a-f]{64}$'",
            name="token_digest_sha256",
        ),
        CheckConstraint("expires_at > created_at", name="expiry_after_creation"),
        CheckConstraint(
            "accepted_at IS NULL OR revoked_at IS NULL",
            name="not_accepted_and_revoked",
        ),
        Index(
            "ix_staff_invitations_tenant_email_created",
            "tenant_id",
            "email_normalized",
            "created_at",
        ),
        Index("ix_staff_invitations_expires", "expires_at"),
    )

    invited_by_membership_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), nullable=False
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_normalized: Mapped[str] = mapped_column(String(320), nullable=False)
    job_title: Mapped[str | None] = mapped_column(String(160))
    performs_treatments: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    token_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TeamMember(UUIDPrimaryKeyMixin, TimestampMixin, TenantOwnedMixin, Base):
    """A salon staff profile, independent from access to the admin panel.

    A practitioner can exist without a login. When a profile belongs to a
    BeautyDocs user, ``membership_id`` links the roster entry to that user's
    tenant-scoped access membership.
    """

    __tablename__ = "team_members"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_team_member_tenant_id"),
        UniqueConstraint(
            "tenant_id",
            "membership_id",
            name="uq_team_member_tenant_membership",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_team_member_tenant_membership",
            ondelete="RESTRICT",
        ),
        Index(
            "ix_team_members_tenant_active_name",
            "tenant_id",
            "is_active",
            "display_name",
        ),
    )

    membership_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(32))
    phone_normalized: Mapped[str | None] = mapped_column(String(32))
    job_title: Mapped[str | None] = mapped_column(String(160))
    is_owner: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    performs_treatments: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    all_treatments: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    treatment_codes: Mapped[list[str]] = mapped_column(
        json_document_type(), nullable=False, default=list
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    signature_data_url: Mapped[str | None] = mapped_column(Text)
    signature_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Client(UUIDPrimaryKeyMixin, TimestampMixin, TenantOwnedMixin, Base):
    __tablename__ = "clients"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_client_tenant_id"),
        Index(
            "ix_clients_tenant_name",
            "tenant_id",
            "last_name_normalized",
            "first_name_normalized",
        ),
        Index("ix_clients_tenant_phone", "tenant_id", "phone_normalized"),
        Index("ix_clients_tenant_created", "tenant_id", "created_at"),
    )

    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(160), nullable=False)
    first_name_normalized: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name_normalized: Mapped[str] = mapped_column(String(160), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    phone_normalized: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(320))
    birth_date: Mapped[date | None] = mapped_column(Date)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ClientNote(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    __tablename__ = "client_notes"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_client_note_tenant_id"),
        ForeignKeyConstraint(
            ["tenant_id", "client_id"],
            ["clients.tenant_id", "clients.id"],
            name="fk_client_note_tenant_client",
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "category IN ('NOTATKA', 'ALERGIA', 'UWAGA', 'PREFERENCJA')",
            name="category_allowed",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "author_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_client_note_tenant_author",
            ondelete="RESTRICT",
        ),
        Index("ix_client_notes_tenant_client_created", "tenant_id", "client_id", "created_at"),
    )

    client_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    author_membership_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=ClientNoteCategory.NOTATKA.value
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FormTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "form_templates"
    __table_args__ = (
        CheckConstraint("code = lower(code)", name="code_lowercase"),
        CheckConstraint("status IN ('DRAFT', 'ACTIVE', 'RETIRED')", name="status_allowed"),
    )

    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=TemplateStatus.DRAFT.value
    )


class FormTemplateVersion(UUIDPrimaryKeyMixin, Base):
    """Append-only template content; published rows are DB-trigger protected."""

    __tablename__ = "form_template_versions"
    __table_args__ = (
        UniqueConstraint(
            "form_template_id",
            "version_number",
            name="uq_template_version_number",
        ),
        CheckConstraint("version_number > 0", name="version_positive"),
        CheckConstraint("char_length(content_hash) = 64", name="content_hash_sha256"),
        Index(
            "ix_template_versions_template_published",
            "form_template_id",
            "published_at",
        ),
    )

    form_template_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("form_templates.id", ondelete="RESTRICT"),
        nullable=False,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    schema_definition: Mapped[dict[str, Any]] = mapped_column(
        "schema", json_document_type(), nullable=False
    )
    legal_content: Mapped[dict[str, Any]] = mapped_column(json_document_type(), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TenantFormTemplate(UUIDPrimaryKeyMixin, TimestampMixin, TenantOwnedMixin, Base):
    __tablename__ = "tenant_form_templates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_tenant_form_tenant_id"),
        UniqueConstraint(
            "tenant_id",
            "form_template_id",
            name="uq_tenant_form_template",
        ),
        CheckConstraint("display_order >= 0", name="display_order_nonnegative"),
        CheckConstraint(
            "duration_minutes >= 15 AND duration_minutes <= 480",
            name="duration_minutes_valid",
        ),
        Index(
            "ix_tenant_forms_tenant_enabled_order",
            "tenant_id",
            "enabled",
            "display_order",
        ),
    )

    form_template_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("form_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    duration_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=60,
        server_default="60",
    )


class SalonCatalogItem(UUIDPrimaryKeyMixin, TimestampMixin, TenantOwnedMixin, Base):
    """A tenant-owned snapshot of a product, substance or device.

    RPL and BeautyDocs catalogue records are copied as snapshots so a salon's
    historic recommendation does not silently change when an upstream entry is
    updated. Custom salon equipment and cosmetics use the same structure.
    """

    __tablename__ = "salon_catalog_items"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_salon_catalog_item_tenant_id"),
        UniqueConstraint(
            "tenant_id",
            "source",
            "external_id",
            name="uq_salon_catalog_item_external",
        ),
        CheckConstraint(
            "kind IN ('MEDICINE', 'TREATMENT_SUBSTANCE', 'DEVICE', 'COSMETIC')",
            name="kind_allowed",
        ),
        CheckConstraint(
            "source IN ('RPL', 'BEAUTYDOCS', 'SALON')",
            name="source_allowed",
        ),
        CheckConstraint(
            "source <> 'RPL' OR (kind = 'MEDICINE' AND external_id IS NOT NULL)",
            name="rpl_item_valid",
        ),
        CheckConstraint(
            "is_sponsored = false OR sponsor_name IS NOT NULL",
            name="sponsor_disclosed",
        ),
        Index(
            "ix_salon_catalog_tenant_active_kind",
            "tenant_id",
            "is_active",
            "kind",
        ),
    )

    source: Mapped[str] = mapped_column(String(24), nullable=False)
    external_id: Mapped[str | None] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(250), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(200))
    summary: Mapped[str | None] = mapped_column(Text)
    details: Mapped[dict[str, Any]] = mapped_column(
        json_document_type(), nullable=False, default=dict
    )
    source_label: Mapped[str | None] = mapped_column(String(200))
    source_url: Mapped[str | None] = mapped_column(String(2048))
    used_in_treatments: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    recommended_aftercare: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    treatment_codes: Mapped[list[str]] = mapped_column(
        json_document_type(), nullable=False, default=list
    )
    recommendation_note: Mapped[str | None] = mapped_column(Text)
    is_sponsored: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    sponsor_name: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )


class MedicineProduct(TimestampMixin, Base):
    """Global, nightly synchronized mirror of human medicines from the Polish RPL."""

    __tablename__ = "medicine_products"
    __table_args__ = (
        Index("ix_medicine_products_name", "name"),
        Index("ix_medicine_products_active_substance", "active_substance"),
        Index("ix_medicine_products_atc", "atc_code"),
        Index("ix_medicine_products_active", "is_active"),
    )

    rpl_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(250), nullable=False)
    common_name: Mapped[str | None] = mapped_column(String(500))
    active_substance: Mapped[str | None] = mapped_column(String(1000))
    pharmaceutical_form: Mapped[str | None] = mapped_column(String(300))
    strength: Mapped[str | None] = mapped_column(String(300))
    marketing_authorisation_holder: Mapped[str | None] = mapped_column(String(300))
    registry_number: Mapped[str | None] = mapped_column(String(100))
    atc_code: Mapped[str | None] = mapped_column(String(100))
    search_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_payload: Mapped[dict[str, Any]] = mapped_column(
        json_document_type(), nullable=False, default=dict
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class MedicineSafetyRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Versioned, source-backed rule applied at substance and dosage-form level."""

    __tablename__ = "medicine_safety_rules"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PHOTOSENSITIZING', 'VERIFY')",
            name="medicine_safety_rule_status_allowed",
        ),
        Index("ix_medicine_safety_rules_active", "is_active"),
    )

    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    substance_names: Mapped[list[str]] = mapped_column(
        json_document_type(), nullable=False, default=list
    )
    pharmaceutical_form_terms: Mapped[list[str]] = mapped_column(
        json_document_type(), nullable=False, default=list
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    flags: Mapped[list[str]] = mapped_column(
        json_document_type(), nullable=False, default=list
    )
    treatment_families: Mapped[list[str]] = mapped_column(
        json_document_type(), nullable=False, default=list
    )
    evidence_label: Mapped[str] = mapped_column(String(250), nullable=False)
    evidence_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    reviewed_by: Mapped[str] = mapped_column(String(200), nullable=False)
    reviewed_at: Mapped[date] = mapped_column(Date, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )


class MedicineCatalogSyncRun(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "medicine_catalog_sync_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('RUNNING', 'COMPLETED', 'FAILED')",
            name="medicine_catalog_sync_status_allowed",
        ),
        Index("ix_medicine_catalog_sync_started", "started_at"),
    )

    status: Mapped[str] = mapped_column(String(16), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    products_seen: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    products_imported: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    error_message: Mapped[str | None] = mapped_column(String(500))


class Visit(UUIDPrimaryKeyMixin, TimestampMixin, TenantOwnedMixin, Base):
    __tablename__ = "visits"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_visit_tenant_id"),
        ForeignKeyConstraint(
            ["tenant_id", "client_id"],
            ["clients.tenant_id", "clients.id"],
            name="fk_visit_tenant_client",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "staff_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_visit_tenant_staff",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "status IN ('PLANNED', 'COMPLETED', 'CANCELLED')",
            name="status_allowed",
        ),
        Index("ix_visits_tenant_client_start", "tenant_id", "client_id", "starts_at"),
        Index("ix_visits_tenant_start", "tenant_id", "starts_at"),
    )

    client_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    staff_membership_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    form_template_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("form_templates.id", ondelete="SET NULL"),
    )
    treatment_name: Mapped[str] = mapped_column(String(250), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=VisitStatus.PLANNED.value
    )
    notes: Mapped[str | None] = mapped_column(Text)
    anaesthesia: Mapped[str | None] = mapped_column(Text)


class FormSubmission(UUIDPrimaryKeyMixin, TimestampMixin, TenantOwnedMixin, Base):
    __tablename__ = "form_submissions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_submission_tenant_id"),
        ForeignKeyConstraint(
            ["tenant_id", "client_id"],
            ["clients.tenant_id", "clients.id"],
            name="fk_submission_tenant_client",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "visit_id"],
            ["visits.tenant_id", "visits.id"],
            name="fk_submission_tenant_visit",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "submitted_by_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_submission_tenant_submitter",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "practitioner_team_member_id"],
            ["team_members.tenant_id", "team_members.id"],
            name="fk_submission_tenant_practitioner",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "status IN ('DRAFT', 'SUBMITTED', 'SIGNED', 'VOID')",
            name="status_allowed",
        ),
        CheckConstraint(
            "document_hash IS NULL OR char_length(document_hash) = 64",
            name="document_hash_sha256",
        ),
        CheckConstraint(
            "status <> 'SIGNED' OR "
            "(signed_at IS NOT NULL AND document_hash IS NOT NULL "
            "AND document_snapshot IS NOT NULL)",
            name="signed_document_complete",
        ),
        Index(
            "ix_submissions_tenant_client_created",
            "tenant_id",
            "client_id",
            "created_at",
        ),
        Index(
            "ix_submissions_tenant_status_created",
            "tenant_id",
            "status",
            "created_at",
        ),
    )

    client_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    visit_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    form_template_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("form_template_versions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    submitted_by_membership_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    practitioner_team_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=SubmissionStatus.DRAFT.value
    )
    answers: Mapped[dict[str, Any]] = mapped_column(
        json_document_type(), nullable=False, default=dict
    )
    document_snapshot: Mapped[dict[str, Any] | None] = mapped_column(json_document_type())
    document_hash: Mapped[str | None] = mapped_column(String(64))
    public_access_token_digest: Mapped[str | None] = mapped_column(String(64))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    practitioner_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    practitioner_signature_data_url: Mapped[str | None] = mapped_column(Text)
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SalonNotification(UUIDPrimaryKeyMixin, TimestampMixin, TenantOwnedMixin, Base):
    """A durable shared-inbox message scoped to one salon."""

    __tablename__ = "salon_notifications"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_salon_notification_tenant_id"),
        UniqueConstraint(
            "tenant_id",
            "kind",
            "resource_type",
            "resource_id",
            name="uq_salon_notification_resource",
        ),
        CheckConstraint(
            "severity IN ('INFO', 'ACTION_REQUIRED')",
            name="severity_allowed",
        ),
        Index(
            "ix_salon_notifications_tenant_inbox_created",
            "tenant_id",
            "archived_at",
            "created_at",
        ),
        Index(
            "ix_salon_notifications_tenant_unread_created",
            "tenant_id",
            "read_at",
            "created_at",
        ),
        Index(
            "ix_salon_notifications_tenant_kind_resolved",
            "tenant_id",
            "kind",
            "resolved_at",
        ),
    )

    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        server_default=SalonNotificationSeverity.INFO.value,
    )
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    action_label: Mapped[str | None] = mapped_column(String(120))
    details: Mapped[dict[str, Any]] = mapped_column(
        "metadata", json_document_type(), nullable=False, default=dict
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SignatureVerification(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    __tablename__ = "signature_verifications"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_signature_verification_tenant_id"),
        ForeignKeyConstraint(
            ["tenant_id", "form_submission_id"],
            ["form_submissions.tenant_id", "form_submissions.id"],
            name="fk_signature_tenant_submission",
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED')",
            name="status_allowed",
        ),
        CheckConstraint(
            "signer_type IN ('CLIENT', 'PRACTITIONER')",
            name="signer_type_allowed",
        ),
        CheckConstraint("attempt_count >= 0", name="attempt_count_nonnegative"),
        CheckConstraint(
            "document_hash IS NULL OR char_length(document_hash) = 64",
            name="document_hash_sha256",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "signer_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_signature_tenant_signer_membership",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "signer_team_member_id"],
            ["team_members.tenant_id", "team_members.id"],
            name="fk_signature_tenant_signer_team_member",
            ondelete="RESTRICT",
        ),
        Index(
            "ix_signature_verifications_tenant_expires",
            "tenant_id",
            "expires_at",
        ),
        Index(
            "ix_signature_verifications_tenant_submission_created",
            "tenant_id",
            "form_submission_id",
            "created_at",
        ),
    )

    form_submission_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    method: Mapped[str] = mapped_column(String(32), nullable=False, server_default="SMS_OTP")
    signer_type: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        server_default=SignatureSignerType.CLIENT.value,
    )
    signer_membership_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    signer_team_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=VerificationStatus.PENDING.value
    )
    otp_digest: Mapped[str] = mapped_column(String(255), nullable=False)
    destination_masked: Mapped[str] = mapped_column(String(64), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(32))
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    document_hash: Mapped[str | None] = mapped_column(String(64))
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    requested_ip_address: Mapped[str | None] = mapped_column(String(64))
    requested_user_agent: Mapped[str | None] = mapped_column(String(512))
    verified_ip_address: Mapped[str | None] = mapped_column(String(64))
    verified_user_agent: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FileObject(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    __tablename__ = "file_objects"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_file_object_tenant_id"),
        UniqueConstraint(
            "storage_provider",
            "bucket",
            "object_key",
            name="uq_file_object_storage_key",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "client_id"],
            ["clients.tenant_id", "clients.id"],
            name="fk_file_object_tenant_client",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "form_submission_id"],
            ["form_submissions.tenant_id", "form_submissions.id"],
            name="fk_file_object_tenant_submission",
            ondelete="RESTRICT",
        ),
        CheckConstraint("size_bytes >= 0", name="size_nonnegative"),
        CheckConstraint("char_length(sha256) = 64", name="sha256_length"),
        Index(
            "ix_file_objects_tenant_submission",
            "tenant_id",
            "form_submission_id",
        ),
        Index("ix_file_objects_tenant_client", "tenant_id", "client_id"),
    )

    client_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    form_submission_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    storage_provider: Mapped[str] = mapped_column(String(32), nullable=False)
    bucket: Mapped[str] = mapped_column(String(255), nullable=False)
    object_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditEvent(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    """Append-only audit entry; mutation is rejected by a database trigger."""

    __tablename__ = "audit_events"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_audit_event_tenant_id"),
        ForeignKeyConstraint(
            ["tenant_id", "actor_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_audit_event_tenant_actor",
            ondelete="RESTRICT",
        ),
        Index(
            "ix_audit_events_tenant_occurred",
            "tenant_id",
            "occurred_at",
        ),
        Index(
            "ix_audit_events_tenant_resource",
            "tenant_id",
            "resource_type",
            "resource_id",
        ),
    )

    actor_membership_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    details: Mapped[dict[str, Any]] = mapped_column(
        "metadata", json_document_type(), nullable=False, default=dict
    )
    request_id: Mapped[str | None] = mapped_column(String(100))
    ip_hash: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(512))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
