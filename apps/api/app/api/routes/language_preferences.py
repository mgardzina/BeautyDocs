"""Per-account interface language, independent of a salon's shared settings."""
from typing import Literal

from fastapi import APIRouter, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select

from app.api.dependencies import CurrentConsumerDep, CurrentUserDep, DbSessionDep, TrustedOriginDep
from app.core.errors import AppError
from app.models.domain import ConsumerAccount, User

router = APIRouter(tags=["language-preferences"])


class LanguagePreference(BaseModel):
    model_config = ConfigDict(extra="forbid")
    language: Literal["pl", "en", "de", "es", "fr"]


async def _preference(session, model, account_id, response, payload=None):
    account = await session.scalar(select(model).where(model.id == account_id))
    if account is None:
        raise AppError(status_code=401, code="authentication_required", message="Authentication required")
    if payload is not None:
        account.interface_language = payload.language
        await session.flush()
    response.headers["Cache-Control"] = "private, no-store"
    return LanguagePreference(language=account.interface_language or "pl")


@router.get("/auth/language", response_model=LanguagePreference)
async def owner_language(principal: CurrentUserDep, session: DbSessionDep, response: Response):
    return await _preference(session, User, principal.user_id, response)


@router.put("/auth/language", response_model=LanguagePreference)
async def update_owner_language(payload: LanguagePreference, principal: CurrentUserDep,
                                session: DbSessionDep, response: Response, _origin: TrustedOriginDep):
    return await _preference(session, User, principal.user_id, response, payload)


@router.get("/consumer/language", response_model=LanguagePreference)
async def consumer_language(principal: CurrentConsumerDep, session: DbSessionDep, response: Response):
    return await _preference(session, ConsumerAccount, principal.consumer_account_id, response)


@router.put("/consumer/language", response_model=LanguagePreference)
async def update_consumer_language(payload: LanguagePreference, principal: CurrentConsumerDep,
                                   session: DbSessionDep, response: Response, _origin: TrustedOriginDep):
    return await _preference(session, ConsumerAccount, principal.consumer_account_id, response, payload)
