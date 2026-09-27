"""Public client signing flow: form data -> SMS OTP -> consents and signature.

The first request stores an immutable draft and sends a six-digit code. The
code is bound to the draft hash. A verified challenge only unlocks the final
signature call; it cannot be reused for another document or submission.
"""

from __future__ import annotations

import hashlib
import json
import re
import secrets
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import select

from app.api.dependencies import DbSessionDep, SettingsDep, TenantSlugPath, TrustedOriginDep
from app.core.config import Settings
from app.core.errors import AppError
from app.db.tenant_context import set_tenant_context
from app.models.domain import (
    Client,
    ConsumerAppointment,
    FormSubmission,
    FormTemplate,
    FormTemplateVersion,
    SignatureSignerType,
    SignatureVerification,
    SubmissionStatus,
    TeamMember,
    TemplateStatus,
    Tenant,
    TenantFormTemplate,
    TenantStatus,
    VerificationStatus,
    Visit,
    VisitStatus,
)
from app.services.consumer_documents import issue_consumer_document_claim
from app.services.salon_notifications import add_practitioner_signature_notification
from app.services.signature_sms import normalize_phone
from app.services.signature_verification import (
    confirm_sms_verification,
    invalid_verification_code,
    issue_sms_verification,
)
from app.services.form_i18n import InterfaceLanguage, localize_form_content, localized_content_hash
from app.services.team_assignments import can_perform_treatment

router = APIRouter(prefix="/public", tags=["public"])

_FORM_CODE_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$")
_DATA_URL_PATTERN = re.compile(r"^data:image/png;base64,[A-Za-z0-9+/=]+$")
_ACCESS_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")
_MAX_SIGNATURE_CHARS = 600_000
_NO_STORE = {"Cache-Control": "no-store"}
_TREATMENT_CONSENT_KEY = "zgodaWykonanieZabiegu"
_CONSENT_SIGNATURE_KEYS = {
    _TREATMENT_CONSENT_KEY: "podpisDane",
    "zgodaPrzetwarzanieDanych": "podpisRodo",
    "zgodaMarketing": "podpisMarketing",
    "zgodaFotografie": "podpisFotografie",
}


class SubmissionRequestModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class SubmissionClientInput(SubmissionRequestModel):
    full_name: str = Field(min_length=2, max_length=200)
    phone: str = Field(min_length=8, max_length=32)
    email: str | None = Field(
        default=None,
        max_length=320,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    )
    birth_date: str | None = Field(default=None, max_length=32)
    street: str | None = Field(default=None, max_length=250)
    postal_code: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=120)


class FormDraftRequest(SubmissionRequestModel):
    client: SubmissionClientInput
    treatment_area: list[str] = Field(default_factory=list, max_length=100)
    answers: dict[str, Any] = Field(default_factory=dict)
    consents: dict[str, bool] = Field(default_factory=dict)
    place_and_date: str | None = Field(default=None, max_length=200)
    practitioner_team_member_id: UUID | None = None
    appointment_id: UUID | None = None
    # Language the client read the questionnaire and consents in.
    locale: InterfaceLanguage = "pl"
    booking_token: str | None = Field(
        default=None,
        min_length=43,
        max_length=43,
        pattern=r"^[A-Za-z0-9_-]{43}$",
    )


class VerificationStartResponse(SubmissionRequestModel):
    submission_id: UUID
    client_id: UUID
    submission_token: str = Field(min_length=43, max_length=43)
    verification_id: UUID
    destination_masked: str = Field(max_length=64)
    expires_in_seconds: int
    dev_code: str | None = Field(default=None, min_length=6, max_length=6)


class VerificationResendRequest(SubmissionRequestModel):
    submission_token: str = Field(min_length=43, max_length=43)


class VerificationConfirmRequest(VerificationResendRequest):
    verification_id: UUID
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class VerificationConfirmedResponse(SubmissionRequestModel):
    verification_id: UUID
    status: str
    verified_at: datetime


class ClientSignatureRequest(SubmissionRequestModel):
    submission_token: str = Field(min_length=43, max_length=43)
    verification_id: UUID
    consents: dict[str, bool] = Field(default_factory=dict)
    signatures: dict[str, str] = Field(default_factory=dict)


class SubmissionCreatedResponse(SubmissionRequestModel):
    submission_id: UUID
    client_id: UUID
    status: str
    claim_token: str = Field(min_length=43, max_length=43)
    claim_expires_in_seconds: int


def _normalize(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0], parts[0]
    return parts[0], " ".join(parts[1:])


def _validate_signatures(signatures: dict[str, str]) -> None:
    for key, value in signatures.items():
        if len(value) > _MAX_SIGNATURE_CHARS or not _DATA_URL_PATTERN.fullmatch(value):
            raise AppError(
                status_code=422,
                code="invalid_signature",
                message=f"Signature '{key}' is not a valid PNG data URL",
                headers=_NO_STORE,
            )


def _validate_consents(consents: dict[str, bool], definition: object) -> None:
    allowed, required = _definition_consent_rules(definition)
    # Every public form requires the client's main signature. Record the
    # deliberate treatment acceptance separately from the signature image so
    # the signed snapshot proves both the choice and the signature.
    allowed.add(_TREATMENT_CONSENT_KEY)
    required.add(_TREATMENT_CONSENT_KEY)
    if any(key not in allowed for key in consents):
        raise AppError(
            status_code=422,
            code="invalid_consent",
            message="The form contains an unknown consent",
            headers=_NO_STORE,
        )
    if any(consents.get(key) is not True for key in required):
        raise AppError(
            status_code=422,
            code="consent_required",
            message="All required consents must be accepted",
            headers=_NO_STORE,
        )


def _validate_consent_signatures(consents: dict[str, bool], signatures: dict[str, str]) -> None:
    for consent_key, signature_key in _CONSENT_SIGNATURE_KEYS.items():
        decision_recorded = consent_key in consents
        signed = bool(signatures.get(signature_key))
        if decision_recorded and not signed:
            raise AppError(
                status_code=422,
                code="consent_signature_required",
                message=f"Consent decision '{consent_key}' requires its own signature",
                headers=_NO_STORE,
            )
        if not decision_recorded and signed:
            raise AppError(
                status_code=422,
                code="unexpected_consent_signature",
                message=f"Consent decision '{consent_key}' was not recorded",
                headers=_NO_STORE,
            )


def _json_hash(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()


def _new_submission_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    if _ACCESS_TOKEN_PATTERN.fullmatch(token) is None:  # pragma: no cover
        raise RuntimeError("Unexpected public submission token format")
    return token, hashlib.sha256(token.encode("ascii")).hexdigest()


def _submission_token_digest(token: str) -> str:
    if _ACCESS_TOKEN_PATTERN.fullmatch(token) is None:
        raise _submission_not_found()
    return hashlib.sha256(token.encode("ascii")).hexdigest()


async def _tenant_and_version(
    *,
    session: DbSessionDep,
    settings: Settings,
    slug: str,
    code: str,
) -> tuple[Tenant, Any]:
    if slug in settings.reserved_subdomains or not _FORM_CODE_PATTERN.fullmatch(code):
        raise _form_not_found()
    tenant = await session.scalar(
        select(Tenant).where(
            Tenant.slug == slug,
            Tenant.status == TenantStatus.ACTIVE.value,
        )
    )
    if tenant is None:
        raise _form_not_found()
    await set_tenant_context(session, tenant.id)
    version_row = (
        await session.execute(
            select(
                FormTemplate.name,
                FormTemplate.id.label("form_template_id"),
                FormTemplateVersion.id,
                FormTemplateVersion.version_number,
                FormTemplateVersion.schema_definition,
                FormTemplateVersion.legal_content,
            )
            .join(TenantFormTemplate, TenantFormTemplate.form_template_id == FormTemplate.id)
            .join(FormTemplateVersion, FormTemplateVersion.form_template_id == FormTemplate.id)
            .where(
                TenantFormTemplate.tenant_id == tenant.id,
                TenantFormTemplate.enabled.is_(True),
                FormTemplate.status == TemplateStatus.ACTIVE.value,
                FormTemplate.code == code,
                FormTemplateVersion.published_at.is_not(None),
            )
            .order_by(FormTemplateVersion.version_number.desc())
            .limit(1)
        )
    ).first()
    if version_row is None:
        raise _form_not_found()
    return tenant, version_row


async def _selected_practitioner(
    *,
    session: DbSessionDep,
    tenant_id: UUID,
    form_code: str,
    practitioner_id: UUID | None,
    required: bool,
) -> TeamMember | None:
    if required and practitioner_id is None:
        raise AppError(
            status_code=422,
            code="practitioner_required",
            message="A treatment practitioner must be selected",
            headers=_NO_STORE,
        )
    if practitioner_id is None:
        return None
    practitioner = await session.scalar(
        select(TeamMember).where(
            TeamMember.tenant_id == tenant_id,
            TeamMember.id == practitioner_id,
            TeamMember.is_active.is_(True),
            TeamMember.performs_treatments.is_(True),
            TeamMember.membership_id.is_not(None),
            TeamMember.phone_normalized.is_not(None),
        )
    )
    if practitioner is None:
        raise AppError(
            status_code=422,
            code="invalid_practitioner",
            message="The selected practitioner is not available for SMS signing",
            headers=_NO_STORE,
        )
    if not can_perform_treatment(practitioner, form_code):
        raise AppError(
            status_code=422,
            code="invalid_practitioner",
            message="The selected practitioner is not assigned to this treatment",
            headers=_NO_STORE,
        )
    return practitioner


async def _draft_for_public_token(
    *,
    session: DbSessionDep,
    tenant_id: UUID,
    submission_id: UUID,
    token: str,
    for_update: bool = False,
) -> FormSubmission:
    query = select(FormSubmission).where(
        FormSubmission.tenant_id == tenant_id,
        FormSubmission.id == submission_id,
        FormSubmission.status == SubmissionStatus.DRAFT.value,
        FormSubmission.public_access_token_digest == _submission_token_digest(token),
    )
    if for_update:
        query = query.with_for_update()
    submission = await session.scalar(query)
    if submission is None:
        raise _submission_not_found()
    return submission


async def _client_verification_for_update(
    *,
    session: DbSessionDep,
    submission: FormSubmission,
    verification_id: UUID,
) -> SignatureVerification:
    verification = await session.scalar(
        select(SignatureVerification)
        .where(
            SignatureVerification.tenant_id == submission.tenant_id,
            SignatureVerification.form_submission_id == submission.id,
            SignatureVerification.id == verification_id,
            SignatureVerification.signer_type == SignatureSignerType.CLIENT.value,
        )
        .with_for_update()
    )
    if verification is None:
        raise invalid_verification_code()
    return verification


@router.post(
    "/tenants/{slug}/forms/{code}/submissions/client-verification",
    response_model=VerificationStartResponse,
    status_code=201,
)
async def start_client_verification(
    slug: TenantSlugPath,
    code: str,
    payload: FormDraftRequest,
    request: Request,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
) -> VerificationStartResponse:
    normalized_phone = normalize_phone(payload.client.phone)
    tenant, version_row = await _tenant_and_version(
        session=session,
        settings=settings,
        slug=slug,
        code=code,
    )
    practitioner = await _selected_practitioner(
        session=session,
        tenant_id=tenant.id,
        form_code=code,
        practitioner_id=payload.practitioner_team_member_id,
        required=_definition_requires_practitioner(version_row.schema_definition),
    )

    visit_id: UUID | None = None
    if payload.appointment_id is not None or payload.booking_token is not None:
        if payload.appointment_id is None or payload.booking_token is None:
            raise AppError(
                status_code=422,
                code="invalid_appointment_reference",
                message="Appointment id and booking token are both required",
                headers=_NO_STORE,
            )
        booking_digest = hashlib.sha256(payload.booking_token.encode("ascii")).hexdigest()
        appointment = await session.scalar(
            select(ConsumerAppointment)
            .where(
                ConsumerAppointment.id == payload.appointment_id,
                ConsumerAppointment.tenant_id == tenant.id,
                ConsumerAppointment.booking_token_digest == booking_digest,
            )
            .with_for_update()
        )
        if appointment is None:
            raise _submission_not_found()
        visit = await session.scalar(
            select(Visit)
            .where(
                Visit.tenant_id == tenant.id,
                Visit.id == appointment.visit_id,
            )
            .with_for_update()
        )
        if (
            visit is None
            or visit.status != VisitStatus.PLANNED.value
            or visit.form_template_id != version_row.form_template_id
        ):
            raise _submission_not_found()
        client = await session.scalar(
            select(Client).where(
                Client.tenant_id == tenant.id,
                Client.id == visit.client_id,
            )
        )
        if client is None or client.phone_normalized != normalized_phone:
            raise _submission_not_found()
        visit_id = visit.id
    else:
        first_name, last_name = _split_name(payload.client.full_name)
        first_norm, last_norm = _normalize(first_name), _normalize(last_name)
        client = await session.scalar(
            select(Client).where(
                Client.tenant_id == tenant.id,
                Client.first_name_normalized == first_norm,
                Client.last_name_normalized == last_norm,
                Client.phone_normalized == normalized_phone,
            )
        )
        if client is None:
            client = Client(
                tenant_id=tenant.id,
                first_name=first_name,
                last_name=last_name,
                first_name_normalized=first_norm,
                last_name_normalized=last_norm,
                phone=payload.client.phone,
                phone_normalized=normalized_phone,
                email=payload.client.email,
            )
            session.add(client)
            await session.flush()

    answer_fields = dict(payload.answers)
    if practitioner is not None:
        answer_fields["osobaPrzeprowadzajacaZabieg"] = practitioner.display_name
    answers = {
        "fields": answer_fields,
        "treatmentArea": payload.treatment_area,
        "consents": payload.consents,
        "placeAndDate": payload.place_and_date,
    }
    shown_definition, shown_legal, content_locale = localize_form_content(
        version_row.schema_definition, version_row.legal_content or {}, payload.locale
    )
    snapshot = {
        "formCode": code,
        "formName": version_row.name,
        "templateVersion": version_row.version_number,
        # Evidence of the exact wording the client saw and signed.
        "contentLocale": content_locale,
        "contentHash": localized_content_hash(shown_definition, shown_legal),
        "client": payload.client.model_dump(by_alias=True),
        "answers": answers,
        "practitioner": (
            {
                "teamMemberId": str(practitioner.id),
                "displayName": practitioner.display_name,
                "jobTitle": practitioner.job_title,
                "signature": None,
                "signedAt": None,
            }
            if practitioner is not None
            else None
        ),
        "signatures": {},
        "clientSigning": {"status": "PENDING_SMS"},
        "appointmentId": str(payload.appointment_id) if payload.appointment_id else None,
    }
    document_hash = _json_hash(snapshot)
    submission_token, token_digest = _new_submission_token()
    submission = FormSubmission(
        tenant_id=tenant.id,
        client_id=client.id,
        visit_id=visit_id,
        form_template_version_id=version_row.id,
        practitioner_team_member_id=practitioner.id if practitioner else None,
        status=SubmissionStatus.DRAFT.value,
        answers=answers,
        document_snapshot=snapshot,
        document_hash=document_hash,
        public_access_token_digest=token_digest,
    )
    session.add(submission)
    await session.flush()
    verification, dev_code = await issue_sms_verification(
        request=request,
        session=session,
        settings=settings,
        submission=submission,
        phone=normalized_phone,
        signer_type=SignatureSignerType.CLIENT,
    )
    return VerificationStartResponse(
        submission_id=submission.id,
        client_id=client.id,
        submission_token=submission_token,
        verification_id=verification.id,
        destination_masked=verification.destination_masked,
        expires_in_seconds=settings.signature_otp_ttl_seconds,
        dev_code=dev_code,
    )


@router.post(
    "/tenants/{slug}/forms/{code}/submissions/{submission_id}/client-verification",
    response_model=VerificationStartResponse,
)
async def resend_client_verification(
    slug: TenantSlugPath,
    code: str,
    submission_id: UUID,
    payload: VerificationResendRequest,
    request: Request,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
) -> VerificationStartResponse:
    tenant, _version = await _tenant_and_version(
        session=session,
        settings=settings,
        slug=slug,
        code=code,
    )
    submission = await _draft_for_public_token(
        session=session,
        tenant_id=tenant.id,
        submission_id=submission_id,
        token=payload.submission_token,
        for_update=True,
    )
    client = await session.scalar(
        select(Client).where(
            Client.tenant_id == tenant.id,
            Client.id == submission.client_id,
        )
    )
    if client is None or client.phone_normalized is None:
        raise _submission_not_found()
    verification, dev_code = await issue_sms_verification(
        request=request,
        session=session,
        settings=settings,
        submission=submission,
        phone=client.phone_normalized,
        signer_type=SignatureSignerType.CLIENT,
    )
    return VerificationStartResponse(
        submission_id=submission.id,
        client_id=client.id,
        submission_token=payload.submission_token,
        verification_id=verification.id,
        destination_masked=verification.destination_masked,
        expires_in_seconds=settings.signature_otp_ttl_seconds,
        dev_code=dev_code,
    )


@router.post(
    "/tenants/{slug}/forms/{code}/submissions/{submission_id}/client-verification/confirm",
    response_model=VerificationConfirmedResponse,
)
async def confirm_client_verification(
    slug: TenantSlugPath,
    code: str,
    submission_id: UUID,
    payload: VerificationConfirmRequest,
    request: Request,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
) -> VerificationConfirmedResponse:
    tenant, _version = await _tenant_and_version(
        session=session,
        settings=settings,
        slug=slug,
        code=code,
    )
    submission = await _draft_for_public_token(
        session=session,
        tenant_id=tenant.id,
        submission_id=submission_id,
        token=payload.submission_token,
    )
    verification = await _client_verification_for_update(
        session=session,
        submission=submission,
        verification_id=payload.verification_id,
    )
    now = await confirm_sms_verification(
        request=request,
        session=session,
        settings=settings,
        submission=submission,
        verification=verification,
        code=payload.code,
    )
    return VerificationConfirmedResponse(
        verification_id=verification.id,
        status=verification.status,
        verified_at=now,
    )


@router.post(
    "/tenants/{slug}/forms/{code}/submissions/{submission_id}/client-signature",
    response_model=SubmissionCreatedResponse,
    status_code=201,
)
async def sign_client_submission(
    slug: TenantSlugPath,
    code: str,
    submission_id: UUID,
    payload: ClientSignatureRequest,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
) -> SubmissionCreatedResponse:
    if not payload.signatures.get("podpisDane"):
        raise AppError(
            status_code=422,
            code="signature_required",
            message="A signature is required",
            headers=_NO_STORE,
        )
    _validate_signatures(payload.signatures)
    tenant, version = await _tenant_and_version(
        session=session,
        settings=settings,
        slug=slug,
        code=code,
    )
    _validate_consents(payload.consents, version.schema_definition)
    _validate_consent_signatures(payload.consents, payload.signatures)
    submission = await _draft_for_public_token(
        session=session,
        tenant_id=tenant.id,
        submission_id=submission_id,
        token=payload.submission_token,
        for_update=True,
    )
    verification = await _client_verification_for_update(
        session=session,
        submission=submission,
        verification_id=payload.verification_id,
    )
    now = datetime.now(UTC)
    if (
        verification.status != VerificationStatus.VERIFIED.value
        or verification.verified_at is None
        or verification.consumed_at is not None
        or verification.expires_at <= now
        or verification.document_hash != submission.document_hash
    ):
        raise AppError(
            status_code=409,
            code="client_verification_required",
            message="A valid SMS verification is required before signing",
            headers=_NO_STORE,
        )

    answers = dict(submission.answers or {})
    answers["consents"] = payload.consents
    snapshot = dict(submission.document_snapshot or {})
    snapshot["answers"] = answers
    snapshot["signatures"] = payload.signatures
    snapshot["clientSignedAt"] = now.isoformat()
    snapshot["clientSigning"] = {
        "status": "SIGNED",
        "verificationId": str(verification.id),
        "method": verification.method,
        "destinationMasked": verification.destination_masked,
        "provider": verification.provider,
        "verifiedAt": verification.verified_at.isoformat(),
        "draftDocumentHash": verification.document_hash,
    }
    submission.answers = answers
    submission.document_snapshot = snapshot
    submission.document_hash = _json_hash(snapshot)
    submission.status = SubmissionStatus.SUBMITTED.value
    submission.submitted_at = now
    submission.public_access_token_digest = None
    verification.consumed_at = now
    client = await session.scalar(
        select(Client).where(
            Client.tenant_id == tenant.id,
            Client.id == submission.client_id,
        )
    )
    if client is None or client.phone_normalized is None:
        raise _submission_not_found()
    if submission.practitioner_team_member_id is not None:
        practitioner_snapshot = snapshot.get("practitioner")
        practitioner_name = (
            practitioner_snapshot.get("displayName")
            if isinstance(practitioner_snapshot, dict)
            and isinstance(practitioner_snapshot.get("displayName"), str)
            else None
        )
        add_practitioner_signature_notification(
            session=session,
            tenant_id=tenant.id,
            submission_id=submission.id,
            client_id=client.id,
            client_name=f"{client.first_name} {client.last_name}".strip(),
            form_name=version.name,
            practitioner_name=practitioner_name,
            created_at=now,
        )
    claim_token, _claim = await issue_consumer_document_claim(
        session=session,
        settings=settings,
        submission=submission,
        phone_normalized=client.phone_normalized,
    )
    return SubmissionCreatedResponse(
        submission_id=submission.id,
        client_id=submission.client_id,
        status=submission.status,
        claim_token=claim_token,
        claim_expires_in_seconds=settings.consumer_claim_ttl_seconds,
    )


@router.post("/tenants/{slug}/forms/{code}/submissions", include_in_schema=False)
async def legacy_direct_submission_disabled(
    slug: TenantSlugPath,
    code: str,
    _origin: TrustedOriginDep,
) -> None:
    del slug, code
    raise AppError(
        status_code=409,
        code="sms_verification_required",
        message="Start the SMS verification flow before signing",
        headers=_NO_STORE,
    )


def _definition_requires_practitioner(definition: object) -> bool:
    if not isinstance(definition, dict):
        return False
    sections = definition.get("sections")
    if not isinstance(sections, list):
        return False
    for section in sections[:100]:
        if not isinstance(section, dict):
            continue
        fields = section.get("fields")
        if not isinstance(fields, list):
            continue
        for field in fields[:500]:
            if (
                isinstance(field, dict)
                and field.get("key") == "osobaPrzeprowadzajacaZabieg"
                and field.get("required") is True
            ):
                return True
    return False


def _definition_consent_rules(definition: object) -> tuple[set[str], set[str]]:
    allowed: set[str] = set()
    required: set[str] = set()
    if not isinstance(definition, dict):
        return allowed, required
    sections = definition.get("sections")
    if not isinstance(sections, list):
        return allowed, required
    for section in sections[:100]:
        if not isinstance(section, dict):
            continue
        fields = section.get("fields")
        if not isinstance(fields, list):
            continue
        for field in fields[:500]:
            if not isinstance(field, dict) or field.get("type") != "consent":
                continue
            key = field.get("key")
            if not isinstance(key, str) or not key:
                continue
            allowed.add(key)
            if field.get("required") is True:
                required.add(key)
    return allowed, required


def _form_not_found() -> AppError:
    return AppError(
        status_code=404,
        code="form_not_found",
        message="Form was not found",
        headers=_NO_STORE,
    )


def _submission_not_found() -> AppError:
    return AppError(
        status_code=404,
        code="submission_not_found",
        message="Submission was not found",
        headers=_NO_STORE,
    )
