#!/usr/bin/env bash
# Drops and recreates the database schema from Prisma, then seeds drills,
# training session templates, and players.
# Usage: bash ./scripts/reset-db.sh [--force]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if [[ "${1:-}" != "--force" ]]; then
  read -r -p 'This permanently deletes ALL data and re-seeds. Type RESET to continue: ' answer
  if [[ "$answer" != "RESET" ]]; then echo 'Cancelled.'; exit 1; fi
fi

get_env() {
  local key="$1" default="$2" value=""
  local env_file="$REPO_ROOT/deploy/.env"
  if [[ -f "$env_file" ]]; then
    value=$(grep -E "^[[:space:]]*${key}=" "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true)
  fi
  echo "${value:-$default}"
}

DB_USER=$(get_env POSTGRES_USER cricket_user)
DB_PASS=$(get_env POSTGRES_PASSWORD cricket_secret)
DB_NAME=$(get_env POSTGRES_DB ecricketcoach)

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5433/${DB_NAME}"

COMPOSE=(docker compose --project-directory "$REPO_ROOT" --env-file "$REPO_ROOT/deploy/.env" -f "$REPO_ROOT/deploy/compose.yml")
"${COMPOSE[@]}" up -d postgres

printf 'Waiting for PostgreSQL to become ready'
for attempt in {1..30}; do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    printf '\n'
    break
  fi
  printf '.'
  sleep 1
done

if ! "${COMPOSE[@]}" exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  printf '\nPostgreSQL did not become ready in time.\n' >&2
  exit 1
fi

(cd services/platform-api && npx prisma db push --force-reset --accept-data-loss)

"${COMPOSE[@]}" exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -f - < services/platform-api/src/scripts/drillseeder.sql

"${COMPOSE[@]}" exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -f - < services/platform-api/src/scripts/trainingtemplateseeder.sql

"${COMPOSE[@]}" exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -f - < services/platform-api/src/scripts/playerseeder.sql

echo 'Done. Prisma schema applied; drills, training templates, and players seeded.'
