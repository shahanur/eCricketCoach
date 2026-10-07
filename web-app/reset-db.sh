#!/usr/bin/env bash
# Cleans the whole eCricketCoach database and re-seeds default data.
# Connects from the host to the Postgres container's published port (5433).
# Usage: ./reset-db.sh [--force]
set -euo pipefail

cd "$(dirname "$0")"

if [[ "${1:-}" != "--force" ]]; then
  read -r -p 'This permanently deletes ALL data and re-seeds. Type RESET to continue: ' answer
  if [[ "$answer" != "RESET" ]]; then echo 'Cancelled.'; exit 1; fi
fi

get_env() {
  local key="$1" default="$2" value=""
  if [[ -f .env ]]; then
    value=$(grep -E "^[[:space:]]*${key}=" .env | tail -n1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true)
  fi
  echo "${value:-$default}"
}

DB_USER=$(get_env POSTGRES_USER cricket_user)
DB_PASS=$(get_env POSTGRES_PASSWORD cricket_secret)
DB_NAME=$(get_env POSTGRES_DB ecricketcoach)

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5433/${DB_NAME}"

(cd server && npm run db:reset)

echo 'Done. Restart the API if it caches data: docker compose restart server'
