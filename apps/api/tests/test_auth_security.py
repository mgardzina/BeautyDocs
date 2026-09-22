from __future__ import annotations

import re

import bcrypt

from app.core.security import (
    generate_session_token,
    hash_password,
    is_valid_session_token,
    session_token_digest,
    verify_password,
)


def test_argon2id_password_round_trip() -> None:
    encoded = hash_password("correct horse battery staple")

    assert encoded.startswith("$argon2id$")
    assert verify_password("correct horse battery staple", encoded).valid is True
    assert verify_password("wrong", encoded).valid is False


def test_legacy_bcrypt_is_upgraded_after_successful_verification() -> None:
    legacy = bcrypt.hashpw(b"legacy-password", bcrypt.gensalt()).decode("ascii")

    result = verify_password("legacy-password", legacy)

    assert result.valid is True
    assert result.upgraded_hash is not None
    assert result.upgraded_hash.startswith("$argon2id$")
    assert verify_password("legacy-password", result.upgraded_hash).valid is True


def test_legacy_bcrypt_never_accepts_password_truncation_after_72_bytes() -> None:
    seventy_two_bytes = "a" * 72
    legacy = bcrypt.hashpw(seventy_two_bytes.encode(), bcrypt.gensalt()).decode()

    assert verify_password(seventy_two_bytes, legacy).valid is True
    assert verify_password(seventy_two_bytes + "extra", legacy).valid is False


def test_session_token_is_single_fixed_length_base64url_and_only_digest_is_stable() -> None:
    token = generate_session_token()
    digest = session_token_digest(token)

    assert re.fullmatch(r"[A-Za-z0-9_-]{43}", token)
    assert is_valid_session_token(token)
    assert re.fullmatch(r"[0-9a-f]{64}", digest)
    assert token not in digest
    assert session_token_digest(token) == digest
