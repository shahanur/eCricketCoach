---
name: player-02-auth-registration
description: "Implement individual-player social sign-in (Google, Microsoft, Apple), verified registration, pending approval and session lifecycle."
agent: agent
---
Implement player authentication and registration using the club/academy journey's existing backend semantics, not its organization-specific UI.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), [delivery guide](../../docs/features/individual-player/README.md), and [registration workflow](../../docs/auth-and-registration-workflow.md). Prerequisites: 00 and 01. Coordinate checkout with module 03.

## Sign-in: social login with Google, Microsoft and Apple

Sign-in uses social login only, matching the club app's login (`apps/mobile/club/android/.../presentation/auth/SignInScreen.kt` and `CoachApi.kt`). There is no email/password form.

- Offer **Continue with Google**, **Continue with Microsoft** and **Continue with Apple** buttons, using each provider's official logo and branding guidelines. Show only providers that `GET /api/auth/providers` reports as configured (Google counts as enabled when `googleNative` or `google` is true). Show a friendly message if none are available or the check fails, with a retry.
- Reuse the existing backend flows in `services/platform-api/src/routes/auth.ts`; do not add a new identity service. Browser OIDC starts at `GET /api/auth/:provider?returnTo=<callback>` (Apple uses `form_post`). Google may also use the native nonce/challenge flow at `GET`/`POST /api/auth/google/native`, as the club app does.
- Open providers in the system browser or the platform auth session (`expo-web-browser` `openAuthSessionAsync` / ASWebAuthenticationSession / Custom Tabs), never an embedded webview. Handle cancel, provider error, and an expired or missing callback with friendly, retryable messages.
- The player app has its own callback scheme (`ecricketcoach-player://auth/callback`). The backend `safeReturnTo` allowlist currently accepts only the club app's `ecricketcoach://auth/callback`. Add the player callback to that allowlist as an explicit, tested backend change; never reuse the club scheme.
- An existing approved individual player receives `auth_token` in the callback; store it in secure storage and continue to the session flow below. A new identity receives a registration token (browser) or `REGISTRATION_REQUIRED` (native Google); send it into the registration handoff, not a signed-in state.
- On iOS, Sign in with Apple must be offered whenever another social login is offered (App Store guideline 4.8). Verify Apple's current requirements, configure Apple Services ID and return URLs, and test on a real device.
- Sign-in screen copy and layout must meet the production-quality rules in the player instructions: branded, friendly wording, and no technical messages.

## Registration and session lifecycle

- Discover available identity providers and implement only configured provider flows. Existing native Google returns `REGISTRATION_REQUIRED` for new users; the browser callback can issue a registration token. Define a safe mobile handoff instead of assuming those responses are equivalent.
- Support startup restoration, sign-in, verified identity, individual plan selection/handoff to checkout, pending system-admin approval, rejection/retry and activation followed by sign-in. Persist only the minimum pending-registration state and handle registration-token expiry.
- Do not require academy/club name or organization fields. Prevent duplicate registration and repeated checkout on retries. Never allow the user to select a privileged role.
- Add an owner-safe registration-status contract if missing. Never poll admin listings or issue full application access merely to inspect approval.
- Preserve the current individual active-tenant -> `PLAYER` login mapping; coordinate durable self-profile provisioning with module 04.
- Register separate Android/iOS callback transport. Validate callback destination, state/nonce/challenge and token issuer/audience as appropriate; use system-browser/provider-supported authentication, not an embedded credential webview. Remove callback credentials promptly and never log them.
- Store session tokens securely, centralize 401/403 handling and clear user-scoped data on sign-out/account switch. The current backend has no verified refresh/revocation API: implement explicit expiry and reauthentication, not imaginary refresh calls. Add server lifecycle APIs only under an agreed contract.
- Check current Apple sign-in/store requirements for the chosen login offerings before iOS release.

Acceptance: tests cover Google, Microsoft and Apple sign-in (each enabled/disabled by provider discovery), existing/new player, expired/forged/replayed callback, cancelled provider login, duplicate registration, pending/rejected/approved state, unsupported role, cross-owner status access, session expiry and logout. Verify browser return for each provider on Android and iOS; preserve club login and registration behavior, including the club app's existing callback.
