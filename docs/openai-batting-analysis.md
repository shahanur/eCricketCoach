# OpenAI batting video analysis

The authenticated `POST /api/videos/analyze/openai-batting` endpoint analyzes an uploaded video or a Google Drive video. It uses the configurable `OPENAI_VIDEO_ANALYSIS_MODEL` (default `gpt-6.1-sol`) and requires the server-side `OPENAI_API_KEY`. The client never receives or stores the key.

## Pipeline and limits

- The OpenAI route accepts coach-provided shot type, handedness, camera view, playback speed, optional capture FPS, and priorities. Unknown values are explicit and are not inferred.
- The pipeline makes one OpenAI Responses request. FFprobe maps frame samples to original presentation timestamps; the default automatic mode sends up to 36 full-clip samples at up to 4 fps. The detailed response identifies likely contact and assesses one stroke.
- Automatic mode does not run a second dense contact pass or additional candidate-shot passes. Since samples are sparse, exact impact may be marked uncertain or not visible rather than interpolated.
- When the coach supplies a contact timestamp, CAPE’s bounded contact-window settings control local decoding of every original PTS frame (0.5 seconds per side by default, maximum 2 seconds / 120 frames). Over-limit windows fail explicitly instead of silently dropping frames.
- Structured output is capped at 8,000 tokens with one retry at 16,000 only when the API reports `max_output_tokens`. Refusals and content-filter interruptions are not retried. `OPENAI_REASONING_EFFORT` defaults to `low` and can be raised if quality needs more reasoning.
- Automatic full-clip samples use low image detail. In manual dense-window mode, only frames within 0.05 seconds of the selected contact use high detail; other supplied frames remain in the request at low detail.
- Coordinates and joint angles are projected 2D visual estimates. The application calculates interior image-plane angles from pixel-scaled landmark coordinates; these are not clinical or 3D angles. Physical speed, forces, torque, and ground reaction force are not measured.
- PNG visuals are rendered from original-resolution, orientation-corrected source frames. Contact review brackets uncertain impact. Phase-specific joint montages, bat shaft positions, annotations, crop transforms, source frame references, and output checksums are recorded. Bat positions are not connected into a measured trajectory. Unsupported visuals are omitted and explained in `report.md`.

## Configuration

All limits are optional server environment variables; invalid values fall back to safe defaults:

| Variable | Default | Bounded range |
|---|---:|---:|
| `OPENAI_VIDEO_ANALYSIS_MODEL` | `gpt-6.1-sol` | Configured model ID; no silent substitution |
| `OPENAI_REASONING_EFFORT` | `low` | `low`, `medium`, or `high` |
| `OPENAI_MAX_VIDEO_SIZE_MB` | `500` | 1–2048 MB |
| `OPENAI_MAX_VIDEO_DURATION_SECONDS` | `180` | 1–600 seconds |
| `OPENAI_OVERVIEW_FPS` | `4` | 0.5–10 fps |
| `OPENAI_MAX_OVERVIEW_FRAMES` | `36` | 4–120 frames |
| `OPENAI_CONTACT_CONTEXT_SECONDS` | `0.5` | 0.1–1.5 seconds per side |
| `OPENAI_MAX_CONTACT_WINDOW_SECONDS` | `2` | 0.5–5 seconds |
| `OPENAI_MAX_CONTACT_WINDOW_FRAMES` | `120` | 1–800 original frames in manual-contact mode |
| `OPENAI_REQUEST_TIMEOUT_MS` | `240000` | 30,000–600,000 ms per Responses request; SDK retries disabled |
| `OPENAI_REPORTS_DIR` | Compose: `/var/openai-reports` | Persistent server-only volume |

## Versioned model assets

The shared instructions, task prompts, and strict schemas live in `web-app/server/src/services/openai_inputs/`. They are included in the production server image. Schema validation is followed by application-level checks for source-frame references, normalized coordinates, contact-window bounds, shot metadata, and footage quality.

## Persistence and downloads

Report metadata and the image-free analysis record are stored in `openai_batting_reports`, scoped to the authenticated tenant. Artifacts are persisted under `OPENAI_REPORTS_DIR` (Compose defaults to `/var/openai-reports`, backed by the `openai-report-artifacts` volume). Downloads are served by the authenticated, tenant-scoped route:

`GET /api/videos/analyze/openai-batting/:reportId/artifacts/:name`

Supported artifact names are allowlisted. The ZIP contains generated report files; original uploaded video bytes are not persisted by this report pipeline.

Coaches can retrieve or revise their tenant's review record through:

- `GET /api/videos/analyze/openai-batting/:reportId/review`
- `PATCH /api/videos/analyze/openai-batting/:reportId/review`

The patch accepts an overall coach note (up to 3000 characters) and finding dispositions/notes (up to 30 findings, 1000 characters per note). It refreshes `analysis.json`, `report.md`, checksums, and the ZIP. Review notes do not alter model-generated evidence or silently recalculate landmarks.

## Local verification

From `web-app/server`, run `npx prisma generate`, `npm run build`, and `npm exec -- tsx --test src/services/openAiBattingAnalysisService.test.ts src/services/openAiBattingReportArtifacts.test.ts src/services/openAiBattingVisuals.test.ts`. From `web-app/client`, run `npm run build`. A live model/video request is not required for these checks and may incur API charges.
