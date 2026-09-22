#!/usr/bin/env bash

set -euo pipefail

API_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POSTGRES_BIN="${POSTGRES_BIN:-/Applications/Postgres.app/Contents/Versions/latest/bin}"
PYTHON_BIN="${API_ROOT}/.venv/bin/python"

for required_binary in initdb pg_ctl psql; do
  if [[ ! -x "${POSTGRES_BIN}/${required_binary}" ]]; then
    echo "Missing PostgreSQL binary: ${POSTGRES_BIN}/${required_binary}" >&2
    exit 1
  fi
done

for required_binary in "${PYTHON_BIN}"; do
  if [[ ! -x "${required_binary}" ]]; then
    echo "Missing API environment binary: ${required_binary}" >&2
    exit 1
  fi
done

TEST_ROOT="$(mktemp -d /tmp/beautydocs-pg.XXXXXX)"
PG_DATA="${TEST_ROOT}/data"
PG_SOCKET="${TEST_ROOT}/socket"
PG_LOG="${TEST_ROOT}/postgres.log"
PG_STARTED=0

cleanup() {
  local exit_code=$?

  if [[ "${PG_STARTED}" == "1" && -d "${PG_DATA}" ]]; then
    "${POSTGRES_BIN}/pg_ctl" -D "${PG_DATA}" -m fast -w stop >/dev/null 2>&1 || true
  fi

  case "${TEST_ROOT}" in
    /tmp/beautydocs-pg.*)
      rm -rf -- "${TEST_ROOT}"
      ;;
    *)
      echo "Refusing to remove unexpected test directory: ${TEST_ROOT}" >&2
      ;;
  esac

  exit "${exit_code}"
}
trap cleanup EXIT

mkdir -p "${PG_SOCKET}"

PG_PORT="$("${PYTHON_BIN}" -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')"

"${POSTGRES_BIN}/initdb" \
  -D "${PG_DATA}" \
  --username=postgres \
  --auth-local=trust \
  --auth-host=trust \
  --encoding=UTF8 \
  --no-locale \
  >/dev/null

"${POSTGRES_BIN}/pg_ctl" \
  -D "${PG_DATA}" \
  -l "${PG_LOG}" \
  -o "-h 127.0.0.1 -p ${PG_PORT} -k ${PG_SOCKET}" \
  -w start \
  >/dev/null
PG_STARTED=1

PSQL_BASE=(
  "${POSTGRES_BIN}/psql"
  -h 127.0.0.1
  -p "${PG_PORT}"
  -U postgres
  -v ON_ERROR_STOP=1
)

"${PSQL_BASE[@]}" -d postgres -c \
  "CREATE ROLE beautydocs_migrator_test LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS" \
  >/dev/null
"${PSQL_BASE[@]}" -d postgres -c \
  "ALTER ROLE beautydocs_migrator_test CREATEDB" \
  >/dev/null
"${PSQL_BASE[@]}" -d postgres -c \
  "CREATE ROLE beautydocs_app_test LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS" \
  >/dev/null
"${PSQL_BASE[@]}" -d postgres -c \
  "CREATE ROLE beautydocs_importer_test LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS" \
  >/dev/null
"${PSQL_BASE[@]}" -d postgres -c \
  "CREATE DATABASE beautydocs_integration OWNER beautydocs_migrator_test" \
  >/dev/null
"${PSQL_BASE[@]}" -d postgres -c \
  "ALTER ROLE beautydocs_migrator_test NOCREATEDB" \
  >/dev/null

export BEAUTYDOCS_DATABASE_URL="postgresql+asyncpg://beautydocs_migrator_test@127.0.0.1:${PG_PORT}/beautydocs_integration"
export BEAUTYDOCS_MIGRATION_DATABASE_URL="${BEAUTYDOCS_DATABASE_URL}"
export BEAUTYDOCS_INTEGRATION_MIGRATOR_DSN="postgresql://beautydocs_migrator_test@127.0.0.1:${PG_PORT}/beautydocs_integration"
export BEAUTYDOCS_INTEGRATION_APP_DSN="postgresql://beautydocs_app_test@127.0.0.1:${PG_PORT}/beautydocs_integration"
export BEAUTYDOCS_INTEGRATION_IMPORTER_DSN="postgresql://beautydocs_importer_test@127.0.0.1:${PG_PORT}/beautydocs_integration"

(
  cd "${API_ROOT}"
  "${PYTHON_BIN}" -m alembic -c alembic.ini upgrade head
)

"${PSQL_BASE[@]}" -d beautydocs_integration <<'SQL'
GRANT CONNECT ON DATABASE beautydocs_integration TO beautydocs_app_test;
GRANT USAGE ON SCHEMA public TO beautydocs_app_test;
GRANT SELECT ON TABLE tenants TO beautydocs_app_test;
GRANT SELECT ON TABLE form_templates, tenant_form_templates TO beautydocs_app_test;
GRANT SELECT, UPDATE ON TABLE users TO beautydocs_app_test;
GRANT SELECT, INSERT, UPDATE ON TABLE auth_sessions TO beautydocs_app_test;
GRANT SELECT ON TABLE tenant_memberships, client_notes, visits, form_submissions TO beautydocs_app_test;
GRANT SELECT, INSERT, UPDATE ON TABLE team_members TO beautydocs_app_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE clients TO beautydocs_app_test;
GRANT SELECT, UPDATE, DELETE ON TABLE form_template_versions TO beautydocs_app_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE audit_events TO beautydocs_app_test;

GRANT CONNECT ON DATABASE beautydocs_integration TO beautydocs_importer_test;
GRANT USAGE ON SCHEMA public TO beautydocs_importer_test;
GRANT SELECT ON TABLE tenants, form_templates, form_template_versions TO beautydocs_importer_test;
GRANT SELECT, INSERT ON TABLE users, tenant_memberships TO beautydocs_importer_test;
GRANT SELECT, INSERT ON TABLE clients, client_notes, visits, form_submissions TO beautydocs_importer_test;
GRANT SELECT ON TABLE signature_verifications TO beautydocs_importer_test;
GRANT SELECT, INSERT ON TABLE audit_events TO beautydocs_importer_test;
SQL

# Exercise the exact bootstrap used by Compose in a second, empty database.
"${PSQL_BASE[@]}" -d postgres -c "CREATE DATABASE beautydocs" >/dev/null
PATH="${POSTGRES_BIN}:${PATH}" \
  PGHOST=127.0.0.1 PGPORT="${PG_PORT}" POSTGRES_USER=postgres POSTGRES_DB=beautydocs \
  BEAUTYDOCS_MIGRATOR_PASSWORD=local-migration-test \
  BEAUTYDOCS_APP_PASSWORD=local-runtime-test \
  bash "${API_ROOT}/../../docker/postgres/init-beautydocs.sh"

export BEAUTYDOCS_BOOTSTRAP_MIGRATOR_DSN="postgresql://beautydocs_migrator@127.0.0.1:${PG_PORT}/beautydocs"
export BEAUTYDOCS_BOOTSTRAP_APP_DSN="postgresql://beautydocs_app@127.0.0.1:${PG_PORT}/beautydocs"

(
  cd "${API_ROOT}"
  export BEAUTYDOCS_MIGRATION_DATABASE_URL="postgresql+asyncpg://beautydocs_migrator@127.0.0.1:${PG_PORT}/beautydocs"
  "${PYTHON_BIN}" -m alembic -c alembic.ini upgrade head
  "${PYTHON_BIN}" -m alembic -c alembic.ini downgrade base
  "${PYTHON_BIN}" -m alembic -c alembic.ini upgrade head
)

# Verify that the latest migration can be rolled back and reapplied cleanly.
(
  cd "${API_ROOT}"
  "${PYTHON_BIN}" -m alembic -c alembic.ini downgrade 20260719_0001
  "${PYTHON_BIN}" -m alembic -c alembic.ini upgrade head
)

(
  cd "${API_ROOT}"
  if [[ "${1:-}" == "--schema-only" ]]; then
    "${PYTHON_BIN}" -m pytest -q tests/integration/test_database_bootstrap.py tests/integration/test_legacy_copy.py tests/integration/test_legacy_data.py
  else
    "${PYTHON_BIN}" -m pytest -q tests/integration
  fi
)
