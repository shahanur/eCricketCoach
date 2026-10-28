---
name: player-02-auth-registration
description: "Implement individual-player authentication, verified registration, pending approval and session lifecycle."
agent: agent
---
Implement player authentication and registration using the club/academy journey's existing backend semantics, not its organization-specific UI.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), [delivery guide](../../docs/features/individual-player/README.md), and [registration workflow](../../docs/auth-and-registration-workflow.md). Prerequisites: 00 and 01. Coordinate checkout with module 03.

- Discover available identity providers and implement only configured provider flows. Existing native Google returns `REGISTRATION_REQUIRED` for new users; the browser callback can issue a registration token. Define a safe mobile handoff instead of assuming those responses are equivalent.
- Support startup restoration, sign-in, verified identity, individual plan selection/handoff to checkout, pending system-admin approval, rejection/retry and activation followed by sign-in. Persist only the minimum pending-registration state and handle registration-token expiry.
- Do not require academy/club name or organization fields. Prevent duplicate registration and repeated checkout on retries. Never allow the user to select a privileged role.
- Add an owner-safe registration-status contract if missing. Never poll admin listings or issue full application access merely to inspect approval.
- Preserve the current individual active-tenant -> `PLAYER` login mapping; coordinate durable self-profile provisioning with module 04.
- Register separate Android/iOS callback transport. Validate callback destination, state/nonce/challenge and token issuer/audience as appropriate; use system-browser/provider-supported authentication, not an embedded credential webview. Remove callback credentials promptly and never log them.
- Store session tokens securely, centralize 401/403 handling and clear user-scoped data on sign-out/account switch. The current backend has no verified refresh/revocation API: implement explicit expiry and reauthentication, not imaginary refresh calls. Add server lifecycle APIs only under an agreed contract.
- Check current Apple sign-in/store requirements for the chosen login offerings before iOS release.

Acceptance: tests cover existing/new player, expired/forged/replayed callback, cancelled provider login, duplicate registration, pending/rejected/approved state, unsupported role, cross-owner status access, session expiry and logout. Verify browser return on Android and iOS; preserve club registration behavior.
