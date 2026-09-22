#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
exec docker compose --env-file .env.production.local \
    -f docker-compose.yml -f docker-compose.production.yml "$@"
