#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [--cape]

  (no flag)  Build and start the whole stack, including CAPE.
  --cape     Rebuild and restart only the cape-api container; other services are left untouched.
EOF
}

CAPE_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --cape) CAPE_ONLY=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

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

if [ "$CAPE_ONLY" = true ]; then
  echo "Building and restarting cape-api only..."
  "${COMPOSE[@]}" build cape-api
  "${COMPOSE[@]}" up --detach --no-deps --force-recreate cape-api
  "${COMPOSE[@]}" ps cape-api
  exit 0
fi

echo "Building and starting eCricketCoach (including CAPE)..."
"${COMPOSE[@]}" up --build --detach

# Nginx resolves the server service when it starts. Recreate/restart the proxy
# after a server rebuild so it does not retain a stale container IP.
docker compose restart client

echo
echo "Service status:"
"${COMPOSE[@]}" ps

echo
echo "Frontend: http://localhost:3000"
echo "API health: http://localhost:3000/api/health"
echo "CAPE runs internally at http://cape-api:8000 (not published to the host)."
echo "This Compose configuration is for local development, not production."
