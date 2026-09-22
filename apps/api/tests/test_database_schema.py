from __future__ import annotations

from sqlalchemy import ForeignKeyConstraint, UniqueConstraint

from app.db.base import Base
from app.models import (  # noqa: F401 - importing registers all model tables
    AuditEvent,
    Client,
    ClientNote,
    FileObject,
    FormSubmission,
    FormTemplate,
    FormTemplateVersion,
    SalonNotification,
    SignatureVerification,
    TeamMember,
    Tenant,
    TenantFormTemplate,
    TenantMembership,
    User,
    Visit,
)

TENANT_OWNED_TABLES = {
    "tenant_memberships",
    "team_members",
    "clients",
    "client_notes",
    "tenant_form_templates",
    "visits",
    "form_submissions",
    "signature_verifications",
    "salon_notifications",
    "file_objects",
    "audit_events",
}


def _ordered_unique_columns(table_name: str) -> set[tuple[str, ...]]:
    table = Base.metadata.tables[table_name]
    return {
        tuple(column.name for column in constraint.columns)
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    }


def _foreign_key_pairs(table_name: str) -> set[tuple[tuple[str, ...], tuple[str, ...]]]:
    table = Base.metadata.tables[table_name]
    pairs: set[tuple[tuple[str, ...], tuple[str, ...]]] = set()
    for constraint in table.constraints:
        if not isinstance(constraint, ForeignKeyConstraint):
            continue
        local = tuple(column.name for column in constraint.columns)
        remote = tuple(element.target_fullname for element in constraint.elements)
        pairs.add((local, remote))
    return pairs


def test_expected_initial_tables_are_registered() -> None:
    expected_initial_tables = TENANT_OWNED_TABLES | {
        "tenants",
        "users",
        "form_templates",
        "form_template_versions",
    }
    assert expected_initial_tables <= set(Base.metadata.tables)


def test_every_tenant_owned_table_has_required_tenant_key_and_index() -> None:
    for table_name in TENANT_OWNED_TABLES:
        table = Base.metadata.tables[table_name]
        tenant_column = table.c.tenant_id

        assert not tenant_column.nullable
        assert any(
            foreign_key.target_fullname == "tenants.id"
            for foreign_key in tenant_column.foreign_keys
        )

        indexed_column_sets = {
            tuple(column.name for column in index.columns) for index in table.indexes
        }
        unique_column_sets = _ordered_unique_columns(table_name)
        assert any(
            columns and columns[0] == "tenant_id"
            for columns in indexed_column_sets | unique_column_sets
        ), table_name


def test_tenant_owned_references_carry_tenant_id() -> None:
    expected_composite_links = {
        "client_notes": {
            (
                ("tenant_id", "client_id"),
                ("clients.tenant_id", "clients.id"),
            ),
            (
                ("tenant_id", "author_membership_id"),
                ("tenant_memberships.tenant_id", "tenant_memberships.id"),
            ),
        },
        "visits": {
            (
                ("tenant_id", "client_id"),
                ("clients.tenant_id", "clients.id"),
            ),
            (
                ("tenant_id", "staff_membership_id"),
                ("tenant_memberships.tenant_id", "tenant_memberships.id"),
            ),
        },
        "form_submissions": {
            (
                ("tenant_id", "client_id"),
                ("clients.tenant_id", "clients.id"),
            ),
            (
                ("tenant_id", "visit_id"),
                ("visits.tenant_id", "visits.id"),
            ),
            (
                ("tenant_id", "submitted_by_membership_id"),
                ("tenant_memberships.tenant_id", "tenant_memberships.id"),
            ),
            (
                ("tenant_id", "practitioner_team_member_id"),
                ("team_members.tenant_id", "team_members.id"),
            ),
        },
        "team_members": {
            (
                ("tenant_id", "membership_id"),
                ("tenant_memberships.tenant_id", "tenant_memberships.id"),
            ),
        },
        "signature_verifications": {
            (
                ("tenant_id", "form_submission_id"),
                ("form_submissions.tenant_id", "form_submissions.id"),
            )
        },
        "file_objects": {
            (
                ("tenant_id", "client_id"),
                ("clients.tenant_id", "clients.id"),
            ),
            (
                ("tenant_id", "form_submission_id"),
                ("form_submissions.tenant_id", "form_submissions.id"),
            ),
        },
        "audit_events": {
            (
                ("tenant_id", "actor_membership_id"),
                ("tenant_memberships.tenant_id", "tenant_memberships.id"),
            )
        },
    }

    for table_name, expected_links in expected_composite_links.items():
        assert expected_links <= _foreign_key_pairs(table_name)


def test_client_identity_is_not_unique_by_name_or_phone() -> None:
    unique_columns = _ordered_unique_columns("clients")

    assert ("first_name", "last_name") not in unique_columns
    assert ("tenant_id", "first_name", "last_name") not in unique_columns
    assert ("tenant_id", "phone_normalized") not in unique_columns
    assert unique_columns == {("tenant_id", "id")}


def test_signature_challenges_allow_retry_history() -> None:
    unique_columns = _ordered_unique_columns("signature_verifications")

    assert ("tenant_id", "form_submission_id") not in unique_columns
    assert ("tenant_id", "id") in unique_columns


def test_published_template_version_shape_is_append_only() -> None:
    version_table = Base.metadata.tables["form_template_versions"]

    assert "published_at" in version_table.c
    assert "content_hash" in version_table.c
    assert "updated_at" not in version_table.c
    assert ("form_template_id", "version_number") in _ordered_unique_columns(
        "form_template_versions"
    )


def test_tenant_has_public_and_privacy_contract_fields() -> None:
    tenant_columns = Base.metadata.tables["tenants"].c

    assert not tenant_columns.display_name.nullable
    assert not tenant_columns.legal_name.nullable
    assert not tenant_columns.privacy_contact_email.nullable
    assert "website_url" in tenant_columns
    assert not tenant_columns.directory_visible.nullable
