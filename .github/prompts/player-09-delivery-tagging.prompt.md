---
name: player-09-delivery-tagging
description: "Implement session delivery records, timestamps and self/participant tags without club roster administration."
agent: agent
---
Implement delivery-level records and tagging for individual practice sessions.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md). Prerequisite: 08 and agreed session/delivery metadata contracts.

- Associate deliveries with a source video/session using validated time ranges and stable IDs. Support delivery count, navigation and correction without rewriting the original media.
- Default the authenticated player appropriately as batter or bowler. Support optional participant labels only under an agreed privacy policy; these are not additional paid player profiles or a club roster.
- Implement tag/untag, role correction and explicit apply-self-to-all with confirmation/undo behavior. Preserve manual tags when new analysis arrives according to an agreed conflict policy.
- Do not implement automatic detection/tagging without a supported, validated backend output. Present manual/automatic provenance and confidence where applicable.
- Add owner-scoped metadata endpoints/persistence if missing and ensure all referenced sessions/media belong to the authenticated player.
- Do not request contacts access, scrape other players, or expose coach/member administration. Handle participant consent where names/images are stored.

Acceptance: valid deliveries and tags persist across reopening, invalid/overlapping ranges follow documented rules, bulk tagging is intentional, cross-user media references are rejected, and tags never create extra self profiles. Test duplicate/reordered updates, untagging, deletion and stale metadata.
