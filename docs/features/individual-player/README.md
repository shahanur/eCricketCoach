# Individual-player app delivery guide

## Purpose and architecture

Create a separately maintained Android/iOS application in `apps/mobile/player` using **Expo + React Native + TypeScript**, sharing the existing backend microservices. These files are an implementation kit, not an implementation of the app.

Expo is recommended for cross-platform native UI, TypeScript support, camera/media integrations, secure storage, and independent builds. Use development builds and supported native modules where required. Validate camera throughput, capture timing, video playback, and background transfers on real devices before committing to advanced capture features. Native modules may be needed; do not switch the whole app to a different framework without evidence and agreement.

The existing Kotlin club/academy app lives in `apps/mobile/club/android`, separate from `apps/mobile/player`. Do not use the unrelated `mobile-app` directory as the new application root. The player app needs its own identifiers, configuration, navigation, dependencies, build/release pipeline, and assets. Backend reuse does not mean sharing privileged club UI or trusting role checks made only on the device.

## Requirements and evidence

Sources:

- The supplied individual-player plan image, transcribed below.
- [Functionality reference](../../FUNCTIONALITY_DOCUMENT.md): a third-party behavioral inventory, with several explicitly inferred capabilities. Use only its high-level feature requirements, not its proprietary code, assets, branding, integrations, or unverified algorithms.
- [Existing registration workflow](../../auth-and-registration-workflow.md).
- Existing platform routes and native clients, listed below. Reinspect source when implementing; a route's existence does not establish access for an individual player.

### Required individual plan

| Requirement | Expected player experience |
|---|---|
| GBP 14.99 per month; billed monthly; cancel anytime | Clear approved price/currency, renewal and cancellation terms; actual backend/store product must match before release |
| One player profile and performance dashboard | Self-service profile only; no club, squad, member, or coach administration |
| Personalized batting, bowling, keeping, and fielding roadmap | Goals, current stage, next drills, progress and reassessment in all four disciplines |
| AI biomechanical pose estimation and kinematic feedback | Supported video results, posture/balance scorecard, quality/confidence and limitations |
| Five AI video action uploads per month | Server-derived usage and reset information; device and Drive paths share the allowance |
| Google Drive cloud sync | Consent, connect/status/disconnect, select/upload/sync behavior defined explicitly |
| Solo practice and self-guided technical drills | Assigned/recommended drills, session logging, feedback and progress |
| Digital progression certificates | Durable, verifiable awards at eligible skill-stage milestones |
| Register as player; checkout then system-admin approval | Shared authentication/registration semantics, player-specific data, pending and activated states |

### Relevant functionality-reference additions

Include onboarding, permission guidance, capture setup, calibration, session recording, delivery records and tagging, asynchronous analysis, pitch maps and supported metrics, playback/history/search, favorites/comments, export/sharing/deep links, preferences, subscription management, notifications, optional biometric access, and resilient offline/network behavior.

These are phased requirements, not claims that the current APIs or models implement them. Inferred metrics, automatic delivery detection/tagging, subscription-gated exports, sensor calibration algorithms, background recording, and biometric UX need explicit feasibility/contract decisions. Do not implement team administration, bulk roster tagging, a contacts importer, advertising attribution, or location/maps merely because they appear in the reference. Optional participants are session metadata, not extra paid player profiles.

## Verified shared-service contract audit (2026-10-28)

This is a source audit, not a claim that the individual-player app or its contracts are production-ready. Routes below are mounted by `services/platform-api/src/index.ts`. The later Player-03 outcome records the implemented development-only subscription contract; other proposed `/api/player/*` contracts remain unimplemented.

### Identity and approval trace

| Boundary | Verified behavior and identity | Contract result |
|---|---|---|
| Provider identity | `GET /api/auth/providers` reports configured providers. Browser OIDC starts at `GET /api/auth/:provider`; callbacks accept GET and POST (including Apple's `form_post`). Google native uses `GET` then `POST /api/auth/google/native` with a five-minute nonce challenge. OIDC/native identity is verified server-side; Google requires a verified email. | Reusable identity verification. Session JWT is eight hours; no refresh, revocation, or logout API. |
| New applicant | An unrecognized identity receives a 30-minute `registration_token`. Its claims are `type`, verified `email`, `name`, and `provider`; it does not bind the provider `sub`. Browser clients receive it in the query string. Native Google instead returns `403 {error, code: "REGISTRATION_REQUIRED"}`. | Registration grant is not a durable applicant identity or status session. The existing Android client accepts only `auth_token` callbacks; no player app/iOS callback consumer exists. |
| `INDIVIDUAL` checkout | `POST /api/subscriptions/checkout` now rejects individual purchases with `503 PLAYER_PURCHASE_UNAVAILABLE` unless development subscriptions are explicitly enabled outside production. In development mode it accepts a monthly application with name/email and optional verified registration grant, rejects card details, and atomically creates/reuses an approval and admin notification; responds `201 {success,message,data:{approval,invoice:null,notification}}`. No invoice or payment is created. Legacy club/coach checkout is unchanged. | An application is not payment proof. Only authenticated admin approval activates the development subscription. |
| Pending approval | `GET /api/admin/club-approvals` lists the global queue. `POST /api/admin/club-approvals/:id/approve` now requires a `SUPER_ADMIN` bearer session. Individual development approval atomically provisions/reuses one tenant and subscription; club/coach provisioning is preserved. There is still no applicant-scoped status, rejection, resubmission, or cancellation API. | Do not call admin endpoints from the player app. Pending applicants must sign in after approval; applicant-scoped polling remains a separate gap. |
| Approved login | Approval creates an `ACTIVE` tenant with `type: INDIVIDUAL`, `email` and `activeMembers: 1`; it creates no `ClubMember` and does not link the tenant to the approval or verified provider subject. A later social login matches the tenant by email and mints role `PLAYER`, tenant ID, and `userId: oauth-${provider}-${sub}`. | Verified path is email -> tenant lookup -> role claim, not durable provider-subject provisioning. `GET /api/player/profile` now idempotently creates a durable self profile on first access, with unique tenant and normalized owner-email constraints. It does not resolve provider-subject binding or entitlement checks on login. A `PLAYER` role alone does not establish an individual entitlement. Implemented for the player app: `GET /api/auth/player-access` (bearer session) -> `{access: "ACTIVE" \| "UNAVAILABLE", email, displayName}`; `ACTIVE` only for a `PLAYER` session whose own `INDIVIDUAL` tenant (matched by tenant ID and session email) is `ACTIVE`/`TRIAL`; 401 for missing/invalid/expired sessions. This gates app access only; it is not a subscription-billing or quota entitlement. |

### Existing route and caller matrix

`{error: string}` is common, but several routes return `{error, message}` and others return bare arrays or resource wrappers. There is no shared error envelope. Lists below have no general pagination contract unless a limit is stated.

| Capability | Existing method/path and DTO shape | Auth, scope, lifecycle and limits | Individual-player disposition |
|---|---|---|---|
| Plan catalog | `GET /api/subscriptions/plans` -> array of `{id,type,name,priceMonthly,priceAnnual,features}`. | Public; no currency field. | Reuse only after price/currency/product approval. It advertises annual pricing not needed by the player plan. |
| Shared drill content | `GET /api/drills?context&discipline&source&clubId` -> drill array (`id`, title, discipline, skill set, context, duration, instructions, image URL/source). | Public; no pagination. A supplied `clubId` selects global plus that club's drills. | Global catalog is reusable read-only content; a client-supplied tenant ID is not a self-player authorization contract. No self assignments or solo-practice logs. |
| Training templates | `GET /api/training-templates` -> template array (disciplines, focus, safety, duration, drill IDs). | JWT roles `SUPER_ADMIN`, `CLUB_ADMIN`, `COACH`; not `PLAYER`. | Incompatible as a player endpoint. Reuse shared templates only through an explicitly player-safe read contract. |
| Club training / reports | `/api/club/sessions`, `/api/coach/sessions/*`, `/api/club/reports/session-activity`, and `/api/club/assessments*` support club planning, execution, feedback, reports and PDFs. | Mixed legacy guards; report/assessment flows require club-admin or active club-coach membership and tenant-scoped club records. Report data is roster/session activity. | Not self-practice or self-report APIs. Do not broaden club roster/report access to `PLAYER`; add owner-scoped resources in the existing service. |
| General video analysis | `POST /api/videos/analyze` accepts multipart `file` or JSON `driveFileId`, `discipline`, optional `context`, `playerId`, `playerName`; returns analysis, `analysisId` (nullable), status and source. History is `GET /api/videos/analyze/history?playerId` -> `{history}`; detail is `GET /api/videos/analyze/:id` -> `{entry}`; deletion is `DELETE /api/videos/analyze/:id`. | Upload may be anonymous. Optional bearer identity is used to save `userId`; `playerId`/name are accepted from the request. History is capped at 50 and filtered by JWT `userId`, but detail and adopt-drill do not check record ownership; delete does. | Not an owner-safe player contract as-is. The web client also converts history failures to an empty success-shaped result. Require auth, derive the owner/profile server-side, persist job/consent provenance, and test cross-owner access before reuse. |
| OpenAI batting reports | `POST /api/videos/analyze/openai-batting` accepts upload or `driveFileId`, optional `playerId`/assessment, shot/camera/timing/calibration metadata; responds with report ID, artifacts and analysis. `GET .../history?playerId`, `GET .../latest?playerId`, report PDF/artifacts, review and delete routes operate on reports. | JWT `CLUB_ADMIN`/`COACH`; selected player must be an active `ClubMember` in caller tenant. History capped at 100. Records are tenant-scoped. | Incompatible for self identity and all individual `PLAYER` callers. A self-owned report adapter/authorization and report entitlement decision are required. Output is batting-only and is not proof of four-discipline validated scorecards. |
| CAPE jobs and assigned drills | `/api/club/cape-jobs` POST multipart `file` or JSON `driveFileId`, `playerId`, target/calibration metadata -> `202 {jobId,status}`; GET collection/job/latest, `/:jobId/drills`, `/assigned-drills`, artifacts, delete and assignment routes expose queued/running/succeeded/failed lifecycle. | Router JWT roles include `PLAYER` for reads; player reads force `playerId = userId` within `tenantId`. Creation, latest lookup, deletion and drill assignment are club-admin/coach only; creation additionally requires an active `ClubMember`. Lists take at most 100; no cursor. | Some read semantics are useful, but a self profile has no `ClubMember` ID and no self creation route. Adapt job authorization/ownership and quota in the existing service; do not accept a client player ID as owner. |
| Kinematics / pose overlay | `POST /api/videos/kinematics/analyze` accepts local file or Drive ID and discipline, returns pose metrics/overlay and optional cricket interpretation. `POST /api/videos/kinematics/analyze-image` accepts image/sequence metadata and returns pose output. | Video route requires any JWT role but persists no result and has no per-player usage/ownership record. Image route requires club admin/coach, not `PLAYER`. | Technical analysis primitives exist; no durable player scorecard, supported-output/version contract, quota integration or self-report access. Treat unsupported metrics as unavailable; validate algorithms before presenting scores. |
| Google Drive | `GET /api/google-drive/connect?token&returnTo` starts OAuth; `GET /callback` stores connection; authenticated `GET /status`, `/videos`, `/videos/:fileId/content`; `POST /upload` multipart `file`, `playerName`, `discipline`; `POST /disconnect`. | Connection and server-held access/refresh tokens are keyed to JWT `userId`. Video listing returns at most 50 files without a next-page token. The mobile callback allowlist is `ecricketcoach://drive/callback`; file access uses the caller's Drive credentials. | OAuth, per-user connection and explicit list/upload primitives exist. No selected-media sync record, background-sync/deletion/conflict policy or quota linkage. The connect token is passed in the URL; replace with a short-lived single-purpose OAuth state/hand-off before a new mobile client relies on it. |
| Certificates / progression | `GET /api/club/certificates` -> certificate array; `POST /api/club/players/:id/assess-progress` promotes an active club player and creates a certificate. | Read allows `PLAYER` and filters by `playerId = JWT userId`; other users see tenant certificates. Promotion is limited to club admin/coach and tenant roster membership. | Existing `Certificate` rows can inform a self-certificate DTO, but individual users have no matching member ID, self eligibility/verification/download flow, or approved milestone algorithm. |
| Quota, notifications, privacy and settings | No player quota/status, notification inbox/preferences/device token, self account deletion/export/consent, favorites/comments/search, or player subscription-management endpoints were found. Some existing AI paths return provider-level `429`; that is not an entitlement counter. | No server-enforced five-action monthly allowance or consistent lifecycle accounting. | Missing. Reference items not otherwise mapped above remain gated until owner-safe contracts and product/privacy rules are approved. |

### Plan and reference feature coverage

| Feature | Reusable contract or blocker |
|---|---|
| Register, authenticate, checkout, pending approval, activate | Provider verification and active-user sessions exist; native Google unregistered users cannot continue in-app. Checkout is simulated, pending status is unavailable, activation is not durably linked to the provider subject, and no player app callback consumer exists. Blocked pending real billing and identity provisioning. |
| One profile and dashboard | Owner-scoped self-profile read/update, idempotent initialization and single-profile uniqueness are implemented at `/api/player/profile`. Home composes self-profile, subscription and `/api/player/dashboard`. The dashboard returns explicit empty progress/focus, or labelled, owner-scoped development fixtures outside production; it is not a measured performance aggregate. Assessed progression, analysis history, awards and quota usage/reset remain unavailable. Self-reported roadmap practice is available separately. See the [app's dashboard and local seed guide](../../../apps/mobile/player/README.md#performance-dashboard-boundaries). |
| Five AI uploads/month and analysis jobs | Upload/analysis primitives and CAPE job lifecycle exist, but no owner-safe general upload contract or unified allowance. Blocked on quota policy, atomic reservation, idempotency and refund/release semantics. |
| Four-discipline roadmap, goals and reassessment | Owner-scoped Q&A, AI-guided paths, immutable revisions and reassessment are implemented at `/api/player/roadmap`. Stages remain unassessed pending verified video and approved rubrics. See [implemented roadmap contracts](./roadmap.md). |
| Solo drills and practice history | Roadmap drill snapshots and idempotent self-reported completions reuse public individual drills. Standalone practice sessions, full history paging and richer drill exploration remain separate module work. See [roadmap practice evidence](./roadmap.md). |
| Biomechanics, scorecards, pitch maps, delivery tagging and calibration | Kinematics/CAPE primitives exist with partial supported metrics; not all are persisted, validated, owner-scoped, or supported across four disciplines. Gate unsupported outputs; pitch-map and delivery semantics/algorithms require evidence and approval. |
| Drive connect, history, playback, favorites, comments and offline sync | User-scoped Drive primitives and capped video histories exist. Sync policy, full paging, favorites/comments, durable offline mutation semantics for a self profile, and signed short-lived media access are missing. |
| Certificates, export/share/deep links, notifications, settings/biometrics | Club certificates and mobile/web callback plumbing exist, but self awards, owner-safe export/share, player notifications/preferences, privacy endpoints, and player-app callbacks/settings do not. Gate until contracts and consent are approved. |
| Permissions, capture, recording, network resilience | No player app implementation exists. Device support, permissions, background execution, cancellation, offline behavior and Android/iOS callback handling must be verified in the player app; do not treat club-app behavior as proof. |

### Proposed backward-compatible service extensions (not implemented)

Keep all changes in `services/platform-api` and extend the responsible routes/models; do not create a replacement backend or change club authorization semantics.

| Proposed contract (not implemented) | DTO and behavior | Auth, ownership, errors and paging |
|---|---|---|
| Existing `GET /api/auth/:provider` and callback transport | Keep provider verification; include the verified provider subject in the short-lived registration grant. The separate player app must consume the fixed mobile callback and distinguish `registration_token` from `auth_token`. Preserve the existing native Google `REGISTRATION_REQUIRED` behavior for club-app callers unless they are deliberately migrated. | No tenant session for applicants. Invalid/expired grant remains 401; callback errors remain explicit. |
| Proposed `GET /api/player/application-status` | `Authorization: Bearer <registration grant>` -> `{applicationId,status,plan,statusChangedAt,nextAction}` for the application bound to the verified subject. `status` is a documented application lifecycle; response must not include other applicants, admin notes, or a full tenant session. Reauthenticate with the provider to obtain a fresh grant after expiry. | Grant must be signed, short-lived, type-checked and subject-bound; derive applicant from it, never accept email/application ID as authority. 401 invalid/expired, 404 no matching application. Single resource; no paging. |
| Existing `POST /api/subscriptions/checkout` (contract replacement after payment decision) | Validate only supported individual product/cycle and provider purchase proof; response should contain a stable application ID/status, not fabricated `PAID` invoice data. Provider-specific proof DTO and pending-vs-active billing state remain decision-dependent. Signed provider/store webhook is the source of verified payment state. | Registration identity and purchase must be verified server-side. Require idempotency; duplicate requests return the same application/payment outcome. Explicit 400 validation, 401 identity, 409 duplicate/conflict, 402/422 purchase rejection, and 5xx provider failure; no client-supplied paid flag/card data. |
| Proposed `GET /api/player/me` | Active bearer session -> `{profileId,tenantId,role:"PLAYER",status,profile}`; `profileId`, role, tenant, approval and entitlement come from server records. | JWT plus active individual tenant/profile/entitlement; self only. 401 invalid session, 403 pending/inactive or wrong persona, 404 missing profile. Single resource; no paging. |
| Proposed `GET /api/player/usage` and `POST /api/player/analyses` | Usage -> `{period:{startsAt,endsAt},limit:5,used,reserved,remaining}`. Analysis accepts exactly one multipart video or owned Drive file ID plus validated discipline/analysis metadata; returns `202 {jobId,status,usage}`. Status follows queued/running/succeeded/failed/cancelled; history/detail use cursor-paged owner-scoped records. | Active individual entitlement; owner/profile/tenant derived from JWT. Atomically reserve with an idempotency key before enqueue, scope status/artifacts/media to owner, and settle/release once under the approved failure policy. 400 invalid source/DTO, 401, 403 entitlement, 409 duplicate/conflict, 413 too large, 429 exhausted, 503 queue/provider unavailable. Never accept arbitrary remote URLs. |
| Proposed `GET /api/player/practice`, `POST /api/player/practice` | Standalone cursor-paged practice sessions remain proposed. The implemented roadmap and its completion evidence use separate [roadmap contracts](./roadmap.md); do not duplicate them. | Active individual profile; derive owner and validate drill IDs against reusable global content. 400 invalid DTO, 401, 403, 404 inaccessible drill/resource, 409 invalid lifecycle transition. No client-set progress/milestones. |
| Proposed `GET /api/player/certificates` | Cursor-paged self certificates with stable certificate ID/number, discipline, achieved stage, issue date, evidence/algorithm version and verification URL/token. Award creation stays server-side after approved eligibility rules. | Active profile owner only; never trust requested player ID. 401/403/404 explicit; no client create/delete/promote operation. |

These are a proposed contract surface inside the existing platform API, not an instruction to expose every route at once. Response and lifecycle details that depend on the open decisions below must be finalized before implementation.

1. **Identity/application/profile:** extend the short-lived verified registration grant with a provider-subject binding and add an applicant record linked to the approval. The self profile now initializes idempotently for an approved session and is unique by individual tenant and normalized owner email; atomically provisioning it at approval and binding it to a durable verified provider subject remain open. Preserve existing club/coach rows and login mapping; backfill/re-link existing individual tenants only after provider identity is reverified.
2. **Pending status:** add a minimal applicant-only status query that requires a fresh signed identity grant (or equivalent proof bound to the verified provider subject) and returns only that applicant's status, next action, and safe timestamps. Do not issue a full tenant session or expose the global admin queue. Add operator authorization to approval operations as a separate compatibility/security change.
3. **Billing:** retain the shared subscription service, but replace simulated checkout with an approved store/provider flow and signed webhook verification; persist provider, product, currency, billing period, payment/entitlement status and unique provider transaction/event IDs. Never grant entitlement from card input or a client paid flag. Use additive columns/tables and a migration/backfill plan; keep legacy club checkout behavior explicitly segregated until its clients are migrated.
4. **Quota/jobs/media:** add a server-owned usage ledger with unique idempotency keys and atomic reservation against the approved five-action window. Reserve before job acceptance; retries reuse the same reservation; define whether failed/cancelled work releases it and settle exactly once. Bind uploads, jobs, artifacts and history to profile/tenant from JWT; issue signed expiring media access and never authorize from request `playerId` or arbitrary remote URL.
5. **Player data and reports:** add profile-owned roadmap/progress, solo practice, reassessment and certificate records only after evidence/eligibility rules are approved. Add owner-scoped adapters for selected existing AI/Drive capabilities instead of copying club handlers. Keep club assessment reports, roster data and administration inaccessible to the individual persona.
6. **Cross-cutting contract:** validate all DTOs and status transitions; return explicit existing-style errors (never mock success); enforce foreign keys/unique constraints and transaction boundaries; record consent and retention/deletion policy. Add unauthorized, cross-owner, pending, expired entitlement, duplicate/retry/concurrency, quota exhaustion and migration tests, plus focused existing club/web regressions. Add a dedicated player API client contract test suite before implementing screens.

No Prisma migration or server change is included in this audit. Before implementation, the proposed additions need concrete schema/DTO review; any new schema uses additive Prisma migrations and must preserve existing table/column mappings.

### Decision log — unresolved product contracts

| Decision | Current evidence / safe boundary | Must be decided before |
|---|---|---|
| Price, currency, billing period and renewal | Plan endpoint reports 14.99 monthly / 149.99 annual without currency; checkout writes GBP invoices while notification copy uses `$`. The GBP 14.99/month figure remains a target, not a verified store/provider product. | Publishing product/store metadata or checkout UI. |
| Store/provider purchase and approval timing | Decision (2026-10-28): real billing starts only after approval. Development/testing may instead use explicit approval-backed access, without a verified payment. This access expires after one month until an administrator renews it; it never auto-renews. Production purchase and paid entitlement remain blocked. | Any production checkout or paid entitlement; development approval is not payment proof. |
| Five-action window and settlement | Decision (2026-10-28): the five-use window follows subscription billing-period timestamps; failed/cancelled analyses release reservations and successful analyses consume one. A new reanalysis consumes another use; retries of the same request must not. Atomic reservation and settlement, idempotency conflicts, and crash recovery still need implementation/testing in the analysis module. | Analysis acceptance or usage UI; a development subscription alone does not enable these paths. |
| Youth / guardian consent, privacy and retention | Reference requires private-by-default media; age bands, guardian authorization, sharing, retention, deletion, and regions are unspecified. | Production onboarding, capture, upload, analytics or sharing. |
| Drive sync scope | Existing routes explicitly list/upload files, but no policy defines opt-in selection, automatic/background sync, conflict, deletion or original retention. | Any automatic or background sync. |
| Individual report entitlement and progression | Existing OpenAI/CAPE/assessment reporting is club-oriented; no validated four-discipline roadmap, score/milestone threshold or self-report entitlement is established. | Enabling reports, recommendations, milestones or certificates for an individual. |
| iOS/app identity and callback provisioning | Existing shared OAuth supports a fixed custom-scheme return target; there is no player app, iOS callback handler, bundle identifier, universal-link domain, or store configuration in this repository. | Native OAuth/store provisioning and release. |

### Player-03 outcome (2026-10-28)

Implemented a development-only registration -> authenticated system-admin approval -> player sign-in -> dashboard subscription flow. Enable it on the **platform API**, not in the mobile bundle:

```dotenv
NODE_ENV=development
PLAYER_DEVELOPMENT_SUBSCRIPTIONS=true
```

Both settings are required. `NODE_ENV=production`, an unset environment, or a disabled flag prevents approval-backed subscription access. Restart/redeploy the API after changing the settings. A production-mode container cannot enable this mode merely by setting the flag.

For the repository's local Docker stack, set `PLAYER_DEVELOPMENT_SUBSCRIPTIONS=true` in `deploy/.env` and rebuild/recreate the `server` service using the existing deployment command. The Compose server already uses `NODE_ENV=development` and now forwards this opt-in flag; its default remains `false`. For a directly run API, use its own environment or `services/platform-api/.env`.

- Individual website registration no longer collects card details or advertises annual individual access. In development mode the shared checkout route creates an unpaid application and `APPROVAL_PENDING` notification atomically; duplicate submissions reuse the application. It creates no invoice. Outside development mode individual purchase remains blocked. Club/coach checkout is intentionally unchanged.
- Approval requires a `SUPER_ADMIN` session; the web client supplies its existing bearer token. Development individual approval atomically creates/reuses an `ACTIVE` individual tenant with one member, zero new payment revenue, and a persistent `PlayerDevelopmentSubscription`. Unique tenant/email/approval constraints and transaction-scoped owner locks prevent duplicate subscriptions or period extension on repeated approvals. It grants no club/admin roles and creates no club roster member.
- `GET /api/player/subscription` requires a valid `PLAYER` bearer session matched to its own individual tenant ID and email. Request player/tenant IDs are ignored. It returns `{status,source,paymentVerified:false,plan,period,autoRenews:false,capabilities}` with `Cache-Control: no-store`. Status is `ACTIVE`, `EXPIRED`, `INACTIVE`, or `UNAVAILABLE`; source is `DEVELOPMENT_APPROVAL` or `NONE`; period is `{startsAt,endsAt}` in UTC or `null`. Plan contains `id`, `name`, `currency:"GBP"`, `priceMonthlyMinor:1499`, `billingCycle:"MONTHLY"`, `profileLimit:1`, and target `monthlyAnalysisLimit:5`. Capabilities `purchase`, `restorePurchases`, and `analysis` remain `false`. Missing/expired sessions return 401; wrong persona/owner returns 403; conflicting legacy identity returns 409; database failures return an explicit 500.
- `GET /api/player/profile` idempotently initializes and returns the signed-in player's profile; `PUT /api/player/profile` updates it using the profile version for optimistic concurrency. Both require a `PLAYER` session and revalidate the session email against the caller's own active/trial `INDIVIDUAL` tenant. The API accepts no player, tenant, email, role, or avatar identifier from the caller. A unique tenant and normalized owner-email constraint permits one self profile; club members and club roles are not created. Editable fields are profile display name, batting hand, bowling style, one or more of batting/bowling/keeping/fielding, experience band, and up to three short goals. Incomplete profiles can be saved and resumed; completion is derived from selecting a discipline. Requests use `Cache-Control: no-store`; stale writes return 409 `PROFILE_VERSION_CONFLICT`, cross-owner access is denied, and invalid fields return 400. The mobile profile cache is keyed by the authenticated session email and cleared when the session changes.
- An existing active individual tenant with a matching approved application receives its initial development month once, on its first subscription lookup. It is not inferred from a fake paid invoice. New approvals start the month at approval. Access ends exclusively at `endsAt`, preserving UTC time and clamping short months. Disabling/re-enabling the mode or signing in again does not restart the period.
- `POST /api/admin/customers/:id/renew-player-subscription` requires `SUPER_ADMIN` and the non-production opt-in. It renews an **expired**, active individual tenant for a month from renewal; retries do not extend an already-active period. Missing/inactive accounts return 404, an absent subscription returns 409, and disabled mode returns 503. The web admin Customers tab shows **Renew player month** only when authenticated `GET /api/admin/player-subscriptions/config` reports the development mode enabled.
- The mobile Home and Profile screens display authoritative subscription status and the access end date, loading/retry/offline/session-expiry states, refresh and sign-out actions. They refresh on focus and at expiry. Existing login authorization remains separate: an expired subscription can still sign in and see the renewal guidance.
- Schema changes are additive, using this service's existing `initDb` startup DDL and Prisma schema/client generation, with no reset or destructive backfill. Generate the Prisma client when building the API; normal startup creates `player_development_subscriptions` and `player_profiles` with foreign keys and uniqueness constraints.

Verification: focused PostgreSQL integration tests exercise real HTTP registration, pending login, admin approval, approved player login/access/status, duplicate/concurrent registration and approval, ownership, exact expiry, concurrent/idempotent renewal, production disablement, existing approved-tenant activation, and club provisioning/login regression. Unit tests cover the environment gate and UTC month-end/leap-year boundaries. Mobile tests cover DTO validation, missing/expired sessions, errors, status rendering, refresh, request cancellation, and expiry refresh. A browser check verifies the individual form collects no card details, keeps the monthly plan when annual billing is selected globally, handles failed registration without false success, and shows pending approval on success. Backend/web builds and mobile type-check/lint pass. Physical Android/iOS sign-in and native UI checks remain unverified in this Windows session.

Run `npm run test:player-subscriptions` from `services/platform-api`. The HTTP/database suite is opt-in: point **both** `DATABASE_URL` and `PLAYER_SUBSCRIPTION_TEST_DATABASE_URL` at the same disposable PostgreSQL database initialized from the Prisma schema; never point them at shared development or production data. Without the explicit test URL, only the unit tests run and the integration suite reports skipped.

Run `npm run test:player-profile` for the self-profile validation and HTTP authorization tests. Its PostgreSQL ownership/idempotency/concurrency test is opt-in via `PLAYER_PROFILE_TEST_DATABASE_URL` and requires an explicitly disposable database; it reports skipped when the variable is unset.

**Still gated:** real payments, store purchase/restoration/cancellation/webhooks, age-band and guardian-consent collection, private avatar upload/media access, analysis upload jobs, the five-use usage ledger/reservation enforcement, and actual usage/reset counters. The profile deliberately does not collect age/consent or accept avatar URLs until the applicable youth/privacy decisions and private-media contract are approved. No remaining-allowance number is fabricated. This development subscription is not authorization for the legacy analysis routes; those routes are unchanged and must not be used by the player app until owner-safe analysis and quota integration are implemented.

Only the module depending on each unresolved decision should remain gated; do not infer price, entitlement, consent or analysis rules from the reference inventory.

Never invent an existing `/api/player/*` endpoint. Proposed contracts may use an agreed namespace only after implementation ownership and compatibility are decided. Keep all backend changes in existing services.

## Product decisions to resolve during implementation

1. Reconcile GBP pricing with actual plan/store product currency, taxes and localized prices. Decide Apple/Google billing versus permitted external checkout using current store rules. Do not assume a web checkout can be embedded for digital features.
2. The approved-player self profile is now durably tied to the existing individual tenant and its matching verified session email, without adding club-management permissions. Define secure pending/rejected approval status, resubmission, sign-in after activation, cancellation and entitlement-expiry behavior. Do not query admin approval listings from a pending player's app.
3. Implement approved after-approval billing with the selected real provider; specify pending cancellation and rejection behavior. Development approval only grants the explicitly gated month described above, not a verified payment.
4. Implement subscription-period quota accounting and the approved release/retry/reanalysis rules above. Finalize concurrent reservation, job recovery, Drive imports, and retention. The five-upload allowance is for AI analysis, not an arbitrary limit on local recordings or browsing.
5. Define progression evidence, four-discipline roadmap generation, reassessment, certificate thresholds and any human review. Keep advanced metrics gated until validated.
6. Define youth age bands, guardian consent, privacy/retention, deletion, regional obligations and public-sharing defaults. Do not assume every aspiring youth player can consent alone.
7. Define Drive sync direction, deletion/conflict behavior, opt-in and background support. Never silently upload all device media or delete originals.
8. Define the minimum supported Android/iOS versions and approved bundle IDs, URL scheme, universal-link domain, store accounts, push and crash-reporting providers.

Only pause the module that depends on an unresolved decision. Record the blocker explicitly; do not choose a security, billing or product rule silently.

## Implementation order and module prompts

Run prompts from the workspace chat using their `/player-...` names. Each prompt links the common instructions and this guide. Dependencies refer to working, tested contracts/modules, not merely to having run a prompt.

| Phase | Prompt/module | Prerequisites |
|---|---|---|
| 0 | [00 Contract and gap audit](../../../.github/prompts/player-00-contract-audit.prompt.md) | None |
| 1 | [01 App foundation](../../../.github/prompts/player-01-foundation.prompt.md) | 00 architecture/contract decisions |
| 1 | [02 Authentication and registration](../../../.github/prompts/player-02-auth-registration.prompt.md) | 00, 01; secure pending/approval contract |
| 1 | [03 Subscription and quota](../../../.github/prompts/player-03-subscription-quota.prompt.md) | 00, 01, 02; payment/product decisions |
| 1 | [04 Self player profile](../../../.github/prompts/player-04-profile.prompt.md) | 01, 02; self-profile API |
| 1 | [05 Performance dashboard](../../../.github/prompts/player-05-dashboard.prompt.md) | 03, 04; dashboard contract |
| 2 | [06 Personalized roadmap](../../../.github/prompts/player-06-roadmap.prompt.md) | 04; roadmap and milestone contracts |
| 2 | [07 Solo practice and drills](../../../.github/prompts/player-07-solo-practice.prompt.md) | 06; content/practice contracts |
| 2 | [08 Capture and calibration](../../../.github/prompts/player-08-capture-calibration.prompt.md) | 01, 04; device feasibility and session contract |
| 2 | [09 Deliveries and participant tagging](../../../.github/prompts/player-09-delivery-tagging.prompt.md) | 08; delivery metadata contract |
| 2 | [10 Analysis uploads and jobs](../../../.github/prompts/player-10-analysis-upload.prompt.md) | 03, 04, 08; owner-safe jobs |
| 2 | [11 Google Drive](../../../.github/prompts/player-11-google-drive.prompt.md) | 02, 10; mobile OAuth/sync policy |
| 2 | [12 Biomechanics and scorecards](../../../.github/prompts/player-12-biomechanics.prompt.md) | 10; supported analysis schema |
| 3 | [13 Pitch maps and delivery analytics](../../../.github/prompts/player-13-pitch-analytics.prompt.md) | 09, 10; validated metric/calibration outputs |
| 2 | [14 History and media review](../../../.github/prompts/player-14-history-media.prompt.md) | 10; owner-scoped persisted history |
| 2 | [15 Progression certificates](../../../.github/prompts/player-15-certificates.prompt.md) | 06, 07; milestone award contract |
| 3 | [16 Sharing, export and links](../../../.github/prompts/player-16-sharing-links.prompt.md) | 12, 14; consent and share/export APIs |
| 3 | [17 Notifications](../../../.github/prompts/player-17-notifications.prompt.md) | 02; player event/inbox/push APIs |
| 2 | [18 Settings, privacy and biometrics](../../../.github/prompts/player-18-settings-privacy.prompt.md) | 02, 04; privacy/account APIs |
| Cross-cutting | [19 Offline and synchronization](../../../.github/prompts/player-19-offline-sync.prompt.md) | 01, 02 and contracts for each synchronized module |
| Release | [20 Verification and independent releases](../../../.github/prompts/player-20-release-quality.prompt.md) | All enabled modules; platform/store accounts |

Phase 1 establishes identity and paid/approved access. Phase 2 delivers the individual-plan core before optional advanced session analytics. Phase 3 adds reference-app features only where contracts are supported. Offline foundations and tests must be introduced with each dependent module, not deferred wholesale to the end.

## Player-06 evidence-gated roadmap (2026-10-29)

The owner-scoped four-discipline roadmap APIs, Q&A, server-side AI recommendation
workflow, revision history and idempotent self-practice evidence are implemented.
See [roadmap contracts, approved rules and verification](./roadmap.md). The mobile
Progress tab now uses these real contracts instead of the reference sample chart.
Assessed stages and certificates remain blocked pending video verification and
approved discipline rubrics. The local Docker API and its additive roadmap
migration were deployed with user approval and verified on Android. Other
environments still require the migration and updated API image.

## Definition of done for every module

- Deliver working native UI, typed HTTP integration, required backward-compatible server changes, explicit errors, and relevant tests; no success-shaped fixtures in production.
- Update this guide's contract/gap notes with verified outcomes and record unresolved decisions in module completion notes.
- Verify authorization, self ownership, approval/subscription gates, privacy and cross-persona isolation on the server.
- Test loading/empty/error/offline states, duplicate submission, interruptions, expired authentication, and accessibility where applicable.
- Run the smallest relevant tests plus type-check/lint. Exercise native features on Android and iOS, or record the unavailable environment and pending checks.
- Do not modify the existing club mobile app to make the new app work. Shared backend changes must preserve club/web consumers and include focused regression tests.
- Release acceptance must demonstrate all plan-image promises with real approved/sandbox integrations: correct price, one self profile, five-upload enforcement, four-discipline roadmap, solo drills, Drive, supported scorecards, milestone certificate, and checkout/approval.
