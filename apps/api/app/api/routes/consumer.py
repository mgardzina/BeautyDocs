from __future__ import annotations

import hashlib
import secrets
import unicodedata
from calendar import monthrange
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any, Literal
from uuid import UUID

from anyio import to_thread
from fastapi import APIRouter, Path, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import delete, or_, select, update

from app.api.dependencies import (
    CurrentConsumerDep,
    DbSessionDep,
    OptionalConsumerDep,
    SettingsDep,
    TrustedOriginDep,
)
from app.api.routes.admin_clients import (
    ClientFormAnswerSectionResponse,
    _build_form_answer_sections,
)
from app.core.auth_context import AuthenticatedConsumer
from app.core.errors import AppError, error_response
from app.core.security import (
    generate_session_token,
    generate_verification_code,
    hash_password,
    is_valid_session_token,
    session_token_digest,
    verification_code_digest,
    verify_dummy_password,
    verify_password,
)
from app.db.tenant_context import set_tenant_context
from app.models.domain import (
    ChatMessageKind,
    Client,
    ConsumerAccount,
    ConsumerAppointment,
    ConsumerChallengeStatus,
    ConsumerDocumentClaim,
    ConsumerGoogleIdentity,
    ConsumerLoginChallenge,
    ConsumerRegistration,
    ConsumerSession,
    ConsumerSubmissionLink,
    FormSubmission,
    FormTemplate,
    FormTemplateVersion,
    MfaChallengePurpose,
    MfaMethod,
    SubmissionStatus,
    TemplateStatus,
    Tenant,
    TenantFormTemplate,
    TenantStatus,
    Visit,
    VisitStatus,
)
from app.services.account_email import (
    VerificationEmailDeliveryError,
    send_account_verification_email,
)
from app.services.booking_schedule import (
    BOOKING_DURATION_MINUTES,
    BOOKING_TIME_ZONE,
    booking_day_window,
    booking_start_allowed,
    normalize_booking_schedule,
)
from app.services.chat_automation import append_visit_chat_event
from app.services.check_in_token import issue_check_in_token
from app.services.consumer_documents import consumer_claim_token_digest
from app.services.consumer_mfa import consumer_mfa_enabled, issue_consumer_mfa_challenge
from app.services.google_identity import (
    GoogleIdentityVerificationError,
    VerifiedGoogleIdentity,
    resolve_google_identity,
)
from app.services.signature_image import (
    SIGNATURE_MAX_CHARS,
    InvalidSignatureImageError,
    decode_signature_png_data_url,
)
from app.services.signature_sms import (
    mask_phone,
    normalize_phone,
    send_consumer_login_code,
    signing_request_metadata,
)

router = APIRouter(prefix="/consumer", tags=["consumer"])
_NO_STORE = {"Cache-Control": "no-store"}
EMAIL_VERIFICATION_TTL_SECONDS = 15 * 60
EMAIL_VERIFICATION_MAX_ATTEMPTS = 6
# How long a verified e-mail can be finalized (name + password) before the
# one-time completion token expires.
REGISTRATION_COMPLETION_TTL_SECONDS = 30 * 60
BOOKING_SLOT_MINUTES = BOOKING_DURATION_MINUTES
BOOKING_WINDOW_DAYS = 365
_MEDICATION_FOLLOW_UP_KEYS = frozenset(
    {
        "antykoagulanty",
        "antykoagulantyLekiRozrzedzajace",
        "lekiKrzepliwosc",
        "lekiMiejscowe",
        "lekiRozrzedzajace",
        "lekiRozrzedzajaceKrew",
    }
)
_MEDICATION_FOLLOW_UP_PLACEHOLDER = "Podaj nazwę leku, dawkę i częstotliwość stosowania"
ConsumerSignatureKeyPath = Annotated[
    str,
    Path(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_-]+$"),
]


def _directory_search_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold()).replace("ł", "l")
    return "".join(character for character in normalized if not unicodedata.combining(character))


class ConsumerModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class ConsumerProfileResponse(ConsumerModel):
    full_name: str
    phone: str | None
    email: str | None
    birth_date: date | None
    street: str | None
    house_number: str | None
    apartment_number: str | None
    postal_code: str | None
    city: str | None
    medical_answers: dict[str, Any]
    medical_profile_updated_at: datetime | None
    signature_configured: bool
    signature_updated_at: datetime | None


class ConsumerStateResponse(ConsumerModel):
    profile: ConsumerProfileResponse
    sign_in_methods: list[Literal["password", "google"]]
    phone_verified: bool


class ConsumerMfaLoginChallengeResponse(ConsumerModel):
    mfa_required: Literal[True] = True
    challenge_id: UUID
    method: MfaMethod
    destination_masked: str | None = Field(default=None, max_length=64)
    expires_in_seconds: int = Field(ge=120, le=900)
    dev_code: str | None = Field(default=None, min_length=6, max_length=6)


class ConsumerRegisterRequest(ConsumerModel):
    """E-mail-first client sign-up start; name and password come after verify."""

    email: str = Field(min_length=3, max_length=320)


class DeleteConsumerAccountRequest(ConsumerModel):
    confirmation: Literal["USUŃ KONTO"]


class ConsumerEmailVerificationResponse(ConsumerModel):
    email: str = Field(max_length=320)
    expires_in_seconds: int
    dev_code: str | None = Field(default=None, min_length=6, max_length=6)


class ConsumerEmailVerifyRequest(ConsumerModel):
    email: str = Field(min_length=3, max_length=320)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ConsumerVerifyResponse(ConsumerModel):
    email: str = Field(max_length=320)
    # One-time token authorizing the finalize step; never a session.
    registration_token: str = Field(max_length=128)


class ConsumerCompleteRequest(ConsumerModel):
    """Finalize a verified client sign-up: name + password create the account."""

    registration_token: str = Field(min_length=16, max_length=128)
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=8, max_length=1024)


class ConsumerPasswordLoginRequest(ConsumerModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)


class GoogleLoginConfigResponse(ConsumerModel):
    enabled: bool
    client_id: str | None


class GoogleLoginRequest(ConsumerModel):
    credential: str | None = Field(default=None, min_length=20, max_length=8_192)
    access_token: str | None = Field(default=None, min_length=20, max_length=8_192)


class LoginCodeResponse(ConsumerModel):
    challenge_id: UUID
    destination_masked: str
    expires_in_seconds: int
    dev_code: str | None = Field(default=None, min_length=6, max_length=6)


class PhoneVerificationRequest(ConsumerModel):
    phone: str = Field(min_length=8, max_length=32)


class PhoneVerificationConfirm(PhoneVerificationRequest):
    challenge_id: UUID
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ClaimDocumentRequest(ConsumerModel):
    submission_id: UUID
    claim_token: str = Field(min_length=43, max_length=43)
    save_profile: bool = True


class ConsumerProfileUpdate(ConsumerModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    birth_date: date | None = None
    street: str | None = Field(default=None, max_length=250)
    house_number: str | None = Field(default=None, max_length=30)
    apartment_number: str | None = Field(default=None, max_length=30)
    postal_code: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=120)


class ConsumerMedicalAnswerInput(ConsumerModel):
    answer: Literal["yes", "no"]
    follow_up: str | None = Field(default=None, max_length=1_000)


class ConsumerMedicalProfileUpdate(ConsumerModel):
    answers: dict[str, ConsumerMedicalAnswerInput] = Field(max_length=500)


class ConsumerMedicalQuestionResponse(ConsumerModel):
    key: str = Field(min_length=1, max_length=120)
    question: str = Field(min_length=1, max_length=2_000)
    has_follow_up: bool
    follow_up_placeholder: str | None = Field(default=None, max_length=500)
    category: str | None = Field(default=None, max_length=250)
    source_forms: list[str] = Field(max_length=100)


class ConsumerMedicalCatalogResponse(ConsumerModel):
    questions: list[ConsumerMedicalQuestionResponse] = Field(max_length=500)


class ConsumerSignatureRequest(ConsumerModel):
    signature: str = Field(min_length=32, max_length=SIGNATURE_MAX_CHARS)


class ConsumerDocumentSummary(ConsumerModel):
    submission_id: UUID
    tenant_slug: str
    salon_name: str
    form_code: str
    form_name: str
    status: str
    signed_at: datetime | None
    practitioner_signed_at: datetime | None
    shared_at: datetime


class ConsumerDocumentListResponse(ConsumerModel):
    items: list[ConsumerDocumentSummary]


class ConsumerDocumentAnatomy(ConsumerModel):
    model: Literal["face", "body", "both"]
    face_zone_set: str | None = Field(default=None, max_length=100)
    body_zone_set: str | None = Field(default=None, max_length=100)


class ConsumerDocumentDetail(ConsumerDocumentSummary):
    client: dict[str, Any]
    answers: dict[str, Any]
    sections: list[ClientFormAnswerSectionResponse]
    anatomy: ConsumerDocumentAnatomy | None
    treatment_area_ids: list[str] = Field(max_length=100)
    signature_keys: list[str]
    client_signed_at: datetime | None
    practitioner: dict[str, Any] | None


class ConsumerSalonForm(ConsumerModel):
    code: str = Field(max_length=100)
    display_name: str = Field(max_length=250)


class ConsumerSalonSummary(ConsumerModel):
    cover_url: str | None = None
    introduction: str = ""
    starting_price: int | None = None
    slug: str = Field(max_length=63)
    display_name: str = Field(max_length=200)
    logo_url: str | None = Field(default=None, max_length=320_000)
    city: str | None = Field(default=None, max_length=120)
    postal_code: str | None = Field(default=None, max_length=20)
    address_line1: str | None = Field(default=None, max_length=250)
    address_line2: str | None = Field(default=None, max_length=250)
    phone: str | None = Field(default=None, max_length=32)
    website_url: str | None = Field(default=None, max_length=2048)
    active_forms: list[ConsumerSalonForm] = Field(max_length=100)


class ConsumerSalonListResponse(ConsumerModel):
    items: list[ConsumerSalonSummary] = Field(max_length=24)


class ConsumerAppointmentSlot(ConsumerModel):
    starts_at: datetime
    ends_at: datetime


class ConsumerAppointmentAvailability(ConsumerModel):
    date: date
    time_zone: str = Field(max_length=64)
    slot_minutes: int = Field(ge=15, le=480)
    slot_interval_minutes: int = Field(ge=15, le=60)
    slots: list[ConsumerAppointmentSlot] = Field(max_length=96)


class ConsumerAppointmentMonthDay(ConsumerModel):
    date: date
    available_slots: int = Field(ge=0, le=96)


class ConsumerAppointmentMonthAvailability(ConsumerModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    time_zone: str = Field(max_length=64)
    slot_minutes: int = Field(ge=15, le=480)
    days: list[ConsumerAppointmentMonthDay] = Field(max_length=31)


class ConsumerAppointmentCreateRequest(ConsumerModel):
    tenant_slug: str = Field(min_length=1, max_length=63, pattern=r"^[a-z0-9-]+$")
    form_code: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    starts_at: datetime


class ConsumerAppointmentResponse(ConsumerModel):
    id: UUID
    tenant_slug: str = Field(max_length=63)
    salon_name: str = Field(max_length=200)
    form_code: str = Field(max_length=100)
    form_name: str = Field(max_length=250)
    starts_at: datetime
    ends_at: datetime
    status: str = Field(max_length=16)
    form_submitted: bool


class ConsumerAppointmentCreatedResponse(ConsumerAppointmentResponse):
    booking_token: str = Field(min_length=43, max_length=43)


class ConsumerAppointmentListResponse(ConsumerModel):
    items: list[ConsumerAppointmentResponse] = Field(max_length=100)


class ConsumerAppointmentFormAccess(ConsumerModel):
    appointment_id: UUID
    tenant_slug: str = Field(max_length=63)
    form_code: str = Field(max_length=100)
    booking_token: str = Field(min_length=43, max_length=43)


def _profile_response(account: ConsumerAccount) -> ConsumerProfileResponse:
    profile = account.medical_profile if isinstance(account.medical_profile, dict) else {}
    medical_answers = profile.get("contraindications", {})
    if not isinstance(medical_answers, dict):
        medical_answers = {}
    return ConsumerProfileResponse(
        full_name=account.full_name,
        phone=account.phone,
        email=account.email,
        birth_date=account.birth_date,
        street=account.street,
        house_number=account.house_number,
        apartment_number=account.apartment_number,
        postal_code=account.postal_code,
        city=account.city,
        medical_answers=medical_answers,
        medical_profile_updated_at=account.medical_profile_updated_at,
        signature_configured=bool(account.signature_data_url),
        signature_updated_at=account.signature_updated_at,
    )


async def _state_response(
    session: DbSessionDep,
    account: ConsumerAccount,
) -> ConsumerStateResponse:
    methods: list[Literal["password", "google"]] = []
    if account.password_hash is not None:
        methods.append("password")
    phone_verified = (
        account.phone_normalized is not None and account.phone_verified_at is not None
    )
    google_identity_id = await session.scalar(
        select(ConsumerGoogleIdentity.id).where(
            ConsumerGoogleIdentity.consumer_account_id == account.id
        )
    )
    if google_identity_id is not None:
        methods.append("google")
    return ConsumerStateResponse(
        profile=_profile_response(account),
        sign_in_methods=methods,
        phone_verified=phone_verified,
    )


def _set_consumer_cookie(
    response: Response,
    *,
    settings: SettingsDep,
    raw_token: str,
    expires_at: datetime,
) -> None:
    response.set_cookie(
        key=settings.consumer_session_cookie_name,
        value=raw_token,
        max_age=settings.consumer_session_ttl_seconds,
        expires=expires_at,
        path="/",
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite="lax",
    )


async def _open_session(
    *,
    session: DbSessionDep,
    settings: SettingsDep,
    response: Response,
    account: ConsumerAccount,
) -> None:
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=settings.consumer_session_ttl_seconds)
    raw_token = generate_session_token()
    session.add(
        ConsumerSession(
            consumer_account_id=account.id,
            token_digest=session_token_digest(raw_token),
            created_at=now,
            expires_at=expires_at,
        )
    )
    await session.flush()
    _set_consumer_cookie(
        response,
        settings=settings,
        raw_token=raw_token,
        expires_at=expires_at,
    )


@router.post(
    "/auth/register",
    response_model=ConsumerEmailVerificationResponse,
    status_code=201,
)
async def register(
    payload: ConsumerRegisterRequest,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
) -> ConsumerEmailVerificationResponse:
    normalized_email = _normalize_email(payload.email)
    if normalized_email is None or "@" not in normalized_email:
        raise AppError(
            status_code=422,
            code="invalid_email",
            message="Email address is invalid",
            headers=_NO_STORE,
        )
    existing = await session.scalar(
        select(ConsumerAccount.id)
        .where(ConsumerAccount.email_normalized == normalized_email)
        .limit(1)
    )
    if existing is not None:
        raise AppError(
            status_code=409,
            code="consumer_email_taken",
            message="A consumer account already uses this email",
            headers=_NO_STORE,
        )

    now = datetime.now(UTC)
    code = generate_verification_code()
    expires_at = now + timedelta(seconds=EMAIL_VERIFICATION_TTL_SECONDS)

    # Only a pending verification exists until the name + password step.
    pending = await session.scalar(
        select(ConsumerRegistration)
        .where(ConsumerRegistration.email_normalized == normalized_email)
        .with_for_update()
    )
    if pending is None:
        pending = ConsumerRegistration(
            email=payload.email.strip(),
            email_normalized=normalized_email,
        )
        session.add(pending)
    pending.email = payload.email.strip()
    pending.verification_code_hash = verification_code_digest(code)
    pending.verification_code_expires_at = expires_at
    pending.verification_attempts = 0
    pending.email_verified_at = None
    pending.registration_token_hash = None
    pending.registration_token_expires_at = None
    await session.flush()

    try:
        await send_account_verification_email(
            recipient_email=pending.email,
            recipient_name=pending.email,
            code=code,
            expires_in_seconds=EMAIL_VERIFICATION_TTL_SECONDS,
            settings=settings,
        )
    except VerificationEmailDeliveryError as exc:
        raise AppError(
            status_code=503,
            code="verification_email_unavailable",
            message="Account verification e-mail could not be sent",
            headers=_NO_STORE,
        ) from exc

    return ConsumerEmailVerificationResponse(
        email=pending.email,
        expires_in_seconds=EMAIL_VERIFICATION_TTL_SECONDS,
        dev_code=code if settings.environment in {"local", "test"} else None,
    )


def _invalid_email_verification_code(request: Request) -> JSONResponse:
    return error_response(
        request,
        status_code=400,
        code="invalid_code",
        message="The verification code is invalid or has expired",
        headers=_NO_STORE,
    )


def _invalid_consumer_registration(request: Request) -> JSONResponse:
    return error_response(
        request,
        status_code=400,
        code="invalid_registration",
        message="The registration session is invalid or has expired",
        headers=_NO_STORE,
    )


@router.post(
    "/auth/register/verify",
    response_model=ConsumerVerifyResponse,
    responses={400: {"description": "Invalid or expired code"}},
)
async def verify_email_registration(
    payload: ConsumerEmailVerifyRequest,
    request: Request,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
) -> ConsumerVerifyResponse | JSONResponse:
    now = datetime.now(UTC)
    normalized_email = _normalize_email(payload.email)
    pending = None
    if normalized_email is not None:
        pending = await session.scalar(
            select(ConsumerRegistration)
            .where(ConsumerRegistration.email_normalized == normalized_email)
            .with_for_update()
        )
    if (
        pending is None
        or pending.verification_code_hash is None
        or pending.email_verified_at is not None
        or pending.verification_code_expires_at is None
        or pending.verification_code_expires_at <= now
        or pending.verification_attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS
    ):
        return _invalid_email_verification_code(request)

    if verification_code_digest(payload.code) != pending.verification_code_hash:
        pending.verification_attempts += 1
        return _invalid_email_verification_code(request)

    # Verified: mint a one-time token for the finalize step; no session yet.
    registration_token = generate_session_token()
    pending.email_verified_at = now
    pending.verification_code_hash = None
    pending.verification_code_expires_at = None
    pending.verification_attempts = 0
    pending.registration_token_hash = session_token_digest(registration_token)
    pending.registration_token_expires_at = now + timedelta(
        seconds=REGISTRATION_COMPLETION_TTL_SECONDS
    )
    return ConsumerVerifyResponse(
        email=pending.email, registration_token=registration_token
    )


@router.post(
    "/auth/register/complete",
    response_model=ConsumerStateResponse,
    responses={
        400: {"description": "Invalid or expired registration"},
        409: {"description": "Email already registered"},
    },
)
async def complete_registration(
    payload: ConsumerCompleteRequest,
    request: Request,
    response: Response,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
) -> ConsumerStateResponse | JSONResponse:
    now = datetime.now(UTC)
    try:
        token_digest = session_token_digest(payload.registration_token)
    except ValueError:
        return _invalid_consumer_registration(request)

    pending = await session.scalar(
        select(ConsumerRegistration)
        .where(ConsumerRegistration.registration_token_hash == token_digest)
        .with_for_update()
    )
    if (
        pending is None
        or pending.email_verified_at is None
        or pending.registration_token_expires_at is None
        or pending.registration_token_expires_at <= now
    ):
        return _invalid_consumer_registration(request)

    existing = await session.scalar(
        select(ConsumerAccount.id).where(
            ConsumerAccount.email_normalized == pending.email_normalized
        )
    )
    if existing is not None:
        raise AppError(
            status_code=409,
            code="consumer_email_taken",
            message="A consumer account already uses this email",
            headers=_NO_STORE,
        )

    password_hash = await to_thread.run_sync(hash_password, payload.password)
    account = ConsumerAccount(
        phone=None,
        phone_normalized=None,
        full_name=payload.full_name.strip(),
        email=pending.email,
        email_normalized=pending.email_normalized,
        password_hash=password_hash,
        medical_profile={},
        phone_verified_at=None,
        email_verified_at=now,
    )
    session.add(account)
    await session.flush()

    await session.execute(
        delete(ConsumerRegistration).where(ConsumerRegistration.id == pending.id)
    )
    await _open_session(
        session=session,
        settings=settings,
        response=response,
        account=account,
    )
    response.headers["Cache-Control"] = "no-store"
    return await _state_response(session, account)


@router.post(
    "/auth/password",
    response_model=ConsumerStateResponse | ConsumerMfaLoginChallengeResponse,
)
async def login_with_password(
    payload: ConsumerPasswordLoginRequest,
    request: Request,
    response: Response,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
) -> ConsumerStateResponse | ConsumerMfaLoginChallengeResponse:
    normalized_email = _normalize_email(payload.email)
    account = None
    if normalized_email is not None:
        account = await session.scalar(
            select(ConsumerAccount)
            .where(ConsumerAccount.email_normalized == normalized_email)
            .with_for_update()
        )
    if account is None or account.password_hash is None:
        await to_thread.run_sync(verify_dummy_password, payload.password)
        raise _invalid_consumer_credentials()

    password_check = await to_thread.run_sync(
        verify_password,
        payload.password,
        account.password_hash,
    )
    if not password_check.valid:
        raise _invalid_consumer_credentials()
    if password_check.upgraded_hash is not None:
        account.password_hash = password_check.upgraded_hash

    if account.email_verified_at is None:
        raise AppError(
            status_code=403,
            code="consumer_email_unverified",
            message="Confirm your e-mail address before signing in",
            headers=_NO_STORE,
        )

    if consumer_mfa_enabled(account):
        method = MfaMethod(account.mfa_method)
        challenge, dev_code = await issue_consumer_mfa_challenge(
            session=session,
            request=request,
            settings=settings,
            account=account,
            purpose=MfaChallengePurpose.LOGIN,
            method=method,
            phone_normalized=(
                account.mfa_phone_normalized if method == MfaMethod.SMS else None
            ),
        )
        await session.flush()
        response.headers["Cache-Control"] = "no-store"
        return ConsumerMfaLoginChallengeResponse(
            challenge_id=challenge.id,
            method=method,
            destination_masked=challenge.destination_masked,
            expires_in_seconds=settings.auth_mfa_challenge_ttl_seconds,
            dev_code=dev_code,
        )

    await _open_session(
        session=session,
        settings=settings,
        response=response,
        account=account,
    )
    response.headers["Cache-Control"] = "no-store"
    return await _state_response(session, account)


def _invalid_consumer_credentials() -> AppError:
    return AppError(
        status_code=401,
        code="invalid_credentials",
        message="Email or password is incorrect",
        headers=_NO_STORE,
    )


def _account_not_found() -> AppError:
    return AppError(
        status_code=404,
        code="consumer_account_not_found",
        message="Create a client account after signing a BeautyDocs form",
        headers=_NO_STORE,
    )


@router.get("/auth/google/config", response_model=GoogleLoginConfigResponse)
async def google_login_config(settings: SettingsDep) -> GoogleLoginConfigResponse:
    return GoogleLoginConfigResponse(
        enabled=settings.google_client_id is not None,
        client_id=settings.google_client_id,
    )


@router.post("/auth/google", response_model=ConsumerStateResponse)
async def google_login(
    payload: GoogleLoginRequest,
    response: Response,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    principal: OptionalConsumerDep,
    session: DbSessionDep,
) -> ConsumerStateResponse:
    if settings.google_client_id is None:
        raise AppError(
            status_code=503,
            code="google_auth_not_configured",
            message="Google sign-in is not configured",
            headers=_NO_STORE,
        )
    try:
        verified = await resolve_google_identity(
            client_id=settings.google_client_id,
            credential=payload.credential,
            access_token=payload.access_token,
        )
    except GoogleIdentityVerificationError:
        raise AppError(
            status_code=401,
            code="invalid_google_credential",
            message="Google credential is invalid",
            headers=_NO_STORE,
        ) from None

    now = datetime.now(UTC)
    identity = await session.scalar(
        select(ConsumerGoogleIdentity)
        .where(ConsumerGoogleIdentity.google_subject == verified.subject)
        .with_for_update()
    )
    account = await _resolve_google_account(
        session=session,
        principal=principal,
        identity=identity,
        verified=verified,
        now=now,
    )
    await session.flush()
    await _open_session(
        session=session,
        settings=settings,
        response=response,
        account=account,
    )
    response.headers["Cache-Control"] = "no-store"
    return await _state_response(session, account)


async def _resolve_google_account(
    *,
    session: DbSessionDep,
    principal: AuthenticatedConsumer | None,
    identity: ConsumerGoogleIdentity | None,
    verified: VerifiedGoogleIdentity,
    now: datetime,
) -> ConsumerAccount:
    principal_account = (
        await session.get(ConsumerAccount, principal.consumer_account_id)
        if principal is not None
        else None
    )
    if identity is not None:
        account = await session.get(ConsumerAccount, identity.consumer_account_id)
        if account is None:
            raise _account_not_found()
        if principal_account is not None and account.id != principal_account.id:
            if account.phone_normalized is not None:
                raise _google_account_conflict()
            existing_target_identity = await session.scalar(
                select(ConsumerGoogleIdentity.id).where(
                    ConsumerGoogleIdentity.consumer_account_id == principal_account.id
                )
            )
            if existing_target_identity is not None:
                raise _google_account_conflict()
            identity.consumer_account_id = principal_account.id
            if principal_account.email is None:
                principal_account.email = verified.email
                principal_account.email_normalized = verified.email_normalized
            await session.flush()
            await session.delete(account)
            account = principal_account
    else:
        account = principal_account
        if account is None and verified.email_is_authoritative:
            candidates = (
                await session.scalars(
                    select(ConsumerAccount)
                    .where(ConsumerAccount.email_normalized == verified.email_normalized)
                    .limit(2)
                )
            ).all()
            if len(candidates) == 1:
                account = candidates[0]
        if account is None:
            account = ConsumerAccount(
                phone=None,
                phone_normalized=None,
                full_name=verified.full_name,
                email=verified.email,
                email_normalized=verified.email_normalized,
                medical_profile={},
                phone_verified_at=None,
            )
            session.add(account)
            await session.flush()
        existing_account_identity = await session.scalar(
            select(ConsumerGoogleIdentity.id).where(
                ConsumerGoogleIdentity.consumer_account_id == account.id
            )
        )
        if existing_account_identity is not None:
            raise _google_account_conflict()
        identity = ConsumerGoogleIdentity(
            consumer_account_id=account.id,
            google_subject=verified.subject,
            email=verified.email,
            email_normalized=verified.email_normalized,
            hosted_domain=verified.hosted_domain,
            email_verified_at=now,
            created_at=now,
            last_login_at=now,
        )
        session.add(identity)

    identity.email = verified.email
    identity.email_normalized = verified.email_normalized
    identity.hosted_domain = verified.hosted_domain
    identity.email_verified_at = now
    identity.last_login_at = now
    account.email_verified_at = account.email_verified_at or now
    account.verification_code_hash = None
    account.verification_code_expires_at = None
    account.verification_attempts = 0
    if account.email is None:
        account.email = verified.email
        account.email_normalized = verified.email_normalized
    return account


def _google_account_conflict() -> AppError:
    return AppError(
        status_code=409,
        code="google_account_conflict",
        message="Google identity is already linked to another account",
        headers=_NO_STORE,
    )


async def _issue_phone_verification_code(
    *,
    session: DbSessionDep,
    settings: SettingsDep,
    request: Request,
    phone: str,
    now: datetime,
) -> tuple[ConsumerLoginChallenge, str]:
    """Rate-limit and persist an SMS challenge used to verify a profile phone."""

    latest = await session.scalar(
        select(ConsumerLoginChallenge)
        .where(
            ConsumerLoginChallenge.phone_normalized == phone,
            ConsumerLoginChallenge.status == ConsumerChallengeStatus.PENDING.value,
        )
        .order_by(ConsumerLoginChallenge.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    if latest is not None:
        elapsed = (now - latest.created_at).total_seconds()
        if elapsed < settings.signature_otp_resend_cooldown_seconds:
            retry_after = max(
                1,
                settings.signature_otp_resend_cooldown_seconds - int(elapsed),
            )
            raise AppError(
                status_code=429,
                code="otp_rate_limited",
                message="Wait before requesting another code",
                headers={**_NO_STORE, "Retry-After": str(retry_after)},
            )
        latest.status = ConsumerChallengeStatus.EXPIRED.value

    code = generate_verification_code()
    otp_digest = await to_thread.run_sync(hash_password, code)
    dispatch = await send_consumer_login_code(phone=phone, code=code, settings=settings)
    metadata = signing_request_metadata(request)
    challenge = ConsumerLoginChallenge(
        phone_normalized=phone,
        destination_masked=mask_phone(phone),
        otp_digest=otp_digest,
        status=ConsumerChallengeStatus.PENDING.value,
        attempt_count=0,
        provider=dispatch.provider,
        provider_message_id=dispatch.message_id,
        requested_ip_address=metadata.ip_address,
        requested_user_agent=metadata.user_agent,
        created_at=now,
        expires_at=now + timedelta(seconds=settings.signature_otp_ttl_seconds),
    )
    session.add(challenge)
    await session.flush()
    return challenge, code


def _invalid_code() -> AppError:
    return AppError(
        status_code=400,
        code="invalid_code",
        message="The verification code is invalid or has expired",
        headers=_NO_STORE,
    )


def _phone_taken() -> AppError:
    return AppError(
        status_code=409,
        code="consumer_phone_taken",
        message="This phone number is already linked to another account",
        headers=_NO_STORE,
    )


async def _phone_conflicts_with_other_account(
    session: DbSessionDep,
    *,
    phone_normalized: str,
    account_id: UUID,
) -> bool:
    other_id = await session.scalar(
        select(ConsumerAccount.id).where(
            ConsumerAccount.phone_normalized == phone_normalized,
            ConsumerAccount.id != account_id,
            ConsumerAccount.deleted_at.is_(None),
        )
    )
    return other_id is not None


@router.post("/profile/phone/code", response_model=LoginCodeResponse, status_code=201)
async def request_profile_phone_code(
    payload: PhoneVerificationRequest,
    request: Request,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> LoginCodeResponse:
    """Send an SMS OTP so a signed-in consumer can add or change their phone."""

    account = await session.get(ConsumerAccount, principal.consumer_account_id)
    if account is None:
        raise _account_not_found()
    phone = normalize_phone(payload.phone)
    if await _phone_conflicts_with_other_account(
        session, phone_normalized=phone, account_id=account.id
    ):
        raise _phone_taken()

    challenge, code = await _issue_phone_verification_code(
        session=session,
        settings=settings,
        request=request,
        phone=phone,
        now=datetime.now(UTC),
    )
    return LoginCodeResponse(
        challenge_id=challenge.id,
        destination_masked=challenge.destination_masked,
        expires_in_seconds=settings.signature_otp_ttl_seconds,
        dev_code=code if settings.environment in {"local", "test"} else None,
    )


@router.post("/profile/phone/verify", response_model=ConsumerStateResponse)
async def verify_profile_phone_code(
    payload: PhoneVerificationConfirm,
    request: Request,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> ConsumerStateResponse:
    """Confirm the OTP and attach the verified phone to the current account."""

    account = await session.get(ConsumerAccount, principal.consumer_account_id)
    if account is None:
        raise _account_not_found()
    now = datetime.now(UTC)
    phone = normalize_phone(payload.phone)
    challenge = await session.scalar(
        select(ConsumerLoginChallenge)
        .where(
            ConsumerLoginChallenge.id == payload.challenge_id,
            ConsumerLoginChallenge.phone_normalized == phone,
        )
        .with_for_update()
    )
    if (
        challenge is None
        or challenge.status != ConsumerChallengeStatus.PENDING.value
        or challenge.expires_at <= now
        or challenge.attempt_count >= settings.signature_otp_max_attempts
    ):
        raise _invalid_code()
    check = await to_thread.run_sync(verify_password, payload.code, challenge.otp_digest)
    if not check.valid:
        challenge.attempt_count += 1
        if challenge.attempt_count >= settings.signature_otp_max_attempts:
            challenge.status = ConsumerChallengeStatus.FAILED.value
        raise _invalid_code()

    if await _phone_conflicts_with_other_account(
        session, phone_normalized=phone, account_id=account.id
    ):
        raise _phone_taken()

    metadata = signing_request_metadata(request)
    challenge.status = ConsumerChallengeStatus.VERIFIED.value
    challenge.verified_at = now
    challenge.verified_ip_address = metadata.ip_address
    challenge.verified_user_agent = metadata.user_agent
    account.phone = payload.phone.strip()
    account.phone_normalized = phone
    account.phone_verified_at = now
    await session.flush()
    return await _state_response(session, account)


@router.post("/claim", response_model=ConsumerStateResponse)
async def claim_document(
    payload: ClaimDocumentRequest,
    response: Response,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    principal: OptionalConsumerDep,
    session: DbSessionDep,
) -> ConsumerStateResponse:
    try:
        digest = consumer_claim_token_digest(payload.claim_token)
    except ValueError:
        raise _claim_not_found() from None
    now = datetime.now(UTC)
    claim = await session.scalar(
        select(ConsumerDocumentClaim)
        .where(
            ConsumerDocumentClaim.token_digest == digest,
            ConsumerDocumentClaim.form_submission_id == payload.submission_id,
        )
        .with_for_update()
    )
    if claim is None or claim.consumed_at is not None or claim.expires_at <= now:
        raise _claim_not_found()
    if (
        principal is not None
        and principal.phone_normalized is not None
        and principal.phone_normalized != claim.phone_normalized
    ):
        raise AppError(
            status_code=409,
            code="consumer_phone_mismatch",
            message="This document belongs to another verified phone number",
            headers=_NO_STORE,
        )

    await set_tenant_context(session, claim.tenant_id)
    submission = await session.scalar(
        select(FormSubmission).where(
            FormSubmission.tenant_id == claim.tenant_id,
            FormSubmission.id == claim.form_submission_id,
            FormSubmission.status.in_(
                [SubmissionStatus.SUBMITTED.value, SubmissionStatus.SIGNED.value]
            ),
        )
    )
    if submission is None:
        raise _claim_not_found()
    client = await session.scalar(
        select(Client).where(
            Client.tenant_id == claim.tenant_id,
            Client.id == submission.client_id,
        )
    )
    if client is None or client.phone_normalized != claim.phone_normalized:
        raise _claim_not_found()

    snapshot = (
        submission.document_snapshot if isinstance(submission.document_snapshot, dict) else {}
    )
    client_snapshot = snapshot.get("client")
    if not isinstance(client_snapshot, dict):
        client_snapshot = {}
    phone_account = await session.scalar(
        select(ConsumerAccount).where(ConsumerAccount.phone_normalized == claim.phone_normalized)
    )
    account = None
    if principal is not None:
        account = await session.get(ConsumerAccount, principal.consumer_account_id)
        if (
            account is not None
            and account.phone_normalized is None
            and phone_account is not None
            and phone_account.id != account.id
        ):
            raise AppError(
                status_code=409,
                code="consumer_phone_already_linked",
                message="This phone belongs to another consumer account",
                headers=_NO_STORE,
            )
    if account is None:
        account = phone_account
    if account is None:
        account_email = _optional_text(client_snapshot.get("email"), 320)
        account = ConsumerAccount(
            phone=str(client_snapshot.get("phone") or client.phone or claim.phone_normalized),
            phone_normalized=claim.phone_normalized,
            full_name=str(
                client_snapshot.get("fullName") or f"{client.first_name} {client.last_name}"
            )[:200],
            email=account_email,
            email_normalized=_normalize_email(account_email),
            birth_date=_optional_date(client_snapshot.get("birthDate")),
            street=_optional_text(client_snapshot.get("street"), 250),
            postal_code=_optional_text(client_snapshot.get("postalCode"), 20),
            city=_optional_text(client_snapshot.get("city"), 120),
            medical_profile={},
            phone_verified_at=now,
        )
        session.add(account)
        await session.flush()
    else:
        if account.phone_normalized is None:
            account.phone = str(
                client_snapshot.get("phone") or client.phone or claim.phone_normalized
            )
            account.phone_normalized = claim.phone_normalized
        account.phone_verified_at = now

    link = await session.scalar(
        select(ConsumerSubmissionLink).where(
            ConsumerSubmissionLink.consumer_account_id == account.id,
            ConsumerSubmissionLink.form_submission_id == submission.id,
        )
    )
    if link is None:
        link = ConsumerSubmissionLink(
            consumer_account_id=account.id,
            tenant_id=claim.tenant_id,
            client_id=submission.client_id,
            form_submission_id=submission.id,
            shared_at=now,
        )
        session.add(link)
    else:
        link.revoked_at = None
        link.shared_at = now

    if payload.save_profile:
        _import_profile(account, snapshot, now)
        link.profile_imported_at = now
    claim.consumed_at = now
    if principal is None:
        await _open_session(
            session=session,
            settings=settings,
            response=response,
            account=account,
        )
    response.headers["Cache-Control"] = "no-store"
    return await _state_response(session, account)


def _claim_not_found() -> AppError:
    return AppError(
        status_code=404,
        code="consumer_claim_not_found",
        message="The document claim is invalid or has expired",
        headers=_NO_STORE,
    )


def _optional_text(value: object, max_length: int) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value[:max_length] if value else None


def _normalize_email(value: str | None) -> str | None:
    return value.strip().lower() if value else None


async def _medical_question_catalog(
    session: DbSessionDep,
) -> list[ConsumerMedicalQuestionResponse]:
    """Build one current health interview from the latest published templates.

    Template schemas remain the source of truth. Questions sharing a stable key
    are represented once and retain the names of every form that uses them.
    """

    rows = (
        await session.execute(
            select(
                FormTemplate.id,
                FormTemplate.name,
                FormTemplateVersion.version_number,
                FormTemplateVersion.schema_definition,
            )
            .join(
                FormTemplateVersion,
                FormTemplateVersion.form_template_id == FormTemplate.id,
            )
            .where(
                FormTemplate.status == TemplateStatus.ACTIVE.value,
                FormTemplateVersion.published_at.is_not(None),
            )
            .order_by(
                FormTemplate.id,
                FormTemplateVersion.version_number.desc(),
            )
        )
    ).all()

    latest_template_ids: set[UUID] = set()
    questions: dict[str, dict[str, Any]] = {}
    for template_id, template_name, _version_number, definition in rows:
        if template_id in latest_template_ids:
            continue
        latest_template_ids.add(template_id)
        if not isinstance(definition, dict):
            continue
        sections = definition.get("sections")
        if not isinstance(sections, list):
            continue
        for raw_section in sections[:100]:
            if not isinstance(raw_section, dict) or raw_section.get("type") != "contraindications":
                continue
            items = raw_section.get("items")
            if not isinstance(items, list):
                continue
            for raw_item in items[:500]:
                if not isinstance(raw_item, dict):
                    continue
                key = str(raw_item.get("key") or "").strip()[:120]
                question = str(raw_item.get("question") or "").strip()[:2_000]
                if not key or not question:
                    continue
                requires_medication_details = key in _MEDICATION_FOLLOW_UP_KEYS
                has_follow_up = bool(raw_item.get("hasFollowUp") or requires_medication_details)
                follow_up_placeholder = _optional_text(raw_item.get("followUpPlaceholder"), 500)
                if requires_medication_details and follow_up_placeholder is None:
                    follow_up_placeholder = _MEDICATION_FOLLOW_UP_PLACEHOLDER
                existing = questions.get(key)
                if existing is None:
                    questions[key] = {
                        "key": key,
                        "question": question,
                        "has_follow_up": has_follow_up,
                        "follow_up_placeholder": follow_up_placeholder,
                        "category": _optional_text(raw_item.get("category"), 250),
                        "source_forms": {str(template_name)[:250]},
                    }
                    continue
                existing["source_forms"].add(str(template_name)[:250])
                existing["has_follow_up"] = bool(existing["has_follow_up"] or has_follow_up)
                if len(question) > len(existing["question"]):
                    existing["question"] = question
                if existing["follow_up_placeholder"] is None:
                    existing["follow_up_placeholder"] = follow_up_placeholder
                if existing["category"] is None:
                    existing["category"] = _optional_text(raw_item.get("category"), 250)

    return [
        ConsumerMedicalQuestionResponse(
            key=item["key"],
            question=item["question"],
            has_follow_up=item["has_follow_up"],
            follow_up_placeholder=item["follow_up_placeholder"],
            category=item["category"],
            source_forms=sorted(item["source_forms"]),
        )
        for item in sorted(
            questions.values(),
            key=lambda item: (
                str(item["category"] or "Wywiad medyczny").casefold(),
                str(item["question"]).casefold(),
            ),
        )
    ]


def _optional_date(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _import_profile(
    account: ConsumerAccount,
    snapshot: dict[str, Any],
    now: datetime,
) -> None:
    client = snapshot.get("client")
    if isinstance(client, dict):
        account.full_name = str(client.get("fullName") or account.full_name)[:200]
        account.email = _optional_text(client.get("email"), 320)
        account.email_normalized = _normalize_email(account.email)
        account.birth_date = _optional_date(client.get("birthDate"))
        account.street = _optional_text(client.get("street"), 250)
        account.postal_code = _optional_text(client.get("postalCode"), 20)
        account.city = _optional_text(client.get("city"), 120)

    answers = snapshot.get("answers")
    fields = answers.get("fields") if isinstance(answers, dict) else None
    contraindications = fields.get("contraindications") if isinstance(fields, dict) else None
    existing = account.medical_profile if isinstance(account.medical_profile, dict) else {}
    merged = existing.get("contraindications", {})
    if not isinstance(merged, dict):
        merged = {}
    if isinstance(contraindications, dict):
        merged = {**merged, **contraindications}
    account.medical_profile = {
        "contraindications": merged,
        "lastSourceFormCode": snapshot.get("formCode"),
        "lastUpdatedAt": now.isoformat(),
    }
    account.medical_profile_updated_at = now


@router.get("/me", response_model=ConsumerStateResponse)
async def get_consumer_state(
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> ConsumerStateResponse:
    account = await session.get(ConsumerAccount, principal.consumer_account_id)
    if account is None:
        raise _account_not_found()
    return await _state_response(session, account)


@router.put("/profile", response_model=ConsumerStateResponse)
async def update_consumer_profile(
    payload: ConsumerProfileUpdate,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> ConsumerStateResponse:
    account = await session.get(ConsumerAccount, principal.consumer_account_id)
    if account is None:
        raise _account_not_found()
    account.full_name = payload.full_name.strip()
    account.email = payload.email.strip() if payload.email else None
    account.email_normalized = _normalize_email(account.email)
    account.birth_date = payload.birth_date
    account.street = payload.street.strip() if payload.street else None
    account.house_number = payload.house_number.strip() if payload.house_number else None
    account.apartment_number = (
        payload.apartment_number.strip() if payload.apartment_number else None
    )
    account.postal_code = payload.postal_code.strip() if payload.postal_code else None
    account.city = payload.city.strip() if payload.city else None
    return await _state_response(session, account)


@router.get("/profile/medical", response_model=ConsumerMedicalCatalogResponse)
async def get_consumer_medical_catalog(
    _principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> ConsumerMedicalCatalogResponse:
    return ConsumerMedicalCatalogResponse(
        questions=await _medical_question_catalog(session),
    )


@router.put("/profile/medical", response_model=ConsumerStateResponse)
async def update_consumer_medical_profile(
    payload: ConsumerMedicalProfileUpdate,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> ConsumerStateResponse:
    account = await session.get(ConsumerAccount, principal.consumer_account_id)
    if account is None:
        raise _account_not_found()

    catalog = await _medical_question_catalog(session)
    catalog_by_key = {question.key: question for question in catalog}
    allowed_keys = set(catalog_by_key)
    unknown_keys = set(payload.answers) - allowed_keys
    if unknown_keys:
        raise AppError(
            status_code=422,
            code="unknown_medical_question",
            message="Medical profile contains a question that is no longer available",
            headers=_NO_STORE,
        )

    missing_follow_up = [
        key
        for key, answer in payload.answers.items()
        if answer.answer == "yes"
        and catalog_by_key[key].has_follow_up
        and not (answer.follow_up or "").strip()
    ]
    if missing_follow_up:
        raise AppError(
            status_code=422,
            code="medical_follow_up_required",
            message="A positive answer requires additional details",
            headers=_NO_STORE,
        )

    existing = account.medical_profile if isinstance(account.medical_profile, dict) else {}
    existing_answers = existing.get("contraindications", {})
    if not isinstance(existing_answers, dict):
        existing_answers = {}
    normalized_answers = {
        key: {
            "answer": answer.answer,
            "followUp": answer.follow_up.strip() if answer.follow_up else "",
        }
        for key, answer in payload.answers.items()
    }
    now = datetime.now(UTC)
    account.medical_profile = {
        **existing,
        "contraindications": {**existing_answers, **normalized_answers},
        "lastUpdatedAt": now.isoformat(),
    }
    account.medical_profile_updated_at = now
    return await _state_response(session, account)


@router.get("/profile/signature")
async def get_consumer_signature(
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> Response:
    account = await session.get(ConsumerAccount, principal.consumer_account_id)
    if account is None or not account.signature_data_url:
        raise AppError(
            status_code=404,
            code="consumer_signature_not_found",
            message="Signature was not found",
            headers={"Cache-Control": "private, no-store"},
        )
    try:
        payload = decode_signature_png_data_url(account.signature_data_url)
    except InvalidSignatureImageError:
        raise AppError(
            status_code=404,
            code="consumer_signature_not_found",
            message="Signature was not found",
            headers={"Cache-Control": "private, no-store"},
        ) from None
    return Response(
        content=payload,
        media_type="image/png",
        headers={
            "Cache-Control": "private, no-store",
            "Content-Disposition": 'inline; filename="signature.png"',
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.put("/profile/signature", status_code=204, response_class=Response)
async def set_consumer_signature(
    payload: ConsumerSignatureRequest,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> Response:
    try:
        decode_signature_png_data_url(payload.signature)
    except InvalidSignatureImageError:
        raise AppError(
            status_code=422,
            code="invalid_consumer_signature",
            message="Signature must be a valid PNG image",
            headers={"Cache-Control": "private, no-store"},
        ) from None
    account = await session.get(ConsumerAccount, principal.consumer_account_id)
    if account is None:
        raise _account_not_found()
    account.signature_data_url = payload.signature
    account.signature_updated_at = datetime.now(UTC)
    await session.flush()
    return Response(status_code=204, headers={"Cache-Control": "private, no-store"})


@router.delete("/profile/signature", status_code=204, response_class=Response)
async def delete_consumer_signature(
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> Response:
    account = await session.get(ConsumerAccount, principal.consumer_account_id)
    if account is None:
        raise _account_not_found()
    account.signature_data_url = None
    account.signature_updated_at = None
    await session.flush()
    return Response(status_code=204, headers={"Cache-Control": "private, no-store"})


@router.delete("/account", status_code=204, response_class=Response)
async def delete_consumer_account(
    payload: DeleteConsumerAccountRequest,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> Response:
    """Remove the consumer login profile without altering salon-owned records."""

    del payload
    account = await session.scalar(
        select(ConsumerAccount)
        .where(
            ConsumerAccount.id == principal.consumer_account_id,
            ConsumerAccount.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if account is None:
        raise _account_not_found()

    now = datetime.now(UTC)
    account.phone = None
    account.phone_normalized = None
    account.full_name = "Usunięte konto"
    account.email = None
    account.email_normalized = None
    account.password_hash = None
    account.email_verified_at = None
    account.verification_code_hash = None
    account.verification_code_expires_at = None
    account.birth_date = None
    account.street = None
    account.house_number = None
    account.apartment_number = None
    account.postal_code = None
    account.city = None
    account.medical_profile = {}
    account.medical_profile_updated_at = None
    account.signature_data_url = None
    account.signature_updated_at = None
    account.phone_verified_at = None
    account.deleted_at = now
    await session.execute(
        delete(ConsumerGoogleIdentity).where(
            ConsumerGoogleIdentity.consumer_account_id == account.id
        )
    )
    await session.execute(
        update(ConsumerSession)
        .where(
            ConsumerSession.consumer_account_id == account.id,
            ConsumerSession.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    await session.flush()

    response = Response(status_code=204, headers=_NO_STORE)
    response.delete_cookie(
        key=settings.consumer_session_cookie_name,
        path="/",
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite="lax",
    )
    return response


@router.get("/salons", response_model=ConsumerSalonListResponse)
async def list_consumer_salons(
    principal: CurrentConsumerDep,
    session: DbSessionDep,
    query: Annotated[str, Query(max_length=100)] = "",
    slug: Annotated[str, Query(max_length=63)] = "",
) -> ConsumerSalonListResponse:
    """Search explicitly discoverable salons and their active public forms.

    When `slug` is given, look up that one tenant directly instead of running the
    text search — this is what lets a public salon page ("Umów wizytę") deep-link
    straight into booking without depending on where the salon lands in a ranked
    search result.
    """

    del principal
    query_terms = _directory_search_text(" ".join(query.strip().split())).split()
    tenant_statement = (
        select(Tenant)
        .where(
            Tenant.status == TenantStatus.ACTIVE.value,
            Tenant.directory_visible.is_(True),
        )
        .order_by(Tenant.display_name, Tenant.slug)
    )
    if slug:
        tenant_statement = tenant_statement.where(Tenant.slug == slug)
    else:
        tenant_statement = tenant_statement.limit(100)
    tenant_result = await session.scalars(tenant_statement)
    candidates = tenant_result.all()
    items: list[ConsumerSalonSummary] = []
    for tenant in candidates:
        await set_tenant_context(session, tenant.id)
        form_rows = (
            await session.execute(
                select(FormTemplate.code, FormTemplate.name)
                .join(
                    TenantFormTemplate,
                    TenantFormTemplate.form_template_id == FormTemplate.id,
                )
                .where(
                    TenantFormTemplate.tenant_id == tenant.id,
                    TenantFormTemplate.enabled.is_(True),
                    FormTemplate.status == TemplateStatus.ACTIVE.value,
                )
                .order_by(TenantFormTemplate.display_order, FormTemplate.code)
                .limit(100)
            )
        ).all()
        if not form_rows:
            continue
        searchable = _directory_search_text(
            " ".join(
                filter(
                    None,
                    (
                        tenant.display_name,
                        tenant.city,
                        tenant.postal_code,
                        tenant.address_line1,
                        *(name for _code, name in form_rows),
                    ),
                )
            )
        )
        if not slug and query_terms and not all(term in searchable for term in query_terms):
            continue
        items.append(
            ConsumerSalonSummary(
                slug=tenant.slug,
                display_name=tenant.display_name,
                logo_url=tenant.logo_image,
                cover_url=(
                    f"/api/beautydocs-preview/salons/{tenant.slug}/photos/0"
                    if (tenant.public_profile or {}).get("photos") else None
                ),
                introduction=(tenant.public_profile or {}).get("introduction", ""),
                starting_price=min(
                    (s["price"] for s in (tenant.public_profile or {}).get("services", [])),
                    default=None,
                ),
                city=tenant.city,
                postal_code=tenant.postal_code,
                address_line1=tenant.address_line1,
                address_line2=tenant.address_line2,
                phone=tenant.phone,
                website_url=tenant.website_url,
                active_forms=[
                    ConsumerSalonForm(code=code, display_name=name) for code, name in form_rows
                ],
            )
        )
        if len(items) == 24:
            break
    return ConsumerSalonListResponse(items=items)


async def _bookable_tenant_form(
    session: DbSessionDep,
    *,
    tenant_slug: str,
    form_code: str,
    lock_tenant: bool = False,
) -> tuple[Tenant, Any]:
    tenant_statement = select(Tenant).where(
        Tenant.slug == tenant_slug,
        Tenant.status == TenantStatus.ACTIVE.value,
        Tenant.directory_visible.is_(True),
    )
    if lock_tenant:
        tenant_statement = tenant_statement.with_for_update()
    tenant = await session.scalar(tenant_statement)
    if tenant is None:
        raise AppError(
            status_code=404,
            code="salon_not_found",
            message="Salon was not found",
            headers=_NO_STORE,
        )
    await set_tenant_context(session, tenant.id)
    form = (
        await session.execute(
            select(
                FormTemplate.id,
                FormTemplate.code,
                FormTemplate.name,
                TenantFormTemplate.duration_minutes,
            )
            .join(
                TenantFormTemplate,
                TenantFormTemplate.form_template_id == FormTemplate.id,
            )
            .where(
                TenantFormTemplate.tenant_id == tenant.id,
                TenantFormTemplate.enabled.is_(True),
                FormTemplate.status == TemplateStatus.ACTIVE.value,
                FormTemplate.code == form_code,
            )
            .limit(1)
        )
    ).first()
    if form is None:
        raise AppError(
            status_code=404,
            code="form_not_found",
            message="Form was not found",
            headers=_NO_STORE,
        )
    return tenant, form


def _validate_booking_date(booking_date: date) -> None:
    today = datetime.now(BOOKING_TIME_ZONE).date()
    if booking_date < today or booking_date > today + timedelta(days=BOOKING_WINDOW_DAYS):
        raise AppError(
            status_code=422,
            code="booking_date_out_of_range",
            message="Booking date is outside the available window",
            headers=_NO_STORE,
        )


async def _busy_visits(
    session: DbSessionDep,
    *,
    tenant_id: UUID,
    period_start: datetime,
    period_end: datetime,
    duration_minutes: int = BOOKING_SLOT_MINUTES,
) -> list[Visit]:
    visits = await session.scalars(
        select(Visit).where(
            Visit.tenant_id == tenant_id,
            Visit.status != VisitStatus.CANCELLED.value,
            Visit.starts_at >= period_start.astimezone(UTC) - timedelta(minutes=duration_minutes),
            Visit.starts_at < period_end.astimezone(UTC),
            or_(
                Visit.ends_at.is_(None),
                Visit.ends_at > period_start.astimezone(UTC),
            ),
        )
    )
    return list(visits.all())


def _periods_overlap(
    first_start: datetime,
    first_end: datetime,
    second_start: datetime,
    second_end: datetime,
) -> bool:
    return first_start < second_end and first_end > second_start


def _available_appointment_slots(
    *,
    period_start: datetime,
    period_end: datetime,
    duration_minutes: int,
    interval_minutes: int,
    busy_visits: list[Visit],
    earliest_start: datetime,
) -> list[ConsumerAppointmentSlot]:
    slots: list[ConsumerAppointmentSlot] = []
    slot_start = period_start
    while slot_start + timedelta(minutes=duration_minutes) <= period_end:
        slot_end = slot_start + timedelta(minutes=duration_minutes)
        slot_start_utc = slot_start.astimezone(UTC)
        slot_end_utc = slot_end.astimezone(UTC)
        occupied = any(
            _periods_overlap(
                slot_start_utc,
                slot_end_utc,
                visit.starts_at,
                visit.ends_at or visit.starts_at + timedelta(minutes=duration_minutes),
            )
            for visit in busy_visits
        )
        if slot_start_utc > earliest_start and not occupied:
            slots.append(
                ConsumerAppointmentSlot(
                    starts_at=slot_start_utc,
                    ends_at=slot_end_utc,
                )
            )
        slot_start += timedelta(minutes=interval_minutes)
    return slots


@router.get(
    "/salons/{tenant_slug}/availability",
    response_model=ConsumerAppointmentAvailability,
)
async def consumer_appointment_availability(
    tenant_slug: Annotated[str, Path(min_length=1, max_length=63)],
    principal: CurrentConsumerDep,
    session: DbSessionDep,
    form_code: Annotated[str, Query(alias="formCode", min_length=1, max_length=100)],
    booking_date: Annotated[date, Query(alias="date")],
) -> ConsumerAppointmentAvailability:
    del principal
    _validate_booking_date(booking_date)
    tenant, form = await _bookable_tenant_form(
        session,
        tenant_slug=tenant_slug,
        form_code=form_code,
    )
    schedule = normalize_booking_schedule(tenant.booking_schedule)
    duration_minutes = int(getattr(form, "duration_minutes", BOOKING_SLOT_MINUTES))
    interval_minutes = int(schedule["slotIntervalMinutes"])
    booking_period = booking_day_window(schedule, booking_date)
    if booking_period is None:
        return ConsumerAppointmentAvailability(
            date=booking_date,
            time_zone=str(BOOKING_TIME_ZONE),
            slot_minutes=duration_minutes,
            slot_interval_minutes=interval_minutes,
            slots=[],
        )

    period_start, period_end = booking_period
    busy_visits = await _busy_visits(
        session,
        tenant_id=tenant.id,
        period_start=period_start,
        period_end=period_end,
        duration_minutes=duration_minutes,
    )
    slots = _available_appointment_slots(
        period_start=period_start,
        period_end=period_end,
        duration_minutes=duration_minutes,
        interval_minutes=interval_minutes,
        busy_visits=busy_visits,
        earliest_start=datetime.now(UTC) + timedelta(minutes=15),
    )

    return ConsumerAppointmentAvailability(
        date=booking_date,
        time_zone=str(BOOKING_TIME_ZONE),
        slot_minutes=duration_minutes,
        slot_interval_minutes=interval_minutes,
        slots=slots,
    )


@router.get(
    "/salons/{tenant_slug}/availability/month",
    response_model=ConsumerAppointmentMonthAvailability,
)
async def consumer_appointment_month_availability(
    tenant_slug: Annotated[str, Path(min_length=1, max_length=63)],
    principal: CurrentConsumerDep,
    session: DbSessionDep,
    form_code: Annotated[str, Query(alias="formCode", min_length=1, max_length=100)],
    month: Annotated[str, Query(pattern=r"^\d{4}-\d{2}$")],
) -> ConsumerAppointmentMonthAvailability:
    del principal
    try:
        month_start = date.fromisoformat(f"{month}-01")
    except ValueError:
        raise AppError(
            status_code=422,
            code="invalid_booking_month",
            message="Booking month is invalid",
            headers=_NO_STORE,
        ) from None

    today = datetime.now(BOOKING_TIME_ZONE).date()
    latest_booking_date = today + timedelta(days=BOOKING_WINDOW_DAYS)
    month_end = date(
        month_start.year,
        month_start.month,
        monthrange(month_start.year, month_start.month)[1],
    )
    if month_end < today or month_start > latest_booking_date:
        raise AppError(
            status_code=422,
            code="booking_date_out_of_range",
            message="Booking month is outside the available window",
            headers=_NO_STORE,
        )

    tenant, form = await _bookable_tenant_form(
        session,
        tenant_slug=tenant_slug,
        form_code=form_code,
    )
    schedule = normalize_booking_schedule(tenant.booking_schedule)
    duration_minutes = int(getattr(form, "duration_minutes", BOOKING_SLOT_MINUTES))
    interval_minutes = int(schedule["slotIntervalMinutes"])
    next_month_start = (
        date(month_start.year + 1, 1, 1)
        if month_start.month == 12
        else date(month_start.year, month_start.month + 1, 1)
    )
    period_start = datetime.combine(month_start, datetime.min.time(), tzinfo=BOOKING_TIME_ZONE)
    period_end = datetime.combine(next_month_start, datetime.min.time(), tzinfo=BOOKING_TIME_ZONE)
    busy_visits = await _busy_visits(
        session,
        tenant_id=tenant.id,
        period_start=period_start,
        period_end=period_end,
        duration_minutes=duration_minutes,
    )
    earliest_start = datetime.now(UTC) + timedelta(minutes=15)
    first_date = max(month_start, today)
    last_date = min(month_end, latest_booking_date)
    days: list[ConsumerAppointmentMonthDay] = []
    current_date = first_date
    while current_date <= last_date:
        booking_period = booking_day_window(schedule, current_date)
        available_slots = 0
        if booking_period is not None:
            day_start, day_end = booking_period
            available_slots = len(
                _available_appointment_slots(
                    period_start=day_start,
                    period_end=day_end,
                    duration_minutes=duration_minutes,
                    interval_minutes=interval_minutes,
                    busy_visits=busy_visits,
                    earliest_start=earliest_start,
                )
            )
        days.append(
            ConsumerAppointmentMonthDay(
                date=current_date,
                available_slots=available_slots,
            )
        )
        current_date += timedelta(days=1)

    return ConsumerAppointmentMonthAvailability(
        month=month,
        time_zone=str(BOOKING_TIME_ZONE),
        slot_minutes=duration_minutes,
        days=days,
    )


def _split_consumer_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split()
    if len(parts) <= 1:
        name = parts[0] if parts else "Klientka"
        return name, name
    return parts[0], " ".join(parts[1:])


def _normalized_client_name(value: str) -> str:
    return " ".join(value.strip().casefold().split())


def _new_booking_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, hashlib.sha256(token.encode("ascii")).hexdigest()


async def _consumer_appointment_response(
    session: DbSessionDep,
    link: ConsumerAppointment,
) -> ConsumerAppointmentResponse | None:
    await set_tenant_context(session, link.tenant_id)
    row = (
        await session.execute(
            select(Visit, Tenant.slug, Tenant.display_name, FormTemplate.code, FormTemplate.name)
            .join(Tenant, Tenant.id == Visit.tenant_id)
            .join(FormTemplate, FormTemplate.id == Visit.form_template_id)
            .where(
                Visit.tenant_id == link.tenant_id,
                Visit.id == link.visit_id,
            )
        )
    ).first()
    if row is None or row.Visit.ends_at is None:
        return None
    form_submitted = (
        await session.scalar(
            select(FormSubmission.id)
            .where(
                FormSubmission.tenant_id == link.tenant_id,
                FormSubmission.visit_id == link.visit_id,
                FormSubmission.status.in_(
                    [SubmissionStatus.SUBMITTED.value, SubmissionStatus.SIGNED.value]
                ),
            )
            .limit(1)
        )
    ) is not None
    return ConsumerAppointmentResponse(
        id=link.id,
        tenant_slug=row.slug,
        salon_name=row.display_name,
        form_code=row.code,
        form_name=row.name,
        starts_at=row.Visit.starts_at,
        ends_at=row.Visit.ends_at,
        status=row.Visit.status,
        form_submitted=form_submitted,
    )


@router.get("/appointments", response_model=ConsumerAppointmentListResponse)
async def list_consumer_appointments(
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> ConsumerAppointmentListResponse:
    links = (
        await session.scalars(
            select(ConsumerAppointment)
            .where(
                ConsumerAppointment.consumer_account_id == principal.consumer_account_id,
            )
            .order_by(ConsumerAppointment.created_at.desc())
            .limit(100)
        )
    ).all()
    items: list[ConsumerAppointmentResponse] = []
    for link in links:
        appointment = await _consumer_appointment_response(session, link)
        if appointment is not None:
            items.append(appointment)
    items.sort(key=lambda item: item.starts_at, reverse=True)
    return ConsumerAppointmentListResponse(items=items)


@router.post(
    "/appointments",
    response_model=ConsumerAppointmentCreatedResponse,
    status_code=201,
)
async def create_consumer_appointment(
    payload: ConsumerAppointmentCreateRequest,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> ConsumerAppointmentCreatedResponse:
    if payload.starts_at.tzinfo is None or payload.starts_at.utcoffset() is None:
        raise AppError(
            status_code=422,
            code="booking_time_zone_required",
            message="Booking time zone is required",
            headers=_NO_STORE,
        )
    starts_at = payload.starts_at.astimezone(BOOKING_TIME_ZONE)
    _validate_booking_date(starts_at.date())
    if starts_at.astimezone(UTC) <= datetime.now(UTC) + timedelta(minutes=15):
        raise AppError(
            status_code=422,
            code="invalid_booking_slot",
            message="The selected booking slot is invalid",
            headers=_NO_STORE,
        )
    account = await session.get(ConsumerAccount, principal.consumer_account_id)
    if (
        account is None
        or account.deleted_at is not None
        or account.phone_normalized is None
        or account.phone_verified_at is None
    ):
        raise AppError(
            status_code=409,
            code="verified_phone_required",
            message="A verified phone number is required before booking",
            headers=_NO_STORE,
        )

    tenant, form = await _bookable_tenant_form(
        session,
        tenant_slug=payload.tenant_slug,
        form_code=payload.form_code,
        lock_tenant=True,
    )
    duration_minutes = int(getattr(form, "duration_minutes", BOOKING_SLOT_MINUTES))
    if not booking_start_allowed(
        tenant.booking_schedule,
        starts_at,
        duration_minutes=duration_minutes,
    ):
        raise AppError(
            status_code=422,
            code="invalid_booking_slot",
            message="The selected booking slot is invalid",
            headers=_NO_STORE,
        )
    ends_at = starts_at + timedelta(minutes=duration_minutes)
    busy_visits = await _busy_visits(
        session,
        tenant_id=tenant.id,
        period_start=starts_at,
        period_end=ends_at,
        duration_minutes=duration_minutes,
    )
    starts_at_utc = starts_at.astimezone(UTC)
    ends_at_utc = ends_at.astimezone(UTC)
    if any(
        _periods_overlap(
            starts_at_utc,
            ends_at_utc,
            visit.starts_at,
            visit.ends_at or visit.starts_at + timedelta(minutes=duration_minutes),
        )
        for visit in busy_visits
    ):
        raise AppError(
            status_code=409,
            code="booking_slot_unavailable",
            message="The selected booking slot is no longer available",
            headers=_NO_STORE,
        )

    client = await session.scalar(
        select(Client).where(
            Client.tenant_id == tenant.id,
            Client.phone_normalized == account.phone_normalized,
            Client.archived_at.is_(None),
        )
    )
    if client is None:
        first_name, last_name = _split_consumer_name(account.full_name)
        client = Client(
            tenant_id=tenant.id,
            first_name=first_name,
            last_name=last_name,
            first_name_normalized=_normalized_client_name(first_name),
            last_name_normalized=_normalized_client_name(last_name),
            phone=account.phone,
            phone_normalized=account.phone_normalized,
            email=account.email,
            birth_date=account.birth_date,
        )
        session.add(client)
        await session.flush()

    visit = Visit(
        tenant_id=tenant.id,
        client_id=client.id,
        form_template_id=form.id,
        treatment_name=form.name,
        starts_at=starts_at_utc,
        ends_at=ends_at_utc,
        status=VisitStatus.PLANNED.value,
    )
    session.add(visit)
    await session.flush()
    booking_token, booking_token_digest = _new_booking_token()
    link = ConsumerAppointment(
        consumer_account_id=account.id,
        tenant_id=tenant.id,
        visit_id=visit.id,
        booking_token_digest=booking_token_digest,
    )
    session.add(link)
    await session.flush()
    await append_visit_chat_event(
        session,
        tenant=tenant,
        visit=visit,
        consumer_account_id=account.id,
        kind=ChatMessageKind.VISIT_CREATED,
    )
    return ConsumerAppointmentCreatedResponse(
        id=link.id,
        tenant_slug=tenant.slug,
        salon_name=tenant.display_name,
        form_code=form.code,
        form_name=form.name,
        starts_at=visit.starts_at,
        ends_at=visit.ends_at,
        status=visit.status,
        form_submitted=False,
        booking_token=booking_token,
    )


@router.delete("/appointments/{appointment_id}", status_code=204, response_class=Response)
async def cancel_consumer_appointment(
    appointment_id: Annotated[UUID, Path()],
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> Response:
    link = await session.scalar(
        select(ConsumerAppointment)
        .where(
            ConsumerAppointment.id == appointment_id,
            ConsumerAppointment.consumer_account_id == principal.consumer_account_id,
        )
        .with_for_update()
    )
    if link is None:
        raise AppError(
            status_code=404,
            code="appointment_not_found",
            message="Appointment was not found",
            headers=_NO_STORE,
        )
    await set_tenant_context(session, link.tenant_id)
    visit = await session.scalar(
        select(Visit)
        .where(Visit.tenant_id == link.tenant_id, Visit.id == link.visit_id)
        .with_for_update()
    )
    if visit is None:
        raise AppError(
            status_code=404,
            code="appointment_not_found",
            message="Appointment was not found",
            headers=_NO_STORE,
        )
    if visit.starts_at <= datetime.now(UTC):
        raise AppError(
            status_code=409,
            code="appointment_already_started",
            message="An appointment that has already started cannot be cancelled",
            headers=_NO_STORE,
        )
    visit.status = VisitStatus.CANCELLED.value
    await session.flush()
    tenant = await session.scalar(select(Tenant).where(Tenant.id == link.tenant_id))
    if tenant is not None:
        await append_visit_chat_event(
            session,
            tenant=tenant,
            visit=visit,
            consumer_account_id=principal.consumer_account_id,
            kind=ChatMessageKind.VISIT_CANCELLED,
        )
    return Response(status_code=204, headers=_NO_STORE)


@router.post(
    "/appointments/{appointment_id}/form-access",
    response_model=ConsumerAppointmentFormAccess,
)
async def create_consumer_appointment_form_access(
    appointment_id: Annotated[UUID, Path()],
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> ConsumerAppointmentFormAccess:
    link = await session.scalar(
        select(ConsumerAppointment)
        .where(
            ConsumerAppointment.id == appointment_id,
            ConsumerAppointment.consumer_account_id == principal.consumer_account_id,
        )
        .with_for_update()
    )
    if link is None:
        raise AppError(
            status_code=404,
            code="appointment_not_found",
            message="Appointment was not found",
            headers=_NO_STORE,
        )
    await set_tenant_context(session, link.tenant_id)
    row = (
        await session.execute(
            select(Visit, Tenant.slug, FormTemplate.code)
            .join(Tenant, Tenant.id == Visit.tenant_id)
            .join(FormTemplate, FormTemplate.id == Visit.form_template_id)
            .where(
                Visit.tenant_id == link.tenant_id,
                Visit.id == link.visit_id,
                Visit.status == VisitStatus.PLANNED.value,
            )
        )
    ).first()
    if row is None:
        raise AppError(
            status_code=409,
            code="appointment_form_unavailable",
            message="The appointment form is no longer available",
            headers=_NO_STORE,
        )
    booking_token, booking_token_digest = _new_booking_token()
    link.booking_token_digest = booking_token_digest
    await session.flush()
    return ConsumerAppointmentFormAccess(
        appointment_id=link.id,
        tenant_slug=row.slug,
        form_code=row.code,
        booking_token=booking_token,
    )


@router.get("/documents", response_model=ConsumerDocumentListResponse)
async def list_consumer_documents(
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> ConsumerDocumentListResponse:
    links = (
        await session.scalars(
            select(ConsumerSubmissionLink)
            .where(
                ConsumerSubmissionLink.consumer_account_id == principal.consumer_account_id,
                ConsumerSubmissionLink.revoked_at.is_(None),
            )
            .order_by(ConsumerSubmissionLink.shared_at.desc())
            .limit(200)
        )
    ).all()
    items: list[ConsumerDocumentSummary] = []
    for link in links:
        await set_tenant_context(session, link.tenant_id)
        row = (
            await session.execute(
                select(
                    FormSubmission,
                    Tenant.display_name,
                    Tenant.slug,
                    FormTemplate.code,
                )
                .join(Tenant, Tenant.id == FormSubmission.tenant_id)
                .join(
                    FormTemplateVersion,
                    FormTemplateVersion.id == FormSubmission.form_template_version_id,
                )
                .join(FormTemplate, FormTemplate.id == FormTemplateVersion.form_template_id)
                .where(
                    FormSubmission.tenant_id == link.tenant_id,
                    FormSubmission.id == link.form_submission_id,
                )
            )
        ).first()
        if row is None:
            continue
        submission, salon_name, tenant_slug, form_code = row
        snapshot = (
            submission.document_snapshot if isinstance(submission.document_snapshot, dict) else {}
        )
        items.append(
            ConsumerDocumentSummary(
                submission_id=submission.id,
                tenant_slug=tenant_slug,
                salon_name=salon_name,
                form_code=form_code,
                form_name=str(snapshot.get("formName") or "Formularz zabiegowy")[:250],
                status=submission.status,
                signed_at=submission.signed_at or submission.submitted_at,
                practitioner_signed_at=submission.practitioner_signed_at,
                shared_at=link.shared_at,
            )
        )
    return ConsumerDocumentListResponse(items=items)


@router.get("/documents/{submission_id}", response_model=ConsumerDocumentDetail)
async def get_consumer_document(
    submission_id: UUID,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> ConsumerDocumentDetail:
    link = await session.scalar(
        select(ConsumerSubmissionLink).where(
            ConsumerSubmissionLink.consumer_account_id == principal.consumer_account_id,
            ConsumerSubmissionLink.form_submission_id == submission_id,
            ConsumerSubmissionLink.revoked_at.is_(None),
        )
    )
    if link is None:
        raise _document_not_found()
    await set_tenant_context(session, link.tenant_id)
    row = (
        await session.execute(
            select(
                FormSubmission,
                Tenant.display_name,
                Tenant.slug,
                FormTemplate.code,
                FormTemplateVersion.schema_definition,
                FormTemplateVersion.legal_content,
            )
            .join(Tenant, Tenant.id == FormSubmission.tenant_id)
            .join(
                FormTemplateVersion,
                FormTemplateVersion.id == FormSubmission.form_template_version_id,
            )
            .join(FormTemplate, FormTemplate.id == FormTemplateVersion.form_template_id)
            .where(
                FormSubmission.tenant_id == link.tenant_id,
                FormSubmission.id == submission_id,
            )
        )
    ).first()
    if row is None:
        raise _document_not_found()
    submission, salon_name, tenant_slug, form_code, template_schema, legal_content = row
    snapshot = (
        submission.document_snapshot if isinstance(submission.document_snapshot, dict) else {}
    )
    raw_practitioner = snapshot.get("practitioner")
    practitioner = raw_practitioner if isinstance(raw_practitioner, dict) else None
    if practitioner is not None:
        practitioner = {
            "displayName": practitioner.get("displayName"),
            "jobTitle": practitioner.get("jobTitle"),
            "signedAt": practitioner.get("signedAt"),
        }
    sections, signature_keys = _build_form_answer_sections(
        definition=template_schema if isinstance(template_schema, dict) else {},
        legal_content=legal_content if isinstance(legal_content, dict) else {},
        stored_answers=(submission.answers if isinstance(submission.answers, dict) else {}),
        document_snapshot=snapshot,
        salon_name=salon_name,
    )
    raw_anatomy = template_schema.get("anatomy")
    anatomy: ConsumerDocumentAnatomy | None = None
    if isinstance(raw_anatomy, dict) and raw_anatomy.get("model") in {
        "face",
        "body",
        "both",
    }:
        raw_face_zone_set = raw_anatomy.get("faceZoneSet")
        raw_body_zone_set = raw_anatomy.get("bodyZoneSet")
        anatomy = ConsumerDocumentAnatomy(
            model=raw_anatomy["model"],
            face_zone_set=(raw_face_zone_set if isinstance(raw_face_zone_set, str) else None),
            body_zone_set=(raw_body_zone_set if isinstance(raw_body_zone_set, str) else None),
        )
    stored_answers = submission.answers if isinstance(submission.answers, dict) else {}
    raw_treatment_area = stored_answers.get("treatmentArea")
    if isinstance(raw_treatment_area, list):
        treatment_area_ids = [
            value[:100] for value in raw_treatment_area[:100] if isinstance(value, str) and value
        ]
    elif isinstance(raw_treatment_area, str):
        treatment_area_ids = [
            value.strip()[:100] for value in raw_treatment_area.split(",")[:100] if value.strip()
        ]
    else:
        treatment_area_ids = []
    return ConsumerDocumentDetail(
        submission_id=submission.id,
        tenant_slug=tenant_slug,
        salon_name=salon_name,
        form_code=form_code,
        form_name=str(snapshot.get("formName") or "Formularz zabiegowy")[:250],
        status=submission.status,
        signed_at=submission.signed_at or submission.submitted_at,
        practitioner_signed_at=submission.practitioner_signed_at,
        shared_at=link.shared_at,
        client=snapshot.get("client") if isinstance(snapshot.get("client"), dict) else {},
        answers=snapshot.get("answers") if isinstance(snapshot.get("answers"), dict) else {},
        sections=sections,
        anatomy=anatomy,
        treatment_area_ids=treatment_area_ids,
        signature_keys=signature_keys,
        client_signed_at=_optional_datetime(snapshot.get("clientSignedAt")),
        practitioner=practitioner,
    )


@router.get("/documents/{submission_id}/signatures/{signature_key}")
async def get_consumer_document_signature(
    submission_id: UUID,
    signature_key: ConsumerSignatureKeyPath,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> Response:
    link = await session.scalar(
        select(ConsumerSubmissionLink).where(
            ConsumerSubmissionLink.consumer_account_id == principal.consumer_account_id,
            ConsumerSubmissionLink.form_submission_id == submission_id,
            ConsumerSubmissionLink.revoked_at.is_(None),
        )
    )
    if link is None:
        raise _document_not_found()
    await set_tenant_context(session, link.tenant_id)
    document_snapshot = await session.scalar(
        select(FormSubmission.document_snapshot).where(
            FormSubmission.tenant_id == link.tenant_id,
            FormSubmission.id == submission_id,
        )
    )
    snapshot = document_snapshot if isinstance(document_snapshot, dict) else {}
    raw_signatures = snapshot.get("signatures")
    signatures = raw_signatures if isinstance(raw_signatures, dict) else {}
    signature = signatures.get(signature_key)
    if not isinstance(signature, str):
        raise _document_not_found()
    try:
        signature_bytes = decode_signature_png_data_url(signature)
    except InvalidSignatureImageError:
        raise _document_not_found() from None
    return Response(
        content=signature_bytes,
        media_type="image/png",
        headers={
            **_NO_STORE,
            "Content-Disposition": 'inline; filename="signature.png"',
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/documents/{submission_id}/practitioner-signature")
async def get_consumer_document_practitioner_signature(
    submission_id: UUID,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> Response:
    link = await session.scalar(
        select(ConsumerSubmissionLink).where(
            ConsumerSubmissionLink.consumer_account_id == principal.consumer_account_id,
            ConsumerSubmissionLink.form_submission_id == submission_id,
            ConsumerSubmissionLink.revoked_at.is_(None),
        )
    )
    if link is None:
        raise _document_not_found()
    await set_tenant_context(session, link.tenant_id)
    document_snapshot = await session.scalar(
        select(FormSubmission.document_snapshot).where(
            FormSubmission.tenant_id == link.tenant_id,
            FormSubmission.id == submission_id,
        )
    )
    snapshot = document_snapshot if isinstance(document_snapshot, dict) else {}
    practitioner = snapshot.get("practitioner")
    signature = practitioner.get("signature") if isinstance(practitioner, dict) else None
    if not isinstance(signature, str):
        raise _document_not_found()
    try:
        signature_bytes = decode_signature_png_data_url(signature)
    except InvalidSignatureImageError:
        raise _document_not_found() from None
    return Response(
        content=signature_bytes,
        media_type="image/png",
        headers={
            **_NO_STORE,
            "Content-Disposition": 'inline; filename="practitioner-signature.png"',
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "X-Content-Type-Options": "nosniff",
        },
    )


def _optional_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _document_not_found() -> AppError:
    return AppError(
        status_code=404,
        code="consumer_document_not_found",
        message="Document was not found",
        headers=_NO_STORE,
    )


@router.post("/auth/logout", status_code=204, response_class=Response)
async def logout_consumer(
    request: Request,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
) -> Response:
    raw_token = request.cookies.get(settings.consumer_session_cookie_name)
    if is_valid_session_token(raw_token):
        assert raw_token is not None
        consumer_session = await session.scalar(
            select(ConsumerSession).where(
                ConsumerSession.token_digest == session_token_digest(raw_token)
            )
        )
        if consumer_session is not None and consumer_session.revoked_at is None:
            consumer_session.revoked_at = datetime.now(UTC)
    response = Response(status_code=204, headers=_NO_STORE)
    response.delete_cookie(
        key=settings.consumer_session_cookie_name,
        path="/",
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite="lax",
    )
    return response


class CheckInTokenResponse(ConsumerModel):
    token: str
    expires_in_seconds: int


@router.post("/check-in-token", response_model=CheckInTokenResponse)
async def issue_consumer_check_in_token(
    principal: CurrentConsumerDep,
    _origin: TrustedOriginDep,
    response: Response,
    settings: SettingsDep,
) -> CheckInTokenResponse:
    """Issue a short-lived, rotating token for the client's check-in QR code."""
    key = settings.check_in_signing_key
    if key is None:
        raise AppError(
            status_code=503,
            code="check_in_not_configured",
            message="Check-in QR is not configured",
            headers=_NO_STORE,
        )
    token, expires_in = issue_check_in_token(
        consumer_id=principal.consumer_account_id,
        key=key.get_secret_value(),
        ttl_seconds=settings.check_in_token_ttl_seconds,
    )
    response.headers.update(_NO_STORE)
    return CheckInTokenResponse(token=token, expires_in_seconds=expires_in)
