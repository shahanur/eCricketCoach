Act as a DevOps engineer.

Create or update `web-app/docker-compose.yml` for local development with these services:
- `postgres`: PostgreSQL 16, published on host port 5433.
- `redis`: Redis 7, published on host port 6379. It is provisioned locally but is not currently used by a queue worker.
- `server`: Express API, published on host port 5001 and dependent on `postgres` and `redis`.
- `client`: Build the Vite client and serve it through Nginx, published on host port 3000.

Configure the environment variables required by the existing application, including `JWT_SECRET`, `GEMINI_API_KEY`, and OAuth credentials. Use clearly marked development-only defaults for local use; do not include real credentials or present these defaults as production-safe. Ensure the stack can be started with `docker compose up --build` from `web-app/`.