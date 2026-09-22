"""Cryptographic and delivery primitives for optional account MFA."""

from __future__ import annotations

import base64
import hashlib
import hmac
import io
import secrets
import struct
import time
from datetime import UTC, datetime, timedelta
from urllib.parse import quote, urlencode
from uuid import uuid4

import qrcode
from anyio import to_thread
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import generate_verification_code, hash_password, verify_password
from app.db.tenant_context import set_mfa_challenge_context, set_user_context
from app.models.domain import (
    MfaChallengePurpose,
    MfaMethod,
    User,
    UserMfaChallenge,
    VerificationStatus,
)
from app.services.signature_sms import (
    SmsDispatch,
    _send_code,
    mask_phone,
    signing_request_metadata,
)

_TOTP_STEP_SECONDS = 30
_TOTP_DIGITS = 6
_LOCAL_KEY_LABEL = b"beautydocs-local-only-mfa-encryption-key"


def generate_totp_secret() -> str:
    """Return a 160-bit RFC 6238 secret in unpadded Base32 form."""

    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def totp_code(secret: str, *, timestamp: int | None = None) -> str:
    counter = (timestamp if timestamp is not None else int(time.time())) // _TOTP_STEP_SECONDS
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{binary % (10**_TOTP_DIGITS):0{_TOTP_DIGITS}d}"


def verify_totp_code(
    secret: str,
    code: str,
    *,
    timestamp: int | None = None,
    window: int = 1,
) -> bool:
    return (
        matching_totp_counter(
            secret,
            code,
            timestamp=timestamp,
            window=window,
        )
        is not None
    )


def matching_totp_counter(
    secret: str,
    code: str,
    *,
    timestamp: int | None = None,
    window: int = 1,
) -> int | None:
    if len(code) != _TOTP_DIGITS or not code.isdigit():
        return None
    current = timestamp if timestamp is not None else int(time.time())
    for offset in range(-window, window + 1):
        candidate_timestamp = current + offset * _TOTP_STEP_SECONDS
        if hmac.compare_digest(totp_code(secret, timestamp=candidate_timestamp), code):
            return candidate_timestamp // _TOTP_STEP_SECONDS
    return None


def encrypt_totp_secret(secret: str, settings: Settings) -> str:
    nonce = secrets.token_bytes(12)
    encrypted = AESGCM(_encryption_key(settings)).encrypt(
        nonce,
        secret.encode("ascii"),
        b"beautydocs:user-mfa:v1",
    )
    return base64.urlsafe_b64encode(nonce + encrypted).decode("ascii").rstrip("=")


def decrypt_totp_secret(payload: str, settings: Settings) -> str:
    raw = base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
    if len(raw) < 29:
        raise ValueError("Invalid encrypted TOTP secret")
    secret = AESGCM(_encryption_key(settings)).decrypt(
        raw[:12],
        raw[12:],
        b"beautydocs:user-mfa:v1",
    )
    return secret.decode("ascii")


def totp_provisioning_uri(*, secret: str, account_email: str) -> str:
    issuer = "BeautyDocs"
    label = quote(f"{issuer}:{account_email}", safe="")
    query = urlencode(
        {
            "secret": secret,
            "issuer": issuer,
            "algorithm": "SHA1",
            "digits": str(_TOTP_DIGITS),
            "period": str(_TOTP_STEP_SECONDS),
        }
    )
    return f"otpauth://totp/{label}?{query}"


def qr_code_data_url(value: str) -> str:
    image = qrcode.make(value)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


async def send_account_mfa_code(
    *,
    phone: str,
    code: str,
    settings: Settings,
) -> SmsDispatch:
    validity_minutes = max(1, settings.auth_mfa_challenge_ttl_seconds // 60)
    return await _send_code(
        phone=phone,
        message=f"BeautyDocs: kod zabezpieczenia konta {code}. Ważny {validity_minutes} min.",
        settings=settings,
    )


async def issue_mfa_challenge(
    *,
    session: AsyncSession,
    request: Request,
    settings: Settings,
    user: User,
    purpose: MfaChallengePurpose,
    method: MfaMethod,
    phone_normalized: str | None = None,
    totp_secret_encrypted: str | None = None,
) -> tuple[UserMfaChallenge, str | None]:
    now = datetime.now(UTC)
    await set_user_context(session, user.id)
    latest = await session.scalar(
        select(UserMfaChallenge)
        .where(
            UserMfaChallenge.user_id == user.id,
            UserMfaChallenge.purpose == purpose.value,
            UserMfaChallenge.method == method.value,
            UserMfaChallenge.status == VerificationStatus.PENDING.value,
        )
        .order_by(UserMfaChallenge.created_at.desc())
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
            update(UserMfaChallenge)
            .where(
                UserMfaChallenge.user_id == user.id,
                UserMfaChallenge.purpose == purpose.value,
                UserMfaChallenge.status == VerificationStatus.PENDING.value,
            )
            .values(status=VerificationStatus.EXPIRED.value)
        )
    challenge_id = uuid4()
    await set_mfa_challenge_context(session, challenge_id)
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

    challenge = UserMfaChallenge(
        id=challenge_id,
        user_id=user.id,
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


async def verify_mfa_challenge(
    *,
    challenge: UserMfaChallenge,
    user: User,
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
            else user.mfa_totp_secret_encrypted
        )
        if encrypted_secret:
            try:
                secret = decrypt_totp_secret(encrypted_secret, settings)
                matching_counter = matching_totp_counter(secret, code)
            except (InvalidTag, ValueError, UnicodeError):
                matching_counter = None
            valid = matching_counter is not None and (
                challenge.purpose == MfaChallengePurpose.ENROLLMENT.value
                or user.mfa_last_used_counter is None
                or matching_counter > user.mfa_last_used_counter
            )

    if not valid:
        challenge.attempt_count += 1
        if challenge.attempt_count >= settings.auth_mfa_max_attempts:
            challenge.status = VerificationStatus.FAILED.value
        return False

    challenge.status = VerificationStatus.VERIFIED.value
    challenge.verified_at = checked_at
    if matching_counter is not None and challenge.purpose != MfaChallengePurpose.ENROLLMENT.value:
        user.mfa_last_used_counter = matching_counter
    return True


def mfa_enabled(user: User) -> bool:
    if user.mfa_method == MfaMethod.SMS.value:
        return bool(user.mfa_phone_normalized and user.mfa_enabled_at)
    if user.mfa_method == MfaMethod.TOTP.value:
        return bool(user.mfa_totp_secret_encrypted and user.mfa_enabled_at)
    return False


def clear_mfa(user: User) -> None:
    user.mfa_method = None
    user.mfa_phone_normalized = None
    user.mfa_totp_secret_encrypted = None
    user.mfa_enabled_at = None
    user.mfa_last_used_counter = None


def _encryption_key(settings: Settings) -> bytes:
    if settings.mfa_encryption_key is None:
        if settings.environment not in {"local", "test"}:  # pragma: no cover - config guard
            raise RuntimeError("MFA encryption key is not configured")
        return hashlib.sha256(_LOCAL_KEY_LABEL).digest()
    encoded = settings.mfa_encryption_key.get_secret_value()
    return base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
