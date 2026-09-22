"""Validation for salon logo images stored as bounded data URLs.

The client resizes the logo before upload; here we only accept a small PNG/JPEG/
WebP data URL so it can be embedded directly in public responses.
"""

from __future__ import annotations

import base64
import binascii
import re

LOGO_MAX_CHARS = 300_000
_LOGO_DATA_URL_PATTERN = re.compile(
    r"^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$"
)


class InvalidLogoImageError(ValueError):
    """Raised when an uploaded logo is not a valid, bounded image data URL."""


def validate_logo_data_url(value: str) -> str:
    if len(value) > LOGO_MAX_CHARS:
        raise InvalidLogoImageError("Logo image is too large")
    match = _LOGO_DATA_URL_PATTERN.match(value)
    if match is None:
        raise InvalidLogoImageError("Logo must be a PNG, JPEG, or WebP data URL")
    try:
        payload = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise InvalidLogoImageError("Logo image is not valid base64") from exc
    if len(payload) < 32:
        raise InvalidLogoImageError("Logo image is empty")
    return value
