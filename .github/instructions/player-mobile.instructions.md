---
description: "Use when building the separate individual-player Expo React Native app, player onboarding, solo practice, video analysis, roadmaps, subscriptions, or player mobile tests."
applyTo: "apps/mobile/player/**"
---
# Individual-player mobile app

## Architecture

- Build only the individual-player app in `apps/mobile/player` using Expo, React Native, Expo Router, and strict TypeScript for Android and iOS. Use an Expo development build when native capabilities require it; do not assume Expo Go supports all integrations.
- This is a separate application, not a role switch inside `apps/mobile/club/android`. Preserve the existing native club/academy app, web app, and their builds.
- Give this app independent package scripts, environment configuration, bundle/application identifiers, deep-link scheme, assets, build profiles, and release pipeline. Confirm identifiers before provisioning external services.
- Use the existing backend microservices through centralized, typed HTTP clients. Never import backend code, Prisma, Kotlin UI, or service credentials into the mobile bundle.
- Follow [the player delivery guide](../../docs/features/individual-player/README.md) for scope, dependencies, product decisions, and backend gaps. Older native-Android implementation prompts target the club app, not this application.

## Implementation rules

- Separate routes/screens, reusable UI, feature logic, API adapters/DTOs, and platform integrations. Keep business logic out of rendering components.
- Reuse backend contracts, not club screens or privileged club endpoints. Verify method, route, payload, response, JWT roles, tenant status, and resource ownership before use. Document proposed contracts explicitly before implementing them in the existing service.
- The backend enforces one self profile, ownership, approval status, subscription entitlements, quota, milestone eligibility, and signed media access. Client checks improve UX; they do not grant permission.
- Never infer that a `PLAYER` role, an `INDIVIDUAL` tenant, and an approved subscription are interchangeable. Verify their actual provisioning relationship.
- Use public environment configuration only for public values such as API origins. All secrets, payment credentials, AI keys, and Drive refresh tokens remain server-side.
- Store session credentials in platform-backed secure storage. Do not persist tokens in ordinary key-value storage, URLs beyond unavoidable callback handling, logs, analytics, or unscoped caches.
- Centralize authorization headers, timeout/cancellation, typed error decoding, and user-friendly notifications. Do not invent refresh-token support or silently treat failures as empty/successful responses.
- Use accessible, responsive native UI with readable text, screen-reader labels, adequate touch targets, safe areas, keyboard handling, and light/dark themes. Render loading, empty, error, retry, offline, and forbidden states deliberately.
- Use original eCricketCoach UI/copy/assets. The functionality reference is a behavioral checklist, not permission to copy another product's assets, code, branding, or inferred algorithms.

## Product and device constraints

- The target plan is GBP 14.99/month, one player, five AI video action uploads per month, Drive sync, four-discipline roadmaps, solo drills, biomechanics/kinematics scorecards, and milestone certificates. Price, currency, billing period, renewal, quota accounting, and entitlements come from an approved backend/store contract, not hardcoded checks.
- Preserve the shared registration journey: provider authentication/verification, individual plan selection, checkout, pending system-admin approval, then activation. Do not copy club fields such as organization name into player onboarding.
- Do not collect raw payment-card details or trust the current checkout's paid record as a real provider payment. Store-policy and payment integration decisions must precede production checkout.
- Request camera, microphone, media, notifications, and biometrics only when needed. Do not add contacts or location permissions based only on the reference app's manifest.
- Respect platform limits on capture, uploads, background execution, and iOS suspension. Describe supported behavior; never promise uninterrupted background recording.
- Do not fabricate speed/spin/swing, pitch maps, scores, recommendations, milestones, or medical conclusions. Require supported, versioned analysis outputs with units, provenance, confidence/quality, and unavailable states.
- Protect youth users: gate unresolved age/guardian-consent, retention, privacy, and sharing requirements before production release; default media and progress to private.

## Verification

- Add focused unit and integration/component tests with each module. Mock only in tests or explicitly marked development fixtures, never as a production API fallback.
- Test unauthorized, cross-user/cross-tenant, expired-session, unapproved, inactive-subscription, and quota-exhausted paths alongside the happy path.
- Validate on Android and iOS; a successful Android build alone is insufficient. Use physical-device checks for capture, OAuth callbacks, store billing, Drive, and background transfers.
- Use the app's selected package manager and existing scripts once established. Run focused tests, lint, and type-check; document any environment-blocked native validation honestly.
