from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass

import httpx
from fastapi import Request

from app.core.config import Settings
from app.core.errors import AppError

_PHONE_SEPARATORS = re.compile(r"[\s().-]+")
_E164_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")


@dataclass(frozen=True, slots=True)
class SmsDispatch:
    provider: str
    message_id: str | None


@dataclass(frozen=True, slots=True)
class SigningRequestMetadata:
    ip_address: str | None
    user_agent: str | None


def normalize_phone(value: str | None) -> str:
    if value is None:
        raise _invalid_phone()
    normalized = _PHONE_SEPARATORS.sub("", value.strip())
    if normalized.startswith("00"):
        normalized = f"+{normalized[2:]}"
    elif normalized.isdigit() and len(normalized) == 9:
        normalized = f"+48{normalized}"
    elif normalized.isdigit() and normalized.startswith("48"):
        normalized = f"+{normalized}"
    if not _E164_PATTERN.fullmatch(normalized):
        raise _invalid_phone()
    return normalized


def mask_phone(normalized: str) -> str:
    visible = normalized[-3:]
    prefix = normalized[:3]
    return f"{prefix}{'•' * max(3, len(normalized) - len(prefix) - len(visible))}{visible}"


def signing_request_metadata(request: Request) -> SigningRequestMetadata:
    raw_forwarded = request.headers.get("x-forwarded-for")
    candidate = raw_forwarded.split(",", 1)[0].strip() if raw_forwarded else None
    if candidate is None and request.client is not None:
        candidate = request.client.host
    ip_address: str | None = None
    if candidate:
        try:
            ip_address = str(ipaddress.ip_address(candidate))
        except ValueError:
            ip_address = None

    user_agent = request.headers.get("x-beautydocs-original-user-agent")
    if user_agent is None:
        user_agent = request.headers.get("user-agent")
    if user_agent is not None:
        user_agent = user_agent.strip()[:512] or None
    return SigningRequestMetadata(ip_address=ip_address, user_agent=user_agent)


async def send_signature_code(
    *,
    phone: str,
    code: str,
    settings: Settings,
) -> SmsDispatch:
    validity_minutes = max(1, settings.signature_otp_ttl_seconds // 60)
    return await _send_code(
        phone=phone,
        message=(f"BeautyDocs: kod potwierdzający {code}. Ważny przez {validity_minutes} min."),
        settings=settings,
    )


async def send_consumer_login_code(
    *,
    phone: str,
    code: str,
    settings: Settings,
) -> SmsDispatch:
    validity_minutes = max(1, settings.signature_otp_ttl_seconds // 60)
    return await _send_code(
        phone=phone,
        message=(f"BeautyDocs: kod logowania {code}. Ważny przez {validity_minutes} min."),
        settings=settings,
    )


async def _send_code(
    *,
    phone: str,
    message: str,
    settings: Settings,
) -> SmsDispatch:
    if settings.environment == "test" or (
        settings.environment == "local" and settings.smsapi_token is None
    ):
        return SmsDispatch(provider="DEVELOPMENT", message_id=None)

    if settings.smsapi_token is None:
        raise _sms_unavailable()

    token = settings.smsapi_token.get_secret_value()
    try:
        async with httpx.AsyncClient(
            base_url="https://api.smsapi.pl",
            timeout=10.0,
        ) as client:
            response = await client.post(
                "/sms.do",
                headers={"Authorization": f"Bearer {token}"},
                data={
                    "to": phone.removeprefix("+"),
                    "from": settings.sms_sender_name,
                    "message": message,
                    "format": "json",
                },
            )
            payload = response.json()
            if _smsapi_error_code(payload) == 103:
                raise _sms_balance_required()
            response.raise_for_status()
    except (httpx.HTTPError, ValueError, TypeError):
        raise _sms_unavailable() from None

    messages = payload.get("list") if isinstance(payload, dict) else None
    message = messages[0] if isinstance(messages, list) and messages else None
    message_id = message.get("id") if isinstance(message, dict) else None
    if not isinstance(message_id, str) or not message_id:
        raise _sms_unavailable()
    return SmsDispatch(provider="SMSAPI", message_id=message_id[:255])


def _smsapi_error_code(payload: object) -> int | None:
    if not isinstance(payload, dict):
        return None
    error = payload.get("error")
    if isinstance(error, int):
        return error
    if isinstance(error, str) and error.isdigit():
        return int(error)
    return None


def _invalid_phone() -> AppError:
    return AppError(
        status_code=422,
        code="invalid_phone",
        message="A valid mobile phone number is required",
        headers={"Cache-Control": "no-store"},
    )


def _sms_unavailable() -> AppError:
    return AppError(
        status_code=503,
        code="sms_unavailable",
        message="The SMS service is temporarily unavailable",
        headers={"Cache-Control": "no-store"},
    )


def _sms_balance_required() -> AppError:
    return AppError(
        status_code=402,
        code="sms_balance_required",
        message="The SMS provider account has insufficient balance",
        headers={"Cache-Control": "no-store"},
    )
