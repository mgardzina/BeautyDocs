from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.dependencies import RequestContextDep

router = APIRouter(prefix="/context", tags=["context"])


class TenantContextResponse(BaseModel):
    slug: str
    source: Literal["host", "internal_header"]


class RequestContextResponse(BaseModel):
    request_id: str
    tenant: TenantContextResponse


@router.get("", response_model=RequestContextResponse)
async def current_request_context(context: RequestContextDep) -> RequestContextResponse:
    """Expose the resolved public tenant context; authentication is added separately."""

    return RequestContextResponse(
        request_id=context.request_id,
        tenant=TenantContextResponse(
            slug=context.tenant.slug,
            source=context.tenant.source,
        ),
    )
