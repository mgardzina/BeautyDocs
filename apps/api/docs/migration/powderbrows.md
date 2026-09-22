# PowderBrows legacy migration runbook

This package provides a controlled export, a deterministic planner, and a
fail-closed **staging-only** importer. The importer defaults to an offline
dry-run. It can write only after an explicit `--apply` and rejects every
environment value other than the exact string `staging`. These tools do not
provide a production apply path.

## Legacy schema mapping

The exporter is pinned to Prisma file fingerprint
`0e810110d44090e1bd272db947f147c4ccdead81cc0797e1a825eaa4bebadeed`,
verified database-structure fingerprint
`ac20beb67d73f8fc92d1251197f15e3439a9359307c2ae0957679a553831ad0e`,
and export contract `powderbrows-legacy-export/v1`. Before reading counts or
records it compares the actual `information_schema.columns` result with the
complete expected table/column sets. A stamped constant alone is not accepted.

| Prisma record | Planned BeautyDocs record | Important rule |
|---|---|---|
| `Client` | `Client` | Separate records remain separate; normalized names only generate duplicate warnings. |
| `ClientNote` | `ClientNote` | Category must be one of `NOTATKA`, `ALERGIA`, `UWAGA`, `PREFERENCJA`; an explicit migration actor membership is required. |
| `ConsentForm` | `FormSubmission` | The type maps to a centrally published `legacy-v1` template version. Missing client references are errors. |
| `TreatmentHistory` | `Visit` | A single history can populate `FormSubmission.visitId`; multiple histories require reconciliation. |
| `AdminUser` | global `User` plus `TenantMembership` | User UUID is derived from normalized email. The OWNER is selected by an explicit legacy admin ID, never sort order. |
| `OtpVerification` | none | Raw OTP codes are operational secrets and are intentionally omitted. |

Legacy signature images and `auditLog` are sensitive evidence artifacts. The
planner removes them from normalized answers and reports them as unsupported.
Legacy `VERIFIED` or `SIGNED` status must never create a new
`SignatureVerification` automatically because the current system cannot prove
the new challenge, digest, and verification chain.

## 1. Preflight

1. Freeze schema changes to the legacy application for the migration window.
2. Verify that `apps/api/docs/migration/legacy-schema.txt` still has the pinned fingerprint. A schema
   change requires a new export contract version and review.
3. Create a dedicated PostgreSQL source credential with `CONNECT`, schema
   `USAGE`, and `SELECT` only. The exporter additionally opens a
   `REPEATABLE READ, READ ONLY` transaction and aborts if PostgreSQL does not
   confirm read-only mode.
4. Pre-allocate the PowderBrows tenant UUID and identify the exact legacy
   `AdminUser.id` that should become OWNER. Record both in the approved change
   ticket.
5. Use a workstation and staging environment approved for special-category
   personal data. Do not use developer cloud drives or chat attachments.

## 2. Count-only inventory

Run from `apps/api`. The source DSN is read only from an environment variable so
it is not exposed in shell history or the process argument list.

```bash
export LEGACY_DATABASE_URL='postgresql://read_only_user@legacy-host/legacy-db'
.venv/bin/python scripts/export_legacy_powderbrows.py \
  --output /encrypted-volume/powderbrows-inventory-v1.json
```

The default `powderbrows-legacy-inventory/v1` output reads counts only. It does
not read or contain names, contact details, health answers, signatures, audit
data, or password hashes. Inventory files cannot be passed to the planner; it
rejects them explicitly because no records are present.

## 3. Restricted-record staging rehearsal

After inventory reconciliation and approval to handle special-category data,
request a record export explicitly:

```bash
.venv/bin/python scripts/export_legacy_powderbrows.py \
  --output /encrypted-volume/powderbrows-restricted-records-v1.json \
  --include-records

.venv/bin/python scripts/plan_legacy_powderbrows.py \
  --input /encrypted-volume/powderbrows-restricted-records-v1.json \
  --tenant-id 00000000-0000-0000-0000-000000000000 \
  --owner-admin-legacy-id 00000000-0000-0000-0000-000000000000 \
  --report /encrypted-volume/powderbrows-reconciliation-v1.json
```

Both tools require explicit output paths, create files with mode `0600`, and
refuse to overwrite existing files. They print counts only and never print
records, names, contact details, signatures, audit payloads, password hashes, or
database URLs.

Despite redacting signature images, `auditLog`, and password hashes, this export
still contains direct identifiers, addresses, dates of birth, and health data.
It is named `restricted-records`, not redacted or safe. The report omits direct
PII fields but contains stable legacy identifiers and mappings, so it is also
confidential and linkable.

The planner exits with code `2` when reconciliation errors exist. Warnings and
unsupported artifacts must still be reviewed even when the exit code is zero.

## 4. Sensitive export for an approved staging migration

Only after the restricted-record rehearsal and security approval, run the exporter with
`--include-sensitive`. This includes password hashes, base64 signatures, and
legacy audit data in the export, although the planner refuses to transfer
legacy password hashes or turn signature evidence into a new verification
record.

```bash
.venv/bin/python scripts/export_legacy_powderbrows.py \
  --output /encrypted-volume/powderbrows-sensitive-v1.json \
  --include-sensitive

.venv/bin/python scripts/plan_legacy_powderbrows.py \
  --input /encrypted-volume/powderbrows-sensitive-v1.json \
  --tenant-id 00000000-0000-0000-0000-000000000000 \
  --owner-admin-legacy-id 00000000-0000-0000-0000-000000000000 \
  --report /encrypted-volume/powderbrows-sensitive-report-v1.json \
  --plan-output /encrypted-volume/powderbrows-normalized-plan-v1.json
```

The optional plan contains normalized personal and health data and must be
treated as sensitive even when signatures were excluded. Use encrypted
storage, encrypted authenticated transport, restricted access, and an audited
retention period. Delete migration artifacts after signed reconciliation and
expiry of the approved rollback window using the storage platform's supported
secure-deletion process. Removing a filename alone is not sufficient assurance
on snapshots, backups, or SSD media.

## 5. Reconciliation gate

No staging apply should begin until:

- the export `recordCounts` match the actual array lengths;
- client, note, form, administrator, and treatment-history source counts match
  an independent SQL count from the legacy database;
- the report has zero errors;
- every unsupported record or artifact has a documented disposition;
- possible duplicate clients are reviewed without merging by name alone;
- every note category is known;
- every form and treatment history has a valid reference;
- the selected OWNER is confirmed by a second reviewer;
- required `legacy-v1` template versions and the migration actor membership
  have their deterministic IDs reserved in staging;
- every administrator account is marked for forced password reset; the
  staging importer never accepts or transfers a legacy password hash;
- a reviewer confirms that the plan has zero `SignatureVerification` records.

Compare the report `planFingerprint` on every rehearsal. With the same export,
tenant UUID, owner selection, and planner version it must remain identical.

## 6. Explicit staging prerequisites

The plan intentionally does not contain enough information to invent a legal
tenant, legal form content, or a migration service identity. Before apply, an
operator must provision and independently review all of the following:

- the tenant at the exact `tenantId`, with the real display/legal name,
  controller contact, privacy contact, address, status, and other required
  tenant fields; the importer requires it to be `ACTIVE`;
- a dedicated migration service `User` and an active `TenantMembership` at the
  plan's deterministic `migrationActorMembershipId`; the backing user ID and
  credentials are deliberately not present in the legacy plan;
- each central `FormTemplate` referenced by `templateCode`, with status
  `ACTIVE`, and its reviewed, published `legacy-v1` `FormTemplateVersion` at
  the exact deterministic `formTemplateVersionId`; the importer never
  fabricates schema definitions or legal content;
- a dedicated PostgreSQL staging migration role, distinct from the API runtime
  role, with `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, no ownership of any target
  table, and only the table privileges needed for the import;
- Alembic revision `20260719_0003`, which preserves self-membership discovery
  and adds tenant-context SELECT access to memberships. All tenant-owned reads
  and writes remain limited by transaction-local `app.tenant_id`.

The importer rejects plans containing legacy password migration actions. New
administrator users are provisioned inactive with a non-login dummy hash and
must complete the separately controlled password-reset/activation process.
Existing global users are skipped only when their planned identity fields match
exactly.

## 7. Staging dry-run and apply

Run from `apps/api`. Dry-run is the default and does not open a database
connection:

```bash
.venv/bin/python scripts/apply_legacy_powderbrows.py \
  --plan /encrypted-volume/powderbrows-normalized-plan-v1.json \
  --report /encrypted-volume/powderbrows-sensitive-report-v1.json \
  --environment staging \
  --expected-plan-fingerprint PLAN_SHA256_FROM_APPROVED_REPORT \
  --change-ticket CHG-1234 \
  --migration-role beautydocs_staging_migrator
```

After approval, provide the target DSN only through the dedicated variable and
add the explicit write flag:

```bash
export BEAUTYDOCS_STAGING_MIGRATION_DATABASE_URL='postgresql://migration-role@staging-host/beautydocs-staging'
.venv/bin/python scripts/apply_legacy_powderbrows.py \
  --plan /encrypted-volume/powderbrows-normalized-plan-v1.json \
  --report /encrypted-volume/powderbrows-sensitive-report-v1.json \
  --environment staging \
  --expected-plan-fingerprint PLAN_SHA256_FROM_APPROVED_REPORT \
  --change-ticket CHG-1234 \
  --migration-role beautydocs_staging_migrator \
  --apply
```

The CLI refuses apply when that DSN equals `BEAUTYDOCS_DATABASE_URL`. It also
checks that PostgreSQL `current_user` is exactly the declared migration role,
then verifies the role flags and target-table ownership through PostgreSQL's
catalog. The DSN is never accepted as a command-line argument and is never
printed.

Apply runs inside one `SERIALIZABLE` transaction, sets transaction-local tenant
context, verifies every prerequisite, and reconciles all deterministic target
IDs before commit. A rerun skips a row only when every plan-controlled field is
an exact match. Any mismatch, constraint conflict, report error, count
mismatch, or unexpected signature-verification row rolls back the entire
transaction. The deterministic append-only audit event stores only the change
ticket, schema versions, plan fingerprint, and aggregate counts—never names,
contact details, answers, legacy IDs, or other PII.

No partial direct SQL import should be used as a substitute.

## 8. Cutover and rollback design

For the eventual approved migration:

1. Complete at least two identical staging rehearsals.
2. Put the legacy application into a documented read-only maintenance window.
3. Produce a final versioned export and verify counts/fingerprint.
4. Apply to staging-like production infrastructure only through the future
   reviewed importer transaction.
5. Run tenant-isolation, form rendering, client-history, PDF, and access-audit
   acceptance tests before routing traffic.
6. Keep the legacy database unchanged and read-only through the rollback window.

Rollback means routing traffic back to the unchanged legacy application and
rolling back the complete target transaction or restoring the pre-migration
target snapshot. Do not attempt record-by-record deletion based only on names or
timestamps. If any BeautyDocs writes occur after cutover, rollback requires a
separately approved data reconciliation plan rather than silently discarding
those writes.
