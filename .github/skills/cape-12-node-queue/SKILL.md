---
name: cape-12-node-queue
description: "CAPE 12/13 – BullMQ job queue and CAPE client in the Node server"
disable-model-invocation: true
---
Follow `.github/instructions/cape-api.instructions.md` (architecture + token rules). Also follow `.github/copilot-instructions.md` for `services/platform-api`.

Read only: `services/platform-api/src/index.ts`, `services/platform-api/prisma/schema.prisma` (the video-analysis and assessment models), `deploy/compose.yml`, and the signatures in `services/platform-api/src/services/googleDrive.ts`. `REDIS_URL` is already set for `server` in compose.

1. `npm i bullmq archiver` in `services/platform-api` (ioredis comes with bullmq).
2. Prisma: add `CapeJob` with:
   - `id` (uuid), `tenantId`, `createdById`, optional `playerId`, optional `assessmentId`, optional `driveFileId`.
   - `request Json` (the §11.1 inputs).
   - `status` (QUEUED|RUNNING|SUCCEEDED|FAILED), optional `error`, `result Json?`, `artifacts Json?` (`{ name: driveFileId }`), `attempts`, timestamps.
   - Indexes on `(tenantId, createdAt)`.
   Create a migration.
3. `src/services/capeClient.ts`:
   - `analyzeWithCape(videoPath, request)`: a streamed multipart POST to `${CAPE_API_URL}/api/v1/analyze-cricket-video` with `X-API-Key`. Use `AbortSignal.timeout(CAPE_TIMEOUT_MS ?? 600000)`. Map 4xx to a non-retryable error carrying CAPE's error code, and 5xx/network errors to retryable.
   - `downloadCapeArtifact(sessionId, name, destPath)`.
4. `src/queues/capeQueue.ts`: queue `cape-analysis`. The job data carries `{ capeJobId }` only; never put video bytes in Redis. Use `attempts: 3`, exponential backoff and `removeOnComplete`.
5. `src/workers/capeWorker.ts`:
   - Run with `concurrency = CAPE_CONCURRENCY ?? 1`.
   - Load the job and resolve the video to a temp file under `os.tmpdir()/cape/<jobId>`, from the Drive file (stream to disk) or the upload temp path.
   - Call CAPE, then download every artifact before CAPE's TTL expires and upload them to the user's Drive folder next to the video. Store the Drive IDs in `artifacts`. Store the payload in `result`, with download URLs rewritten to the Node routes from task 13.
   - If `CAPE_GEMINI_SUMMARY=true`, add `coaching.summary` from Gemini (via the existing Gemini service). The prompt gets only the metrics and faults and must not add faults or numbers; on failure, skip it silently.
   - Always delete the temp files. Use `UnrecoverableError` for 4xx.
6. Start the worker from `src/index.ts` when `CAPE_WORKER_ENABLED=true`, with graceful shutdown on SIGTERM. Also add a `worker` npm script (`node dist/workers/capeWorker.js`) so it can run as a separate container.
7. Compose: add a `cape-api` service (build `../cape-api`, GPU reservation, `profiles: [cape]`, no published port) and a `cape-worker` service (same image as `server`, `command: npm run worker`, `profiles: [cape]`). Add the env vars to `server/.env.example`.

Uploads: keep the existing in-memory 500 MB multer limit, but write the buffer to the temp file before enqueueing so the request memory is released. Note the memory cost in a comment.
Verify with `cd services/platform-api; npx prisma validate; npx tsc --noEmit -p .` only.
