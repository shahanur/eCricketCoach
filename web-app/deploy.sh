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

# CAPE (video analysis + its queue worker) needs an NVIDIA GPU with the Container Toolkit
# and model weights in ../cape-api/weights; CAPE_API_URL in .env points the API at it.
COMPOSE=(docker compose --profile cape)

echo "Validating Docker Compose configuration..."
"${COMPOSE[@]}" config --quiet

echo "Building and starting eCricketCoach (including CAPE)..."
"${COMPOSE[@]}" up --build --detach

echo
echo "Service status:"
"${COMPOSE[@]}" ps

echo
echo "Frontend: http://localhost:3000"
echo "API health: http://localhost:3000/api/health"
echo "CAPE runs internally at http://cape-api:8000 (not published to the host)."
echo "This Compose configuration is for local development, not production."
