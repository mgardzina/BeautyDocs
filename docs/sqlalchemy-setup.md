# SQLAlchemy and Alembic setup

BeautyDocs uses **SQLAlchemy 2** for database access in `apps/api/app` and
**Alembic** for schema migrations in `apps/api/alembic/versions`. Next.js calls
the Python API through `BEAUTYDOCS_API_INTERNAL_URL`; Python ORM code does not
run inside Next.js route handlers.

## Start with a new database

For the Nginx/HTTPS production overlay, use the
[Docker deployment instructions](docker-deployment.md). The commands below
describe the local stack.

The Compose stack is for local development. It creates a separate
`beautydocs_sqlalchemy_database` Docker volume and does not connect to the old
Prisma database. Docker Compose v2.24+ is required.

1. Copy `.env.compose.example` to `.env.compose.local` and replace its three
   passwords and the service key. Use URL-safe values, such as `openssl rand -hex 24` output.
2. Start the stack:

   ```bash
   docker compose --env-file .env.compose.local up --build -d
   ```

3. Open `http://localhost:3000`. API readiness is available at
   `http://localhost:8080/health/ready`.

Startup waits for PostgreSQL, applies all Alembic migrations using
`beautydocs_migrator`, then starts the API using `beautydocs_app`. The runtime
role cannot own tables, create schema objects or bypass row-level security.
Uploads persist in a separate volume. The new database starts without users,
salons or imported client records; use the app's registration flow to create
an account and salon.

`docker compose --env-file .env.compose.local down` stops the stack and retains
data. Passwords in the initialization script are applied only to an empty
volume; editing the env file does not rotate existing PostgreSQL passwords.

This stack deliberately uses local cookie and origin settings. Production
needs the production API settings, HTTPS origins and externally managed
credentials described in `apps/api/.env.example`.

## Run Next.js and Python on the host

Start only the new database and migrations:

```bash
docker compose --env-file .env.compose.local up --build -d db migrate
cd apps/api
uv sync --extra dev
```

If `apps/api/.env` already exists, preserve its settings. Otherwise copy
`apps/api/.env.example`. Set these two URLs using the passwords from
`.env.compose.local`:

```dotenv
BEAUTYDOCS_DATABASE_URL=postgresql+asyncpg://beautydocs_app:APP_PASSWORD@localhost:5434/beautydocs
BEAUTYDOCS_MIGRATION_DATABASE_URL=postgresql+asyncpg://beautydocs_migrator:MIGRATOR_PASSWORD@localhost:5434/beautydocs
```

Both URLs require the `postgresql+asyncpg` driver. Set the web application's
`BEAUTYDOCS_API_INTERNAL_URL=http://localhost:8080` in root `.env.local`.
For `/admin`, set an identical random `BEAUTYDOCS_LEGACY_SERVICE_KEY` (at least
32 characters) in both `.env.local` and `apps/api/.env`. Set a separate random
`AUTH_SECRET` in `.env.local` for NextAuth. The API refuses every internal admin
database request if its service key is absent or incorrect.
From the repository root, run `npm run api:dev` and `npm run dev` in separate
terminals. These commands use the Python interpreter directly, so a moved
repository's stale console-script shebangs do not break them.

## Change the schema

Edit SQLAlchemy models, generate a migration, and review the generated file:

```bash
npm run db:revision -- -m "describe the schema change"
npm run db:migrate
npm run db:status
npm run db:check
```

`db:revision` compares models to the configured database; start from a database
already at the current migration head. Review SQL and explicitly add any
needed data migrations, PostgreSQL policies, triggers and permissions.
Autogeneration cannot infer those application rules.

Other commands:

| Command | Purpose |
| --- | --- |
| `npm run db:history` | Show migration history |
| `npm run db:sql` | Compile SQL without opening a connection |
| `npm run db:test` | Apply and roll back migrations in a temporary PostgreSQL cluster; run integration tests |
| `npm run db:test -- --schema-only` | Check only the fresh database bootstrap, role permissions and migration lifecycle |
| `npm run api:test` | Run the Python test suite |

Online migrations prefer `BEAUTYDOCS_MIGRATION_DATABASE_URL`. Existing tooling
using `BEAUTYDOCS_DATABASE_URL` as its explicit migration credential still
works. With neither configured, online migrations fail rather than silently
connecting to a default database. Offline SQL generation needs no credentials.

## Completed ORM cutover

All active database access uses SQLAlchemy in Python. Prisma's schema,
configuration, client, npm packages and Docker generation steps are removed.
The six existing single-salon models are in `apps/api/app/models/legacy.py`;
revision `20260912_0036` creates their tables on a fresh database. The original
schema is retained only as a text reference for the import fingerprint in
`apps/api/docs/migration/legacy-schema.txt`.

The old Next.js routes retain their authenticated public contracts and PDFs.
`lib/legacy-database.ts` is a server-only HTTP transport to a private Python
endpoint with an explicit model/operation allowlist and a shared service key.
It cannot query the multi-tenant tables or accept raw SQL. Transactions,
filters, defaults, unique constraints and cascades execute through SQLAlchemy.
The two admin systems retain separate account/data models; this migration
changes persistence, not account membership or the meaning of signed records.

`BEAUTYDOCS_LEGACY_SERVICE_KEY` belongs only in backend environments. Use a
private network or HTTPS between web and API in deployments. The Compose file
sets the same key for both services. NextAuth continues to manage `/admin`
sessions; its credentials provider reads accounts through the Python API.

## Existing single-salon records

Use an empty set of admin tables on an Alembic-managed target database. The
new BeautyDocs multi-tenant tables may already contain data; the copy tool does
not write to them. Configure `LEGACY_DATABASE_URL` with a read-only credential
for the old database and `BEAUTYDOCS_DATABASE_URL` for the target in
`apps/api/.env`. Run:

```bash
npm run db:migrate
npm run db:copy-legacy
# Stop old-app writes for the final copy, then:
npm run db:copy-legacy -- --apply
```

The default dry run reports counts only. Apply reads a consistent, read-only
source snapshot, checks both schemas, locks the target admin tables, refuses
a nonempty target, copies in batches, and reconciles counts before committing
one transaction. IDs, password hashes, notes, treatments, signatures and audit
JSON are preserved. Temporary OTP challenges are omitted; request new codes
after switching. The source database is never modified. Do not rerun apply
against a populated target; the tool deliberately refuses it.

If starting fresh, create a single-salon administrator with:

```bash
npm run create-admin -- --email admin@example.test --name Administrator --phone +48123456789
```

The command prompts for a password, or reads `ADMIN_PASSWORD` from the process
environment. SMS and email configuration remain necessary for delivery.

For a later conversion of single-salon records into the multi-tenant model,
use the separate [PowderBrows migration runbook](../apps/api/docs/migration/powderbrows.md).

References: [SQLAlchemy asyncio](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html),
[Alembic autogeneration](https://alembic.sqlalchemy.org/en/latest/autogenerate.html).
