---
name: player-12-biomechanics
description: "Implement supported biomechanical video feedback, posture/balance scorecards and analysis-to-practice actions."
disable-model-invocation: true
---
Implement biomechanical analysis results and kinematic scorecards.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), [delivery guide](../../docs/features/individual-player/README.md), and relevant [kinematics requirements](../../docs/kinematics-requirement.md). Prerequisite: 10 and verified analysis schemas.

- Inspect actual supported engine outputs per discipline. Display batting/bowling/keeping/fielding analysis only where supported; explicitly gate missing engine capabilities rather than fabricate four-discipline video feedback.
- Present summary, pose/phase/key-frame evidence, posture and balance metrics, units, technical observations, confidence/quality limitations and prioritized recommendations from versioned backend data.
- Synchronize supported overlays/keyframes with playback using the backend coordinate/time reference. Handle missing joints, insufficient frames, low-quality footage and unsupported camera angles.
- Agree score scales/formulas/provenance before building scorecards; never derive authoritative scores or diagnose injury from guessed client formulas.
- Connect recommendations to real drills/roadmap reassessment, while distinguishing advice from verified milestone achievement. Keep generated content server-side.
- Show completed, partial, unsupported, failed and unavailable historical-analysis states. Compare runs only when metric versions/units are compatible.

Acceptance: displayed values and overlays match known response/video fixtures, unavailable metrics stay unavailable, recommendations link to valid content, and screen-reader users can understand results without visual overlays. Test schema/version compatibility, low confidence, partial results and owner-safe result retrieval.
