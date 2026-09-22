from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from fastapi import Request

TenantSource = Literal["host", "internal_header"]


@dataclass(frozen=True, slots=True)
class TenantContext:
    slug: str
    source: TenantSource


@dataclass(frozen=True, slots=True)
class RequestContext:
    request_id: str
    tenant: TenantContext


def request_id_from(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")
