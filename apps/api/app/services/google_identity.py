from __future__ import annotations

from dataclasses import dataclass
from functools import partial

import httpx
from anyio import to_thread
from google.auth import exceptions as google_exceptions
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

_GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
_GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


class GoogleIdentityVerificationError(ValueError):
    """Raised when a Google credential cannot be trusted for sign-in."""


@dataclass(frozen=True, slots=True)
class VerifiedGoogleIdentity:
    subject: str
    email: str
    email_normalized: str
    full_name: str
    hosted_domain: str | None
    email_is_authoritative: bool


def verify_google_credential(
    *,
    credential: str,
    client_id: str,
) -> VerifiedGoogleIdentity:
    try:
        payload = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            client_id,
        )
    except (ValueError, google_exceptions.GoogleAuthError, OSError) as exc:
        raise GoogleIdentityVerificationError("Invalid Google credential") from exc

    issuer = payload.get("iss")
    subject = payload.get("sub")
    email = payload.get("email")
    email_verified = payload.get("email_verified")
    hosted_domain = payload.get("hd")
    full_name = payload.get("name")

    if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
        raise GoogleIdentityVerificationError("Invalid Google issuer")
    return _build_verified_identity(
        subject=subject,
        email=email,
        email_verified=email_verified is True,
        hosted_domain=hosted_domain,
        full_name=full_name,
    )


async def verify_google_access_token(
    *,
    access_token: str,
    client_id: str,
) -> VerifiedGoogleIdentity:
    """Verify a Google OAuth access token (custom-button token flow).

    The access token is validated against Google's tokeninfo endpoint (to confirm
    it was issued to *our* client, preventing token substitution) and the profile
    is read from the OpenID userinfo endpoint.
    """
    timeout = httpx.Timeout(6.0, connect=3.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            tokeninfo_response = await client.get(
                _GOOGLE_TOKENINFO_URL, params={"access_token": access_token}
            )
            userinfo_response = await client.get(
                _GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
    except httpx.HTTPError as exc:
        raise GoogleIdentityVerificationError("Could not reach Google") from exc

    if tokeninfo_response.status_code != 200 or userinfo_response.status_code != 200:
        raise GoogleIdentityVerificationError("Invalid Google access token")

    tokeninfo = tokeninfo_response.json()
    userinfo = userinfo_response.json()

    # The token must have been minted for this application, not another client.
    audience = tokeninfo.get("aud") or tokeninfo.get("azp")
    if audience != client_id:
        raise GoogleIdentityVerificationError("Google token audience mismatch")

    subject = userinfo.get("sub")
    if (
        not isinstance(subject, str)
        or not subject
        or subject != tokeninfo.get("sub")
    ):
        raise GoogleIdentityVerificationError("Invalid Google subject")

    email_verified = userinfo.get("email_verified")
    if isinstance(email_verified, str):
        email_verified = email_verified.strip().lower() == "true"

    return _build_verified_identity(
        subject=subject,
        email=userinfo.get("email"),
        email_verified=email_verified is True,
        hosted_domain=userinfo.get("hd"),
        full_name=userinfo.get("name"),
    )


async def resolve_google_identity(
    *,
    client_id: str,
    credential: str | None = None,
    access_token: str | None = None,
) -> VerifiedGoogleIdentity:
    """Verify whichever Google proof the client sent.

    Supports both the ID-token (`credential`) flow and the custom-button access
    token (`access_token`) flow. The access token is preferred when both appear.
    """
    if access_token:
        return await verify_google_access_token(
            access_token=access_token, client_id=client_id
        )
    if credential:
        return await to_thread.run_sync(
            partial(verify_google_credential, credential=credential, client_id=client_id)
        )
    raise GoogleIdentityVerificationError("No Google credential provided")


def _build_verified_identity(
    *,
    subject: object,
    email: object,
    email_verified: bool,
    hosted_domain: object,
    full_name: object,
) -> VerifiedGoogleIdentity:
    if not isinstance(subject, str) or not subject or len(subject) > 255:
        raise GoogleIdentityVerificationError("Invalid Google subject")
    if (
        not isinstance(email, str)
        or not email
        or len(email) > 320
        or email_verified is not True
    ):
        raise GoogleIdentityVerificationError("Google email is not verified")

    normalized_email = email.strip().lower()
    if not normalized_email or "@" not in normalized_email:
        raise GoogleIdentityVerificationError("Invalid Google email")
    normalized_domain = (
        hosted_domain.strip().lower()[:255]
        if isinstance(hosted_domain, str) and hosted_domain.strip()
        else None
    )
    normalized_name = (
        full_name.strip()[:200]
        if isinstance(full_name, str) and full_name.strip()
        else normalized_email.split("@", 1)[0][:200]
    )
    return VerifiedGoogleIdentity(
        subject=subject,
        email=email.strip(),
        email_normalized=normalized_email,
        full_name=normalized_name,
        hosted_domain=normalized_domain,
        email_is_authoritative=(
            normalized_email.endswith("@gmail.com") or normalized_domain is not None
        ),
    )
