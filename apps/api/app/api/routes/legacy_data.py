"""Private RPC boundary for the single-salon Next.js admin.

Only six explicitly registered SQLAlchemy models are accessible. This is not
an SQL endpoint: table names, columns, predicates and operations are validated.
Next.js retains user authentication and its existing public route contracts.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import DateTime, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import DatabaseDep, SettingsDep
from app.models.legacy import (
    LegacyAdminUser,
    LegacyClient,
    LegacyClientNote,
    LegacyConsentForm,
    LegacyOtpVerification,
    LegacyTreatmentHistory,
)

router = APIRouter(prefix="/internal/legacy-data", include_in_schema=False)
MODELS: dict[str, Any] = {
    "client": LegacyClient,
    "clientNote": LegacyClientNote,
    "consentForm": LegacyConsentForm,
    "otpVerification": LegacyOtpVerification,
    "adminUser": LegacyAdminUser,
    "treatmentHistory": LegacyTreatmentHistory,
}
MUTATIONS = {
    "client": {"upsert"},
    "clientNote": {"create", "delete"},
    "consentForm": {"create", "update", "delete"},
    "otpVerification": {"create", "update"},
    "adminUser": set(),  # Accounts are provisioned by a local Python CLI.
    "treatmentHistory": {"create", "update", "delete"},
}
Operation = Literal["findMany", "findUnique", "findFirst", "create", "update", "delete", "upsert"]


class Query(BaseModel):
    model_config = ConfigDict(extra="forbid")
    where: dict[str, Any] = Field(default_factory=dict)
    data: dict[str, Any] = Field(default_factory=dict)
    create: dict[str, Any] = Field(default_factory=dict)
    update: dict[str, Any] = Field(default_factory=dict)
    orderBy: dict[str, Literal["asc", "desc"]] = Field(default_factory=dict)
    select: dict[str, bool] | None = None
    include: dict[str, Any] = Field(default_factory=dict)
    take: int | None = Field(default=None, ge=0, le=10_000)


def column_value(column: Any, value: Any) -> Any:
    if value is not None and isinstance(column.type, DateTime):
        parsed = datetime.fromisoformat(value) if isinstance(value, str) else value
        if not isinstance(parsed, datetime):
            raise ValueError("Invalid date")
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(UTC).replace(tzinfo=None)
        return parsed
    return value


def columns_data(model: Any, data: dict[str, Any]) -> dict[str, Any]:
    if not data.keys() <= set(model.__table__.columns.keys()):
        raise ValueError("Unknown field")
    return {key: column_value(model.__table__.c[key], value) for key, value in data.items()}


def predicates(model: Any, where: dict[str, Any]) -> list[Any]:
    result = []
    for key, value in where.items():
        if model is LegacyClient and key == "forms" and value == {"some": {}}:
            result.append(
                select(LegacyConsentForm.id)
                .where(LegacyConsentForm.clientId == LegacyClient.id)
                .exists()
            )
            continue
        if key not in model.__table__.columns:
            raise ValueError("Unknown filter")
        column = model.__table__.c[key]
        if isinstance(value, dict):
            for operator, operand in value.items():
                if operator == "in" and isinstance(operand, list):
                    result.append(column.in_([column_value(column, item) for item in operand]))
                elif operator in {"gt", "gte", "lt", "lte"}:
                    operand = column_value(column, operand)
                    result.append(
                        {
                            "gt": column.__gt__,
                            "gte": column.__ge__,
                            "lt": column.__lt__,
                            "lte": column.__le__,
                        }[operator](operand)
                    )
                else:
                    raise ValueError("Unsupported filter")
        else:
            result.append(column == column_value(column, value))
    return result


def query_statement(model: Any, query: Query) -> Any:
    statement = select(model).where(*predicates(model, query.where))
    for field, direction in query.orderBy.items():
        if field not in model.__table__.columns:
            raise ValueError("Unknown ordering")
        column = model.__table__.c[field]
        statement = statement.order_by(column.desc() if direction == "desc" else column.asc())
    if query.take is not None:
        statement = statement.limit(query.take)
    return statement


async def serialize(session: AsyncSession, row: Any, query: Query) -> dict[str, Any]:
    model = type(row)
    fields = set(model.__table__.columns.keys())
    if query.select is not None:
        if not query.select.keys() <= fields:
            raise ValueError("Unknown selected field")
        fields = {key for key, included in query.select.items() if included}
    result = {}
    for field in fields:
        value = getattr(row, field)
        if isinstance(value, datetime) and value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        result[field] = value
    if query.include:
        if model is not LegacyClient or not query.include.keys() <= {"forms", "notes", "_count"}:
            raise ValueError("Unsupported relation")
        relations: dict[str, Any] = {"forms": LegacyConsentForm, "notes": LegacyClientNote}
        for name, related in relations.items():
            if name in query.include:
                options = query.include[name]
                nested = Query.model_validate({} if options is True else options)
                nested.where = {**nested.where, "clientId": row.id}
                records = (await session.scalars(query_statement(related, nested))).all()
                result[name] = [await serialize(session, item, nested) for item in records]
        if "_count" in query.include:
            result["_count"] = {
                name: await session.scalar(
                    select(func.count()).select_from(related).where(related.clientId == row.id)
                )
                for name, related in relations.items()
            }
    return result


async def execute_query(
    session: AsyncSession, entity: str, operation: Operation, query: Query
) -> Any:
    model = MODELS[entity]
    if operation.startswith("find"):
        statement = query_statement(model, query)
        if operation != "findMany":
            row = await session.scalar(statement.limit(1))
            return None if row is None else await serialize(session, row, query)
        rows = (await session.scalars(statement)).all()
        return [await serialize(session, row, query) for row in rows]
    if operation not in MUTATIONS[entity]:
        raise ValueError("Unsupported operation")
    if operation == "create":
        row = model(**columns_data(model, query.data))
        session.add(row)
    elif operation == "upsert":
        # The existing name-based client identity contract needs atomic upserts.
        if set(query.where) != {"imieNazwisko"}:
            raise ValueError("Client upsert requires a name")
        data = columns_data(model, {**query.create, **query.where})
        updates = columns_data(model, query.update)
        updates["updatedAt"] = func.now()
        statement = (
            insert(model)
            .values(**data)
            .on_conflict_do_update(index_elements=[model.imieNazwisko], set_=updates)
            .returning(model)
        )
        row = (
            await session.scalars(statement, execution_options={"populate_existing": True})
        ).one()
    else:
        if set(query.where) != {"id"} or not isinstance(query.where["id"], str):
            raise ValueError("Mutation requires exactly one record ID")
        row = await session.scalar(query_statement(model, query).with_for_update())
        if row is None:
            raise HTTPException(status_code=404, detail="Record not found")
        if operation == "delete":
            result = await serialize(session, row, query)
            await session.delete(row)
            await session.flush()
            return result
        for field, value in columns_data(model, query.data).items():
            if field in {"id", "createdAt"}:
                raise ValueError("Immutable field")
            setattr(row, field, value)
    await session.flush()
    await session.refresh(row)
    return await serialize(session, row, query)


@router.post("/{entity}/{operation}")
async def legacy_query(
    entity: str,
    operation: Operation,
    request: Request,
    settings: SettingsDep,
    database: DatabaseDep,
) -> JSONResponse:
    configured = settings.legacy_service_key
    supplied = request.headers.get("authorization", "")
    if configured is None or not secrets.compare_digest(
        supplied.encode(), ("Bearer " + configured.get_secret_value()).encode()
    ):
        raise HTTPException(status_code=401, detail="Service authentication required")
    if entity not in MODELS:
        raise HTTPException(status_code=404, detail="Unknown resource")
    if not database.configured:
        raise HTTPException(status_code=503, detail="Database unavailable")
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 12 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Request too large")
    try:
        query = Query.model_validate_json(body)
        async with database.session() as session:
            result = await execute_query(session, entity, operation, query)
        return JSONResponse(
            jsonable_encoder(result), headers={"Cache-Control": "private, no-store"}
        )
    except (ValueError, ValidationError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="Invalid database operation") from exc
