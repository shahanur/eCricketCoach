#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is not installed or is not available on PATH." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: Docker Compose is unavailable. Install Docker Compose v2 and try again." >&2
  exit 1
fi

echo "Validating Docker Compose configuration..."
docker compose config --quiet

echo "Building and starting eCricketCoach..."
docker compose up --build --detach

echo
echo "Service status:"
docker compose ps

echo
echo "Frontend: http://localhost:3000"
echo "API health: http://localhost:3000/api/health"
echo "This Compose configuration is for local development, not production."
