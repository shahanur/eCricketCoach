---
name: player-06-roadmap
description: "Implement the player's four-discipline roadmap, verified video baseline, progress comparison, goals, stage criteria and reassessment."
disable-model-invocation: true
---
Implement the player's personalized development roadmap.

Read [player instructions](../../instructions/player-mobile.instructions.md), [API instructions](../../instructions/player-api.instructions.md), and [delivery guide](../../../docs/features/individual-player/README.md). Prerequisite: 04 and agreed roadmap/progression contracts.

Follow the [approved player journey](../../../docs/features/individual-player/README.md#approved-player-journey) and [roadmap contract](../../../docs/features/individual-player/roadmap.md): an owned, completed, verified video baseline precedes strengths/gaps and the personal roadmap (main focus and small goals); self-practice precedes comparison with a later completed, verified video; eligible goal and then stage criteria precede a certificate and roadmap update. Re-review this full evidence sequence whenever baseline, analysis, goal/stage criteria, progression, or awards change.

- Cover batting, bowling, keeping and fielding, with a verified baseline, supported strengths/gaps, goals, current assessed stage, next recommended drills, completion evidence, reassessment and stage history.
- Reuse training content, assignment and progression models where their ownership semantics fit. Add self-player roadmap contracts in existing services where missing.
- Verified-video baseline and comparison APIs and approved discipline-specific assessment rubrics are not implemented. Gate baseline-derived strengths/gaps, assessed roadmap, progress comparison, goal/stage attainment, and certificates until supported contracts and criteria exist. Do not fake output or replace the missing system with human-coach approval.
- Existing Q&A-only AI paths may guide provisional practice only; they are not a verified baseline or personal assessed roadmap. Keep Q&A and practice clearly self-reported, preserve practice/history when evidence changes, and never promote from these records alone.
- Keep any future AI generation server-side, versioned and attributable; preserve roadmap revisions and completed evidence when goals or verified analysis change. Do not invent scores or thresholds.
- Integrate drill/session navigation and milestone eligibility for module 15, with clear unavailable/insufficient-evidence states.
- Keep progress authoritative on the server and private to the player. Avoid medical or injury-diagnosis claims.

Acceptance: each discipline can have a real personalized path, goals and recommendations persist, duplicate practice does not double-advance stages, invalid transitions are rejected and account ownership is enforced. Test recommendation inputs, version changes, reassessment and milestone boundaries.
