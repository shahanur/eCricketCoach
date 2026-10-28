---
name: player-10-analysis-upload
description: "Implement owner-safe device uploads, analysis job lifecycle, progress and quota-aware retries."
agent: agent
---
Implement video upload and asynchronous AI analysis.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), [delivery guide](../../docs/features/individual-player/README.md), and relevant [video API documentation](../../docs/video-analysis-api.md). Prerequisites: 03, 04, 08 and agreed owner-safe analysis contracts.

- Accept a captured draft or explicitly selected existing clip. Validate supported type/codec/size/duration against server limits; the current general upload route has a 500 MB limit, which is not permission to assume every engine accepts every file.
- Use the central client with typed upload/analysis DTOs, cancellation, progress and explicit server errors. Keep analysis/AI keys server-side; do not call AI vendors directly.
- Resolve the correct general/CAPE/OpenAI service path from verified capability contracts. Existing club-only routes do not permit `PLAYER`: add a least-privileged owner-safe adapter/extension, never spoof a coach role.
- Implement the server's real lifecycle, such as uploading/queued/processing/succeeded/failed/cancelled, with resumable polling or supported events, bounded retries, app-resume recovery and durable history.
- Share atomic five-upload entitlement accounting across device and Drive submissions. Use server idempotency and job IDs; avoid duplicate analysis/charges on timeouts. Distinguish upload retry from a new analysis request.
- Require authenticated ownership for the player's paid path. Do not silently use the legacy anonymous analysis branch to bypass approval/quota or lose history.
- Implement resumable/background transfer only where supported and verified; otherwise show a truthful paused/retry state. Clean up app-owned temporary files with retention limits.

Acceptance: a real approved player submits media, sees progress, receives/persists results and can reopen after interruption. Test fifth/sixth submission, concurrent attempts, malformed media, network timeout, cancellation, process restart, expired token, cross-owner job IDs and regression of existing club/general clients.
