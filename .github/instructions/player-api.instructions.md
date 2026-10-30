---
description: "Use when adding or adapting shared backend API contracts for the individual-player mobile persona, including ownership, approval provisioning, quota, billing, roadmaps, certificates, and player data."
---
# Shared APIs for the player persona

- Read [the player delivery guide](../../docs/features/individual-player/README.md) and the existing authentication middleware, routes, service logic, and Prisma models before proposing a contract.
- Keep shared contracts aligned with the [approved player journey](../../docs/features/individual-player/README.md#approved-player-journey) and [roadmap contract](../../docs/features/individual-player/roadmap.md): individual registration and admin approval -> player login/dashboard -> self profile -> verified completed owned-video baseline -> strengths/gaps -> personal roadmap with main focus and small goals -> self-practice -> later-video comparison -> goal and stage criteria -> eligible certificate -> updated roadmap.
- Keep server changes inside the existing responsible microservice. Do not create a second backend for the player app, or add server handlers inside `apps/mobile/player`.
- Extend existing models/services where their semantics fit; do not copy club handlers into an unguarded player route. Explicitly document any new route or response as proposed until implemented and tested.
- Verify individual checkout/approval creates an appropriate self identity and usable role without granting club-management privileges. Preserve club/academy provisioning and all existing clients.
- Derive user, tenant, role, approval, and entitlement from trusted server state. Scope every read, write, media URL, analysis job, drill assignment, practice log, and certificate to the authenticated owner. Never authorize from a client-supplied player ID alone.
- Enforce one active self player profile and server-side monthly AI allowance. Specify atomic reservation, concurrent submissions, idempotency, billing-period boundaries, failed/retried/cancelled analyses, and refund/release rules before implementing counters.
- Validate real provider/store purchases and signed webhook events before granting paid access. Do not accept client `paid` flags, raw card details, or the legacy checkout's simulated paid invoice as payment proof.
- Use signed, expiring media access and server-held provider credentials. Validate OAuth state and callback allowlists. Do not expose Drive refresh tokens or accept arbitrary remote video URLs.
- Preserve shared registration/approval behavior while adding player-safe status queries. Pending applicants must not gain full tenant access merely to check approval.
- Verified-video baseline, baseline comparison, and discipline-specific assessment rubrics are not implemented. Gate contracts and dependent outcomes until implemented and tested; do not return fabricated strengths, gaps, progress, goal/stage attainment, or certificates, and do not introduce a human-coach dependency as a workaround. Existing Q&A-only recommendations are provisional practice guidance, never a verified baseline or personal assessed roadmap. Preserve self-reported practice/history as such.
- Re-review this journey and its ownership/evidence rules whenever changing auth/approval, profile, analysis, roadmap, practice/history, goal or stage criteria, or certificate contracts.
- Missing player APIs need schema validation, explicit errors, ownership tests, backward-compatible migrations where needed, and documented DTOs. Never disguise an unavailable API with successful mock data.
- In changes to shared services, run both new player tests and focused regression tests for existing club/academy consumers. Record any intentionally changed anonymous analysis behavior and test it separately.
