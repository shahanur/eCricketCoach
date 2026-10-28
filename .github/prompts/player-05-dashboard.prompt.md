---
name: player-05-dashboard
description: "Implement the self-player performance dashboard with real progress, practice, analysis and entitlement data."
agent: agent
---
Implement the individual player's Home/performance dashboard.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md). Prerequisites: 03-04 and verified dashboard contracts.

- Show self profile, current goals/stages across batting, bowling, keeping and fielding, next practice/roadmap action, recent analysis, practice progress, milestone/certificate highlights and monthly AI allowance/reset.
- Provide clear navigation to record/upload/analyze, practice, roadmap, history and profile. Unimplemented modules must be honestly unavailable, not populated with example achievements.
- Use an owner-safe aggregate contract or compose verified existing calls through typed feature services. Agree metric definitions, timeframe, units and missing-data behavior before rendering trends.
- Distinguish first-time/no-data, partial availability, stale offline cache, failed sections, pending approval and expired entitlement. Do not turn API failures into zeros or completed progress.
- Add accessible charts with textual equivalents, pull-to-refresh, cancellation on navigation and bounded fetching/cache invalidation.

Acceptance: dashboard reflects actual self-owned data and quota, first-time players have an actionable empty state, metrics match fixtures/contract definitions, failed sections remain explicit, and no club-wide or other-player information appears. Test navigation, state handling and account-switch cache isolation.
