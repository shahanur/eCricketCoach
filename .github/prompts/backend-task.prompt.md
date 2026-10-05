Act as a senior backend engineer.

Using Node.js, Express 4, TypeScript, and Prisma ORM, implement [FEATURE_NAME].

Requirements:
- Protect new endpoints with the existing JWT authentication middleware and apply role-based authorization where appropriate. Use only the existing roles: `SUPER_ADMIN`, `CLUB_ADMIN`, `COACH`, and `PLAYER`.
- Enforce tenant isolation by scoping reads and writes to the authenticated user's tenant where applicable; role checks alone do not provide tenant isolation.
- Use the existing Prisma models and schema. Do not treat the separate `server/src/config/init.sql` schema as the active Prisma data model.
- Return appropriate HTTP status codes and consistently structured JSON errors, following existing project patterns.
- Keep calls to external services, including Gemini and Google Drive, in service modules.
- Follow existing project conventions and avoid unrelated changes or new dependencies unless required by the feature.