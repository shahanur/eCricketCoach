---
name: player-17-notifications
description: "Implement player notification inbox, consent/preferences and owner-scoped push delivery."
disable-model-invocation: true
---
Implement individual-player notifications.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md). Prerequisite: 02 and agreed event/device/inbox contracts.

- Define supported events: approval, analysis ready/failed, practice reminders, roadmap milestones, certificate issued, billing/allowance notices. Distinguish local opt-in reminders from server business events.
- Existing admin notification rows are not a player push infrastructure. Add owner-scoped inbox/read-state/preferences/device-token APIs and delivery integration in the existing responsible service if missing.
- Choose an approved Expo-compatible push approach and configure separate Android/iOS app credentials. Keep push credentials server-side and use development builds where required.
- Request notification permission contextually; respect denial, per-category preferences, timezone/quiet hours, logout/account switching and disabled reminders.
- Handle token rotation, multiple devices, invalid-token removal, duplicate event suppression and delivery retries. Pending-approval notifications need a safe registration-bound design rather than a full-tenant token.
- Route notification taps through validated links and auth/ownership checks. Keep sensitive youth/analysis data out of lock-screen payloads.

Acceptance: authorized events reach the correct test devices/inbox, preferences work, denied permission does not block the app and logout detaches delivery appropriately. Test duplicate events, cross-user tokens, expired sessions, cold-start routing and timezone-aware reminders.
