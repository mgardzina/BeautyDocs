"""Read-only tenant-scoped client views for the salon administration panel."""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re
import unicodedata
from datetime import UTC, date, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Path, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import func, or_, select
from sqlalchemy.sql.elements import ColumnElement

from app.api.dependencies import (
    DbSessionDep,
    SettingsDep,
    TenantAccessDep,
    TrustedOriginDep,
    enforce_roles,
)
from app.core.errors import AppError
from app.models.domain import (
    AuditEvent,
    Client,
    ClientNote,
    ClientNoteCategory,
    FormSubmission,
    FormTemplate,
    FormTemplateVersion,
    MembershipRole,
    SignatureSignerType,
    SignatureVerification,
    SubmissionStatus,
    TeamMember,
    TenantMembership,
    VerificationStatus,
    Visit,
    VisitStatus,
)
from app.services.salon_notifications import resolve_practitioner_signature_notification
from app.services.signature_sms import normalize_phone
from app.services.signature_verification import (
    confirm_sms_verification,
    invalid_verification_code,
    issue_sms_verification,
)

router = APIRouter(prefix="/admin/tenants", tags=["admin-clients"])
CLIENT_READ_ROLES = frozenset(MembershipRole)
PROFILE_COLLECTION_LIMIT = 100
MAX_SEARCH_LENGTH = 80
MIN_SEARCH_LENGTH = 2
NO_STORE_HEADERS = {"Cache-Control": "private, no-store"}

PageQuery = Annotated[int, Query(ge=1, le=500)]
PageSizeQuery = Annotated[int, Query(alias="pageSize", ge=1, le=100)]
ClientIdPath = Annotated[UUID, Path()]
SubmissionIdPath = Annotated[UUID, Path()]
SignatureKeyPath = Annotated[
    str,
    Path(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_-]+$"),
]
_SIGNATURE_DATA_URL_PATTERN = re.compile(r"^data:image/png;base64,([A-Za-z0-9+/=]+)$")
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_MAX_SIGNATURE_BYTES = 450_000
_TREATMENT_CONSENT_KEY = "zgodaWykonanieZabiegu"
_SIGNATURE_LABELS = {
    "podpisDane": "Podpis pod zgodą na zabieg",
    "podpisRodo": "Podpis pod zgodą na przetwarzanie danych",
    "podpisRodo2": "Podpis pod klauzulą informacyjną RODO",
    "podpisMarketing": "Podpis pod zgodą marketingową",
    "podpisFotografie": "Podpis pod zgodą na wykorzystanie wizerunku",
}
_TREATMENT_AREA_LABELS = {
    "forehead": "Czoło",
    "glabella": "Lwia zmarszczka",
    "nose": "Nos",
    "eyebrow_right": "Prawa brew",
    "eyebrow_left": "Lewa brew",
    "left_eye": "Lewe oko (dolina łez)",
    "right_eye": "Prawe oko (dolina łez)",
    "left_cheek": "Lewy policzek",
    "right_cheek": "Prawy policzek",
    "lips": "Usta",
    "chin": "Broda",
    "marionette_lines": "Linie marionetki",
    "jaw_left": "Lewa strona żuchwy",
    "jaw_right": "Prawa strona żuchwy",
    "nasolabial_folds": "Bruzdy nosowo-wargowe",
    "dekolt": "Dekolt",
    "eyelid_left": "Lewa powieka",
    "eyelid_right": "Prawa powieka",
    "arm_left": "Lewe ramię",
    "arm_right": "Prawe ramię",
    "forearm_left": "Lewe przedramię",
    "forearm_right": "Prawe przedramię",
    "belly": "Brzuch",
    "chest": "Klatka piersiowa",
    "thight_left": "Lewe udo",
    "thight_right": "Prawe udo",
    "back": "Plecy",
    "calf_left": "Lewa łydka",
    "calf_right": "Prawa łydka",
    "neck": "Szyja",
    "shin_left": "Lewy piszczel",
    "shin_right": "Prawy piszczel",
    "bikini_area": "Okolice bikini",
    "ass": "Pośladki",
    "face": "Twarz",
    "eyes": "Okolice oczu",
    "thighs": "Okolice ud",
    "head": "Głowa",
    "body": "Ciało",
}


class AdminClientResponseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class ClientListItemResponse(AdminClientResponseModel):
    id: UUID
    first_name: str = Field(max_length=120)
    last_name: str = Field(max_length=160)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=320)
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ClientListResponse(AdminClientResponseModel):
    items: list[ClientListItemResponse]
    total: int = Field(ge=0)
    page: int = Field(ge=1, le=500)
    page_size: int = Field(ge=1, le=100)
    total_pages: int = Field(ge=0)


class ClientProfileDataResponse(ClientListItemResponse):
    birth_date: date | None


class ClientVisitResponse(AdminClientResponseModel):
    id: UUID
    treatment_name: str = Field(max_length=250)
    starts_at: datetime
    ends_at: datetime | None
    status: VisitStatus
    notes: str | None
    anaesthesia: str | None


class ClientNoteResponse(AdminClientResponseModel):
    id: UUID
    body: str
    category: ClientNoteCategory
    created_at: datetime
    edited_at: datetime | None


class ClientFormResponse(AdminClientResponseModel):
    id: UUID
    visit_id: UUID | None
    template_code: str = Field(max_length=100)
    template_name: str = Field(max_length=250)
    status: SubmissionStatus
    submitted_at: datetime | None
    signed_at: datetime | None
    created_at: datetime


class ClientVisitsResponse(AdminClientResponseModel):
    items: list[ClientVisitResponse]
    total: int = Field(ge=0)
    truncated: bool


class ClientNotesResponse(AdminClientResponseModel):
    items: list[ClientNoteResponse]
    total: int = Field(ge=0)
    truncated: bool


class ClientFormsResponse(AdminClientResponseModel):
    items: list[ClientFormResponse]
    total: int = Field(ge=0)
    truncated: bool


class ClientProfileResponse(AdminClientResponseModel):
    client: ClientProfileDataResponse
    visits: ClientVisitsResponse
    notes: ClientNotesResponse
    forms: ClientFormsResponse


class ClientFormDetailClientResponse(AdminClientResponseModel):
    id: UUID
    first_name: str = Field(max_length=120)
    last_name: str = Field(max_length=160)


class ClientFormDetailSubmissionResponse(AdminClientResponseModel):
    id: UUID
    visit_id: UUID | None
    template_code: str = Field(max_length=100)
    template_name: str = Field(max_length=250)
    template_version: int = Field(ge=1)
    status: SubmissionStatus
    submitted_at: datetime | None
    signed_at: datetime | None
    created_at: datetime


class ClientFormAnswerResponse(AdminClientResponseModel):
    key: str = Field(max_length=100)
    label: str = Field(max_length=1_000)
    kind: Literal[
        "field",
        "contraindication",
        "consent",
        "signature",
        "treatment_area",
        "place_and_date",
    ]
    value: str | None = Field(default=None, max_length=5_000)
    detail: str | None = Field(default=None, max_length=5_000)


class ClientFormAnswerSectionResponse(AdminClientResponseModel):
    key: str = Field(max_length=100)
    title: str = Field(max_length=250)
    items: list[ClientFormAnswerResponse] = Field(max_length=500)


class ClientFormAnatomyResponse(AdminClientResponseModel):
    model: Literal["face", "body", "both"]
    face_zone_set: str | None = Field(default=None, max_length=100)
    body_zone_set: str | None = Field(default=None, max_length=100)


class ClientFormPractitionerResponse(AdminClientResponseModel):
    id: UUID
    display_name: str = Field(max_length=200)
    job_title: str | None = Field(default=None, max_length=160)
    signature_configured: bool
    sms_signing_ready: bool
    can_current_user_sign: bool
    signed_at: datetime | None
    verification_destination_masked: str | None = Field(default=None, max_length=64)
    verification_verified_at: datetime | None


class ClientFormDetailResponse(AdminClientResponseModel):
    client: ClientFormDetailClientResponse
    submission: ClientFormDetailSubmissionResponse
    sections: list[ClientFormAnswerSectionResponse] = Field(max_length=100)
    anatomy: ClientFormAnatomyResponse | None
    treatment_area_ids: list[str] = Field(max_length=100)
    signature_keys: list[str] = Field(max_length=50)
    practitioner: ClientFormPractitionerResponse | None
    document_hash: str | None = Field(default=None, max_length=64)


class PractitionerVerificationStartResponse(AdminClientResponseModel):
    verification_id: UUID
    destination_masked: str = Field(max_length=64)
    expires_in_seconds: int
    dev_code: str | None = Field(default=None, min_length=6, max_length=6)


class PractitionerVerificationConfirmRequest(AdminClientResponseModel):
    verification_id: UUID
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class PractitionerVerificationConfirmedResponse(AdminClientResponseModel):
    verification_id: UUID
    status: str
    verified_at: datetime


class PractitionerSignatureRequest(AdminClientResponseModel):
    verification_id: UUID
    signature: str = Field(min_length=1, max_length=600_000)


class PractitionerSignatureResponse(AdminClientResponseModel):
    submission_id: UUID
    status: SubmissionStatus
    practitioner_signed_at: datetime
    document_hash: str = Field(min_length=64, max_length=64)


def _normalize_search(search: str | None) -> str | None:
    if search is None:
        return None
    if len(search) > MAX_SEARCH_LENGTH:
        raise AppError(
            status_code=422,
            code="invalid_search",
            message="Search must contain between 2 and 80 characters",
            headers=NO_STORE_HEADERS,
        )
    normalized = " ".join(unicodedata.normalize("NFKC", search).strip().split())
    if not normalized:
        return None
    normalized = normalized.casefold()
    if not MIN_SEARCH_LENGTH <= len(normalized) <= MAX_SEARCH_LENGTH:
        raise AppError(
            status_code=422,
            code="invalid_search",
            message="Search must contain between 2 and 80 characters",
            headers=NO_STORE_HEADERS,
        )
    return normalized


def _literal_like_pattern(value: str) -> str:
    escaped = re.sub(r"([\\%_])", r"\\\1", value)
    return f"%{escaped}%"


def _client_search_predicate(search: str) -> ColumnElement[bool]:
    pattern = _literal_like_pattern(search)
    full_name = Client.first_name_normalized + " " + Client.last_name_normalized
    predicates = [
        Client.first_name_normalized.ilike(pattern, escape="\\"),
        Client.last_name_normalized.ilike(pattern, escape="\\"),
        full_name.ilike(pattern, escape="\\"),
        func.lower(Client.email).ilike(pattern, escape="\\"),
    ]
    phone_digits = re.sub(r"\D", "", search)
    if len(phone_digits) >= MIN_SEARCH_LENGTH:
        predicates.append(
            Client.phone_normalized.ilike(_literal_like_pattern(phone_digits), escape="\\")
        )
    return or_(*predicates)


def _set_private_no_store(response: Response) -> None:
    response.headers.update(NO_STORE_HEADERS)


def _decode_signature_data_url(value: object) -> bytes | None:
    match = _SIGNATURE_DATA_URL_PATTERN.fullmatch(value) if isinstance(value, str) else None
    if match is None:
        return None
    try:
        signature_bytes = base64.b64decode(match.group(1), validate=True)
    except (binascii.Error, ValueError):
        return None
    if not signature_bytes.startswith(_PNG_MAGIC) or len(signature_bytes) > _MAX_SIGNATURE_BYTES:
        return None
    return signature_bytes


def _json_hash(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()


def _snapshot_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


async def _actor_membership_id(
    *,
    session: DbSessionDep,
    access: TenantAccessDep,
) -> UUID:
    membership_id = await session.scalar(
        select(TenantMembership.id).where(
            TenantMembership.tenant_id == access.tenant.id,
            TenantMembership.user_id == access.principal.user_id,
            TenantMembership.is_active.is_(True),
        )
    )
    if membership_id is None:
        raise AppError(
            status_code=403,
            code="practitioner_signing_forbidden",
            message="Only the assigned practitioner can sign this form",
            headers=NO_STORE_HEADERS,
        )
    return membership_id


async def _assigned_practitioner_submission(
    *,
    session: DbSessionDep,
    access: TenantAccessDep,
    client_id: UUID,
    submission_id: UUID,
) -> tuple[FormSubmission, TeamMember, UUID]:
    membership_id = await _actor_membership_id(session=session, access=access)
    submission = await session.scalar(
        select(FormSubmission)
        .where(
            FormSubmission.tenant_id == access.tenant.id,
            FormSubmission.client_id == client_id,
            FormSubmission.id == submission_id,
        )
        .with_for_update()
    )
    if submission is None or submission.practitioner_team_member_id is None:
        raise AppError(
            status_code=404,
            code="client_form_not_found",
            message="Client form was not found",
            headers=NO_STORE_HEADERS,
        )
    practitioner = await session.scalar(
        select(TeamMember).where(
            TeamMember.tenant_id == access.tenant.id,
            TeamMember.id == submission.practitioner_team_member_id,
            TeamMember.membership_id == membership_id,
            TeamMember.is_active.is_(True),
            TeamMember.performs_treatments.is_(True),
        )
    )
    if practitioner is None:
        raise AppError(
            status_code=403,
            code="practitioner_signing_forbidden",
            message="Only the assigned practitioner can sign this form",
            headers=NO_STORE_HEADERS,
        )
    return submission, practitioner, membership_id


async def _practitioner_verification_for_update(
    *,
    session: DbSessionDep,
    submission: FormSubmission,
    verification_id: UUID,
    membership_id: UUID,
    practitioner_id: UUID,
) -> SignatureVerification:
    verification = await session.scalar(
        select(SignatureVerification)
        .where(
            SignatureVerification.tenant_id == submission.tenant_id,
            SignatureVerification.form_submission_id == submission.id,
            SignatureVerification.id == verification_id,
            SignatureVerification.signer_type == SignatureSignerType.PRACTITIONER.value,
            SignatureVerification.signer_membership_id == membership_id,
            SignatureVerification.signer_team_member_id == practitioner_id,
        )
        .with_for_update()
    )
    if verification is None:
        raise invalid_verification_code()
    return verification


@router.get("/{slug}/clients", response_model=ClientListResponse)
async def list_tenant_clients(
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
    search: str | None = None,
    page: PageQuery = 1,
    page_size: PageSizeQuery = 20,
) -> ClientListResponse:
    enforce_roles(access, CLIENT_READ_ROLES)
    _set_private_no_store(response)
    tenant_id = access.tenant.id
    normalized_search = _normalize_search(search)

    filters = [Client.tenant_id == tenant_id]
    if normalized_search is not None:
        filters.append(_client_search_predicate(normalized_search))

    total = int(await session.scalar(select(func.count()).select_from(Client).where(*filters)) or 0)
    clients = (
        await session.scalars(
            select(Client)
            .where(*filters)
            .order_by(
                Client.last_name_normalized.asc(),
                Client.first_name_normalized.asc(),
                Client.id.asc(),
            )
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    return ClientListResponse(
        items=[
            ClientListItemResponse(
                id=client.id,
                first_name=client.first_name,
                last_name=client.last_name,
                phone=client.phone,
                email=client.email,
                archived_at=client.archived_at,
                created_at=client.created_at,
                updated_at=client.updated_at,
            )
            for client in clients
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{slug}/clients/{client_id}", response_model=ClientProfileResponse)
async def tenant_client_profile(
    client_id: ClientIdPath,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> ClientProfileResponse:
    enforce_roles(access, CLIENT_READ_ROLES)
    _set_private_no_store(response)
    tenant_id = access.tenant.id
    client = await session.scalar(
        select(Client).where(
            Client.tenant_id == tenant_id,
            Client.id == client_id,
        )
    )
    if client is None:
        raise AppError(
            status_code=404,
            code="client_not_found",
            message="Client was not found",
            headers=NO_STORE_HEADERS,
        )

    visits_total = int(
        await session.scalar(
            select(func.count())
            .select_from(Visit)
            .where(Visit.tenant_id == tenant_id, Visit.client_id == client_id)
        )
        or 0
    )
    notes_total = int(
        await session.scalar(
            select(func.count())
            .select_from(ClientNote)
            .where(
                ClientNote.tenant_id == tenant_id,
                ClientNote.client_id == client_id,
            )
        )
        or 0
    )
    forms_total = int(
        await session.scalar(
            select(func.count())
            .select_from(FormSubmission)
            .where(
                FormSubmission.tenant_id == tenant_id,
                FormSubmission.client_id == client_id,
                # Keep this in sync with the list query below — an abandoned
                # DRAFT should not count as one of the client's forms.
                FormSubmission.status.in_(
                    [SubmissionStatus.SUBMITTED.value, SubmissionStatus.SIGNED.value]
                ),
            )
        )
        or 0
    )

    visits = (
        await session.scalars(
            select(Visit)
            .where(Visit.tenant_id == tenant_id, Visit.client_id == client_id)
            .order_by(Visit.starts_at.desc(), Visit.id.desc())
            .limit(PROFILE_COLLECTION_LIMIT)
        )
    ).all()
    notes = (
        await session.scalars(
            select(ClientNote)
            .where(
                ClientNote.tenant_id == tenant_id,
                ClientNote.client_id == client_id,
            )
            .order_by(ClientNote.created_at.desc(), ClientNote.id.desc())
            .limit(PROFILE_COLLECTION_LIMIT)
        )
    ).all()
    form_rows = (
        await session.execute(
            select(
                FormSubmission.id,
                FormSubmission.visit_id,
                FormTemplate.code.label("template_code"),
                FormTemplate.name.label("template_name"),
                FormSubmission.status,
                FormSubmission.submitted_at,
                FormSubmission.signed_at,
                FormSubmission.created_at,
            )
            .join(
                FormTemplateVersion,
                FormTemplateVersion.id == FormSubmission.form_template_version_id,
            )
            .join(
                FormTemplate,
                FormTemplate.id == FormTemplateVersion.form_template_id,
            )
            .where(
                FormSubmission.tenant_id == tenant_id,
                FormSubmission.client_id == client_id,
                # A DRAFT means the client started the form but never
                # finished signing it — nothing to show staff yet.
                FormSubmission.status.in_(
                    [SubmissionStatus.SUBMITTED.value, SubmissionStatus.SIGNED.value]
                ),
            )
            .order_by(
                FormSubmission.submitted_at.desc().nullslast(),
                FormSubmission.created_at.desc(),
                FormSubmission.id.desc(),
            )
            .limit(PROFILE_COLLECTION_LIMIT)
        )
    ).all()

    return ClientProfileResponse(
        client=ClientProfileDataResponse(
            id=client.id,
            first_name=client.first_name,
            last_name=client.last_name,
            phone=client.phone,
            email=client.email,
            birth_date=client.birth_date,
            archived_at=client.archived_at,
            created_at=client.created_at,
            updated_at=client.updated_at,
        ),
        visits=ClientVisitsResponse(
            items=[
                ClientVisitResponse(
                    id=visit.id,
                    treatment_name=visit.treatment_name,
                    starts_at=visit.starts_at,
                    ends_at=visit.ends_at,
                    status=VisitStatus(visit.status),
                    notes=visit.notes,
                    anaesthesia=visit.anaesthesia,
                )
                for visit in visits
            ],
            total=visits_total,
            truncated=visits_total > len(visits),
        ),
        notes=ClientNotesResponse(
            items=[
                ClientNoteResponse(
                    id=note.id,
                    body=note.body,
                    category=ClientNoteCategory(note.category),
                    created_at=note.created_at,
                    edited_at=note.edited_at,
                )
                for note in notes
            ],
            total=notes_total,
            truncated=notes_total > len(notes),
        ),
        forms=ClientFormsResponse(
            items=[
                ClientFormResponse(
                    id=row.id,
                    visit_id=row.visit_id,
                    template_code=row.template_code,
                    template_name=row.template_name,
                    status=SubmissionStatus(row.status),
                    submitted_at=row.submitted_at,
                    signed_at=row.signed_at,
                    created_at=row.created_at,
                )
                for row in form_rows
            ],
            total=forms_total,
            truncated=forms_total > len(form_rows),
        ),
    )


_CLIENT_SNAPSHOT_FIELDS = {
    "imieNazwisko": ("fullName", "Imię i nazwisko"),
    "telefon": ("phone", "Telefon"),
    "email": ("email", "Adres e-mail"),
    "dataUrodzenia": ("birthDate", "Data urodzenia"),
    "ulica": ("street", "Ulica i numer"),
    "kodPocztowy": ("postalCode", "Kod pocztowy"),
    "miasto": ("city", "Miejscowość"),
}


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _form_anatomy(definition: dict[str, Any]) -> ClientFormAnatomyResponse | None:
    raw_anatomy = _record(definition.get("anatomy"))
    model = raw_anatomy.get("model")
    if model not in {"face", "body", "both"}:
        return None
    raw_face_zone_set = raw_anatomy.get("faceZoneSet")
    raw_body_zone_set = raw_anatomy.get("bodyZoneSet")
    return ClientFormAnatomyResponse(
        model=model,
        face_zone_set=(
            raw_face_zone_set[:100] if isinstance(raw_face_zone_set, str) else None
        ),
        body_zone_set=(
            raw_body_zone_set[:100] if isinstance(raw_body_zone_set, str) else None
        ),
    )


def _treatment_area_ids(
    stored_answers: dict[str, Any],
    document_snapshot: dict[str, Any],
) -> list[str]:
    raw_treatment_area = stored_answers.get("treatmentArea")
    if raw_treatment_area is None:
        raw_treatment_area = _record(document_snapshot.get("answers")).get(
            "treatmentArea"
        )
    if isinstance(raw_treatment_area, list):
        return [
            value[:100]
            for value in raw_treatment_area[:100]
            if isinstance(value, str) and value
        ]
    if isinstance(raw_treatment_area, str):
        return [
            value.strip()[:100]
            for value in raw_treatment_area.split(",")[:100]
            if value.strip()
        ]
    return []


def _display_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return value[:5_000]
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        rendered = ", ".join(
            item for item in (_display_value(entry) for entry in value[:100]) if item is not None
        )
        return rendered[:5_000] or None
    if isinstance(value, dict):
        rendered = ", ".join(
            f"{key}: {text}"
            for key, raw in list(value.items())[:100]
            if (text := _display_value(raw)) is not None
        )
        return rendered[:5_000] or None
    return str(value)[:5_000]


def _legal_text(value: Any, salon_name: str) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    return value.replace("{{salonName}}", salon_name)


def _treatment_area_display(value: Any) -> Any:
    if isinstance(value, list):
        return [
            _TREATMENT_AREA_LABELS.get(item, item)
            if isinstance(item, str)
            else item
            for item in value
        ]
    if isinstance(value, str):
        items = [item.strip() for item in value.split(",")]
        if len(items) > 1 or value in _TREATMENT_AREA_LABELS:
            return [
                _TREATMENT_AREA_LABELS.get(item, item)
                for item in items
                if item
            ]
    return value


def _answer_item(
    *,
    key: str,
    label: str,
    kind: Literal[
        "field",
        "contraindication",
        "consent",
        "signature",
        "treatment_area",
        "place_and_date",
    ],
    value: Any,
    detail: Any = None,
) -> ClientFormAnswerResponse:
    return ClientFormAnswerResponse(
        key=key[:100],
        label=label[:1_000],
        kind=kind,
        value=_display_value(value),
        detail=_display_value(detail),
    )


def _build_form_answer_sections(
    *,
    definition: dict[str, Any],
    legal_content: dict[str, Any],
    stored_answers: dict[str, Any],
    document_snapshot: dict[str, Any],
    salon_name: str,
) -> tuple[list[ClientFormAnswerSectionResponse], list[str]]:
    snapshot_answers = _record(document_snapshot.get("answers"))
    answers = stored_answers or snapshot_answers
    raw_fields = _record(answers.get("fields"))
    if not raw_fields:
        raw_fields = {
            key: value
            for key, value in answers.items()
            if key not in {"treatmentArea", "consents", "placeAndDate"}
        }
    contraindications = _record(raw_fields.get("contraindications"))
    consents = _record(answers.get("consents"))
    client_snapshot = _record(document_snapshot.get("client"))
    raw_signatures = _record(document_snapshot.get("signatures"))
    signature_keys = sorted(
        str(key)[:100]
        for key, value in raw_signatures.items()
        if isinstance(key, str) and isinstance(value, str) and value
    )[:50]
    signature_key_set = set(signature_keys)
    treatment_area = answers.get("treatmentArea")
    place_and_date = answers.get("placeAndDate")

    sections: list[ClientFormAnswerSectionResponse] = []
    seen_field_keys: set[str] = set()
    seen_consent_keys: set[str] = set()
    signature_items_by_key: dict[str, ClientFormAnswerResponse] = {}
    treatment_area_rendered = False
    legal_consents_by_key: dict[str, dict[str, Any]] = {}
    raw_legal_consents = legal_content.get("consents")
    if isinstance(raw_legal_consents, list):
        for raw_consent in raw_legal_consents[:50]:
            consent = _record(raw_consent)
            key = consent.get("key")
            if isinstance(key, str) and key:
                legal_consents_by_key[key] = consent
    legal_documents_by_key: dict[str, dict[str, Any]] = {}
    raw_legal_documents = legal_content.get("documents")
    if isinstance(raw_legal_documents, list):
        for raw_document in raw_legal_documents[:50]:
            document = _record(raw_document)
            key = document.get("key")
            if isinstance(key, str) and key:
                legal_documents_by_key[key] = document

    raw_sections = definition.get("sections")
    if isinstance(raw_sections, list):
        for section_index, raw_section in enumerate(raw_sections[:100]):
            section = _record(raw_section)
            section_key = str(section.get("key") or f"section-{section_index + 1}")
            section_title = str(section.get("title") or "Odpowiedzi")
            items: list[ClientFormAnswerResponse] = []

            if section.get("type") == "contraindications":
                raw_items = section.get("items")
                if isinstance(raw_items, list):
                    for item_index, raw_item in enumerate(raw_items[:500]):
                        item = _record(raw_item)
                        key = str(item.get("key") or f"question-{item_index + 1}")
                        answer = _record(contraindications.get(key))
                        items.append(
                            _answer_item(
                                key=key,
                                label=str(item.get("question") or key),
                                kind="contraindication",
                                value=answer.get("answer"),
                                detail=answer.get("followUp"),
                            )
                        )
                        seen_field_keys.add(key)
            else:
                raw_section_fields = section.get("fields")
                if isinstance(raw_section_fields, list):
                    for field_index, raw_field in enumerate(raw_section_fields[:500]):
                        field = _record(raw_field)
                        key = str(field.get("key") or f"field-{field_index + 1}")
                        label = str(field.get("label") or key)
                        field_type = str(field.get("type") or "text")
                        value: Any
                        kind: Literal[
                            "field",
                            "contraindication",
                            "consent",
                            "signature",
                            "treatment_area",
                            "place_and_date",
                        ] = "field"
                        detail: Any = None

                        client_mapping = _CLIENT_SNAPSHOT_FIELDS.get(key)
                        if client_mapping is not None:
                            value = client_snapshot.get(client_mapping[0])
                        elif field_type == "consent":
                            kind = "consent"
                            value = consents.get(key)
                            legal_consent = legal_consents_by_key.get(key)
                            if legal_consent is not None:
                                legal_title = legal_consent.get("title")
                                if isinstance(legal_title, str) and legal_title:
                                    label = legal_title
                                detail = _legal_text(
                                    legal_consent.get("text"),
                                    salon_name,
                                )
                            seen_consent_keys.add(key)
                        elif field_type == "signature":
                            kind = "signature"
                            value = "signed" if key in signature_key_set else None
                            legal_document = legal_documents_by_key.get(key)
                            if legal_document is not None:
                                document_title = legal_document.get("title")
                                if isinstance(document_title, str) and document_title:
                                    label = document_title
                                detail = _legal_text(
                                    legal_document.get("text"),
                                    salon_name,
                                )
                            signature_items_by_key[key] = _answer_item(
                                key=key,
                                label=label,
                                kind=kind,
                                value=value,
                                detail=detail,
                            )
                            seen_field_keys.add(key)
                            continue
                        elif key == "obszarZabiegu":
                            kind = "treatment_area"
                            value = _treatment_area_display(treatment_area)
                            treatment_area_rendered = True
                        else:
                            value = raw_fields.get(key)

                        items.append(
                            _answer_item(
                                key=key,
                                label=label,
                                kind=kind,
                                value=value,
                                detail=detail,
                            )
                        )
                        seen_field_keys.add(key)

            if items:
                sections.append(
                    ClientFormAnswerSectionResponse(
                        key=section_key[:100],
                        title=section_title[:250],
                        items=items,
                    )
                )

    consent_items: list[ClientFormAnswerResponse] = []
    if isinstance(raw_legal_consents, list):
        for index, raw_consent in enumerate(raw_legal_consents[:50]):
            consent = _record(raw_consent)
            key = str(consent.get("key") or f"consent-{index + 1}")
            if key in seen_consent_keys:
                continue
            consent_items.append(
                _answer_item(
                    key=key,
                    label=str(consent.get("title") or consent.get("text") or key),
                    kind="consent",
                    value=consents.get(key),
                    detail=_legal_text(consent.get("text"), salon_name),
                )
            )
            seen_consent_keys.add(key)
    if (
        _TREATMENT_CONSENT_KEY in consents
        and _TREATMENT_CONSENT_KEY not in seen_consent_keys
    ):
        consent_items.insert(
            0,
            _answer_item(
                key=_TREATMENT_CONSENT_KEY,
                label="Zgoda na wykonanie zabiegu",
                kind="consent",
                value=consents.get(_TREATMENT_CONSENT_KEY),
                detail=_legal_text(
                    legal_documents_by_key.get("podpisDane", {}).get("text"),
                    salon_name,
                ),
            ),
        )
        seen_consent_keys.add(_TREATMENT_CONSENT_KEY)

    for key in signature_keys:
        signature_item = signature_items_by_key.get(key)
        if signature_item is None:
            label = _SIGNATURE_LABELS.get(key, "Podpis klientki")
            detail: Any = None
            legal_document = legal_documents_by_key.get(key)
            if legal_document is not None:
                document_title = legal_document.get("title")
                if isinstance(document_title, str) and document_title:
                    label = document_title
                detail = _legal_text(legal_document.get("text"), salon_name)
            signature_item = _answer_item(
                key=key,
                label=label,
                kind="signature",
                value="signed",
                detail=detail,
            )
        consent_items.append(signature_item)

    evidence_items: list[ClientFormAnswerResponse] = []
    client_signing = _record(document_snapshot.get("clientSigning"))
    signing_method = client_signing.get("method")
    if isinstance(signing_method, str) and signing_method:
        evidence_items.append(
            _answer_item(
                key="clientSigningMethod",
                label="Metoda potwierdzenia klientki",
                kind="field",
                value=(
                    "Jednorazowy kod SMS"
                    if signing_method == "sms_otp"
                    else signing_method
                ),
            )
        )
    signing_status = client_signing.get("status")
    if isinstance(signing_status, str) and signing_status:
        evidence_items.append(
            _answer_item(
                key="clientSigningStatus",
                label="Status weryfikacji klientki",
                kind="field",
                value=(
                    "Potwierdzono"
                    if signing_status == "VERIFIED"
                    else signing_status
                ),
            )
        )
    for key, label in (
        ("destinationMasked", "Potwierdzony numer telefonu"),
        ("verifiedAt", "Data potwierdzenia kodem SMS"),
        ("verificationId", "Identyfikator weryfikacji"),
        ("draftDocumentHash", "Odcisk dokumentu potwierdzonego kodem SMS"),
    ):
        value = client_signing.get(key)
        if value is not None:
            evidence_items.append(
                _answer_item(key=key, label=label, kind="field", value=value)
            )
    document_form = legal_content.get("documentForm")
    if isinstance(document_form, str) and document_form:
        evidence_items.append(
            _answer_item(
                key="documentForm",
                label="Forma prawna dokumentu",
                kind="field",
                value=document_form,
            )
        )
    if evidence_items:
        sections.append(
            ClientFormAnswerSectionResponse(
                key="client-signing-evidence",
                title="Potwierdzenie i integralność",
                items=evidence_items,
            )
        )
    if consent_items:
        sections.append(
            ClientFormAnswerSectionResponse(
                key="consents",
                title="Zgody",
                items=consent_items,
            )
        )

    additional_items: list[ClientFormAnswerResponse] = []
    if not treatment_area_rendered and treatment_area is not None:
        additional_items.append(
            _answer_item(
                key="treatmentArea",
                label="Obszar zabiegu",
                kind="treatment_area",
                value=_treatment_area_display(treatment_area),
            )
        )
    if place_and_date is not None:
        additional_items.append(
            _answer_item(
                key="placeAndDate",
                label="Miejscowość i data",
                kind="place_and_date",
                value=place_and_date,
            )
        )
    for key, value in list(raw_fields.items())[:500]:
        if not isinstance(key, str) or key == "contraindications" or key in seen_field_keys:
            continue
        additional_items.append(
            _answer_item(
                key=key,
                label=key,
                kind="field",
                value=value,
            )
        )
    if additional_items:
        sections.append(
            ClientFormAnswerSectionResponse(
                key="additional",
                title="Pozostałe informacje",
                items=additional_items[:500],
            )
        )

    return sections[:100], signature_keys


@router.get(
    "/{slug}/clients/{client_id}/forms/{submission_id}",
    response_model=ClientFormDetailResponse,
)
async def tenant_client_form_detail(
    client_id: ClientIdPath,
    submission_id: SubmissionIdPath,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> ClientFormDetailResponse:
    enforce_roles(access, CLIENT_READ_ROLES)
    _set_private_no_store(response)
    tenant_id = access.tenant.id

    row = (
        await session.execute(
            select(
                FormSubmission,
                Client.first_name.label("client_first_name"),
                Client.last_name.label("client_last_name"),
                FormTemplate.code.label("template_code"),
                FormTemplate.name.label("template_name"),
                FormTemplateVersion.version_number.label("template_version"),
                FormTemplateVersion.schema_definition.label("template_schema"),
                FormTemplateVersion.legal_content.label("template_legal_content"),
            )
            .join(
                Client,
                (Client.tenant_id == FormSubmission.tenant_id)
                & (Client.id == FormSubmission.client_id),
            )
            .join(
                FormTemplateVersion,
                FormTemplateVersion.id == FormSubmission.form_template_version_id,
            )
            .join(
                FormTemplate,
                FormTemplate.id == FormTemplateVersion.form_template_id,
            )
            .where(
                FormSubmission.tenant_id == tenant_id,
                FormSubmission.client_id == client_id,
                FormSubmission.id == submission_id,
                # A DRAFT means the client never finished signing it — there
                # is nothing complete here for staff to review yet.
                FormSubmission.status.in_(
                    [SubmissionStatus.SUBMITTED.value, SubmissionStatus.SIGNED.value]
                ),
            )
        )
    ).first()
    if row is None:
        raise AppError(
            status_code=404,
            code="client_form_not_found",
            message="Client form was not found",
            headers=NO_STORE_HEADERS,
        )

    submission = row[0]
    document_snapshot = _record(submission.document_snapshot)
    template_schema = _record(row.template_schema)
    stored_answers = _record(submission.answers)
    sections, signature_keys = _build_form_answer_sections(
        definition=template_schema,
        legal_content=_record(row.template_legal_content),
        stored_answers=stored_answers,
        document_snapshot=document_snapshot,
        salon_name=access.tenant.display_name,
    )
    practitioner_snapshot = _record(document_snapshot.get("practitioner"))
    practitioner: ClientFormPractitionerResponse | None = None
    try:
        practitioner_id = UUID(str(practitioner_snapshot.get("teamMemberId")))
    except (TypeError, ValueError, AttributeError):
        practitioner_id = None
    practitioner_name = practitioner_snapshot.get("displayName")
    if practitioner_id is not None and isinstance(practitioner_name, str):
        current_practitioner = await session.scalar(
            select(TeamMember).where(
                TeamMember.tenant_id == tenant_id,
                TeamMember.id == practitioner_id,
            )
        )
        actor_membership_id = await session.scalar(
            select(TenantMembership.id).where(
                TenantMembership.tenant_id == tenant_id,
                TenantMembership.user_id == access.principal.user_id,
                TenantMembership.is_active.is_(True),
            )
        )
        raw_job_title = practitioner_snapshot.get("jobTitle")
        verification_snapshot = _record(practitioner_snapshot.get("verification"))
        # The dedicated column is the authoritative record of a practitioner
        # signature — sign_as_practitioner always writes it in the same
        # transaction as the status change, whereas the embedded snapshot
        # copy has been found missing on at least one otherwise-signed
        # submission. Prefer the column and fall back to the snapshot only
        # for whichever field it doesn't carry.
        signed_at = submission.practitioner_signed_at or _snapshot_datetime(
            practitioner_snapshot.get("signedAt")
        )
        verified_at = _snapshot_datetime(verification_snapshot.get("verifiedAt"))
        practitioner = ClientFormPractitionerResponse(
            id=practitioner_id,
            display_name=practitioner_name[:200],
            job_title=(raw_job_title[:160] if isinstance(raw_job_title, str) else None),
            signature_configured=(
                submission.practitioner_signature_data_url is not None
                or _decode_signature_data_url(practitioner_snapshot.get("signature")) is not None
            ),
            sms_signing_ready=bool(
                current_practitioner is not None
                and current_practitioner.membership_id is not None
                and current_practitioner.phone_normalized
            ),
            can_current_user_sign=bool(
                current_practitioner is not None
                and actor_membership_id is not None
                and current_practitioner.membership_id == actor_membership_id
                and submission.status == SubmissionStatus.SUBMITTED.value
            ),
            signed_at=signed_at,
            verification_destination_masked=(
                verification_snapshot.get("destinationMasked")
                if isinstance(
                    verification_snapshot.get("destinationMasked"),
                    str,
                )
                else None
            ),
            verification_verified_at=verified_at,
        )

    return ClientFormDetailResponse(
        client=ClientFormDetailClientResponse(
            id=client_id,
            first_name=row.client_first_name,
            last_name=row.client_last_name,
        ),
        submission=ClientFormDetailSubmissionResponse(
            id=submission.id,
            visit_id=submission.visit_id,
            template_code=row.template_code,
            template_name=row.template_name,
            template_version=row.template_version,
            status=SubmissionStatus(submission.status),
            submitted_at=submission.submitted_at,
            signed_at=submission.signed_at,
            created_at=submission.created_at,
        ),
        sections=sections,
        anatomy=_form_anatomy(template_schema),
        treatment_area_ids=_treatment_area_ids(stored_answers, document_snapshot),
        signature_keys=signature_keys,
        practitioner=practitioner,
        document_hash=submission.document_hash,
    )


@router.post(
    "/{slug}/clients/{client_id}/forms/{submission_id}/practitioner-verification",
    response_model=PractitionerVerificationStartResponse,
)
async def start_practitioner_verification(
    client_id: ClientIdPath,
    submission_id: SubmissionIdPath,
    request: Request,
    access: TenantAccessDep,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
    response: Response,
) -> PractitionerVerificationStartResponse:
    enforce_roles(access, CLIENT_READ_ROLES)
    _set_private_no_store(response)
    submission, practitioner, membership_id = await _assigned_practitioner_submission(
        session=session,
        access=access,
        client_id=client_id,
        submission_id=submission_id,
    )
    if submission.status != SubmissionStatus.SUBMITTED.value:
        raise AppError(
            status_code=409,
            code="practitioner_signature_not_pending",
            message="This form is not awaiting a practitioner signature",
            headers=NO_STORE_HEADERS,
        )
    if practitioner.phone_normalized is None:
        raise AppError(
            status_code=422,
            code="practitioner_phone_required",
            message="Configure your phone number before signing forms",
            headers=NO_STORE_HEADERS,
        )
    verification, dev_code = await issue_sms_verification(
        request=request,
        session=session,
        settings=settings,
        submission=submission,
        phone=normalize_phone(practitioner.phone_normalized),
        signer_type=SignatureSignerType.PRACTITIONER,
        signer_membership_id=membership_id,
        signer_team_member_id=practitioner.id,
    )
    return PractitionerVerificationStartResponse(
        verification_id=verification.id,
        destination_masked=verification.destination_masked,
        expires_in_seconds=settings.signature_otp_ttl_seconds,
        dev_code=dev_code,
    )


@router.post(
    "/{slug}/clients/{client_id}/forms/{submission_id}/practitioner-verification/confirm",
    response_model=PractitionerVerificationConfirmedResponse,
)
async def confirm_practitioner_verification(
    client_id: ClientIdPath,
    submission_id: SubmissionIdPath,
    payload: PractitionerVerificationConfirmRequest,
    request: Request,
    access: TenantAccessDep,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
    response: Response,
) -> PractitionerVerificationConfirmedResponse:
    enforce_roles(access, CLIENT_READ_ROLES)
    _set_private_no_store(response)
    submission, practitioner, membership_id = await _assigned_practitioner_submission(
        session=session,
        access=access,
        client_id=client_id,
        submission_id=submission_id,
    )
    if submission.status != SubmissionStatus.SUBMITTED.value:
        raise AppError(
            status_code=409,
            code="practitioner_signature_not_pending",
            message="This form is not awaiting a practitioner signature",
            headers=NO_STORE_HEADERS,
        )
    verification = await _practitioner_verification_for_update(
        session=session,
        submission=submission,
        verification_id=payload.verification_id,
        membership_id=membership_id,
        practitioner_id=practitioner.id,
    )
    verified_at = await confirm_sms_verification(
        request=request,
        session=session,
        settings=settings,
        submission=submission,
        verification=verification,
        code=payload.code,
    )
    return PractitionerVerificationConfirmedResponse(
        verification_id=verification.id,
        status=verification.status,
        verified_at=verified_at,
    )


@router.post(
    "/{slug}/clients/{client_id}/forms/{submission_id}/practitioner-signature",
    response_model=PractitionerSignatureResponse,
)
async def sign_as_practitioner(
    client_id: ClientIdPath,
    submission_id: SubmissionIdPath,
    payload: PractitionerSignatureRequest,
    access: TenantAccessDep,
    settings: SettingsDep,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
    response: Response,
) -> PractitionerSignatureResponse:
    enforce_roles(access, CLIENT_READ_ROLES)
    _set_private_no_store(response)
    if _decode_signature_data_url(payload.signature) is None:
        raise AppError(
            status_code=422,
            code="invalid_practitioner_signature",
            message="Signature must be a valid PNG image",
            headers=NO_STORE_HEADERS,
        )
    submission, practitioner, membership_id = await _assigned_practitioner_submission(
        session=session,
        access=access,
        client_id=client_id,
        submission_id=submission_id,
    )
    if submission.status != SubmissionStatus.SUBMITTED.value:
        raise AppError(
            status_code=409,
            code="practitioner_signature_not_pending",
            message="This form is not awaiting a practitioner signature",
            headers=NO_STORE_HEADERS,
        )
    verification = await _practitioner_verification_for_update(
        session=session,
        submission=submission,
        verification_id=payload.verification_id,
        membership_id=membership_id,
        practitioner_id=practitioner.id,
    )
    now = datetime.now(UTC)
    reviewed_document_hash = submission.document_hash
    if (
        verification.status != VerificationStatus.VERIFIED.value
        or verification.verified_at is None
        or verification.consumed_at is not None
        or verification.expires_at <= now
        or reviewed_document_hash is None
        or verification.document_hash != reviewed_document_hash
    ):
        raise AppError(
            status_code=409,
            code="practitioner_verification_required",
            message="A valid SMS verification is required before signing",
            headers=NO_STORE_HEADERS,
        )

    snapshot = _record(submission.document_snapshot)
    practitioner_snapshot = _record(snapshot.get("practitioner"))
    if str(practitioner_snapshot.get("teamMemberId")) != str(practitioner.id):
        raise AppError(
            status_code=409,
            code="practitioner_snapshot_mismatch",
            message="The assigned practitioner does not match this document",
            headers=NO_STORE_HEADERS,
        )
    practitioner_snapshot.update(
        {
            "signature": payload.signature,
            "signedAt": now.isoformat(),
            "reviewedDocumentHash": reviewed_document_hash,
            "verification": {
                "verificationId": str(verification.id),
                "method": verification.method,
                "destinationMasked": verification.destination_masked,
                "provider": verification.provider,
                "providerMessageId": verification.provider_message_id,
                "verifiedAt": verification.verified_at.isoformat(),
                "documentHash": verification.document_hash,
            },
        }
    )
    snapshot["practitioner"] = practitioner_snapshot
    snapshot["completedAt"] = now.isoformat()
    final_hash = _json_hash(snapshot)

    submission.document_snapshot = snapshot
    submission.document_hash = final_hash
    submission.status = SubmissionStatus.SIGNED.value
    submission.signed_at = now
    submission.practitioner_signed_at = now
    submission.practitioner_signature_data_url = payload.signature
    verification.consumed_at = now
    await resolve_practitioner_signature_notification(
        session=session,
        tenant_id=access.tenant.id,
        submission_id=submission.id,
        resolved_at=now,
    )
    session.add(
        AuditEvent(
            tenant_id=access.tenant.id,
            actor_membership_id=membership_id,
            action="form_submission.practitioner_signed",
            resource_type="form_submission",
            resource_id=submission.id,
            details={
                "verificationId": str(verification.id),
                "reviewedDocumentHash": reviewed_document_hash,
                "finalDocumentHash": final_hash,
            },
        )
    )
    await session.flush()
    return PractitionerSignatureResponse(
        submission_id=submission.id,
        status=SubmissionStatus.SIGNED,
        practitioner_signed_at=now,
        document_hash=final_hash,
    )


@router.get(
    "/{slug}/clients/{client_id}/forms/{submission_id}/signatures/{signature_key}",
)
async def tenant_client_form_signature(
    client_id: ClientIdPath,
    submission_id: SubmissionIdPath,
    signature_key: SignatureKeyPath,
    access: TenantAccessDep,
    session: DbSessionDep,
) -> Response:
    enforce_roles(access, CLIENT_READ_ROLES)
    document_snapshot = await session.scalar(
        select(FormSubmission.document_snapshot).where(
            FormSubmission.tenant_id == access.tenant.id,
            FormSubmission.client_id == client_id,
            FormSubmission.id == submission_id,
        )
    )
    signatures = _record(_record(document_snapshot).get("signatures"))
    signature_bytes = _decode_signature_data_url(signatures.get(signature_key))
    if signature_bytes is None:
        raise _signature_not_found()

    return Response(
        content=signature_bytes,
        media_type="image/png",
        headers={
            **NO_STORE_HEADERS,
            "Content-Disposition": 'inline; filename="signature.png"',
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )


@router.get(
    "/{slug}/clients/{client_id}/forms/{submission_id}/practitioner-signature",
)
async def tenant_client_form_practitioner_signature(
    client_id: ClientIdPath,
    submission_id: SubmissionIdPath,
    access: TenantAccessDep,
    session: DbSessionDep,
) -> Response:
    enforce_roles(access, CLIENT_READ_ROLES)
    row = (
        await session.execute(
            select(
                FormSubmission.document_snapshot,
                FormSubmission.practitioner_signature_data_url,
            ).where(
                FormSubmission.tenant_id == access.tenant.id,
                FormSubmission.client_id == client_id,
                FormSubmission.id == submission_id,
            )
        )
    ).first()
    practitioner = _record(_record(row.document_snapshot if row else None).get("practitioner"))
    # The dedicated column is authoritative (see tenant_client_form_detail);
    # fall back to the embedded snapshot copy for older rows that predate it.
    signature_bytes = _decode_signature_data_url(
        row.practitioner_signature_data_url if row else None
    ) or _decode_signature_data_url(practitioner.get("signature"))
    if signature_bytes is None:
        raise AppError(
            status_code=404,
            code="client_form_practitioner_signature_not_found",
            message="Practitioner signature was not found",
            headers=NO_STORE_HEADERS,
        )
    return Response(
        content=signature_bytes,
        media_type="image/png",
        headers={
            **NO_STORE_HEADERS,
            "Content-Disposition": ('inline; filename="practitioner-signature.png"'),
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )


def _signature_not_found() -> AppError:
    return AppError(
        status_code=404,
        code="client_form_signature_not_found",
        message="Client form signature was not found",
        headers=NO_STORE_HEADERS,
    )
