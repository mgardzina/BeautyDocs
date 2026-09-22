# BeautyDocs 2.0 — architecture foundation

Status: accepted foundation for the multi-tenant migration.

## Current implementation status

Stages 1-2 established the isolated FastAPI/SQLAlchemy/Alembic foundation and
the public tenant preview. Stage 3 added the first shared administration slice:

- opaque database-backed sessions in a host-only `HttpOnly` cookie;
- global users with per-tenant memberships and roles;
- backend authorization plus fail-closed RLS for sessions and tenant data;
- a shared Next.js login, salon chooser, and tenant overview preview;
- a read-only PowderBrows exporter and deterministic reconciliation planner.

Stage 4 now provides the implementation needed for a controlled rehearsal:

- a shared path-based public catalogue and form start route for each tenant;
- a staging-only, dry-run-by-default PowderBrows importer;
- deterministic reconciliation, exact-match idempotent reruns and a
  non-PII audit event inside one serializable transaction;
- database-role and RLS gates plus integration tests against real PostgreSQL.

Stage 4 tooling does not mean that real salon data has been imported. The
PowderBrows tenant, reviewed legal template versions, migration service
identity, dedicated staging credentials and approved change ticket must be
provisioned before a staging apply. Production routing is unchanged, Prisma is
not removed, and the legacy application remains the source of truth until the
approved rehearsals, reconciliation, cutover and rollback checks are complete.

## Product boundaries

BeautyDocs is one SaaS product with one shared user interface. A salon is a
tenant, not a separate deployment or a separately themed application.

Tenant-specific configuration is deliberately limited to:

- display and legal name,
- legal and contact details,
- active form templates and their display order,
- users, memberships and roles,
- published business information used by the assistant.

Custom layouts, CSS themes and salon-specific forks are out of scope.

## Domains

BeautyDocs does not require a subdomain per salon for the MVP. The canonical
surfaces are:

| Address | Responsibility |
| --- | --- |
| `beautydocs.pl` | marketing site and product entry point |
| `www.beautydocs.pl` | redirect to the apex domain |
| `app.beautydocs.pl/login` | login owned by the application origin |
| `app.beautydocs.pl/salons/{slug}` | shared administration panel for an authorized salon |
| `forms.beautydocs.pl/{slug}` | public forms and informational assistant for a salon |

Only the apex, `www`, `app`, and shared `forms` DNS records and certificates are
required. The session cookie remains host-only for `app.beautydocs.pl`; it is
never sent to public form routes and is never shared with the marketing origin
or all subdomains. `forms.beautydocs.pl` can still route to the same Next.js and
FastAPI deployment; it is a browser security boundary, not a separate product.

The salon slug in a path is a lookup key, not proof of access. Administration
requests always resolve the authenticated user's active membership before
setting the transaction-local tenant context. Public requests resolve only an
active tenant and expose the deliberately limited public contract.

Per-salon subdomains or customer-owned domains can be added later as aliases
for public routes. They are not part of the initial product and must not change
tenant authorization or require a salon-specific UI deployment.

## Runtime architecture

```text
Browser
  -> load balancer / same-origin routing
      -> Next.js web
      -> FastAPI /api/v1
          -> PostgreSQL
          -> private object storage
          -> background worker
          -> Redis or managed task queue
```

- Next.js owns presentation and does not access the database directly.
- FastAPI owns business rules, authentication enforcement and authorization.
- SQLAlchemy 2 is the only long-term ORM.
- Alembic is the only long-term schema migration system.
- Prisma remains temporarily available only while legacy routes are migrated.
- Public tenant configuration is resolved through the path-based endpoint
  `GET /api/v1/public/tenants/{slug}`. The public frontend does not emulate a
  salon subdomain through the `Host` header.

## Tenant isolation

All tenant-owned records carry a non-null `tenant_id`. Public routes resolve an
active tenant from a validated path slug. Administration routes derive tenant
context from an authenticated membership; they never treat a browser-supplied
tenant identifier as proof of access.

Isolation is enforced twice:

1. application services scope every operation to the active tenant;
2. PostgreSQL Row-Level Security provides defence in depth.

Schema migrations use a separate database owner. The application role does not
own tenant tables and must not have `BYPASSRLS`.

## Forms

Form templates are managed centrally by BeautyDocs. A tenant enables a subset
through a join table; enabling a form never requires code changes or a deploy.

Published template versions are immutable. A signed submission records the
exact template version, canonical response snapshot, server-generated hash and
private PDF object key.

## Assistant

The public assistant is informational. It may explain treatments, products,
general risks, aftercare and salon logistics from reviewed sources. It must not
diagnose, qualify a person for treatment, select doses or replace professional
consultation.

The public assistant has no access to client records. Retrieval uses approved,
versioned knowledge sources, always returns citations and refuses to invent an
answer when sources are insufficient. Personalised or post-treatment symptom
questions are routed to deterministic safety responses and human contact.

## Migration sequence

1. Harden the legacy application while it remains the source of truth.
2. Introduce FastAPI, SQLAlchemy models, Alembic and automated tests.
3. Introduce shared authentication/RBAC and prepare a deterministic PowderBrows
   staging migration plan.
4. Create the PowderBrows tenant, implement the reviewed staging importer, and
   reconcile imported data.
5. Move clients, visits and notes to FastAPI.
6. Move versioned forms, OTP, signed snapshots, PDFs and audit events.
7. Connect the complete shared Next.js panel and public path-based form flow.
8. Pilot a second salon and run cross-tenant security tests.
9. Add the informational assistant.
10. Disable legacy Next.js API routes and remove Prisma.

The migration follows expand-migrate-contract. Existing production data is not
destructively changed before a verified import, reconciliation and rollback
plan exist.
