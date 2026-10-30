---
name: player-00-contract-audit
description: "Establish verified shared-service contracts, the player journey, video baseline and progress blockers for the separate individual-player app."
disable-model-invocation: true
---
Prepare the contract baseline for the individual-player app; do not scaffold the app yet.

Read [player instructions](../../instructions/player-mobile.instructions.md), [API instructions](../../instructions/player-api.instructions.md), and [delivery guide](../../../docs/features/individual-player/README.md).

Use the [approved player journey](../../../docs/features/individual-player/README.md#approved-player-journey) and [roadmap contract](../../../docs/features/individual-player/roadmap.md) as the canonical flow. Audit registration/individual plan/admin approval/login/dashboard -> profile -> verified completed owned-video baseline -> strengths/gaps -> personal roadmap/main focus/small goals -> self-practice -> later-video comparison -> goal and stage criteria -> eligible certificate -> updated roadmap. Record that verified baseline, comparison APIs, and assessment rubrics are not implemented; Q&A-only recommendations are provisional practice, not verified baseline or a personal assessed roadmap. Preserve self-reported practice/history and do not invent outcomes or add a human-coach dependency.

1. Reinspect existing auth, subscriptions, admin approval, middleware, Prisma models, training, AI, Drive, progression and certificate routes in the platform API and their existing clients. Distinguish implemented, incompatible, missing and proposed capabilities.
2. Trace the individual journey end to end, including verified identity -> individual-plan registration/checkout -> pending approval -> active tenant -> `PLAYER` login/dashboard -> durable self profile. Capture identity IDs and ownership semantics at each boundary.
3. Inventory each module's method/path, request/response DTOs, error shape, authentication, role, owner/tenant check, status lifecycle and pagination. Never label proposed endpoints as existing.
4. Resolve or explicitly gate currency inconsistency, real payment/store compliance, pending-status access, iOS callbacks, self-profile provisioning, five-upload accounting and individual access to currently club-only reports.
5. Define proposed backward-compatible APIs for missing capabilities in existing microservices. Specify data migrations, validation, idempotency, privacy and focused club/web regressions. Do not create a replacement player backend.
6. Update the delivery guide with a concise verified contract matrix and decision log. Ask for decisions that materially affect the contract instead of inventing prices, entitlements, consent rules or algorithms.

Acceptance: every required plan feature and reference feature maps to a verified reusable contract, a clearly proposed extension, or a named blocker. No app implementation, no speculative claim of backend readiness, and no unrelated server edits.
