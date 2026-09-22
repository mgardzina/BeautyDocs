from __future__ import annotations

import base64
from typing import Annotated

from fastapi import APIRouter, Query, Response
from sqlalchemy import String, cast, or_, select

from app.api.dependencies import DbSessionDep, TenantSlugPath
from app.core.errors import AppError
from app.models.domain import Tenant, TenantStatus
from app.services.salon_profile import public_profile

router = APIRouter(prefix="/public/salons", tags=["salon-directory"])


def visible():
    return select(Tenant).where(
        Tenant.status == TenantStatus.ACTIVE.value, Tenant.directory_visible.is_(True)
    )


@router.get("")
async def search_salons(
    session: DbSessionDep,
    response: Response,
    query: Annotated[str, Query(max_length=100)] = "",
    offset: Annotated[int, Query(ge=0, le=10000)] = 0,
) -> dict:
    statement = visible()
    for term in query.strip().split():
        statement = statement.where(
            or_(
                Tenant.display_name.icontains(term, autoescape=True),
                Tenant.city.icontains(term, autoescape=True),
                Tenant.public_profile["introduction"].as_string().icontains(term, autoescape=True),
                cast(Tenant.public_profile["services"], String).icontains(term, autoescape=True),
            )
        )
    rows = (
        await session.scalars(
            statement.order_by(Tenant.display_name, Tenant.slug).offset(offset).limit(25)
        )
    ).all()
    response.headers["Cache-Control"] = "no-store"
    items = []
    for tenant in rows[:24]:
        item = public_profile(tenant)
        item["about"] = ""
        item["photos"] = item["photos"][:1]
        items.append(item)
    return {"items": items, "nextOffset": offset + 24 if len(rows) > 24 else None}


async def find_salon(session, slug):
    tenant = await session.scalar(visible().where(Tenant.slug == slug))
    if tenant is None:
        raise AppError(status_code=404, code="not_found", message="Salon not found")
    return tenant


@router.get("/{slug}")
async def salon_detail(slug: TenantSlugPath, session: DbSessionDep, response: Response) -> dict:
    tenant = await find_salon(session, slug)
    response.headers["Cache-Control"] = "no-store"
    return public_profile(tenant)


@router.get("/{slug}/photos/{index}")
async def salon_photo(slug: TenantSlugPath, index: int, session: DbSessionDep) -> Response:
    tenant = await find_salon(session, slug)
    photos = (tenant.public_profile or {}).get("photos", [])
    if index < 0 or index >= len(photos):
        raise AppError(status_code=404, code="not_found", message="Photo not found")
    return Response(
        content=base64.b64decode(photos[index]["dataUrl"].split(",", 1)[1]),
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/{slug}/logo")
async def salon_logo(slug: TenantSlugPath, session: DbSessionDep) -> Response:
    tenant = await find_salon(session, slug)
    image = tenant.logo_image or ""
    import re

    match = re.fullmatch(r"data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)", image)
    if not match:
        raise AppError(status_code=404, code="not_found", message="Logo not found")
    return Response(
        content=base64.b64decode(match[2]),
        media_type=f"image/{match[1]}",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )
