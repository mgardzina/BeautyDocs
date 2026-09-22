"""Validation shared by reusable account and salon team signatures."""

from __future__ import annotations

import base64
import binascii
import re

SIGNATURE_MAX_BYTES = 450_000
SIGNATURE_MAX_CHARS = 600_000

_SIGNATURE_DATA_URL_PATTERN = re.compile(r"^data:image/png;base64,([A-Za-z0-9+/=]+)$")
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


class InvalidSignatureImageError(ValueError):
    """Raised when a signature is not a supported, bounded PNG data URL."""


def decode_signature_png_data_url(value: str) -> bytes:
    """Decode a PNG data URL after strict format and size validation."""

    if len(value) > SIGNATURE_MAX_CHARS:
        raise InvalidSignatureImageError
    match = _SIGNATURE_DATA_URL_PATTERN.fullmatch(value)
    if match is None:
        raise InvalidSignatureImageError
    try:
        payload = base64.b64decode(match.group(1), validate=True)
    except (binascii.Error, ValueError):
        raise InvalidSignatureImageError from None
    if not payload.startswith(_PNG_MAGIC) or not payload or len(payload) > SIGNATURE_MAX_BYTES:
        raise InvalidSignatureImageError
    return payload
