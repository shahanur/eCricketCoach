# Personalized development roadmap

## Approved scope — 2026-10-29

- Server-side AI recommends a four-discipline training path from profile goals,
  preferences, player Q&A and completed self-practice.
- Q&A and practice are explicitly self-reported, not verified skill measurements.
- The authoritative baseline/stage is **unassessed**. AI may suggest a provisional
  stage with evidence citations, but may not promote, score or certify the player.
- Assessed stage changes and certificates remain blocked until owner-scoped video
  verification and versioned, discipline-specific assessment rubrics are approved.
  No arbitrary score thresholds or human-coach dependency were introduced.

## Implemented contracts

All routes are inside the existing platform API under `/api/player`. They require
a valid PLAYER session, an owned individual profile, an active individual tenant,
and active subscription. The existing approval-backed development entitlement
is supported; it is not payment proof. Production paid entitlement is still a
separate prerequisite. Responses are private (`Cache-Control: no-store`).

| Method and route | Request | Result |
|---|---|---|
| `GET /roadmap` | No player/tenant ID | `{roadmap}` |
| `POST /roadmap/answers` | `{version, answers}` | `{roadmap}` with incremented evidence version |
| `POST /roadmap/generate` | `{version, requestId}` | `{roadmap}` with a new immutable AI revision |
| `POST /roadmap/practice` | `{requestId, revisionId, drillId, minutes, reflection}` | `{roadmap}` with persisted completion evidence |

`answers` contains exactly `BATTING`, `BOWLING`, `KEEPING`, `FIELDING`. Each value
is `{focus: string (1–300), confidence: integer (1–5)}`. Confidence is a player's
self-report, never an assessment score. Goals continue to use the existing
versioned profile editor rather than a second mutable goals store.

The roadmap response includes `version`, `profileVersion`, `goals`,
`primaryDisciplines`, `answers`, `stage: "UNASSESSED"`,
`baseline: "SELF_REPORTED"`, `policyVersion`, `generating`,
`needsReassessment`, `revisions` and `practice`. `milestoneEligibility` is
`BLOCKED_PENDING_VERIFIED_VIDEO_AND_APPROVED_RUBRIC`.

Each revision contains its ID, timestamps, profile/evidence versions and a
snapshot with provider/model attribution, policy version, input evidence,
four recommendations and drill snapshots. Each recommendation contains
`discipline`, `objective`, nullable `proposedStage`, cited evidence IDs and drills.
Drills contain `id`, `title`, `discipline`, `instructions`, `duration`, and the AI
recommendation `reason`. A proposal is never the authoritative stage.

Practice contains a server-generated ID/time, revision/drill IDs, discipline,
duration, reflection and `source: "SELF_REPORTED"`. It has no client-set stage,
score, completion timestamp or player ID.

## Ownership, lifecycle and retries

- Existing club assignments refer to club-member identities. They are **not**
  reused for self-player evidence. Shared drills are reused only when explicitly
  `SYSTEM_PREDEFINED`, `INDIVIDUAL`, with no club or squad scope.
- The authenticated tenant/email resolve the one self profile. Every revision
  lookup and practice write includes this profile ID; arbitrary foreign revision
  and drill IDs are rejected.
- Q&A updates use optimistic evidence versions. Mutations serialize on an
  owner-specific PostgreSQL transaction advisory lock.
- Generation reserves a five-minute lease, then calls AI outside the database
  transaction. Concurrent requests return an explicit 409. An expired lease can
  be replaced. A unique lease identity prevents a late request from clearing or
  committing over a replacement.
- Publishing checks the lease, evidence version, profile version and current
  entitlement. Changed inputs reject stale output; they do not overwrite history.
- Successful generation retries with the same owner/request ID reuse the
  persisted revision without another provider call. Failed generation releases
  its lease and can be retried. There is no successful static-drill fallback.
- Practice requests are idempotent by owner/request ID. Reusing the key with a
  different payload returns 409. A unique owner/revision/drill constraint prevents
  duplicate practice from double-counting, including concurrent submissions.
- Practice may be logged only against the latest path. Previous paths remain
  viewable, including their completed evidence. New paths may assign the same drill
  for another practice cycle, without advancing an assessed stage.
- Goal/Q&A/practice changes flag reassessment and preserve completed evidence and
  immutable revisions. The API returns the latest 20 revisions and 100 practice
  records for bounded mobile rendering; older records remain stored. AI receives
  the latest 50 practice records. These windows are not a full export/history API.

## AI boundaries

`ROADMAP_AI_PROVIDER` explicitly selects `GEMINI` (default, existing model discovery)
or `OPENAI` (using the existing server-held `OPENAI_API_KEY`). OpenAI uses
`OPENAI_ROADMAP_MODEL`, defaulting to `gpt-4.1-mini`, JSON output, no automatic
retries and the same two-minute deadline. There is no silent provider switch.
Persisted provenance records the actual provider and returned model, and old
Gemini revisions remain readable. No provider credential,
player name, account email, video URL or private club content is sent by this
module. Player-written goals, focuses and reflections are supplied as untrusted
evidence. The prompt forbids instructions embedded in those inputs, medical
claims, fabricated drills, measured scores and authoritative awards.

Output validation requires four unique supported disciplines, allowed evidence
citations and at most three distinct, matching public catalogue drills per
discipline. Unknown fields (including score/promotion fields) are rejected.
Provider errors, invalid output and unavailable catalogue content return explicit
errors. Missing content for one discipline is an explicit no-drill state, not an
invented AI exercise.

The original [solo drill seed](../../../services/platform-api/src/scripts/seed-player-solo-drills.sql)
adds one low-intensity individual exercise per discipline. Apply it explicitly
to provision the catalogue; it is not fake recommendation output or an automatic
runtime fallback. Reruns preserve existing rows and all group/club activities.
Missing solo content and AI failures have distinct player-friendly error messages.

Generation has a two-minute total provider deadline (including discovery,
fallback models and retries), shorter than the client timeout and reservation
lease. Cancellation propagates to provider HTTP requests and stops further retries.
Existing shared AI callers retain their original retry behavior unless they
explicitly provide an abort signal.

This is a new recommendation workflow, **not** a video-analysis submission; it
does not consume or bypass the five-video allowance. No analysis routes, media
access or anonymous analysis behavior were changed.

## Mobile experience

The Progress tab and existing View Roadmap links open the real roadmap instead of
the sample progress dashboard. Practice links to the same personal training path.
Players can update Q&A, prepare/reassess a path, read full drill instructions,
record practice/reflection, and view earlier revisions and evidence. Loading,
empty, unavailable, retry, expired-session and forbidden states are explicit.
Network errors never substitute mock charts, recommendations or progression.

The reference-style **Your Plan** screen has **Roadmap**, **Goals** and
**Certificates** tabs, a dark green background in dark mode, mint-green accents,
and a vertical four-discipline training timeline. The shared theme provides a
corresponding light palette; other screens retain their blue/slate theme.
Timeline completion and dates derive only from logged drills on the viewed
revision. Percentages describe the fraction of drills logged, not skill scores.
No fake completed stages, arbitrary ordering restrictions or awards are added.
The certificate node is explicitly locked pending a verified assessment.

Select a timeline discipline, then **View Recommended Drills** to open its focus,
recommendations and practice forms. The back arrow returns to the compact timeline
(or Home from the overview). Drill instructions open on demand with bold Equipment,
Setup, Steps, Cues and Safety sections; unstructured instructions remain fully
readable. Practice logging opens separately and unsaved drafts survive navigation
between these views.

Goals contains the profile link, four-discipline check-in and an expandable
history. Check-in edits one discipline at a time and saves all four answers
together. History initially shows five revisions/completions, with explicit
Show more controls up to the API's existing limits. Certificates explains the
unassessed stage and evidence requirements without offering unavailable download
or award actions. These are presentation changes only; no stage, entitlement,
recommendation or persistence rules were changed.

## Migration and verification

The additive migration
[`20261029193000_player_roadmap`](../../../services/platform-api/prisma/migrations/20261029193000_player_roadmap/migration.sql)
creates profile-owned roadmap, revision and practice tables. It does not update
club tables or profile rows. Apply through the deployment's existing migration
process before starting the updated API; existing installations must already
have the profile/subscription schema. This repository previously had no Prisma
migration baseline: do not run `migrate deploy` on a populated database without
establishing its baseline. Applying the reviewed SQL directly through the
deployment's migration mechanism is also possible.

The local Docker development database was migrated with user approval on
2026-10-29, and only the API container was rebuilt/recreated. Deployment was
verified with an authenticated `200` response and the baseline check-in on the
physical Android device. Other environments still require this migration.

For the local Compose deployment, explicitly load its ignored environment file
so provider configuration and the development subscription opt-in are preserved:

```powershell
docker compose --env-file deploy\.env --project-directory . -f deploy\compose.yml build server
docker compose --env-file deploy\.env --project-directory . -f deploy\compose.yml up -d --no-deps server
```

These commands update the API, not the database schema. Apply the reviewed
additive SQL once, transactionally, before recreating the API. A `404` with
`Cannot GET /api/player/roadmap` indicates a stale backend image, not a missing
player roadmap. A player without revisions receives `200` with empty history
and can complete the baseline check-in.

Backend tests:

```powershell
npm run build
npm run test:player-roadmap
```

Set `PLAYER_PROFILE_TEST_DATABASE_URL` only to a disposable database with the
schema applied to execute persistence/concurrency integration coverage. Without
it, the integration test is explicitly skipped. Never target a production
database: test cases create and remove their own test tenant, approval and drills.

Tests cover Q&A and AI validation, auth/role rejection, ownership, stale evidence,
idempotency, concurrent duplicate completions, revisions after goal changes,
invalid AI, expired/inactive access and blocked milestone boundaries. Focused
existing profile, subscription and club drill tests must run alongside them.
Mobile tests cover the central HTTP contract, Q&A, error/retry request IDs,
recommendations, completion evidence, duplicate prevention and goal navigation.

Live provider quality, physical Android/iOS interaction, video verification,
rubrics, full history paging/export, production paid entitlement and certificate
issuance remain release prerequisites; they are not represented as implemented.

### Local live verification — 2026-10-29

With explicit user approval, the local deployment selects OpenAI and the original
solo catalogue was provisioned. One live generation using the saved check-in
returned `200`, persisted actual OpenAI model provenance and one catalogue drill
for each discipline, and left the authoritative stage `UNASSESSED`. Pull-to-refresh
on the physical Android phone displayed the saved AI path and drill cards.
This verifies the generation/rendering workflow, not assessment accuracy, skill
improvement or iOS behavior. No certificate or assessed stage was awarded.
