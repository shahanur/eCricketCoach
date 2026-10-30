---
name: player-14-history-media
description: "Implement owner-scoped player video history and review that preserves baseline and progress evidence provenance."
disable-model-invocation: true
---
Implement history and native media review.

Read [player instructions](../../instructions/player-mobile.instructions.md), [API instructions](../../instructions/player-api.instructions.md), and [delivery guide](../../../docs/features/individual-player/README.md). Prerequisite: 10 and persisted owner-scoped history contracts.

Follow the [approved player journey](../../../docs/features/individual-player/README.md#approved-player-journey) and [roadmap contract](../../../docs/features/individual-player/roadmap.md). Preserve whether each item is self-reported practice, an incomplete analysis, or a completed verified video result; only the last may participate in a future baseline/comparison contract. Review history, comparison, and progress screens whenever evidence status or ownership rules change.

- List/paginate previous sessions and analyses with meaningful supported search/filter/sort fields. Open session, delivery and analysis detail without fetching another player's records.
- Reuse general owner-scoped video history where appropriate; do not assume club-only OpenAI reports or assessment history permit individual access.
- Provide native pause/play, seek, rewind/fast-forward, playback speed and fullscreen, with correct lifecycle/audio focus, rotation and expired-media-URL recovery.
- Add durable favorites and comments/notes only through agreed self-owned contracts. Clearly distinguish private notes from shared comments; define edit/delete and any moderation/participant visibility.
- Support confirmed deletion of owned history/media with explicit retention/Drive-original effects. Respect running-job deletion restrictions and avoid UI-only deletion.
- Keep cache bounded and account-scoped; label unavailable originals and deleted/partially migrated historical results. Preserve filter/navigation state and use signed media access.

Acceptance: player can reopen real prior results, control playback, find content, persist supported favorites/notes and delete eligible owned items. Test paging/filter correctness, inaccessible IDs, media expiry, failed deletion, cache invalidation and player/club report authorization.
