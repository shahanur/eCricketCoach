---
name: player-07-solo-practice
description: "Implement player self-practice, retain self-reported history, and connect only verified video evidence to assessed progress."
disable-model-invocation: true
---
Implement solo practice and self-guided technical drills.

Read [player instructions](../../instructions/player-mobile.instructions.md), [API instructions](../../instructions/player-api.instructions.md), and [delivery guide](../../../docs/features/individual-player/README.md). Prerequisite: 06, verified catalogue access and solo-practice persistence.

Follow the [approved player journey](../../../docs/features/individual-player/README.md#approved-player-journey) and [roadmap contract](../../../docs/features/individual-player/roadmap.md). Practice logs and Q&A remain self-reported: retain them as history and provisional practice context, but never treat them as a verified baseline, measured skill progress, or certificate evidence. Re-review this boundary whenever practice completion or progress summaries change.

- Reuse the shared drill/training-template catalogue through the central API client. Confirm individual-player read access rather than assuming coach/club routes are usable.
- Build discovery/filtering by discipline, level and relevant equipment; show instructions, demonstrations where licensed/available, duration/repetitions, safety guidance and roadmap relevance.
- Support start/pause/resume/complete/abandon of a solo session, drill checklist/timer, notes, self-reported outcomes and supported evidence/video attachment. Clearly separate self-reported completion from verified skill achievement.
- Persist owner-scoped sessions and drill outcomes in existing services with idempotent completion. Update roadmap/dashboard through agreed rules, never client-only promotion.
- Handle interruptions and offline drafts safely; synchronize only approved mutations with visible pending/failed state. Do not consume AI allowance merely for practising or attaching an unanalysed local clip.
- Include safe defaults and accessible controls; avoid prescriptive medical advice or unsafe workloads.

Acceptance: a player can complete a real solo session and review it later, retries cannot duplicate outcomes, interrupted practice resumes, unauthorized catalogue mutations are denied, and progress changes match the agreed evidence rules. Test timers/lifecycle, persistence, offline reconciliation and owner isolation.
