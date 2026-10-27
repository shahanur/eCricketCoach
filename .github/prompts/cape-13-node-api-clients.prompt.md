---
agent: agent
description: CAPE 13/13 – job API, result screen and image downloads in web and mobile
---

Follow `.github/instructions/cape-api.instructions.md` (architecture + token rules). Also follow `.github/copilot-instructions.md` for `services/platform-api`.

Requires task 12. Spec: §11.1, §11.2 and §11.7 (read only those). Read only `services/platform-api/src/routes/assessments.ts` (video routes), the `CapeJob` model, `src/queues/capeQueue.ts`, the assessment video UI in `apps/web`, and `apps/mobile/android/.../AssessmentVideoCard.kt` + `CoachApi.kt`.

**Server.** Every route uses `authenticateToken` + `requireRole('CLUB_ADMIN','COACH')` + the existing `canAccessAssessment` (players may read only their own jobs) and is scoped by `tenantId`:
- `POST /api/club/assessments/:id/video` gets `engine: 'gemini' | 'cape'` (default `gemini`, unchanged behaviour). For `cape` it takes the §11.1 fields, validates them with the same enums, creates a `CapeJob` and enqueues it, returning `202 { jobId, status }`.
- `GET /api/club/cape-jobs/:jobId` returns the status, the queue position when queued, and the result. 404 if the job is in another tenant.
- `GET /api/club/cape-jobs/:jobId/artifacts/:name` streams one image from Drive as an attachment named `<player>_<yyyy-mm-dd>_<name>.jpg`. `GET .../artifacts/all.zip` streams a ZIP via `archiver`. Never expose the CAPE URL.
- Return 503 `cape_unavailable` when `CAPE_API_URL` is unset. Map CAPE error codes (`no_contact_detected`, `no_pitching_point_detected`) to friendly messages that say how to re-film.

**Web client** (local state, same-origin `/api`, all three themes):
- Input step: target, handedness, and `shot_type` or `bowler_type` (conditional), plus a 4-tap crease-corner picker on the first video frame.
- Progress state: poll every 3 s with backoff. The user can leave and come back via the assessment.
- Result screen per §11.2:
  - Verdict card with the score.
  - Pose table with green/amber/red against the expected range.
  - Bowling: speed (± tolerance), length and line badges, and a good-ball tick.
  - Fault cards (severity, measured vs expected, recommendation, drill), strengths, and the optional AI summary.
  - Image gallery with per-image download and a "Download all (ZIP)" button.

**Mobile** (`AssessmentVideoCard.kt` + a new `CapeResultPanel.kt`):
- The same steps, with a calibration tap overlay.
- Polling in a coroutine cancelled on dispose.
- Result panel matching the web.
- Downloads saved via `MediaStore` (Pictures/eCricketCoach and Downloads for the ZIP), with a share action.
- Add the `CoachApi` methods.

Verify with `npx tsc --noEmit -p .` in `services/platform-api` and `apps/web`, plus `cd apps/mobile/android; .\gradlew.bat :app:compileDebugKotlin --no-daemon -q`. Don't run test suites.
