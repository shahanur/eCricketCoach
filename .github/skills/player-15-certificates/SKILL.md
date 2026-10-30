---
name: player-15-certificates
description: "Implement certificates only after verified baseline-based progress meets approved goal and stage criteria."
disable-model-invocation: true
---
Implement digital certificates of progression.

Read [player instructions](../../instructions/player-mobile.instructions.md), [API instructions](../../instructions/player-api.instructions.md), and [delivery guide](../../../docs/features/individual-player/README.md). Prerequisites: 06-07 and agreed milestone/award contracts.

Use the [approved player journey](../../../docs/features/individual-player/README.md#approved-player-journey) and [roadmap contract](../../../docs/features/individual-player/roadmap.md): verified baseline -> supported strengths/gaps -> roadmap -> later-video comparison -> goal criteria -> stage criteria -> eligible certificate -> roadmap update. Comparison APIs and approved rubrics are not implemented, so eligibility and issuance remain blocked; Q&A-only recommendations and self-reported practice/history cannot satisfy assessment. Never substitute a human-coach dependency or fabricated award data. Re-review certificate gates whenever criteria or evidence contracts change.

- Reuse progression and certificate domain models where suitable; existing club-issued certificates are not automatically self-player awards.
- Agree skill-stage thresholds, required evidence, reassessment, human review if applicable, and issuance/correction/revocation policy. Never award certificates from client counters or self-reported practice alone unless explicitly approved.
- Implement server-authoritative, idempotent milestone evaluation and durable certificate issuance with player, discipline, stage, issue date, unique identifier, criteria/evidence version and appropriate issuer.
- Build progress-to-next-milestone, earned-certificate list/detail, accessible original branded certificate rendering and secure PDF/download where supported.
- Keep awards private by default. Share/verification links need explicit consent, minimal public data, expiry/revocation policy and owner-safe access.
- Reflect awards on roadmap/dashboard without duplicate issuance on retries or multiple devices.

Acceptance: threshold boundary and duplicate-event tests prove correct issuance; ineligible clients cannot mint awards; a player can view/download a real persisted certificate. Test cross-owner access, correction/revocation and existing club certificate regression.
