# BeautyDocs

BeautyDocs is a Polish-language platform for beauty salons and their clients. It brings digital consultation forms, consent signatures, client records, appointments, and salon discovery into one application.

## Features

- **Salon workspace:** client records, treatment documentation, appointments, team access, notifications, and client conversations.
- **Digital forms:** salon-specific public links, consultation questionnaires, consent collection, signatures, and document history.
- **Personal accounts:** client profiles, shared documents, appointment workflows, and communication with salons.
- **Salon discovery:** searchable profiles with photo galleries, introductions, contact details, interactive maps, and informational service prices. Service prices do not provide a payment or checkout flow.
- **Owner settings:** company details, salon logos, public profile content, photos, services, prices, and booking schedules.
- **Authentication:** email/password and configurable Google sign-in, verification flows, and multi-factor authentication.
- **Product catalog:** searchable beauty products and product detail pages.

The interface and customer-facing content are primarily in Polish.

## Architecture

| Layer | Technology |
| --- | --- |
| Web application | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind CSS, Radix UI, Lucide, Framer Motion |
| Maps | Leaflet and OpenStreetMap |
| API | FastAPI, Python 3.12+ |
| Database | PostgreSQL, SQLAlchemy 2, Alembic |
| Deployment | Docker Compose, Nginx, Let's Encrypt |

Next.js route handlers forward requests to FastAPI. SQLAlchemy owns database access; Alembic owns schema migrations. Prisma is no longer required. Tenant-scoped data uses PostgreSQL row-level security, with separate migration and application database roles.

The original single-salon `/admin` interface remains available through a server-only SQLAlchemy API bridge. It is separate from the multi-tenant `/panel` workspace.

## Quick start with Docker

Requires Docker and Docker Compose **2.24.4 or later**.

```bash
git clone git@github.com:mgardzina/BeautyDocs.git
cd BeautyDocs
cp .env.compose.example .env.compose.local
```

Edit `.env.compose.local` and replace each placeholder password and secret with an independently generated value. Use URL-safe database passwords, for example values generated with `openssl rand -hex 24`.

```bash
docker compose --env-file .env.compose.local up --build -d
```

Default local addresses:

| Service | Address |
| --- | --- |
| Web application | http://localhost:3000 |
| API readiness | http://localhost:8080/health/ready |
| PostgreSQL | localhost:5434 |

Startup applies migrations before starting the API. Create a salon account through `/konto`; a fresh database contains no existing salon accounts or client records. Email, SMS, and Google authentication providers require their own configuration.

To stop the stack while preserving its database and uploads:

```bash
docker compose --env-file .env.compose.local down
```

See [Docker deployment](docs/docker-deployment.md) for isolated test containers, custom ports, production settings, Nginx, and HTTPS.

## Run development servers on the host

Requires Node.js **22**, Python **3.12+**, `uv`, and PostgreSQL.

```bash
npm ci
cd apps/api
uv sync --extra dev
cd ../..
```

Create `.env.local` from `.env.example` and `apps/api/.env` from `apps/api/.env.example`. Configure database URLs and provider settings using the [SQLAlchemy setup guide](docs/sqlalchemy-setup.md). Next.js connects to the API through `BEAUTYDOCS_API_INTERNAL_URL`.

```bash
npm run db:migrate
npm run api:dev
```

In another terminal:

```bash
npm run dev
```

The legacy `/admin` integration requires matching `BEAUTYDOCS_LEGACY_SERVICE_KEY` values in the web and API environments, plus `AUTH_SECRET` for its NextAuth sessions. Never expose server credentials with a `NEXT_PUBLIC_` prefix or commit environment files.

## Main routes

| Route | Purpose |
| --- | --- |
| `/` | Public website |
| `/konto` | Salon account registration and login |
| `/panel` | Salon workspace |
| `/klient` | Personal account |
| `/salony` | Salon search |
| `/salony/[slug]` | Public salon profile |
| `/f/[tenantSlug]/[formSlug]` | Public consultation and consent form |
| `/katalog` | Beauty product catalog |
| `/admin` | Legacy single-salon administration |

Owners edit public profiles under **Ustawienia → Strona salonu**. Map markers use coordinates supplied in settings. See [salon profiles](docs/salon-profiles.md).

## Checks and database tools

```bash
npm run lint
npx tsc --noEmit
npm run build -- --webpack
npm run api:test
npm run test:tenant
npm run test:beautydocs-forms
npm run test:beautydocs-admin
npm run test:beautydocs-catalog
```

Backend tests require the Python development dependencies. PostgreSQL integration checks use a temporary database and the PostgreSQL tools described in the setup guide; inspect `apps/api/scripts/run_postgres_integration_tests.sh` for local binary configuration.

| Command | Purpose |
| --- | --- |
| `npm run db:migrate` | Apply Alembic migrations |
| `npm run db:revision -- -m "description"` | Generate a migration for review |
| `npm run db:status` | Show the current revision |
| `npm run db:history` | List migrations |
| `npm run db:check` | Check for unmigrated model changes |
| `npm run db:sql` | Generate migration SQL offline |
| `npm run db:test -- --schema-only` | Check schema and database role behavior |
| `npm run create-admin -- --email admin@example.test --name Administrator` | Create a legacy admin with a prompted password |

## Migrating existing records

Changing the ORM does not copy records between databases. `npm run db:copy-legacy` previews source counts; `npm run db:copy-legacy -- --apply` copies legacy single-salon records into empty destination admin tables, preserving IDs and associated data. It refuses to overwrite existing target records.

Follow the [legacy copy instructions](docs/sqlalchemy-setup.md#existing-single-salon-records) or the separate [multi-tenant import runbook](apps/api/docs/migration/powderbrows.md).

## Repository layout

```text
app/                     Next.js pages and API handlers
components/beautydocs/   Marketing, salon, client, and admin interfaces
lib/                     API clients, contracts, validation, and helpers
types/                   Shared TypeScript contracts
apps/api/app/            FastAPI routes, services, and SQLAlchemy models
apps/api/alembic/        Database migrations
apps/api/tests/          Backend tests
docker/                  PostgreSQL initialization and Nginx configuration
docs/                    Setup, deployment, and feature documentation
public/                  Static assets
```
