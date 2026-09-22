from __future__ import annotations

import hashlib
import re
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.domain import ConsumerDocumentClaim, FormSubmission

_CLAIM_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")


def consumer_claim_token_digest(token: str) -> str:
    if _CLAIM_TOKEN_PATTERN.fullmatch(token) is None:
        raise ValueError("Invalid consumer document claim token")
    return hashlib.sha256(token.encode("ascii")).hexdigest()


async def issue_consumer_document_claim(
    *,
    session: AsyncSession,
    settings: Settings,
    submission: FormSubmission,
    phone_normalized: str,
) -> tuple[str, ConsumerDocumentClaim]:
    raw_token = secrets.token_urlsafe(32)
    if _CLAIM_TOKEN_PATTERN.fullmatch(raw_token) is None:  # pragma: no cover
        raise RuntimeError("Unexpected consumer claim token format")
    now = datetime.now(UTC)
    claim = ConsumerDocumentClaim(
        tenant_id=submission.tenant_id,
        form_submission_id=submission.id,
        phone_normalized=phone_normalized,
        token_digest=consumer_claim_token_digest(raw_token),
        created_at=now,
        expires_at=now + timedelta(seconds=settings.consumer_claim_ttl_seconds),
    )
    session.add(claim)
    await session.flush()
    return raw_token, claim
