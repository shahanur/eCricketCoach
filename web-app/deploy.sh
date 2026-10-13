#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [--cape]

  (no flag)  Build and start the whole stack, including CAPE.
  --cape     Rebuild and restart only the cape-api container; other services are left untouched.

Environment:
  CAPE_MODE=auto|cpu|gpu  Select CAPE runtime mode (default: auto).
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

if [[ "${CAPE_MODE:-auto}" != "auto" && "${CAPE_MODE:-auto}" != "cpu" && "${CAPE_MODE:-auto}" != "gpu" ]]; then
  echo "Error: CAPE_MODE must be auto, cpu, or gpu." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is not installed or is not available on PATH." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: Docker Compose is unavailable. Install Docker Compose v2 and try again." >&2
  exit 1
fi

# CAPE uses CUDA on NVIDIA Linux hosts and the CPU image on macOS/ARM or when NVIDIA is unavailable.
# CAPE_API_URL in .env points the API at the selected internal service.
CAPE_MODE_EFFECTIVE="${CAPE_MODE:-auto}"
if [[ "$CAPE_MODE_EFFECTIVE" == "auto" ]]; then
  if [[ "$(uname -s)" == "Darwin" || "$(uname -m)" == "arm64" || "$(uname -m)" == "aarch64" ]]; then
    CAPE_MODE_EFFECTIVE="cpu"
  elif command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1; then
    CAPE_MODE_EFFECTIVE="gpu"
  else
    CAPE_MODE_EFFECTIVE="cpu"
  fi
fi

COMPOSE_FILES=(-f docker-compose.yml)
if [[ "$CAPE_MODE_EFFECTIVE" == "cpu" ]]; then
  COMPOSE_FILES+=(-f docker-compose.cape-cpu.yml)
fi
COMPOSE=(docker compose "${COMPOSE_FILES[@]}" --profile cape)

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
echo "CAPE runtime: ${CAPE_MODE_EFFECTIVE} ($(uname -s)/$(uname -m))"
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
