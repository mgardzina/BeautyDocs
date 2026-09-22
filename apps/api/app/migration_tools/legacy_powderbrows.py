"""Validation and deterministic dry-run planning for PowderBrows legacy data.

This module deliberately has no database session or target database URL. It
turns a versioned JSON export into an in-memory plan and reconciliation report.
The separate fail-closed importer can consume that reviewed plan in staging;
planning itself remains offline and non-writing.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Literal
from uuid import UUID, uuid5

from pydantic import BaseModel, ConfigDict, Field, model_validator

EXPORT_SCHEMA_VERSION = "powderbrows-legacy-export/v1"
INVENTORY_SCHEMA_VERSION = "powderbrows-legacy-inventory/v1"
PLAN_SCHEMA_VERSION = "beautydocs-powderbrows-plan/v1"
REPORT_SCHEMA_VERSION = "beautydocs-migration-report/v1"
MIGRATION_NAMESPACE = UUID("9f73b7f8-d246-4f76-b4df-e12a98321ec7")
LEGACY_PRISMA_SCHEMA_FINGERPRINT = (
    "0e810110d44090e1bd272db947f147c4ccdead81cc0797e1a825eaa4bebadeed"
)
LEGACY_DATABASE_SCHEMA_FINGERPRINT = (
    "ac20beb67d73f8fc92d1251197f15e3439a9359307c2ae0957679a553831ad0e"
)

EXPECTED_RECORD_COUNT_KEYS = {
    "clients",
    "clientNotes",
    "consentForms",
    "adminUsers",
    "treatmentHistories",
}

NOTE_CATEGORIES = {"NOTATKA", "ALERGIA", "UWAGA", "PREFERENCJA"}
SENSITIVE_FORM_FIELDS = {
    "podpisDane",
    "podpisMarketing",
    "podpisFotografie",
    "podpisRodo",
    "podpisRodo2",
    "auditLog",
}

FORM_TYPE_TO_TEMPLATE_CODE = {
    "LIP_AUGMENTATION": "lip-augmentation",
    "FACIAL_VOLUMETRY": "facial-volumetry",
    "NEEDLE_MESOTHERAPY": "needle-mesotherapy",
    "INJECTION_LIPOLYSIS": "injection-lipolysis",
    "PERMANENT_MAKEUP": "permanent-makeup",
    "LASER_HAIR_REMOVAL": "laser-hair-removal",
    "LASER_TATTOO_REMOVAL": "laser-tattoo-removal",
    "WRINKLE_REDUCTION": "wrinkle-reduction",
    "EYELID_LIFT": "eyelid-lift",
    "TISSUE_STIMULATION": "tissue-stimulation",
    "EYEBROW_TINTING": "eyebrow-tinting",
    "EYELASH_EXTENSION": "eyelash-extension",
    "EYEBROW_LAMINATION": "eyebrow-lamination",
    "FACIAL_CLEANSING": "facial-cleansing",
}
DEPRECATED_FORM_TYPE_ALIASES = {
    "HYALURONIC": "LIP_AUGMENTATION",
    "PMU": "PERMANENT_MAKEUP",
    "LASER": "LASER_HAIR_REMOVAL",
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class LegacyClient(StrictModel):
    id: str
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    full_name: str = Field(alias="imieNazwisko")
    phone: str | None = Field(alias="telefon")


class LegacyClientNote(StrictModel):
    id: str
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    content: str
    category: str
    client_id: str = Field(alias="clientId")


class LegacyConsentForm(StrictModel):
    id: str
    type: str
    created_at: datetime = Field(alias="createdAt")
    full_name: str = Field(alias="imieNazwisko")
    email: str | None
    street: str | None = Field(alias="ulica")
    postal_code: str | None = Field(alias="kodPocztowy")
    city: str | None = Field(alias="miasto")
    birth_date: str | None = Field(alias="dataUrodzenia")
    phone: str = Field(alias="telefon")
    place_and_date: str = Field(alias="miejscowoscData")
    product_name: str | None = Field(alias="nazwaProduktu")
    treatment_area: str | None = Field(alias="obszarZabiegu")
    desired_effect: str | None = Field(alias="celEfektu")
    anaesthesia: str | None = Field(alias="znieczulenie")
    contraindications: dict[str, Any] = Field(alias="przeciwwskazania")
    data_processing_consent: bool = Field(alias="zgodaPrzetwarzanieDanych")
    marketing_consent: bool = Field(alias="zgodaMarketing")
    photography_consent: bool = Field(alias="zgodaFotografie")
    legal_help_consent: bool = Field(alias="zgodaPomocPrawna")
    photo_publication_places: str | None = Field(alias="miejscaPublikacjiFotografii")
    data_signature: str | None = Field(alias="podpisDane")
    marketing_signature: str | None = Field(alias="podpisMarketing")
    photography_signature: str | None = Field(alias="podpisFotografie")
    rodo_signature: str | None = Field(alias="podpisRodo")
    rodo_signature_2: str | None = Field(alias="podpisRodo2")
    additional_information: str | None = Field(alias="informacjaDodatkowa")
    client_reservations: str | None = Field(alias="zastrzeniaKlienta")
    treatment_number: str | None = Field(alias="numerZabiegu")
    practitioner_name: str | None = Field(alias="osobaPrzeprowadzajacaZabieg")
    treatment_method: str | None = Field(alias="metodaZabiegu")
    planned_treatment_count: str | None = Field(alias="planowanaIloscZabiegow")
    treatment_interval: str | None = Field(alias="odstepMiedzyZabiegami")
    later_treatment_intervals: str | None = Field(alias="kolejneZabiegiOdstepy")
    product_amount: str | None = Field(alias="iloscProduktu")
    signature_status: str | None = Field(alias="signatureStatus")
    signature_verified_at: datetime | None = Field(alias="signatureVerifiedAt")
    audit_log: Any | None = Field(alias="auditLog")
    client_id: str | None = Field(alias="clientId")


class LegacyAdminUser(StrictModel):
    id: str
    email: str
    phone_number: str | None = Field(alias="phoneNumber")
    password_hash: str | None = Field(alias="passwordHash")
    name: str | None


class LegacyTreatmentHistory(StrictModel):
    id: str
    created_at: datetime = Field(alias="createdAt")
    date: datetime
    description: str
    anaesthesia: str | None = Field(alias="znieczulenie")
    form_id: str = Field(alias="formId")


class LegacyRecords(StrictModel):
    clients: list[LegacyClient]
    client_notes: list[LegacyClientNote] = Field(alias="clientNotes")
    consent_forms: list[LegacyConsentForm] = Field(alias="consentForms")
    admin_users: list[LegacyAdminUser] = Field(alias="adminUsers")
    treatment_histories: list[LegacyTreatmentHistory] = Field(alias="treatmentHistories")


class ExportSource(StrictModel):
    provider: Literal["prisma-postgresql"]
    schema_fingerprint: str = Field(alias="schemaFingerprint", min_length=64, max_length=64)
    prisma_schema_fingerprint: str = Field(
        alias="prismaSchemaFingerprint", min_length=64, max_length=64
    )
    read_only_transaction: bool = Field(alias="readOnlyTransaction")

    @model_validator(mode="after")
    def validate_schema_fingerprints(self) -> ExportSource:
        if self.schema_fingerprint != LEGACY_DATABASE_SCHEMA_FINGERPRINT:
            raise ValueError("legacy database schema fingerprint is not export v1")
        if self.prisma_schema_fingerprint != LEGACY_PRISMA_SCHEMA_FINGERPRINT:
            raise ValueError("legacy Prisma schema fingerprint is not export v1")
        return self


class OmittedRecordSet(StrictModel):
    entity: str
    count: int = Field(ge=0)
    reason: str


class LegacyExport(StrictModel):
    schema_version: Literal["powderbrows-legacy-export/v1"] = Field(alias="schemaVersion")
    exported_at: datetime = Field(alias="exportedAt")
    mode: Literal["restricted-records", "sensitive"]
    source: ExportSource
    record_counts: dict[str, int] = Field(alias="recordCounts")
    redactions: dict[str, list[str]] = Field(default_factory=dict)
    omitted: list[OmittedRecordSet] = Field(default_factory=list)
    records: LegacyRecords

    @model_validator(mode="after")
    def validate_record_counts(self) -> LegacyExport:
        actual_counts = {
            "clients": len(self.records.clients),
            "clientNotes": len(self.records.client_notes),
            "consentForms": len(self.records.consent_forms),
            "adminUsers": len(self.records.admin_users),
            "treatmentHistories": len(self.records.treatment_histories),
        }
        if set(self.record_counts) != EXPECTED_RECORD_COUNT_KEYS:
            raise ValueError("recordCounts contains an unexpected entity set")
        if self.record_counts != actual_counts:
            raise ValueError("recordCounts does not match exported records")
        if not self.source.read_only_transaction:
            raise ValueError("export was not verified as transaction read-only")
        return self


class LegacyInventory(StrictModel):
    schema_version: Literal["powderbrows-legacy-inventory/v1"] = Field(alias="schemaVersion")
    exported_at: datetime = Field(alias="exportedAt")
    mode: Literal["inventory"]
    source: ExportSource
    record_counts: dict[str, int] = Field(alias="recordCounts")
    omitted: list[OmittedRecordSet] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_inventory_counts(self) -> LegacyInventory:
        if set(self.record_counts) != EXPECTED_RECORD_COUNT_KEYS:
            raise ValueError("recordCounts contains an unexpected entity set")
        if any(count < 0 for count in self.record_counts.values()):
            raise ValueError("recordCounts cannot contain negative values")
        if not self.source.read_only_transaction:
            raise ValueError("inventory was not verified as transaction read-only")
        return self


class MigrationIssue(StrictModel):
    code: str
    entity: str
    legacy_id: str | None = Field(default=None, alias="legacyId")
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class UnsupportedItem(MigrationIssue):
    record_planned: bool = Field(alias="recordPlanned")


class MigrationPlan(StrictModel):
    schema_version: Literal["beautydocs-powderbrows-plan/v1"] = Field(alias="schemaVersion")
    tenant_id: UUID = Field(alias="tenantId")
    migration_actor_membership_id: UUID = Field(alias="migrationActorMembershipId")
    clients: list[dict[str, Any]]
    users: list[dict[str, Any]]
    memberships: list[dict[str, Any]]
    client_notes: list[dict[str, Any]] = Field(alias="clientNotes")
    form_submissions: list[dict[str, Any]] = Field(alias="formSubmissions")
    visits: list[dict[str, Any]]


class ReconciliationReport(StrictModel):
    schema_version: Literal["beautydocs-migration-report/v1"] = Field(alias="schemaVersion")
    export_schema_version: str = Field(alias="exportSchemaVersion")
    tenant_id: UUID = Field(alias="tenantId")
    export_mode: str = Field(alias="exportMode")
    source_counts: dict[str, int] = Field(alias="sourceCounts")
    planned_counts: dict[str, int] = Field(alias="plannedCounts")
    mappings: dict[str, dict[str, str]]
    errors: list[MigrationIssue]
    warnings: list[MigrationIssue]
    unsupported: list[UnsupportedItem]
    prerequisites: list[str]
    plan_fingerprint: str = Field(alias="planFingerprint")


class PlannerResult(StrictModel):
    plan: MigrationPlan
    report: ReconciliationReport


def migration_plan_fingerprint(plan: MigrationPlan) -> str:
    """Return the canonical SHA-256 fingerprint used by plan/apply gates."""

    plan_json = json.dumps(
        plan.model_dump(mode="json", by_alias=True),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(plan_json).hexdigest()


def deterministic_target_uuid(tenant_id: UUID, entity: str, legacy_id: str) -> UUID:
    return uuid5(
        MIGRATION_NAMESPACE,
        f"beautydocs:powderbrows:v1:{tenant_id}:{entity}:{legacy_id}",
    )


def deterministic_global_uuid(entity: str, key: str) -> UUID:
    return uuid5(MIGRATION_NAMESPACE, f"beautydocs:global:v1:{entity}:{key}")


def _normalized_text(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).strip().split())


def _normalized_phone(value: str | None) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"\D", "", value)
    return digits or None


def _split_client_name(value: str) -> tuple[str, str, str, str] | None:
    normalized = _normalized_text(value)
    parts = normalized.split(" ")
    if len(parts) < 2 or any(not part for part in parts):
        return None
    first_name = " ".join(parts[:-1])
    last_name = parts[-1]
    return first_name, last_name, first_name.casefold(), last_name.casefold()


def _issue(
    code: str,
    entity: str,
    message: str,
    legacy_id: str | None = None,
    **details: Any,
) -> MigrationIssue:
    return MigrationIssue(
        code=code,
        entity=entity,
        legacy_id=legacy_id,
        message=message,
        details=details,
    )


def _unsupported(
    code: str,
    entity: str,
    message: str,
    record_planned: bool,
    legacy_id: str | None = None,
    **details: Any,
) -> UnsupportedItem:
    return UnsupportedItem(
        code=code,
        entity=entity,
        legacy_id=legacy_id,
        message=message,
        details=details,
        record_planned=record_planned,
    )


def _unique_legacy_records(
    records: list[Any],
    entity: str,
    errors: list[MigrationIssue],
    unsupported: list[UnsupportedItem],
) -> list[Any]:
    seen: set[str] = set()
    unique: list[Any] = []
    for record in sorted(records, key=lambda item: item.id):
        if record.id in seen:
            errors.append(
                _issue(
                    "duplicate_legacy_id",
                    entity,
                    "Duplicate legacy identifier; only the first record can be planned",
                    record.id,
                )
            )
            unsupported.append(
                _unsupported(
                    "duplicate_legacy_id",
                    entity,
                    "Duplicate record excluded from the plan",
                    False,
                    record.id,
                )
            )
            continue
        seen.add(record.id)
        unique.append(record)
    return unique


def build_migration_plan(
    export: LegacyExport,
    tenant_id: UUID,
    *,
    owner_admin_legacy_id: str | None = None,
) -> PlannerResult:
    """Build a deterministic, non-writing migration plan and reconciliation report."""

    errors: list[MigrationIssue] = []
    warnings: list[MigrationIssue] = []
    unsupported: list[UnsupportedItem] = []
    mappings: dict[str, dict[str, str]] = defaultdict(dict)

    clients: list[dict[str, Any]] = []
    users: list[dict[str, Any]] = []
    memberships: list[dict[str, Any]] = []
    client_notes: list[dict[str, Any]] = []
    submissions: list[dict[str, Any]] = []
    visits: list[dict[str, Any]] = []

    if export.mode == "restricted-records":
        warnings.append(
            _issue(
                "restricted_export_missing_sensitive_evidence",
                "Export",
                "Restricted record export omits signatures, auditLog, and password hashes",
            )
        )

    client_targets: dict[str, UUID] = {}
    normalized_name_to_client_ids: dict[str, list[str]] = defaultdict(list)
    planned_name_keys: dict[str, list[str]] = defaultdict(list)

    legacy_clients = _unique_legacy_records(export.records.clients, "Client", errors, unsupported)
    for legacy_client in legacy_clients:
        parsed_name = _split_client_name(legacy_client.full_name)
        if parsed_name is None:
            errors.append(
                _issue(
                    "client_name_unparseable",
                    "Client",
                    "Client name must contain at least a first and last name",
                    legacy_client.id,
                )
            )
            unsupported.append(
                _unsupported(
                    "client_name_unparseable",
                    "Client",
                    "Client excluded until identity is reconciled",
                    False,
                    legacy_client.id,
                )
            )
            continue

        first_name, last_name, first_normalized, last_normalized = parsed_name
        normalized_full_name = f"{first_normalized} {last_normalized}"
        planned_name_keys[normalized_full_name].append(legacy_client.id)
        normalized_name_to_client_ids[_normalized_text(legacy_client.full_name).casefold()].append(
            legacy_client.id
        )

        target_id = deterministic_target_uuid(tenant_id, "client", legacy_client.id)
        client_targets[legacy_client.id] = target_id
        mappings["clients"][legacy_client.id] = str(target_id)
        clients.append(
            {
                "id": str(target_id),
                "tenantId": str(tenant_id),
                "firstName": first_name,
                "lastName": last_name,
                "firstNameNormalized": first_normalized,
                "lastNameNormalized": last_normalized,
                "phone": legacy_client.phone,
                "phoneNormalized": _normalized_phone(legacy_client.phone),
                "createdAt": legacy_client.created_at.isoformat(),
                "updatedAt": legacy_client.updated_at.isoformat(),
            }
        )

    for legacy_ids in planned_name_keys.values():
        if len(legacy_ids) > 1:
            warnings.append(
                _issue(
                    "possible_duplicate_client",
                    "Client",
                    "Multiple client records have the same normalized name; none were merged",
                    legacy_ids=sorted(legacy_ids),
                )
            )

    legacy_admins = _unique_legacy_records(
        export.records.admin_users, "AdminUser", errors, unsupported
    )
    normalized_admin_emails: set[str] = set()
    membership_by_legacy_admin_id: dict[str, dict[str, Any]] = {}
    for legacy_admin in legacy_admins:
        normalized_email = legacy_admin.email.strip().casefold()
        if "@" not in normalized_email:
            errors.append(
                _issue(
                    "admin_email_invalid",
                    "AdminUser",
                    "Admin email is not valid",
                    legacy_admin.id,
                )
            )
            unsupported.append(
                _unsupported(
                    "admin_email_invalid",
                    "AdminUser",
                    "Administrator excluded until email is reconciled",
                    False,
                    legacy_admin.id,
                )
            )
            continue
        if normalized_email in normalized_admin_emails:
            errors.append(
                _issue(
                    "duplicate_admin_email",
                    "AdminUser",
                    "Normalized administrator email is duplicated",
                    legacy_admin.id,
                )
            )
            unsupported.append(
                _unsupported(
                    "duplicate_admin_email",
                    "AdminUser",
                    "Administrator excluded because target email must be unique",
                    False,
                    legacy_admin.id,
                )
            )
            continue
        normalized_admin_emails.add(normalized_email)

        user_id = deterministic_global_uuid("user", normalized_email)
        membership_id = deterministic_target_uuid(tenant_id, "membership", legacy_admin.id)
        mappings["adminUsers"][legacy_admin.id] = str(user_id)
        mappings["adminMemberships"][legacy_admin.id] = str(membership_id)
        warnings.append(
            _issue(
                "admin_password_reset_required",
                "AdminUser",
                "Legacy password hashes are never transferred; force a password reset",
                legacy_admin.id,
            )
        )
        users.append(
            {
                "id": str(user_id),
                "email": legacy_admin.email.strip(),
                "emailNormalized": normalized_email,
                "displayName": _normalized_text(legacy_admin.name or "Administrator"),
                "passwordAction": "FORCE_RESET",
            }
        )
        membership = {
            "id": str(membership_id),
            "tenantId": str(tenant_id),
            "userId": str(user_id),
            "role": "UNRESOLVED",
        }
        memberships.append(membership)
        membership_by_legacy_admin_id[legacy_admin.id] = membership

    selected_owner_membership = (
        membership_by_legacy_admin_id.get(owner_admin_legacy_id)
        if owner_admin_legacy_id is not None
        else None
    )
    if selected_owner_membership is None:
        errors.append(
            _issue(
                "owner_admin_unresolved",
                "AdminUser",
                "An explicit, supported legacy administrator ID is required for OWNER",
                owner_admin_legacy_id,
            )
        )
    else:
        for membership in memberships:
            membership["role"] = "ADMIN"
        selected_owner_membership["role"] = "OWNER"

    migration_actor_membership_id = deterministic_target_uuid(
        tenant_id, "membership", "powderbrows-migration-actor"
    )

    legacy_notes = _unique_legacy_records(
        export.records.client_notes, "ClientNote", errors, unsupported
    )
    for legacy_note in legacy_notes:
        if legacy_note.category not in NOTE_CATEGORIES:
            errors.append(
                _issue(
                    "unknown_note_category",
                    "ClientNote",
                    "Unknown note category cannot be mapped silently",
                    legacy_note.id,
                    category=legacy_note.category,
                )
            )
            unsupported.append(
                _unsupported(
                    "unknown_note_category",
                    "ClientNote",
                    "Note excluded until its category is reconciled",
                    False,
                    legacy_note.id,
                    category=legacy_note.category,
                )
            )
            continue
        target_client_id = client_targets.get(legacy_note.client_id)
        if target_client_id is None:
            errors.append(
                _issue(
                    "missing_client_reference",
                    "ClientNote",
                    "Referenced legacy client is missing or unsupported",
                    legacy_note.id,
                    referenced_client_id=legacy_note.client_id,
                )
            )
            unsupported.append(
                _unsupported(
                    "missing_client_reference",
                    "ClientNote",
                    "Note excluded until its client reference is reconciled",
                    False,
                    legacy_note.id,
                )
            )
            continue
        target_id = deterministic_target_uuid(tenant_id, "client-note", legacy_note.id)
        mappings["clientNotes"][legacy_note.id] = str(target_id)
        client_notes.append(
            {
                "id": str(target_id),
                "tenantId": str(tenant_id),
                "clientId": str(target_client_id),
                "authorMembershipId": str(migration_actor_membership_id),
                "body": legacy_note.content,
                "category": legacy_note.category,
                "createdAt": legacy_note.created_at.isoformat(),
                "editedAt": (
                    legacy_note.updated_at.isoformat()
                    if legacy_note.updated_at != legacy_note.created_at
                    else None
                ),
            }
        )

    legacy_forms = _unique_legacy_records(
        export.records.consent_forms, "ConsentForm", errors, unsupported
    )
    form_targets: dict[str, dict[str, Any]] = {}
    for legacy_form in legacy_forms:
        canonical_type = DEPRECATED_FORM_TYPE_ALIASES.get(legacy_form.type, legacy_form.type)
        if canonical_type != legacy_form.type:
            warnings.append(
                _issue(
                    "deprecated_form_type_alias",
                    "ConsentForm",
                    "Deprecated form type mapped through an explicit compatibility alias",
                    legacy_form.id,
                    legacy_type=legacy_form.type,
                    canonical_type=canonical_type,
                )
            )
        template_code = FORM_TYPE_TO_TEMPLATE_CODE.get(canonical_type)
        if template_code is None:
            errors.append(
                _issue(
                    "unknown_form_type",
                    "ConsentForm",
                    "Unknown form type cannot be mapped to a BeautyDocs template",
                    legacy_form.id,
                    legacy_type=legacy_form.type,
                )
            )
            unsupported.append(
                _unsupported(
                    "unknown_form_type",
                    "ConsentForm",
                    "Form excluded until its type is reconciled",
                    False,
                    legacy_form.id,
                    legacy_type=legacy_form.type,
                )
            )
            continue

        form_target_client_id: UUID | None = None
        if legacy_form.client_id is not None:
            form_target_client_id = client_targets.get(legacy_form.client_id)
            if form_target_client_id is None:
                errors.append(
                    _issue(
                        "missing_client_reference",
                        "ConsentForm",
                        "Referenced legacy client is missing or unsupported",
                        legacy_form.id,
                        referenced_client_id=legacy_form.client_id,
                    )
                )
        else:
            name_key = _normalized_text(legacy_form.full_name).casefold()
            candidate_ids = normalized_name_to_client_ids.get(name_key, [])
            supported_candidates = [
                client_targets[candidate_id]
                for candidate_id in candidate_ids
                if candidate_id in client_targets
            ]
            if len(supported_candidates) == 1:
                form_target_client_id = supported_candidates[0]
                warnings.append(
                    _issue(
                        "form_client_recovered_by_name",
                        "ConsentForm",
                        "Missing clientId recovered by exact normalized legacy name",
                        legacy_form.id,
                    )
                )
            elif len(supported_candidates) > 1:
                errors.append(
                    _issue(
                        "ambiguous_client_reference",
                        "ConsentForm",
                        "Multiple client records match the form name",
                        legacy_form.id,
                    )
                )
            else:
                errors.append(
                    _issue(
                        "missing_client_reference",
                        "ConsentForm",
                        "Form has no resolvable client reference",
                        legacy_form.id,
                    )
                )

        if form_target_client_id is None:
            unsupported.append(
                _unsupported(
                    "missing_client_reference",
                    "ConsentForm",
                    "Form excluded until its client reference is reconciled",
                    False,
                    legacy_form.id,
                )
            )
            continue

        serialized_form = legacy_form.model_dump(mode="json", by_alias=True)
        redacted_fields = set(export.redactions.get(f"ConsentForm:{legacy_form.id}", []))
        present_sensitive_fields = sorted(
            field
            for field in SENSITIVE_FORM_FIELDS
            if serialized_form.get(field) is not None or field in redacted_fields
        )
        for field in SENSITIVE_FORM_FIELDS:
            serialized_form.pop(field, None)
        if present_sensitive_fields:
            unsupported.append(
                _unsupported(
                    "legacy_sensitive_signature_artifacts",
                    "ConsentForm",
                    "Legacy signatures/audit require separate evidence review and are not planned",
                    True,
                    legacy_form.id,
                    fields=present_sensitive_fields,
                )
            )

        if legacy_form.signature_status in {"VERIFIED", "SIGNED"}:
            unsupported.append(
                _unsupported(
                    "legacy_signature_verification_unverifiable",
                    "ConsentForm",
                    "Legacy status cannot create a new SignatureVerification without proof",
                    True,
                    legacy_form.id,
                    legacy_status=legacy_form.signature_status,
                )
            )

        target_id = deterministic_target_uuid(tenant_id, "form-submission", legacy_form.id)
        template_version_id = deterministic_global_uuid(
            "form-template-version", f"{template_code}:legacy-v1"
        )
        mappings["consentForms"][legacy_form.id] = str(target_id)
        mappings["templateVersions"][template_code] = str(template_version_id)
        submission = {
            "id": str(target_id),
            "tenantId": str(tenant_id),
            "clientId": str(form_target_client_id),
            "visitId": None,
            "templateCode": template_code,
            "formTemplateVersionId": str(template_version_id),
            "status": "SUBMITTED",
            "answers": {"legacyPowderBrows": serialized_form},
            "documentSnapshot": None,
            "documentHash": None,
            "submittedAt": legacy_form.created_at.isoformat(),
            "signedAt": None,
        }
        submissions.append(submission)
        form_targets[legacy_form.id] = submission

    legacy_histories = _unique_legacy_records(
        export.records.treatment_histories,
        "TreatmentHistory",
        errors,
        unsupported,
    )
    visit_ids_by_legacy_form: dict[str, list[str]] = defaultdict(list)
    for legacy_history in legacy_histories:
        target_form = form_targets.get(legacy_history.form_id)
        if target_form is None:
            errors.append(
                _issue(
                    "missing_form_reference",
                    "TreatmentHistory",
                    "Referenced form is missing or unsupported",
                    legacy_history.id,
                    referenced_form_id=legacy_history.form_id,
                )
            )
            unsupported.append(
                _unsupported(
                    "missing_form_reference",
                    "TreatmentHistory",
                    "Treatment history excluded until its form is reconciled",
                    False,
                    legacy_history.id,
                )
            )
            continue
        target_id = deterministic_target_uuid(tenant_id, "visit", legacy_history.id)
        mappings["treatmentHistories"][legacy_history.id] = str(target_id)
        visit_ids_by_legacy_form[legacy_history.form_id].append(str(target_id))
        visits.append(
            {
                "id": str(target_id),
                "tenantId": str(tenant_id),
                "clientId": target_form["clientId"],
                "treatmentName": target_form["templateCode"],
                "startsAt": legacy_history.date.isoformat(),
                "status": "COMPLETED",
                "notes": legacy_history.description,
                "anaesthesia": legacy_history.anaesthesia,
            }
        )

    for legacy_form_id, visit_ids in visit_ids_by_legacy_form.items():
        target_form = form_targets[legacy_form_id]
        if len(visit_ids) == 1:
            target_form["visitId"] = visit_ids[0]
        else:
            warnings.append(
                _issue(
                    "multiple_visits_for_submission",
                    "ConsentForm",
                    "Multiple legacy history rows cannot map to one submission visitId",
                    legacy_form_id,
                    visit_count=len(visit_ids),
                )
            )

    for omitted_set in export.omitted:
        if omitted_set.count:
            unsupported.append(
                _unsupported(
                    "legacy_entity_intentionally_omitted",
                    omitted_set.entity,
                    omitted_set.reason,
                    False,
                    count=omitted_set.count,
                )
            )

    plan = MigrationPlan(
        schema_version=PLAN_SCHEMA_VERSION,
        tenant_id=tenant_id,
        migration_actor_membership_id=migration_actor_membership_id,
        clients=clients,
        users=users,
        memberships=memberships,
        client_notes=client_notes,
        form_submissions=submissions,
        visits=visits,
    )
    source_counts = dict(export.record_counts)
    for omitted_set in export.omitted:
        source_counts[omitted_set.entity] = omitted_set.count
    report = ReconciliationReport(
        schema_version=REPORT_SCHEMA_VERSION,
        export_schema_version=export.schema_version,
        tenant_id=tenant_id,
        export_mode=export.mode,
        source_counts=source_counts,
        planned_counts={
            "clients": len(clients),
            "clientNotes": len(client_notes),
            "formSubmissions": len(submissions),
            "adminUsers": len(users),
            "adminMemberships": len(memberships),
            "visits": len(visits),
            "signatureVerifications": 0,
        },
        mappings={key: dict(sorted(value.items())) for key, value in sorted(mappings.items())},
        errors=errors,
        warnings=warnings,
        unsupported=unsupported,
        prerequisites=[
            "Create the PowderBrows tenant using the report tenantId",
            "Publish legacy-v1 template versions using the deterministic mapped IDs",
            "Provision the migration actor membership before importing client notes",
            "Resolve forms with multiple treatment histories before assigning submission visitId",
            "Review every error and unsupported item; zero errors is required before apply design",
        ],
        plan_fingerprint=migration_plan_fingerprint(plan),
    )
    return PlannerResult(plan=plan, report=report)


def load_legacy_export(path: Path) -> LegacyExport:
    with path.open("r", encoding="utf-8") as export_file:
        payload = json.load(export_file)
    if payload.get("schemaVersion") == INVENTORY_SCHEMA_VERSION:
        raise ValueError(
            "Inventory exports contain counts only and cannot be planned; "
            "create an explicit restricted-records or sensitive export"
        )
    return LegacyExport.model_validate(payload)


def write_private_json(path: Path, payload: Any) -> None:
    """Create a new 0600 JSON artifact without overwriting an existing file."""

    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    descriptor = os.open(path, flags, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output_file:
            json.dump(payload, output_file, ensure_ascii=False, indent=2)
            output_file.write("\n")
            output_file.flush()
            os.fsync(output_file.fileno())
    except BaseException:
        path.unlink(missing_ok=True)
        raise
