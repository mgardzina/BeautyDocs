# BeautyDocs database roles and RLS

Alembic migrations define tables, constraints, triggers, and Row-Level Security
policies. Infrastructure must provision credentials separately; secrets never
belong in a migration.

Recommended roles:

- `beautydocs_owner` — `NOLOGIN`, owns schema objects;
- `beautydocs_migrator` — login used only by CI/CD, can assume the owner role;
- `beautydocs_app` — runtime login, `NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOBYPASSRLS`, never owns tables;
- read-only/support roles should be added later with explicit, audited workflows,
  not by granting `BYPASSRLS`.

Example bootstrap (run by an infrastructure administrator, with passwords and
secret rotation handled by the deployment platform):

```sql
CREATE ROLE beautydocs_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE beautydocs_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE beautydocs_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

GRANT beautydocs_owner TO beautydocs_migrator;
GRANT USAGE ON SCHEMA public TO beautydocs_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO beautydocs_app;
ALTER DEFAULT PRIVILEGES FOR ROLE beautydocs_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO beautydocs_app;
```

The application opens a transaction and calls:

```sql
SELECT set_config('app.tenant_id', '<tenant UUID>', true);
```

The third argument is `true`, so the value is local to that transaction and is
cleared before a pooled connection can serve another request. A missing or
invalid tenant context matches no RLS policy. Every tenant-owned table has RLS
enabled and forced; the runtime role must not be a superuser or have
`BYPASSRLS`.

Migrations use the migrator/owner role and must not run through runtime API
credentials. `FORCE ROW LEVEL SECURITY` protects table owners during ordinary
access; PostgreSQL superusers and roles with `BYPASSRLS` remain outside RLS by
design and therefore must never be used by the web application.

The local Compose bootstrap in `docker/postgres/init-beautydocs.sh` uses a
single non-superuser `beautydocs_migrator` login as the object owner and a
separate `beautydocs_app` runtime login. Set
`BEAUTYDOCS_MIGRATION_DATABASE_URL` for Alembic and `BEAUTYDOCS_DATABASE_URL`
for the API. The deployment example above can additionally separate ownership
into a `NOLOGIN` role. See the [setup guide](../../../docs/sqlalchemy-setup.md).

## Local PostgreSQL integration test

The integration harness creates an isolated PostgreSQL cluster under a guarded
`/tmp/beautydocs-pg.*` directory, listens only on loopback and its temporary
Unix socket, creates separate migration/runtime roles, applies Alembic online,
and then verifies tenant isolation and immutable-record triggers:

```bash
apps/api/scripts/run_postgres_integration_tests.sh
```

It defaults to the Postgres.app binaries at
`/Applications/Postgres.app/Contents/Versions/latest/bin`. Set `POSTGRES_BIN`
to a compatible PostgreSQL `bin` directory when needed. The script always stops
the server and removes only its validated temporary directory through an EXIT
trap. The regular unit-test suite collects the integration test as skipped when
the harness DSNs are absent.

The same test also calls `GET /api/v1/public/tenant` through the complete
FastAPI stack using the non-bypass runtime role. It verifies host-based tenant
resolution, transaction-local RLS, the camelCase response contract, configured
form ordering, and hidden inactive or unknown salons. Public catalog tables get
only the `SELECT` privileges required by that endpoint.
