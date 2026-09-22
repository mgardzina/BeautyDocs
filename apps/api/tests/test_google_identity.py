from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services.google_identity import (
    GoogleIdentityVerificationError,
    verify_google_credential,
)

CLIENT_ID = "123456789-beautydocstest.apps.googleusercontent.com"


def test_google_identity_uses_subject_and_authoritative_gmail() -> None:
    with patch(
        "app.services.google_identity.id_token.verify_oauth2_token",
        return_value={
            "iss": "https://accounts.google.com",
            "sub": "stable-google-subject",
            "email": "Ewa@gmail.com",
            "email_verified": True,
            "name": "Ewa Testowa",
        },
    ):
        verified = verify_google_credential(
            credential="credential",
            client_id=CLIENT_ID,
        )

    assert verified.subject == "stable-google-subject"
    assert verified.email_normalized == "ewa@gmail.com"
    assert verified.email_is_authoritative is True


def test_google_identity_does_not_auto_link_third_party_email() -> None:
    with patch(
        "app.services.google_identity.id_token.verify_oauth2_token",
        return_value={
            "iss": "accounts.google.com",
            "sub": "third-party-google-subject",
            "email": "ewa@example.com",
            "email_verified": True,
        },
    ):
        verified = verify_google_credential(
            credential="credential",
            client_id=CLIENT_ID,
        )

    assert verified.email_is_authoritative is False


@pytest.mark.parametrize(
    "payload",
    [
        {
            "iss": "attacker.example",
            "sub": "subject",
            "email": "ewa@gmail.com",
            "email_verified": True,
        },
        {
            "iss": "accounts.google.com",
            "sub": "subject",
            "email": "ewa@gmail.com",
            "email_verified": False,
        },
    ],
)
def test_google_identity_rejects_untrusted_claims(payload: dict[str, object]) -> None:
    with (
        patch(
            "app.services.google_identity.id_token.verify_oauth2_token",
            return_value=payload,
        ),
        pytest.raises(GoogleIdentityVerificationError),
    ):
        verify_google_credential(
            credential="credential",
            client_id=CLIENT_ID,
        )
