# Individual-player app delivery guide

## Purpose and architecture

Create a separately maintained Android/iOS application in `apps/mobile/player` using **Expo + React Native + TypeScript**, sharing the existing backend microservices. These files are an implementation kit, not an implementation of the app.

Expo is recommended for cross-platform native UI, TypeScript support, camera/media integrations, secure storage, and independent builds. Use development builds and supported native modules where required. Validate camera throughput, capture timing, video playback, and background transfers on real devices before committing to advanced capture features. Native modules may be needed; do not switch the whole app to a different framework without evidence and agreement.

The existing Kotlin club/academy app remains in `apps/mobile/android`, unchanged. Do not use the unrelated `mobile-app` directory as the new application root. The player app needs its own identifiers, configuration, navigation, dependencies, build/release pipeline, and assets. Backend reuse does not mean sharing privileged club UI or trusting role checks made only on the device.

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

## Current backend baseline and blockers

| Area | Evidence to inspect | Reuse/gap |
|---|---|---|
| Authentication | `services/platform-api/src/routes/auth.ts`, middleware, existing native auth repository | Provider discovery and Google native/provider callbacks exist. Session JWT lasts eight hours; no refresh/revocation/logout API was found. Native Google returns `REGISTRATION_REQUIRED` for unregistered users; browser registration provides a registration token. iOS callback transport needs implementation |
| Registration and plans | `services/platform-api/src/routes/subscriptions.ts`, `routes/admin.ts`, Prisma tenant/approval models | `INDIVIDUAL` approval creates an active tenant with `activeMembers: 1` but no `ClubMember`. Subsequent tenant-based OAuth login resolves to `PLAYER`. A self-profile mapping and owner-safe pending-status API are still needed |
| Checkout | `POST /api/subscriptions/checkout` | Current handler records a paid invoice without a real provider transaction and accepts card data. Production mobile payment is blocked until secure provider/store validation exists |
| Price | `GET /api/subscriptions/plans` | Individual prices are 14.99 monthly and 149.99 annual, without a currency field; invoices store GBP but notifications use a dollar sign. Resolve this inconsistency against the image's GBP monthly offer; annual billing is not required for this app |
| Profile/dashboard | Tenant/member models and club routes | No dedicated self-player profile/dashboard contract established |
| Training | `/api/drills`, `/api/training-templates`, player assignment/progression models | Shared content exists; self roadmap, solo-practice persistence and player access need contracts |
| AI video | `/api/videos/analyze`, `routes/ai.ts`; existing analysis repository | Device multipart/Drive analysis and general owner-scoped history exist. OpenAI batting report routes restrict access to `CLUB_ADMIN`/`COACH` and require a tenant player member; individual `PLAYER` access needs a safe adapter/extension, not a client role change. Some local analysis is currently anonymous |
| Club analysis | `/api/club/assessments`, `/api/club/cape-jobs` | Existing club workflows are not automatically player-accessible; adapt shared logic behind appropriate player authorization |
| Drive | `routes/googleDrive.ts` | Connect/callback/status/videos/content/upload/disconnect exist. Connections belong to JWT `userId`, not a tenant-wide Drive. Verify mobile callback support and explicit sync semantics |
| Quotas | AI/assessment routes and subscription plan metadata | Some paths return 429; no unified player usage/status contract established |
| Certificates | Club certificates and promotion models/routes | Existing domain model can inform reuse; self-player eligibility/list/download/verification needs a safe contract |
| Notifications | Admin notifications in checkout/admin routes | Player inbox, preferences, device tokens and push delivery not established |
| Privacy | Existing resource-deletion routes | No verified full account-deletion, personal export, consent or player privacy API |

Never invent an existing `/api/player/*` endpoint. Proposed contracts may use an agreed namespace only after implementation ownership and compatibility are decided. Keep all backend changes in existing services.

## Product decisions to resolve during implementation

1. Reconcile GBP pricing with actual plan/store product currency, taxes and localized prices. Decide Apple/Google billing versus permitted external checkout using current store rules. Do not assume a web checkout can be embedded for digital features.
2. Extend the existing individual tenant-to-`PLAYER` login mapping with a durable self profile without club-management permissions. Define secure pending/rejected approval status, resubmission, sign-in after activation, cancellation and entitlement-expiry behavior. Do not query admin approval listings from a pending player's app.
3. Decide whether billing starts before approval as the image implies; specify refunds/voids for rejection and cancellation while pending. A sandbox/legacy paid flag is not a payment system.
4. Define the monthly quota reset: calendar month or subscription billing period, timezone, reservations, failed jobs, retries, Drive imports, concurrent requests, and retention. The five-upload allowance is for AI analysis, not an arbitrary limit on local recordings or browsing.
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

## Definition of done for every module

- Deliver working native UI, typed HTTP integration, required backward-compatible server changes, explicit errors, and relevant tests; no success-shaped fixtures in production.
- Update this guide's contract/gap notes with verified outcomes and record unresolved decisions in module completion notes.
- Verify authorization, self ownership, approval/subscription gates, privacy and cross-persona isolation on the server.
- Test loading/empty/error/offline states, duplicate submission, interruptions, expired authentication, and accessibility where applicable.
- Run the smallest relevant tests plus type-check/lint. Exercise native features on Android and iOS, or record the unavailable environment and pending checks.
- Do not modify the existing club mobile app to make the new app work. Shared backend changes must preserve club/web consumers and include focused regression tests.
- Release acceptance must demonstrate all plan-image promises with real approved/sandbox integrations: correct price, one self profile, five-upload enforcement, four-discipline roadmap, solo drills, Drive, supported scorecards, milestone certificate, and checkout/approval.
