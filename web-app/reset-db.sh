#!/usr/bin/env bash
# Drops and recreates the database schema from Prisma, then seeds drills and
# training session templates.
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

docker compose up -d postgres

printf 'Waiting for PostgreSQL to become ready'
for attempt in {1..30}; do
  if docker compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    printf '\n'
    break
  fi
  printf '.'
  sleep 1
done

if ! docker compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  printf '\nPostgreSQL did not become ready in time.\n' >&2
  exit 1
fi

(cd server && npx prisma db push --force-reset --accept-data-loss)

docker compose exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -f - < server/src/scripts/drillseeder.sql

docker compose exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -f - < server/src/scripts/trainingtemplateseeder.sql

echo 'Done. Prisma schema applied, drills seeded, and training templates seeded.'
