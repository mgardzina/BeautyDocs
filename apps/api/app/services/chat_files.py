"""Private local file storage used by protected chat attachment endpoints.

The database stores portable file metadata. The storage provider can therefore
be replaced by S3/GCS without changing chat messages or their public contract.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID, uuid4

from app.core.config import Settings

ALLOWED_CHAT_CONTENT_TYPES = frozenset({"image/jpeg", "image/png", "image/webp", "application/pdf"})


@dataclass(frozen=True)
class StoredChatFile:
    object_key: str
    content_type: str
    size_bytes: int
    sha256: str


def normalized_chat_file_name(value: str) -> str:
    candidate = Path(value.replace("\\", "/")).name.strip().replace("\x00", "")
    if not candidate:
        return "zalacznik"
    return candidate[:255]


def validate_chat_file(content: bytes, content_type: str, max_bytes: int) -> str:
    normalized_type = content_type.split(";", 1)[0].strip().lower()
    if normalized_type not in ALLOWED_CHAT_CONTENT_TYPES:
        raise ValueError("unsupported_content_type")
    if not content or len(content) > max_bytes:
        raise ValueError("invalid_file_size")
    signatures = {
        "image/jpeg": content.startswith(b"\xff\xd8\xff"),
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": len(content) >= 12
        and content.startswith(b"RIFF")
        and content[8:12] == b"WEBP",
        "application/pdf": content.startswith(b"%PDF-"),
    }
    if not signatures[normalized_type]:
        raise ValueError("invalid_file_signature")
    return normalized_type


def store_chat_file(
    settings: Settings,
    *,
    tenant_id: UUID,
    conversation_id: UUID,
    content: bytes,
    content_type: str,
) -> StoredChatFile:
    normalized_type = validate_chat_file(
        content,
        content_type,
        settings.chat_upload_max_bytes,
    )
    suffix = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "application/pdf": ".pdf",
    }[normalized_type]
    object_key = f"{tenant_id}/{conversation_id}/{uuid4().hex}{suffix}"
    root = settings.chat_upload_directory.expanduser().resolve()
    target = (root / object_key).resolve()
    if root not in target.parents:
        raise ValueError("invalid_object_key")
    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=".upload-", dir=target.parent)
    try:
        with os.fdopen(descriptor, "wb") as temporary:
            temporary.write(content)
            temporary.flush()
            os.fsync(temporary.fileno())
        Path(temporary_name).replace(target)
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise
    return StoredChatFile(
        object_key=object_key,
        content_type=normalized_type,
        size_bytes=len(content),
        sha256=hashlib.sha256(content).hexdigest(),
    )


def resolve_chat_file(settings: Settings, object_key: str) -> Path | None:
    root = settings.chat_upload_directory.expanduser().resolve()
    target = (root / object_key).resolve()
    if root not in target.parents or not target.is_file():
        return None
    return target
