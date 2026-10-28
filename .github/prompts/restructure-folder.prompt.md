# Restructure Project Folders

Safely reorganize this repository into a clear, scalable monorepo layout that keeps the backend services separate from the web and mobile clients. Treat this as an implementation task: inspect the repository, move files, update references, and validate the result. Do not stop after proposing a tree or giving commands.

## Target structure

```text
eCricketCoach/
├── apps/
│   ├── web/                         # React + Vite frontend
│   └── mobile/
│       └── club/
│           └── android/             # Existing Kotlin + Jetpack Compose club app
├── services/
│   ├── platform-api/                # Node.js + Express API and Prisma
│   ├── cape-api/                    # Python biomechanics API
│   ├── ai-hub/                      # Python AI service
│   └── pose-overlay-api/            # Python pose-overlay service
├── docs/                            # Existing requirements and guides
├── images/                          # Keep existing assets here unless proven otherwise
├── scripts/                         # Deployment and database scripts
├── deploy/
│   ├── compose.yml                  # Main Docker Compose stack
│   └── compose.cape-cpu.yml         # CPU-specific CAPE Compose configuration
├── .github/
├── .vscode/
├── .gitignore
└── README.md
```

## Existing paths to migrate

- `web-app/client/` → `apps/web/`
- `mobile-app/` → `apps/mobile/club/android/`
- `web-app/server/` → `services/platform-api/`
- `cape-api/` → `services/cape-api/`
- `web-app/aihub/` → `services/ai-hub/`
- `web-app/pose-overlay-api/` → `services/pose-overlay-api/`
- `web-app/deploy.sh` → `scripts/deploy.sh`
- `web-app/reset-db.sh` → `scripts/reset-db.sh`
- `web-app/docker-compose.yml` → `deploy/compose.yml`
- `web-app/docker-compose.cape-cpu.yml` → `deploy/compose.cape-cpu.yml`

Keep the existing club Android application intact. The separate individual-player app belongs in `apps/mobile/player`; do not merge its implementation with the club app or invent additional persona projects.

## Migration requirements

1. Inspect the working tree and relevant manifests, Dockerfiles, Compose files, scripts, documentation, IDE configuration, and CI/workflow configuration before moving anything. Preserve all pre-existing user changes and do not overwrite or discard uncommitted work.
2. Use Git-aware moves where possible. Move only the scoped project directories and files listed above. Leave `docs/`, `images/`, `.github/`, `.vscode/`, root media, and other unrelated files in place unless a concrete dependency requires a change.
3. Keep the frontend and mobile clients independent from backend implementation. They must continue to communicate with backend services through their existing HTTP/API client boundaries.
4. Update every affected relative path and working-directory assumption, including Docker build contexts, Compose bind mounts, service dependencies, shell scripts, Android/Gradle configuration, tests, workflows, ignore rules, and README links/instructions. Search the repository for stale references to the old paths after the moves.
5. The current root `.env` is sensitive local configuration. Never read its values into output, commit it, overwrite it, or move it automatically. Check how Compose currently discovers environment files and preserve that behavior deliberately; update `.env.example` or documentation only when needed, without copying secrets.
6. Do not create a shared package merely for appearance. Add one only if inspection finds genuinely reusable code with a clear dependency boundary; otherwise keep client-specific API code in each client.
7. Keep changes focused on the folder restructure. Do not modify application behavior, upgrade dependencies, or perform unrelated cleanup.
8. Update the root README with the final directory tree and corrected setup/development instructions. Keep paths and commands accurate for the resulting repository.
9. Validate the exact affected surfaces using available project tooling: check Compose configuration, build or test the web client and platform API, run relevant CAPE Python tests, and verify the Android project with its existing Gradle wrapper when the environment permits. Report any validation that cannot be run and why.
10. Finish with a concise summary of moved paths, important reference/configuration updates, validation results, and any remaining manual steps. Do not commit unless explicitly asked.

## Important deployment checks

- Compose files moved to the repository root resolve relative paths from a different directory. Recalculate every `build.context`, bind mount, `env_file`, and relative file reference rather than applying a blind text replacement.
- The main Compose stack references the CAPE service and its weights/rules paths. Preserve those mounts and service behavior after relocation.
- Deployment and database scripts currently assume they live under `web-app/`. Update them to resolve repository and service paths reliably from their new `scripts/` location.
- Verify whether environment variables are expected from the repository root, a project directory, or an explicitly configured env file. Preserve the existing developer workflow without exposing local secrets.
