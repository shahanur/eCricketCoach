# eCricketCoach

Multi-device web application and platform for cricket coaching, player skill progression, and AI biomechanical video analysis.

## Repository Structure

```
eCricketCoach/
├── docs/
│   └── requirements.md            # Detailed Software Requirements Specification (SRS)
├── mobile-app/
│   └── README.md                  # Placeholder for future native mobile applications
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

The public Home, Features, Pricing, About, Contact, and FAQ views use hash navigation (`#home`, `#features`, `#pricing`, `#about-us`, `#contact-us`, and `#faqs`). The forest-green and lime design is scoped to the public website; signed-in portals retain their existing theme settings.

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
