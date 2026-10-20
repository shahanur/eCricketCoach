# OpenAI batting video analysis

The authenticated `POST /api/videos/analyze/openai-batting` endpoint analyzes an uploaded video or a Google Drive video. It uses the configurable `OPENAI_VIDEO_ANALYSIS_MODEL` (default `gpt-6.1-sol`) and requires the server-side `OPENAI_API_KEY`. The client never receives or stores the key.

## Pipeline and limits

- Inputs use the existing 500 MB upload limit and are rejected when longer than 180 seconds.
- FFprobe timestamps are used to map sampled frames back to source presentation timestamps. The overview samples at up to 4 fps, bounded to 36 images.
- Up to three distinct overview stroke candidates are retained. The primary candidate and up to two additional candidates get a dense contact-window pass.
- Contact windows are approximately 0.7 seconds and bounded to 36 frames each. The current pipeline sends sampled images, not a guarantee that every encoded frame is analyzed for high-frame-rate or variable-frame-rate video.
- Coordinates and joint angles are projected 2D visual estimates. The application calculates interior image-plane angles from pixel-scaled landmark coordinates; these are not clinical or 3D angles. Physical speed, forces, torque, and ground reaction force are not measured.
- PNG visuals are rendered from source frames. Bat orientation is emitted only when both endpoints are available and is explicitly not a tracked trajectory. Unsupported visuals are omitted and explained in `report.md`.

## Versioned model assets

The shared instructions, task prompts, and strict schemas live in `web-app/server/src/services/openai_inputs/`. They are included in the production server image. Schema validation is followed by application-level checks for source-frame references, normalized coordinates, contact-window bounds, shot metadata, and footage quality.

## Persistence and downloads

Report metadata and the image-free analysis record are stored in `openai_batting_reports`, scoped to the authenticated tenant. Artifacts are persisted under `OPENAI_REPORTS_DIR` (Compose defaults to `/var/openai-reports`, backed by the `openai-report-artifacts` volume). Downloads are served by the authenticated, tenant-scoped route:

`GET /api/videos/analyze/openai-batting/:reportId/artifacts/:name`

Supported artifact names are allowlisted. The ZIP contains generated report files; original uploaded video bytes are not persisted by this report pipeline.

## Local verification

From `web-app/server`, run `npx prisma generate`, `npm run build`, and `npm exec -- tsx --test src/services/openAiBattingAnalysisService.test.ts src/services/openAiBattingReportArtifacts.test.ts`. From `web-app/client`, run `npm run build`. A live model/video request is not required for these checks and may incur API charges.
