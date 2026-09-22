# BeautyDocs API

FastAPI backend for BeautyDocs, with SQLAlchemy 2 models and Alembic migrations.
The older `/admin` screens also use SQLAlchemy through an authenticated internal
API. Prisma has been removed; NextAuth continues to manage their web sessions.
See the [full-stack database setup](../../docs/sqlalchemy-setup.md) for a fresh
PostgreSQL database with separate migration and runtime credentials.

## Local setup

Requires Python 3.12+ and `uv`.

```bash
cp .env.example .env
uv sync --extra dev
uv run uvicorn app.main:app --reload --port 8080
```

Useful endpoints:

- `GET /health/live`
- `GET /health/ready`
- `GET /api/v1/context` with `Host: powderbrows.localhost:8080`
- `GET /api/v1/public/tenant` with a salon host, for example
  `Host: powderbrows.localhost:8080`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/admin/tenants/{slug}/overview`
- `/docs` in local development

The authentication endpoints use an opaque `beautydocs_session` cookie. Only
its SHA-256 digest is stored in PostgreSQL. Membership and role are resolved on
the server for every tenant request; frontend capability flags never replace
API authorization. Authentication mutations require an exact trusted `Origin`.

### Google sign-in for salon clients

Create an OAuth client of type **Web application** in Google Cloud and add the
exact application origins under **Authorized JavaScript origins**:

- `http://localhost:3000` for local development,
- `https://app.beautydocs.pl` for production.

Set its public client ID as `BEAUTYDOCS_GOOGLE_CLIENT_ID` in the API environment
and restart both local development processes. No Google client secret is used by
the Sign in with Google button. The API verifies the returned ID token using the
official Google Auth library before opening a BeautyDocs consumer session.

### E-mail confirmation

Classic e-mail/password registration requires a six-digit confirmation code.
Configure the `BEAUTYDOCS_EMAIL_SMTP_*` settings and
`BEAUTYDOCS_EMAIL_FROM_ADDRESS` from `.env.example` to deliver those codes in
staging and production. Local and test environments expose a development code
in the response so the complete flow can be tested without sending mail.

### Dane firmy z GUS REGON

Wyszukiwanie firmy po NIP korzysta z bezpłatnej usługi GUS BIR 1.2. Dla
środowiska produkcyjnego uzyskaj klucz zgodnie z instrukcją na
`https://api.stat.gov.pl/Home/RegonApi`, a następnie ustaw
`BEAUTYDOCS_REGON_API_KEY`. Klucz jest używany wyłącznie przez API i nie jest
przekazywany do przeglądarki. Podstawowy wynik uzupełnia nazwę i adres oraz
REGON; dla osób prawnych dodatkowy raport BIR12 uzupełnia KRS, jeśli podmiot go
posiada.

### Lokalna kopia Rejestru Produktów Leczniczych

Wyszukiwarka leków korzysta z lokalnej kopii publicznego Rejestru Produktów
Leczniczych (RPL). Pierwszy import oraz późniejszą synchronizację uruchamia:

```bash
cd apps/api
.venv/bin/python scripts/sync_rpl_catalog.py
```

W środowisku produkcyjnym zaplanuj to polecenie raz dziennie w schedulerze
platformy. Synchronizator pobiera wszystkie strony, zapisuje wyłącznie produkty
lecznicze dla ludzi, aktualizuje istniejące pozycje i zapisuje wynik uruchomienia
w `medicine_catalog_sync_runs`. Dopiero po kompletnym imporcie oznacza jako
nieaktywne produkty, które zniknęły z aktualnego rejestru. Blokada PostgreSQL
chroni przed równoczesnym uruchomieniem dwóch synchronizacji.

Opcja `--max-pages` służy wyłącznie do krótkich prób deweloperskich; nie oznacza
brakujących produktów jako nieaktywne. Po załadowaniu lokalnej kopii publiczne
API wyszukiwarki nie odpytuje RPL przy każdym wpisanym zapytaniu.

Klasyfikacje ryzyka nie są wyprowadzane automatycznie z samej listy RPL. Ich
wersjonowane, źródłowe reguły znajdują się w `medicine_safety_rules`. Produkt bez
dopasowanej reguły zawsze otrzymuje status „Wymaga weryfikacji”, a nie
„Bezpieczny”. Każda nowa reguła musi zawierać źródło, datę i autora przeglądu.

## Verification

```bash
uv run pytest
uv run ruff check app tests alembic
uv run mypy app
uv run alembic upgrade head --sql
./scripts/run_postgres_integration_tests.sh
```

The offline Alembic command compiles the migration without changing a database.
The integration script starts an isolated local PostgreSQL instance, applies the
migration online and verifies the runtime role, RLS isolation, immutable records
and the public tenant endpoint. It requires Postgres.app by default; see
[`alembic/README.md`](alembic/README.md) for configuration.

Do not run an online migration against production until database roles, backups,
staging import and rollback have been verified.

## Database ownership

- SQLAlchemy 2 is the target ORM.
- Alembic is the target migration system.
- `BEAUTYDOCS_MIGRATION_DATABASE_URL` selects the Alembic migration role.
- `BEAUTYDOCS_DATABASE_URL` selects the API runtime role and remains a fallback
  for existing migration tooling. Online migrations require an explicit URL.
- Runtime and migration credentials must use separate PostgreSQL roles.
- The runtime role must not own tables or have `BYPASSRLS`.

See [the database role and RLS notes](alembic/README.md) and the
[architecture decision](../../docs/architecture/beautydocs-2.md).

## PowderBrows migration rehearsal

The migration tools can create a count-only inventory, a restricted legacy
export, and a deterministic reconciliation plan. They are deliberately unable
to connect or write to the BeautyDocs target database. Follow the
[PowderBrows migration runbook](docs/migration/powderbrows.md); do not export
personal or health records outside an approved encrypted staging workflow.
