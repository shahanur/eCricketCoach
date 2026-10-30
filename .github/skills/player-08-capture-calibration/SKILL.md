---
name: player-08-capture-calibration
description: "Implement player video capture for a completed, owner-scoped baseline or progress comparison, plus camera guidance and supported calibration."
disable-model-invocation: true
---
Implement player video capture and calibration guidance.

Read [player instructions](../../instructions/player-mobile.instructions.md), [API instructions](../../instructions/player-api.instructions.md), and [delivery guide](../../../docs/features/individual-player/README.md). Prerequisites: 01, 04 and capture/session contract decisions.

Use the [approved player journey](../../../docs/features/individual-player/README.md#approved-player-journey) and [roadmap contract](../../../docs/features/individual-player/roadmap.md). Capturing or uploading a clip alone is not a verified, completed baseline; the server must return a supported, completed result owned by the authenticated player. Baseline APIs and rubrics are not implemented, so gate baseline claims and re-review capture/result handoff whenever that contract changes.

- Validate Expo-compatible camera/media/sensor modules on real Android and iOS devices, using development builds where needed. Agree supported capture resolution/frame rate/duration, device OS baseline and storage limits.
- Support relevant tripod/bowler/machine/umpire-camera setups, camera-position guidance, visible stumps, portrait/orientation and steadiness checks. Adapt guidance by discipline rather than forcing pitch calibration on every fielding/keeping drill.
- Reuse CAPE calibration only through a verified service contract. Clearly distinguish guidance/manual confirmation from actual detected stumps and calibrated measurements. If automatic calibration lacks support, keep it gated; do not simulate detection.
- Start/stop recording, display duration and status, handle camera switching where safe, prevent conflicting operations and review/discard/save a local draft before analysis.
- Request camera and optional microphone/media permissions just in time. Support denial/permanent denial, low storage, calls, app backgrounding, orientation changes, process death and safe recovery of completed files.
- Keep the screen awake only when appropriate and release resources. Do not claim background recording or precise sensor/video synchronization without platform validation.
- Preserve capture/calibration metadata needed by deliveries/analysis; never upload without explicit user action.

Acceptance: captured files play correctly on both platforms, interrupted sessions have truthful recovery states, calibration quality is explicit, denied permissions do not crash, and discarded drafts are cleaned up without deleting user originals. Record physical-device feasibility results and test the capture state machine.
