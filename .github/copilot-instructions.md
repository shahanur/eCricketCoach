# eCricketCoach Project Instructions

## Tech Stack
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, and Lucide React. Do not add React Router or TanStack Query unless requested.
- Backend: Node.js, Express 4, TypeScript, Prisma ORM, PostgreSQL.
- AI/Cloud: Google Gemini Multimodal API (`GEMINI_API_KEY`), Google Drive API.
- Infrastructure: Docker Compose runs PostgreSQL (host port 5433), Redis (6379), the Express API (5001), and an Nginx-served client (3000). Redis is provisioned but is not currently used by a queue worker.

## Architectural Guidelines
1. **Client state and API calls:** Use local React state. Persist the JWT and theme preference in `localStorage`, following the existing client pattern. Make API requests through the same-origin `/api` path.
2. **Database:** Use the Prisma models backed by PostgreSQL for application data. Do not treat the separate schema in `server/src/config/init.sql` as the active Prisma data model.
3. **Express authorization and tenant isolation:** Protect new endpoints with `authenticateToken` and, where appropriate, `requireRole` using the existing roles (`SUPER_ADMIN`, `CLUB_ADMIN`, `COACH`, and `PLAYER`). Scope database reads and writes to the authenticated tenant where applicable; role checks alone do not enforce tenant isolation.
4. **Video uploads:** Follow the existing in-memory multipart upload pattern and its 500 MB per-file limit. Account for the memory cost when changing upload handling.
5. **Deterministic and AI features:** Keep post-session reviews deterministic and keyword-based. Use Gemini for video-analysis workflows.
6. **Design and UI:** Preserve the dark, light, and pure-light themes implemented with Tailwind CSS.