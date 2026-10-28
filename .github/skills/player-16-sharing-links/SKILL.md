---
name: player-16-sharing-links
description: "Implement privacy-safe native sharing, exports and authenticated Android/iOS deep links."
disable-model-invocation: true
---
Implement player sharing, exports and external entry links.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md). Prerequisites: 12, 14 and agreed consent/export/share contracts.

- Share selected supported videos, analysis summaries or certificates using native Android/iOS share sheets; support WhatsApp through normal share targets without contacts access or unnecessary package probing.
- Export/download only formats actually supported by the backend and permitted by server entitlements. Do not add a premium restriction merely because the reference app might have one.
- Make private/public scope, participant consent, youth restrictions and included data explicit before sharing. Strip unnecessary identifiers/metadata; use expiring/revocable share links rather than permanent public storage URLs.
- Implement this app's own custom scheme and verified universal/app links. Do not reuse the reference product's scheme or depend on obsolete dynamic-link services.
- Validate scheme/host/path/parameters, route through authentication/approval when required, preserve safe destination state and reauthorize resource access after sign-in. Treat all incoming URLs as untrusted.
- Handle expired/deleted/revoked links, unavailable share apps, denied downloads, export failures and temporary-file cleanup. Never include tokens in shared content.

Acceptance: real export/share and authenticated cold/warm-start links work on Android/iOS. Test tampered links, cross-owner resources, revoked links, missing target apps, cancellation and private-by-default behavior.
