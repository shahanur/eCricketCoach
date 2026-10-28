---
name: player-19-offline-sync
description: "Implement bounded offline caches, practice drafts and safe mutation/upload recovery for the player app."
agent: agent
---
Implement cross-cutting offline and synchronization reliability for enabled player modules.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md). Prerequisites: 01-02 and the contracts for every mutation included.

- Inventory existing app cache/draft behavior before adding another storage/state abstraction. Borrow concepts from the club mutation journal, not Kotlin implementation dependencies.
- Define offline support explicitly: bounded drill/roadmap/history metadata cache, local capture/practice drafts, supported queued practice/tag/note mutations, and upload recovery. AI processing, purchase verification, approval and quota authorization remain online/server-authoritative.
- Scope all cache, media references and queued work by authenticated user/tenant. Purge or quarantine on logout/account switch; never replay another user's mutations.
- Persist operation IDs, version/conflict data and pending/syncing/failed state. Use idempotent server writes, ordered dependencies and bounded backoff; stop/re-authenticate on auth expiry.
- Agree conflict resolution per operation. Do not silently overwrite server progression, duplicate practice completion, reissue certificates, or consume AI quota twice.
- Handle storage exhaustion, corrupt/incompatible cache schema, partial uploads, signed URL expiry, app termination and foreground resume. Use platform-supported background scheduling only; do not promise always-on sync.
- Show stale-data timestamps, queued work, retry/cancel and actionable conflict/errors. Protect sensitive local files and remove only app-owned expired files.

Acceptance: deterministic tests cover duplicate replay, restart, concurrency, conflict, token expiry, account switch and cache migration. Physical-device interruption tests demonstrate honest recovery, bounded storage and no cross-owner data leak or duplicate quota consumption.
