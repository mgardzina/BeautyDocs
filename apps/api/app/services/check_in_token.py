"""Stateless, short-lived HMAC tokens for the client check-in QR code.

The client's portal shows a QR that rotates every ~60s; the salon scans it to
confirm the client and open her file. Tokens are signed (not stored), so a
photographed code stops working once it expires.
"""

from __future__ import annotations

import base64
import binascii
import hmac
import time
from hashlib import sha256
from uuid import UUID


class CheckInTokenError(ValueError):
    """Raised when a check-in token is malformed, expired, or wrongly signed."""


def _b64u_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64u_decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def issue_check_in_token(
    *,
    consumer_id: UUID,
    key: str,
    ttl_seconds: int,
) -> tuple[str, int]:
    expires_at = int(time.time()) + ttl_seconds
    payload = f"{consumer_id}:{expires_at}".encode("ascii")
    signature = hmac.new(key.encode("utf-8"), payload, sha256).digest()
    token = f"{_b64u_encode(payload)}.{_b64u_encode(signature)}"
    return token, ttl_seconds


def verify_check_in_token(*, token: str, key: str) -> UUID:
    try:
        payload_part, signature_part = token.split(".", 1)
        payload = _b64u_decode(payload_part)
        signature = _b64u_decode(signature_part)
    except (ValueError, binascii.Error):
        raise CheckInTokenError("Malformed token") from None

    expected = hmac.new(key.encode("utf-8"), payload, sha256).digest()
    if not hmac.compare_digest(signature, expected):
        raise CheckInTokenError("Invalid token signature")

    try:
        consumer_part, expires_part = payload.decode("ascii").split(":", 1)
        expires_at = int(expires_part)
        consumer_id = UUID(consumer_part)
    except ValueError:
        raise CheckInTokenError("Malformed token payload") from None

    if expires_at < int(time.time()):
        raise CheckInTokenError("Token expired")
    return consumer_id
