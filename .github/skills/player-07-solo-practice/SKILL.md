---
name: player-07-solo-practice
description: "Implement self-guided drills, solo practice sessions and evidence-based progress logging."
disable-model-invocation: true
---
Implement solo practice and self-guided technical drills.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md). Prerequisite: 06, verified catalogue access and solo-practice persistence.

- Reuse the shared drill/training-template catalogue through the central API client. Confirm individual-player read access rather than assuming coach/club routes are usable.
- Build discovery/filtering by discipline, level and relevant equipment; show instructions, demonstrations where licensed/available, duration/repetitions, safety guidance and roadmap relevance.
- Support start/pause/resume/complete/abandon of a solo session, drill checklist/timer, notes, self-reported outcomes and supported evidence/video attachment. Clearly separate self-reported completion from verified skill achievement.
- Persist owner-scoped sessions and drill outcomes in existing services with idempotent completion. Update roadmap/dashboard through agreed rules, never client-only promotion.
- Handle interruptions and offline drafts safely; synchronize only approved mutations with visible pending/failed state. Do not consume AI allowance merely for practising or attaching an unanalysed local clip.
- Include safe defaults and accessible controls; avoid prescriptive medical advice or unsafe workloads.

Acceptance: a player can complete a real solo session and review it later, retries cannot duplicate outcomes, interrupted practice resumes, unauthorized catalogue mutations are denied, and progress changes match the agreed evidence rules. Test timers/lifecycle, persistence, offline reconciliation and owner isolation.
