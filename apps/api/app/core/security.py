from __future__ import annotations

import hashlib
import re
import secrets
from contextlib import suppress
from dataclasses import dataclass

import bcrypt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from argon2.low_level import Type

SESSION_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")
BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")
DUMMY_ARGON2_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$"
    "mZXwwtcYE24fHmYgGsdTJw$7TE3nD3yiMP51ZU/dKWEWiAYSuriBhf/dhOClx+IsDg"
)

PASSWORD_HASHER = PasswordHasher(
    time_cost=3,
    memory_cost=65_536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)


@dataclass(frozen=True, slots=True)
class PasswordCheck:
    valid: bool
    upgraded_hash: str | None = None


def hash_password(password: str) -> str:
    return PASSWORD_HASHER.hash(password)


def verify_password(password: str, encoded_hash: str) -> PasswordCheck:
    """Verify Argon2id or legacy bcrypt and return an optional upgrade hash."""

    if encoded_hash.startswith("$argon2id$"):
        try:
            PASSWORD_HASHER.verify(encoded_hash, password)
        except (InvalidHashError, VerificationError, VerifyMismatchError):
            return PasswordCheck(valid=False)
        upgraded_hash = (
            hash_password(password) if PASSWORD_HASHER.check_needs_rehash(encoded_hash) else None
        )
        return PasswordCheck(valid=True, upgraded_hash=upgraded_hash)

    if encoded_hash.startswith(BCRYPT_PREFIXES):
        password_bytes = password.encode("utf-8")
        # bcrypt only authenticates at most 72 bytes. We still execute the
        # expensive check for timing consistency, but never accept truncation.
        too_long = len(password_bytes) > 72
        candidate = password_bytes[:72] if too_long else password_bytes
        try:
            matches = bcrypt.checkpw(candidate, encoded_hash.encode("ascii"))
        except (ValueError, UnicodeEncodeError):
            matches = False
        if not matches or too_long:
            return PasswordCheck(valid=False)
        return PasswordCheck(valid=True, upgraded_hash=hash_password(password))

    verify_dummy_password(password)
    return PasswordCheck(valid=False)


def verify_dummy_password(password: str) -> None:
    """Spend the Argon2 verification cost when an account does not exist."""

    with suppress(InvalidHashError, VerificationError, VerifyMismatchError):
        PASSWORD_HASHER.verify(DUMMY_ARGON2_HASH, password)


def generate_session_token() -> str:
    token = secrets.token_urlsafe(32)
    if not SESSION_TOKEN_PATTERN.fullmatch(token):  # pragma: no cover - invariant
        raise RuntimeError("Generated session token has an unexpected format")
    return token


def is_valid_session_token(token: str | None) -> bool:
    return token is not None and SESSION_TOKEN_PATTERN.fullmatch(token) is not None


def session_token_digest(token: str) -> str:
    if not is_valid_session_token(token):
        raise ValueError("Invalid session token format")
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def generate_verification_code() -> str:
    """A 6-digit numeric account-verification code (leading zeros kept)."""

    return f"{secrets.randbelow(1_000_000):06d}"


def verification_code_digest(code: str) -> str:
    """SHA-256 hex digest of a verification code for at-rest comparison."""

    return hashlib.sha256(code.encode("ascii")).hexdigest()
