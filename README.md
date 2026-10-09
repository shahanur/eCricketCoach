# eCricketCoach

Multi-device web application and platform for cricket coaching, player skill progression, and AI biomechanical video analysis.

## Repository Structure

```
eCricketCoach/
├── docs/
│   └── requirements.md            # Detailed Software Requirements Specification (SRS)
├── mobile-app/
│   ├── app/                       # Kotlin + Jetpack Compose Android application
│   ├── gradlew.bat                # Reproducible Android build entry point
│   └── README.md                  # Android setup, OAuth, and feature scope
└── web-app/
    ├── docker-compose.yml         # Container orchestration (PostgreSQL, Redis, Node API, React SPA)
    ├── client/                    # React SPA Frontend (Vite + Tailwind CSS)
    │   ├── src/
    │   │   ├── App.tsx            # Responsive web UI for coaching, drills & AI analysis
    │   │   └── main.tsx
    │   ├── package.json
    │   └── Dockerfile
    └── server/                    # Node.js + Express Containerized REST API
        ├── src/
        │   ├── config/init.sql    # Multi-tenant PostgreSQL relational schema
        │   ├── services/          # AI video analysis & drill recommendation service
        │   └── index.ts           # REST API entrypoint
        ├── package.json
        └── Dockerfile
```

## Quick Start (Local Docker Orchestration)

From the `web-app` directory:

```bash
cd web-app
docker compose up --build
```

- **Frontend SPA:** http://localhost:3000
- **Backend API:** http://localhost:5001
- **PostgreSQL Database:** localhost:5433

## Public Website

The public Home, Features, Pricing, About, Contact, and FAQ views use local React state without changing the host URL. Refreshing returns to Home; old public-page hashes are cleared on load. Sign-in callback parameters are handled separately. Signed-in pages offer Dark (forest-green and lime) and Soft (Azure-inspired white backgrounds, neutral grey panels, blue actions and a blue top bar with white icons). Theme preferences persist across reloads. Saved Pure and Soft Blue preferences migrate to Soft.

The shared palettes are in [dark-theme.css](web-app/client/src/dark-theme.css) and [soft-theme.css](web-app/client/src/soft-theme.css). Soft uses `#0078D4` primary actions with white labels and neutral dark text on white surfaces. Tailwind colours in [index.html](web-app/client/index.html) reference these variables, preserving opacity modifiers and hover/focus states. Warning and error colours retain their meaning, with darker text in Soft mode for readability. Public marketing pages use deep-purple backgrounds and light-purple accents in either mode, independently of logged-in themes.

Logged-in pill tags retain distinct green, blue and teal colours through [tag-colors.css](web-app/client/src/tag-colors.css), rather than inheriting one theme accent. Amber, red and purple categories retain their existing colours. Tag text uses darker variants in light themes.

The public layout and temporary Unsplash photo URLs are in [PublicSite.tsx](web-app/client/src/components/home/PublicSite.tsx), with styles in [public-site.css](web-app/client/src/components/home/public-site.css). Replace these photos and the temporary text-based logo with approved brand assets when available. Subscription prices and registration continue to use the existing [HomePage.tsx](web-app/client/src/components/home/HomePage.tsx) flow.

## Social Sign-In

Google, Microsoft, and Apple OpenID Connect are integrated for sign-in and registration. Copy `web-app/server/.env.example` to `web-app/.env`, set a strong `JWT_SECRET`, and add the client ID and secret from each provider you enable.

Register these callback URLs in the provider consoles:

- Google: `http://localhost:3000/api/auth/google/callback`
- Microsoft: `http://localhost:3000/api/auth/microsoft/callback`
- Apple: `http://localhost:3000/api/auth/apple/callback`

Restart the stack with `docker compose up --build -d` from `web-app`. Provider readiness is available at `http://localhost:5001/api/auth/providers`.

For detailed step-by-step setup guides and architectural sequence diagrams, see:
- [docs/social-sign-in-setup-guide.md](docs/social-sign-in-setup-guide.md)
- [docs/auth-and-registration-workflow.md](docs/auth-and-registration-workflow.md)
- [docs/ai-native-user-journey.md](docs/ai-native-user-journey.md)
