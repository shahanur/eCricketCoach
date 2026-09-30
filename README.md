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
- **PostgreSQL Database:** localhost:5432
