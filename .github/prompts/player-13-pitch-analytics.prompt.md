---
name: player-13-pitch-analytics
description: "Implement validated delivery analytics, pitch maps, units and session-level distributions."
agent: agent
---
Implement advanced session/delivery analytics only for supported backend outputs.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md). Prerequisites: 09, 10 and validated calibration/metric contracts.

- Support standard/wide pitch visualization, stump reference, delivery landing locations, trajectory/heatmap/distributions and session/delivery drill-down where actual results provide them.
- Specify coordinate system, pitch dimensions, camera transform, calibration quality, handedness/orientation and units. Do not plot image pixels as physical pitch positions.
- Show speed in km/h and maximum/average only from valid measurements, with sample count and quality. Add spin, swing, distance, shot distribution or quality metrics only when engine contracts substantiate them.
- Mark inferred/unsupported outputs unavailable. Do not estimate physical speed from nominal frame rate or invent spin/swing algorithms in the UI.
- Provide filters scoped to this player's sessions and accessible textual/table equivalents for charts. Handle sparse/out-of-bounds detections and mixed metric versions.

Acceptance: known coordinate fixtures map to expected positions, aggregate values match documented formulas, units/quality are explicit, and no invalid calibration yields confident physical metrics. Add focused transformation/aggregation and UI tests; document blocked metrics without substituting fake data.
