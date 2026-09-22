from __future__ import annotations

import asyncio
import smtplib
from unittest.mock import patch

import pytest

from app.core.config import Settings
from app.services.account_email import (
    VerificationEmailDeliveryError,
    send_account_verification_email,
)


def _smtp_settings(environment: str) -> Settings:
    values: dict[str, object] = {}
    if environment in {"staging", "production"}:
        values = {
            "allow_localhost_tenants": False,
            "auth_allowed_origins": ["https://app.beautydocs.pl"],
        }
    if environment == "production":
        values["mfa_encryption_key"] = (
            "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="
        )
    return Settings(
        _env_file=None,
        environment=environment,
        email_smtp_host="smtp.example.test",
        email_smtp_port=587,
        email_smtp_security="none",
        email_from_address="noreply@example.test",
        **values,
    )


def _send(settings: Settings) -> None:
    asyncio.run(
        send_account_verification_email(
            recipient_email="owner@example.test",
            recipient_name="Anna Testowa",
            code="123456",
            expires_in_seconds=900,
            settings=settings,
        )
    )


def test_local_registration_is_not_blocked_when_smtp_rejects_the_ip() -> None:
    with patch(
        "app.services.account_email._send_message",
        side_effect=smtplib.SMTPAuthenticationError(
            525,
            b"5.7.1 Unauthorized IP address",
        ),
    ):
        _send(_smtp_settings("local"))


def test_production_registration_still_requires_successful_email_delivery() -> None:
    with (
        patch(
            "app.services.account_email._send_message",
            side_effect=smtplib.SMTPAuthenticationError(
                525,
                b"5.7.1 Unauthorized IP address",
            ),
        ),
        pytest.raises(VerificationEmailDeliveryError),
    ):
        _send(_smtp_settings("production"))
