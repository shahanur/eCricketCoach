---
name: player-20-release-quality
description: "Verify all individual-player plan promises and establish independent Android/iOS release pipelines."
agent: agent
---
Validate and prepare independent releases of the individual-player app.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md). Prerequisite: every feature enabled for the release has working, tested contracts. Do not mark missing modules complete.

- Build a traceable acceptance matrix covering every plan-image promise and each enabled functionality-reference addition. Confirm pending-approval, rejected, active, quota-exhausted, expired and cancelled-account behavior.
- Run app type-check/lint, focused unit/component/integration suites and existing affected-service regressions. Add end-to-end coverage for registration -> checkout -> approval -> self profile -> practice -> upload/Drive -> real analysis -> progress/certificate.
- Verify exact one-profile and five-upload limits on the backend, including parallel submissions, billing-period boundary, retry policy and cross-user/cross-tenant rejection. Confirm real sandbox payments, restoration/cancellation and approved price/currency.
- Exercise OAuth/Drive deep links, camera/calibration, microphone/media permissions, playback, background interruptions, low storage/network, notification tap and biometric recovery on Android and iOS physical devices.
- Verify screen-reader/text-scaling/contrast/touch accessibility, private sharing, consent, deletion/export and cache cleanup. Document remaining gaps rather than hiding them with fixtures.
- Establish app-specific CI, Expo/native build profiles, secrets/signing handling and Android/iOS store release steps. iOS validation needs supported macOS/cloud tooling; do not claim a Windows-only run validates iOS.
- Configure crash/error reporting only with approved privacy-safe telemetry: no tokens, raw video, personal analysis content or provider secrets. Define versioning, rollout/rollback and support diagnostics.
- Update the delivery guide and app README with verified commands, environment requirements, feature availability, acceptance results and release blockers. Preserve independent club Android/web pipelines and test shared-service compatibility.

Acceptance: reproducible signed test builds exist for both platforms, all enabled requirements have passing evidence, store/privacy/payment requirements are addressed and unresolved blockers prevent production promotion. Do not publish, spend money, register external products or commit/push without explicit authorization.
