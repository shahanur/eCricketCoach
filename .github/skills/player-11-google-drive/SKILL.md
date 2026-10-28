---
name: player-11-google-drive
description: "Implement consent-based Google Drive connection, video selection and explicit cloud-sync behavior."
disable-model-invocation: true
---
Implement player Google Drive integration.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md). Prerequisites: 02, 10 and approved mobile OAuth/sync policy.

- Reuse verified `/api/google-drive` connect/callback/status/videos/content/upload/disconnect contracts. Drive connections currently belong to authenticated `userId`; do not assume tenant-wide access.
- Use system-browser OAuth with state validation, allowlisted redirects and independent Android/iOS return links. Keep provider refresh tokens server-side; never put the app session token into an unsafe query URL.
- Provide clear disconnected/connecting/connected/expired/revoked/error states, account information where available, reconnect and disconnect.
- Browse/select supported Drive videos with pagination and explicit analysis consent. Integrate with the same analysis jobs and five-upload quota as local videos.
- Define and implement exactly what cloud sync means: selected originals/results, upload direction, opt-in, metadata tracking, retry, duplicate detection and deletion/conflict behavior. A file picker alone does not fulfil cloud sync.
- Use least-privilege scopes and privacy/retention disclosures. Do not scan unrelated files, silently upload all device media, delete Drive originals, or treat disconnection as account/media deletion.
- Validate remote-file ownership through the server and handle unavailable files, large files, permission changes and expired content URLs.

Acceptance: connection, browser return, selected-file analysis, an agreed sync workflow and disconnect work on Android/iOS. Test callback tampering, account switching, revoked consent, duplicate upload, Drive/local quota parity and unauthorized file access.
