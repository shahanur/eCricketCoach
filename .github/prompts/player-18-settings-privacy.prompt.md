---
name: player-18-settings-privacy
description: "Implement player preferences, privacy controls, account deletion/export and optional biometric app lock."
agent: agent
---
Implement player settings, privacy and optional biometric access.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md). Prerequisites: 02, 04 and agreed privacy/account lifecycle contracts.

- Provide relevant profile/preferences, accessible theme/display options, supported units, notification preferences, Drive management, subscription management, help, legal/privacy information, sign-out and app version.
- Define age/guardian consent, purposes, retention and sharing policy before enabling youth workflows. Avoid collecting contacts/location or unsupported sensitive health data.
- Add secure personal-data export and account-deletion request/status contracts if absent. Require appropriate reauthentication, explicit confirmation, idempotent processing and auditable completion/errors.
- Specify effects on videos, analyses, practice, certificates, provider connections, legal billing records and backups. Account deletion is not logout, subscription cancellation or Drive-original deletion; explain each separately.
- Implement optional biometric app unlock with supported device APIs and secure credential access, fallback/recovery and background relock. Biometrics are a local protection layer, not a replacement for server authentication or an expired JWT.
- Clear user-scoped cache and secrets on logout/deletion/account switch; revoke server/provider sessions where supported and report unsupported revocation honestly.

Acceptance: preferences persist correctly, biometric unavailable/cancel/lockout paths are safe, export/deletion requests are real and owner-scoped, failed requests remain visible, and no misleading instant-deletion promise is shown. Test reauthentication, account switching, retention behavior and subscription/deletion separation.
