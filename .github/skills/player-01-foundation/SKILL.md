---
name: player-01-foundation
description: "Scaffold the isolated Expo React Native TypeScript player app for Android and iOS."
disable-model-invocation: true
---
Implement the individual-player application foundation.

Read [player instructions](../instructions/player-mobile.instructions.md) and [delivery guide](../../docs/features/individual-player/README.md). Prerequisite: module 00 contract baseline.

- Use the current supported Expo scaffold/package tooling to create `apps/mobile/player` with TypeScript and Expo Router. Confirm current compatible SDK/dependency versions rather than guessing them.
- Establish independent application identifiers, environment examples, scripts, lockfile, development/test/production configuration and development-build strategy. Confirm identifiers before external registration. Do not alter club Android or root tooling unnecessarily.
- Organize feature modules, typed centralized API access, DTO validation/adapters, secure session storage, server-state/cache handling and theme/UI primitives. Select the smallest maintained libraries needed; document choices.
- Add startup/session restoration, public onboarding/auth routes, pending-approval routes and protected app navigation. The sign-in route is reserved for social login with Google, Microsoft and Apple, matching the club app; module 02 implements it, so do not add an email/password form. Plan native tabs for Home, Practice, Analyze, Progress and Profile; keep unfinished destinations visibly unavailable rather than showing fabricated data.
- Build reusable loading/empty/error/retry/offline states, accessible form controls, safe-area/keyboard layouts and light/dark themes. Gate routes by actual auth/approval/entitlement state.
- Keep public API origins in environment configuration, support local-device development without localhost assumptions, and add no service secrets to Expo public config.
- Establish type-check, lint and focused unit/component tests using Expo-compatible tooling. Write a short app README with setup and Android/iOS development-build commands.

Acceptance: a real isolated scaffold starts on both platforms where available; navigation and error components have tests; type-check/lint pass. No unrequested business modules, fake production APIs, or dependencies on the native club app.
