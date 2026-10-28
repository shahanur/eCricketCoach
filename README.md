# eCricketCoach

Multi-device web application and platform for cricket coaching, player skill progression, and AI biomechanical video analysis.

## Repository Structure

```text
eCricketCoach/
├── apps/
│   ├── web/                         # React + Vite frontend
│   └── mobile/
│       └── android/                 # Kotlin + Jetpack Compose application
├── services/
│   ├── platform-api/                # Node.js + Express API and Prisma
│   ├── cape-api/                    # Python biomechanics API
│   ├── ai-hub/                      # Python AI service
│   └── pose-overlay-api/            # Python pose-overlay service
├── docs/                            # Requirements and guides
├── images/                          # Project assets
├── scripts/                         # Deployment and database scripts
├── deploy/
│   ├── compose.yml                  # Main Docker Compose stack
│   └── compose.cape-cpu.yml         # CPU-specific CAPE override
├── .github/
├── .vscode/
├── .gitignore
└── README.md
```

## Quick Start

Run commands from the repository root. Compose and the deployment scripts use the ignored `deploy/.env` for interpolation. Keep this local file private and do not replace it. If it does not exist yet, create it from the API example:

```powershell
if (-not (Test-Path .\deploy\.env)) {
    Copy-Item .\services\platform-api\.env.example .\deploy\.env
}
```

Add any required provider credentials to `deploy/.env`, then start the full stack:

```bash
bash ./scripts/deploy.sh
```

The deployment script selects the CPU CAPE override on supported CPU-only hosts and includes CAPE in the stack. To start only the non-CAPE services directly:

```bash
docker compose --project-directory . --env-file deploy/.env -f deploy/compose.yml up --build
```

- **Frontend SPA:** http://localhost:3000
- **Backend API:** http://localhost:5001
- **PostgreSQL Database:** localhost:5433

To run the CAPE service on CPU explicitly, use `CAPE_MODE=cpu bash ./scripts/deploy.sh`. Use `CAPE_MODE=gpu` only when Docker has access to a configured NVIDIA GPU.

## Local Development

- **Web client:** `cd apps/web` and run `npm install` once, then `npm run dev`.
- **Platform API:** `cd services/platform-api` and run `npm install` once, then `npm run dev`. Configure local API variables in `services/platform-api/.env` when running outside Compose.
- **Club Android app:** `cd apps/mobile/club/android`; build with `.\gradlew.bat :app:assembleDebug` in PowerShell.
- **CAPE tests:** from `services/cape-api`, run `python -m pytest`.

The web and Android clients remain independent applications and communicate with backend services through their existing HTTP/API clients.

## Public Website

The public Home, Features, Pricing, About, Contact, and FAQ views use local React state without changing the host URL. Refreshing returns to Home; old public-page hashes are cleared on load. Sign-in callback parameters are handled separately. Signed-in pages offer Dark (forest-green and lime) and Soft (Azure-inspired white backgrounds, neutral grey panels, blue actions and a blue top bar with white icons). Theme preferences persist across reloads. Saved Pure and Soft Blue preferences migrate to Soft.

The shared palettes are in [dark-theme.css](apps/web/src/dark-theme.css) and [soft-theme.css](apps/web/src/soft-theme.css). Soft uses `#0078D4` primary actions with white labels and neutral dark text on white surfaces. Tailwind colours in [index.html](apps/web/index.html) reference these variables, preserving opacity modifiers and hover/focus states. Warning and error colours retain their meaning, with darker text in Soft mode for readability. Public marketing pages use deep-purple backgrounds and light-purple accents in either mode, independently of logged-in themes.

Logged-in pill tags retain distinct green, blue and teal colours through [tag-colors.css](apps/web/src/tag-colors.css), rather than inheriting one theme accent. Amber, red and purple categories retain their existing colours. Tag text uses darker variants in light themes.

The public layout and temporary Unsplash photo URLs are in [PublicSite.tsx](apps/web/src/components/home/PublicSite.tsx), with styles in [public-site.css](apps/web/src/components/home/public-site.css). Replace these photos and the temporary text-based logo with approved brand assets when available. Subscription prices and registration continue to use the existing [HomePage.tsx](apps/web/src/components/home/HomePage.tsx) flow.

## Social Sign-In

Google, Microsoft, and Apple OpenID Connect are integrated for sign-in and registration. Configure the provider client IDs and secrets in `deploy/.env`, including a strong `JWT_SECRET`.

Register these callback URLs in the provider consoles:

- Google: `http://localhost:3000/api/auth/google/callback`
- Microsoft: `http://localhost:3000/api/auth/microsoft/callback`
- Apple: `http://localhost:3000/api/auth/apple/callback`

Restart the stack with `bash ./scripts/deploy.sh`. Provider readiness is available at `http://localhost:5001/api/auth/providers`.

For detailed step-by-step setup guides and architectural sequence diagrams, see:

- [docs/social-sign-in-setup-guide.md](docs/social-sign-in-setup-guide.md)
- [docs/auth-and-registration-workflow.md](docs/auth-and-registration-workflow.md)
- [docs/ai-native-user-journey.md](docs/ai-native-user-journey.md)
