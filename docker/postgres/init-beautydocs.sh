#!/usr/bin/env bash
set -euo pipefail

# Invoked by the PostgreSQL image only when its dedicated volume is empty.
# Read passwords inside psql so they do not appear in process arguments.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv migrator_password BEAUTYDOCS_MIGRATOR_PASSWORD
\getenv app_password BEAUTYDOCS_APP_PASSWORD
CREATE ROLE beautydocs_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'migrator_password';
CREATE ROLE beautydocs_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'app_password';
ALTER DATABASE beautydocs OWNER TO beautydocs_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO beautydocs_migrator;
GRANT USAGE ON SCHEMA public TO beautydocs_app;
ALTER DEFAULT PRIVILEGES FOR ROLE beautydocs_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO beautydocs_app;
ALTER DEFAULT PRIVILEGES FOR ROLE beautydocs_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO beautydocs_app;
SQL
