---
name: player-00-contract-audit
description: "Establish verified shared-service contracts and implementation blockers for the separate individual-player app."
agent: agent
---
Prepare the contract baseline for the individual-player app; do not scaffold the app yet.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md).

1. Reinspect existing auth, subscriptions, admin approval, middleware, Prisma models, training, AI, Drive, progression and certificate routes in the platform API and their existing clients. Distinguish implemented, incompatible, missing and proposed capabilities.
2. Trace the individual journey end to end: verified identity -> registration token -> `INDIVIDUAL` checkout -> pending approval -> active tenant -> `PLAYER` login -> durable self profile. Capture identity IDs and ownership semantics at each boundary.
3. Inventory each module's method/path, request/response DTOs, error shape, authentication, role, owner/tenant check, status lifecycle and pagination. Never label proposed endpoints as existing.
4. Resolve or explicitly gate currency inconsistency, real payment/store compliance, pending-status access, iOS callbacks, self-profile provisioning, five-upload accounting and individual access to currently club-only reports.
5. Define proposed backward-compatible APIs for missing capabilities in existing microservices. Specify data migrations, validation, idempotency, privacy and focused club/web regressions. Do not create a replacement player backend.
6. Update the delivery guide with a concise verified contract matrix and decision log. Ask for decisions that materially affect the contract instead of inventing prices, entitlements, consent rules or algorithms.

Acceptance: every required plan feature and reference feature maps to a verified reusable contract, a clearly proposed extension, or a named blocker. No app implementation, no speculative claim of backend readiness, and no unrelated server edits.
