---
name: player-06-roadmap
description: "Implement personalized four-discipline roadmaps, goals, skill stages and reassessment."
disable-model-invocation: true
---
Implement the player's personalized development roadmap.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md). Prerequisite: 04 and agreed roadmap/progression contracts.

- Cover batting, bowling, keeping and fielding, with baseline, goals, current stage, next recommended drills, completion evidence, reassessment and stage history.
- Reuse training content, assignment and progression models where their ownership semantics fit. Add self-player roadmap contracts in existing services where missing.
- Agree how baseline assessment, available analysis, player preferences and practice evidence generate recommendations. Keep AI generation server-side, versioned and attributable; do not label static fallback drills as personalized AI.
- Preserve roadmap revisions and completed evidence when goals change or analysis arrives. Define stage thresholds, prerequisites, manual review and correction rules with the user rather than inventing scores.
- Integrate drill/session navigation and milestone eligibility for module 15, with clear unavailable/insufficient-evidence states.
- Keep progress authoritative on the server and private to the player. Avoid medical or injury-diagnosis claims.

Acceptance: each discipline can have a real personalized path, goals and recommendations persist, duplicate practice does not double-advance stages, invalid transitions are rejected and account ownership is enforced. Test recommendation inputs, version changes, reassessment and milestone boundaries.
