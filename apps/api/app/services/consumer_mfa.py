"""Optional MFA for client (consumer) accounts.

Mirrors ``app.services.account_mfa`` for owner/staff accounts. The pure
cryptographic primitives (TOTP generation/verification, secret encryption,
QR provisioning) have no owner-specific logic, so they're imported and
reused as-is rather than duplicated. Only the parts that touch ``User`` /
``UserMfaChallenge`` are reimplemented here against ``ConsumerAccount`` /
``ConsumerMfaChallenge`` — and, since consumer tables carry no row-level
security, this version skips the ``set_user_context`` /
``set_mfa_challenge_context`` calls its owner counterpart needs.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from anyio import to_thread
from cryptography.exceptions import InvalidTag
from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import generate_verification_code, hash_password, verify_password
from app.models.domain import (
    ConsumerAccount,
    ConsumerMfaChallenge,
    MfaChallengePurpose,
    MfaMethod,
    VerificationStatus,
)
from app.services.account_mfa import (
    decrypt_totp_secret,
    matching_totp_counter,
    send_account_mfa_code,
)
from app.services.signature_sms import mask_phone, signing_request_metadata

__all__ = [
    "clear_consumer_mfa",
    "consumer_mfa_enabled",
    "issue_consumer_mfa_challenge",
    "verify_consumer_mfa_challenge",
]


async def issue_consumer_mfa_challenge(
    *,
    session: AsyncSession,
    request: Request,
    settings: Settings,
    account: ConsumerAccount,
    purpose: MfaChallengePurpose,
    method: MfaMethod,
    phone_normalized: str | None = None,
    totp_secret_encrypted: str | None = None,
) -> tuple[ConsumerMfaChallenge, str | None]:
    now = datetime.now(UTC)
    latest = await session.scalar(
        select(ConsumerMfaChallenge)
        .where(
            ConsumerMfaChallenge.consumer_account_id == account.id,
            ConsumerMfaChallenge.purpose == purpose.value,
            ConsumerMfaChallenge.method == method.value,
            ConsumerMfaChallenge.status == VerificationStatus.PENDING.value,
        )
        .order_by(ConsumerMfaChallenge.created_at.desc())
        .limit(1)
    )
    if latest is not None:
        elapsed = (now - latest.created_at).total_seconds()
        if elapsed < settings.auth_mfa_resend_cooldown_seconds:
            retry_after = max(
                1,
                settings.auth_mfa_resend_cooldown_seconds - int(elapsed),
            )
            raise AppError(
                status_code=429,
                code="mfa_rate_limited",
                message="Wait before requesting another verification code",
                headers={"Cache-Control": "no-store", "Retry-After": str(retry_after)},
            )
        await session.execute(
            update(ConsumerMfaChallenge)
            .where(
                ConsumerMfaChallenge.consumer_account_id == account.id,
                ConsumerMfaChallenge.purpose == purpose.value,
                ConsumerMfaChallenge.status == VerificationStatus.PENDING.value,
            )
            .values(status=VerificationStatus.EXPIRED.value)
        )
    challenge_id = uuid4()
    metadata = signing_request_metadata(request)
    otp_digest: str | None = None
    destination_masked: str | None = None
    provider: str | None = None
    provider_message_id: str | None = None
    dev_code: str | None = None

    if method == MfaMethod.SMS:
        if phone_normalized is None:
            raise ValueError("An SMS challenge requires a phone number")
        code = generate_verification_code()
        otp_digest = await to_thread.run_sync(hash_password, code)
        dispatch = await send_account_mfa_code(
            phone=phone_normalized,
            code=code,
            settings=settings,
        )
        destination_masked = mask_phone(phone_normalized)
        provider = dispatch.provider
        provider_message_id = dispatch.message_id
        if settings.environment in {"local", "test"}:
            dev_code = code
    elif totp_secret_encrypted is None and purpose == MfaChallengePurpose.ENROLLMENT:
        raise ValueError("A TOTP enrollment requires a pending secret")

    challenge = ConsumerMfaChallenge(
        id=challenge_id,
        consumer_account_id=account.id,
        purpose=purpose.value,
        method=method.value,
        status=VerificationStatus.PENDING.value,
        otp_digest=otp_digest,
        phone_normalized=phone_normalized,
        totp_secret_encrypted=totp_secret_encrypted,
        destination_masked=destination_masked,
        attempt_count=0,
        provider=provider,
        provider_message_id=provider_message_id,
        requested_ip_address=metadata.ip_address,
        requested_user_agent=metadata.user_agent,
        created_at=now,
        expires_at=now + timedelta(seconds=settings.auth_mfa_challenge_ttl_seconds),
    )
    session.add(challenge)
    return challenge, dev_code


async def verify_consumer_mfa_challenge(
    *,
    challenge: ConsumerMfaChallenge,
    account: ConsumerAccount,
    code: str,
    settings: Settings,
    now: datetime | None = None,
) -> bool:
    checked_at = now or datetime.now(UTC)
    if (
        challenge.status != VerificationStatus.PENDING.value
        or challenge.expires_at <= checked_at
        or challenge.attempt_count >= settings.auth_mfa_max_attempts
    ):
        if challenge.status == VerificationStatus.PENDING.value:
            challenge.status = VerificationStatus.EXPIRED.value
        return False

    valid = False
    matching_counter: int | None = None
    if challenge.method == MfaMethod.SMS.value and challenge.otp_digest is not None:
        valid = (await to_thread.run_sync(verify_password, code, challenge.otp_digest)).valid
    elif challenge.method == MfaMethod.TOTP.value:
        encrypted_secret = (
            challenge.totp_secret_encrypted
            if challenge.purpose == MfaChallengePurpose.ENROLLMENT.value
            else account.mfa_totp_secret_encrypted
        )
        if encrypted_secret:
            try:
                secret = decrypt_totp_secret(encrypted_secret, settings)
                matching_counter = matching_totp_counter(secret, code)
            except (InvalidTag, ValueError, UnicodeError):
                matching_counter = None
            valid = matching_counter is not None and (
                challenge.purpose == MfaChallengePurpose.ENROLLMENT.value
                or account.mfa_last_used_counter is None
                or matching_counter > account.mfa_last_used_counter
            )

    if not valid:
        challenge.attempt_count += 1
        if challenge.attempt_count >= settings.auth_mfa_max_attempts:
            challenge.status = VerificationStatus.FAILED.value
        return False

    challenge.status = VerificationStatus.VERIFIED.value
    challenge.verified_at = checked_at
    if matching_counter is not None and challenge.purpose != MfaChallengePurpose.ENROLLMENT.value:
        account.mfa_last_used_counter = matching_counter
    return True


def consumer_mfa_enabled(account: ConsumerAccount) -> bool:
    if account.mfa_method == MfaMethod.SMS.value:
        return bool(account.mfa_phone_normalized and account.mfa_enabled_at)
    if account.mfa_method == MfaMethod.TOTP.value:
        return bool(account.mfa_totp_secret_encrypted and account.mfa_enabled_at)
    return False


def clear_consumer_mfa(account: ConsumerAccount) -> None:
    account.mfa_method = None
    account.mfa_phone_normalized = None
    account.mfa_totp_secret_encrypted = None
    account.mfa_enabled_at = None
    account.mfa_last_used_counter = None
