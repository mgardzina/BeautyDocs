"""Metadata shared by owner and client printable document copies."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class FormPrintMetadata(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    salon_name: str = Field(max_length=250)
    form_name: str = Field(max_length=250)
    template_version: int | None = None
    client_signed_at: datetime | None = None
    document_hash: str | None = None


def form_print_metadata(
    snapshot: dict[str, Any],
    salon_name: str,
    document_hash: str | None,
    *,
    form_name: str = "Formularz zabiegowy",
    template_version: int | None = None,
) -> FormPrintMetadata:
    return FormPrintMetadata(
        salon_name=salon_name,
        form_name=str(snapshot.get("formName") or form_name)[:250],
        template_version=snapshot.get("templateVersion", template_version),
        client_signed_at=snapshot.get("clientSignedAt"),
        document_hash=document_hash,
    )
