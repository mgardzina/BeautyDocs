from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from anyio import to_thread
from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import generate_verification_code, hash_password, verify_password
from app.models.domain import (
    FormSubmission,
    SignatureSignerType,
    SignatureVerification,
    VerificationStatus,
)
from app.services.signature_sms import (
    mask_phone,
    normalize_phone,
    send_signature_code,
    signing_request_metadata,
)

NO_STORE_HEADERS = {"Cache-Control": "no-store"}


async def issue_sms_verification(
    *,
    request: Request,
    session: AsyncSession,
    settings: Settings,
    submission: FormSubmission,
    phone: str,
    signer_type: SignatureSignerType,
    signer_membership_id: UUID | None = None,
    signer_team_member_id: UUID | None = None,
) -> tuple[SignatureVerification, str | None]:
    now = datetime.now(UTC)
    latest = await session.scalar(
        select(SignatureVerification)
        .where(
            SignatureVerification.tenant_id == submission.tenant_id,
            SignatureVerification.form_submission_id == submission.id,
            SignatureVerification.signer_type == signer_type.value,
            SignatureVerification.status == VerificationStatus.PENDING.value,
        )
        .order_by(SignatureVerification.created_at.desc())
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
                headers={**NO_STORE_HEADERS, "Retry-After": str(retry_after)},
            )
        latest.status = VerificationStatus.EXPIRED.value

    normalized_phone = normalize_phone(phone)
    code = generate_verification_code()
    otp_digest = await to_thread.run_sync(hash_password, code)
    dispatch = await send_signature_code(
        phone=normalized_phone,
        code=code,
        settings=settings,
    )
    metadata = signing_request_metadata(request)
    verification = SignatureVerification(
        tenant_id=submission.tenant_id,
        form_submission_id=submission.id,
        signer_type=signer_type.value,
        signer_membership_id=signer_membership_id,
        signer_team_member_id=signer_team_member_id,
        status=VerificationStatus.PENDING.value,
        otp_digest=otp_digest,
        destination_masked=mask_phone(normalized_phone),
        provider=dispatch.provider,
        provider_message_id=dispatch.message_id,
        document_hash=submission.document_hash,
        attempt_count=0,
        requested_ip_address=metadata.ip_address,
        requested_user_agent=metadata.user_agent,
        created_at=now,
        expires_at=now + timedelta(seconds=settings.signature_otp_ttl_seconds),
    )
    session.add(verification)
    await session.flush()
    dev_code = code if settings.environment in {"local", "test"} else None
    return verification, dev_code


async def confirm_sms_verification(
    *,
    request: Request,
    session: AsyncSession,
    settings: Settings,
    submission: FormSubmission,
    verification: SignatureVerification,
    code: str,
) -> datetime:
    now = datetime.now(UTC)
    if (
        verification.status != VerificationStatus.PENDING.value
        or verification.expires_at <= now
        or verification.attempt_count >= settings.signature_otp_max_attempts
        or verification.document_hash != submission.document_hash
    ):
        if verification.status == VerificationStatus.PENDING.value:
            verification.status = VerificationStatus.EXPIRED.value
        raise invalid_verification_code()

    check = await to_thread.run_sync(verify_password, code, verification.otp_digest)
    if not check.valid:
        verification.attempt_count += 1
        if verification.attempt_count >= settings.signature_otp_max_attempts:
            verification.status = VerificationStatus.FAILED.value
        raise invalid_verification_code()

    metadata = signing_request_metadata(request)
    verification.status = VerificationStatus.VERIFIED.value
    verification.verified_at = now
    verification.verified_ip_address = metadata.ip_address
    verification.verified_user_agent = metadata.user_agent
    return now


def invalid_verification_code() -> AppError:
    return AppError(
        status_code=400,
        code="invalid_code",
        message="The verification code is invalid or has expired",
        headers=NO_STORE_HEADERS,
    )
