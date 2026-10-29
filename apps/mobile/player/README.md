# eCricketCoach Player

The individual-player app is a separate Expo/React Native application. It does
not import the club Android app or backend code. This foundation uses Expo SDK
58, Expo Router, TypeScript, Expo SecureStore, TanStack Query, and Zod. Secure
storage is only a credential store; a locally stored token never proves that
the player is approved or entitled.

## Player profile

The Profile tab shows the player identity, current stage, a two-by-two Quick
Stats grid, and Edit Profile. The settings gear opens account, subscription,
and sign-out controls. Edit Profile retains the existing validated editor,
training preferences, goals, and save-conflict handling. The avatar badge also
opens this editor; photo upload is not available in this release.
The editor uses separate Player details, Your game, and Training goals cards,
with compact selection controls. The back arrow and Android Back save changed,
valid details before closing without a confirmation popup. Invalid details or
failed saves keep the editor open with an inline error; unchanged profiles close
without a save request. Membership and
sign-out actions stay in Settings rather than beneath the editing form.

The reference portrait and example stats (22 videos, 78 technique score,
12 drills, 3 certificates) are artwork fixtures shown only in development when
the authenticated dashboard explicitly returns `DEVELOPMENT_SEED`. They are
not measured results. Other accounts and release builds show an unassessed
stage, a generic avatar, and unavailable values until measured profile-stat
contracts exist. Loading and failed dashboard requests are displayed explicitly.

## Prerequisites

- Node.js supported by the selected Expo SDK and npm
- Android Studio and an Android emulator or device for local Android builds
- macOS and Xcode for local iOS builds; EAS can build iOS remotely
- An Expo account for EAS cloud builds

## Install and run

```powershell
npm ci
Copy-Item .env.example .env.local
# Set EXPO_PUBLIC_API_URL in .env.local to the reachable API origin, and
# EXPO_PUBLIC_WEB_APP_URL to the web app where players register.
npm start
```

For an Android emulator, the host machine is usually reachable at
`http://10.0.2.2:<port>`. For a physical device, use the development machine's
LAN address and ensure both devices can reach it. Do not use `localhost` for a
physical device. The API client fails explicitly when the origin is missing or
invalid; no API origin or service credential is bundled as a default.

The app's native dependencies require a development build rather than relying
on Expo Go:

```powershell
npx expo run:android
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios
```

Local iOS builds require macOS/Xcode. EAS build profiles for development,
preview, and production are in `eas.json`.

### Debugging from the repository workspace

The root VS Code launch profiles target this nested app, not the repository
root. First install a development build on your device or emulator (for local
Android, run `npx expo run:android` from this app directory).

1. Select **Run Player Android (Expo development build)** in Run and Debug to
   compile and install the native development build, start Metro, and open the
   app. The first build can take several minutes and requires the Android SDK
   and a JDK. Set `ANDROID_HOME` to your Android SDK directory if it is not
   detected automatically.
2. With the app running, select **Attach Player Android (Hermes)** to attach
   React Native Tools to Metro on port 8081. Close any other debugger attached
   to the app before attaching VS Code.
3. Use the equivalent iOS profiles on macOS with Xcode and a simulator.
   Windows cannot launch an iOS simulator; a physical iOS development build
   can connect to Metro over the LAN.

The workspace setting `react-native-tools.projectRoot` also points extension
commands at this app. The run profiles use the project's Expo CLI, not the
legacy React Native CLI or Expo Go. Once the development build is installed,
`npm run android -- --dev-client` starts Metro and reopens it without rebuilding.
If Expo reports "No development build ... is installed", run the build profile
again; starting Metro alone does not install an application.
If React Native Tools cannot attach to
this SDK, press `j` in the Expo terminal to use React Native DevTools.

#### Windows native build paths

Native modules such as `react-native-worklets` produce CMake object paths longer
than the Windows 260-character limit when built from this deep repository path
(`ninja: ... Filename longer than 260 characters` or `mkdir ... No such file or
directory`). The local config plugin
[`plugins/withShortCmakeStaging.js`](./plugins/withShortCmakeStaging.js) is
applied during prebuild. On Windows it sets `CMAKE_OBJECT_PATH_MAX` and moves
CMake staging to `%SystemDrive%\cxx\<project>`. Set `ANDROID_CXX_STAGING_ROOT` to
choose a different short directory. If a build failed before this plugin was
applied, delete the stale `.cxx` folders (for example
`node_modules/react-native-worklets/android/.cxx` and `android/app/.cxx`) before
rebuilding.

The bundle ID (`com.ecricketcoach.player`) and URL scheme
(`ecricketcoach-player`) are provisional, independent identifiers. Confirm
ownership and callback/store compatibility before registering them with
external services. They have not been provisioned.

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start the Expo development server |
| `npm run android` / `npm run ios` | Start Expo and open a connected target |
| `npm run typecheck` | Strict TypeScript check |
| `npm run lint` | Expo ESLint rules |
| `npm test` | Focused Jest/React Native Testing Library tests |

## Foundation boundaries

### Visual design and device appearance

The player app uses a compact cricket-inspired visual system: rounded surface
cards, emerald actions, discipline tiles, segmented feature views and an
icon-labelled bottom navigation. The welcome screen uses the supplied branded
batter/stadium artwork in `assets/welcome-hero.png`, with its embedded logo and
tagline displayed once and native Get Started / Log in controls below. The
image retains its original colors and full aspect ratio without cropping;
surrounding backgrounds and controls follow the device theme. Other cricket
illustrations and line icons are drawn locally with React Native primitives.
Layouts are scrollable and capped at 620
points on wider displays, with wrapping cards and accessible native controls.

Appearance always follows `useColorScheme()` and updates when the device
changes between light and dark. There is no app-level override; Settings
explains how to change the device appearance. Both palettes define backgrounds,
surfaces, borders, readable text and accents; text contrast is tested. The
Expo configuration keeps `userInterfaceStyle: "automatic"` and the status bar
uses automatic contrast.

Home and Profile render verified player data only. Profile has an overview
and an explicit editor, preserving the existing save, conflict and discard
flows. Settings and Subscription are protected routes reachable from Home or
Profile. Practice, Analysis, roadmap and certificates have navigable previews
with explicit unreleased states, not fabricated measurements or disabled
payment controls that resemble a working checkout. Google-only native sign-in
and website registration remain unchanged; the design does not introduce
password, Apple, payment, biometric or Drive flows that do not exist.

Welcome's Get Started and Log in actions both open the social-only sign-in
screen. That screen offers supported social authentication, with Create account
and Sign up links to the existing website-registration guidance. It has no
email/password form, password-login action, or password-recovery flow. Native
Google remains Android-only. Continue with Google launches the existing nonce,
native credential and session exchange flow directly, without blocking on the
provider-discovery response. It is disabled only during an in-flight sign-in;
actual failures remain visible and retryable. Apple is disabled with an
explicit release-availability note. There is no divider or "Continue on
the website" sign-in action. Registration guidance still opens the website
when a new player needs to register.

- Routes are under `src/app`; shared components, API code, session state, and
  theme primitives live under `src/`.
- Registration starts on the web app: the player chooses the Individual Player
  plan and selects **Register as Player** (identity verification, checkout, then
  system-admin approval). The app's Register screen explains those steps and
  opens `EXPO_PUBLIC_WEB_APP_URL` in the browser; it collects no personal or
  payment data. If the variable is unset, the button is disabled.
- Sign-in on Android uses native Google sign-in, matching the club app:
  `GET /api/auth/google/native` issues a five-minute nonce challenge, the local
  Expo module in `modules/google-identity` shows the Credential Manager account
  chooser bound to that nonce, and `POST /api/auth/google/native` verifies the
  Google ID token server-side and returns a session token. The Google ID token
  is never stored. Accounts that are not registered or not yet approved receive
  `REGISTRATION_REQUIRED` and are directed to the website.
- After sign-in, `GET /api/auth/player-access` (bearer session token) decides
  access on the server: only a `PLAYER` session whose own `INDIVIDUAL` tenant is
  `ACTIVE` or `TRIAL` returns `ACTIVE`. Only those session tokens are kept in
  `expo-secure-store`; other accounts see the plan-unavailable screen. On launch
  a stored token is re-checked; a rejected (401) token asks the player to sign
  in again and connectivity failures offer a retry. Sessions last eight hours;
  the API has no refresh or revocation endpoint.
- Public session screens (plan unavailable, approval, and session verification)
  react to session changes: successful local sign-out returns to Welcome,
  including when revisiting those screens through Android back navigation.
  Secure-storage removal failures keep the screen visible with retry guidance;
  Google account-selection reset does not delay leaving the screen. Approved
  players visiting public screens are redirected to Home.
- Administrator and player identities stay separate. Emails in the platform
  API's `ADMIN_EMAILS` receive a system-admin session before tenant lookup, even
  if they also own an active individual tenant. Use a separate approved player
  email for this app. Player access responses include an optional rejection
  `reason`: `ACCOUNT_TYPE_MISMATCH` for non-player roles or club tenants,
  otherwise `PLAYER_ACCESS_UNAVAILABLE`. The app explains the account mismatch
  without asserting that a subscription has expired; older responses without
  a reason retain generic access-review guidance.
- Google sign-in requires an Android OAuth client in the same Google Cloud
  project as `GOOGLE_CLIENT_ID`, registered for package
  `com.ecricketcoach.player` and the signing certificate SHA-1 (the debug
  keystore's SHA-1 for development builds; the release/Play signing SHA-1 for
  store builds). iOS native sign-in, Microsoft/Apple in-app sign-in, browser
  callback handling, and approval status remain gated; on those paths the
  screen directs players to the website.
- Home shows the self-owned profile, saved goals, discipline preferences and
  server-derived plan status. Pull to refresh updates both live sections;
  individual failures have separate retries. Profile provides plan management
  and sign-out. Practice, Analyze and Progress remain gated until their APIs
  and feature modules are implemented.
- Profile also loads, creates and edits one server-owned self profile through
  `GET`/`PUT /api/player/profile`. It supports a player name, batting hand,
  bowling style, one or more cricket disciplines, experience band and up to
  three training goals; incomplete onboarding can be saved and resumed. The
  account email is read-only. Age/guardian details and avatar media remain
  gated until their privacy and private-media decisions are approved.
- The centralized API client validates response DTOs and surfaces transport,
  HTTP, configuration, and validation failures. It does not define or mock API
  endpoints.
- Product/payment, pending-approval, age/guardian consent, avatar media, quota,
  privacy and native OAuth decisions remain gated as recorded in the
  individual-player delivery guide.

## Performance dashboard boundaries

Practice uses the supplied photographic two-by-two discipline grid, coloured
arrow controls and the "Recommended for you" card, with device-controlled
light/dark appearance and the existing bottom navigation. Discipline taps open
details and a route to training goals; they do not simulate practice sessions.
The "Back Foot Defence Drill" artwork/copy is an explicitly labelled local UI
fixture, shown only in a development build after the authenticated dashboard
returns `DEVELOPMENT_SEED` for the seeded owner. It does not replace Home's
server-provided focus, claim a personalised recommendation, or appear as a
production fallback. Other accounts see an intentional empty state; loading,
error/retry and rejected access are handled explicitly. The source screenshot
is only 170 pixels wide, so higher-resolution photos are needed for sharp
full-size artwork.

Home matches the supplied compact reference: branded header, notification bell,
personal greeting, stage ring and roadmap link, Today's Focus drill thumbnail,
four quick actions, and the five existing bottom tabs. It follows the device's
light/dark appearance. Profile and plan details remain on their dedicated screens.
All quick actions navigate to protected training screens; video/Drive/AI execution
remains gated, not simulated by the home screen.

Home composes typed `GET /api/player/profile`, `GET /api/player/subscription`,
and `GET /api/player/dashboard` adapters; it never queries club/roster resources
or supplies a player ID. Profile preferences never become measured achievements.
The dashboard endpoint returns `{dashboard: {source: "NONE", progress: null,
focus: null, notification: null}}` for players without a development fixture and
in production. The UI shows "Not yet assessed" and invites the player to explore
practice rather than manufacturing a percentage.

### Local reference data

The explicitly labelled `DEVELOPMENT_SEED` response provides
`progress: {percent, stage}`, `focus: {title, discipline, minutes, description}`,
and a sample `notification`. It is read only in development/test, scoped by
verified PLAYER session, active individual tenant and owner email. It grants no
entitlement, quota, completed practice, analysis result or milestone. Opening the
notification clears its dot for the current home-screen session; it is not a
production notification inbox. The drill thumbnail is cropped from the supplied
reference image; a higher-resolution source can replace it.

Apply the additive schema before deploying the endpoint to an existing database:
[`player-dashboard-schema.sql`](../../../services/platform-api/src/scripts/player-dashboard-schema.sql).
Then run the idempotent
[`seed-player-dashboard.sql`](../../../services/platform-api/src/scripts/seed-player-dashboard.sql)
against the local API database. It requires exactly one existing active individual
tenant for `shahanur.reza.rony@gmail.com`, seeds only that tenant's demo, and never
changes approval, billing, profile preferences or other accounts. Both scripts are
transactional and fail explicitly on invalid prerequisites. For the existing local
Docker stack, from the repository root in PowerShell:

```powershell
Get-Content services\platform-api\src\scripts\player-dashboard-schema.sql |
  docker exec -i ecricketcoach-postgres-1 sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
Get-Content services\platform-api\src\scripts\seed-player-dashboard.sql |
  docker exec -i ecricketcoach-postgres-1 sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

The monthly video-action limit comes from the plan DTO. It is not a remaining
balance: the existing contract provides neither usage nor a quota reset date,
and explicitly disables analysis. Subscription `period.endsAt` is the access
expiry, never an allowance reset. No usage chart is rendered without measured
data. Practice, roadmap, analysis/history and awards have explicit unreleased
states, not empty-result claims or example achievements.

Requests run in parallel on focus and refresh, with no automatic retries.
Leaving Home cancels all three requests. In-memory query keys include the session
email; sign-in/sign-out clears the query cache. Home's profile key has a
`dashboard` suffix so cancelling Home never cancels the profile editor's
request. Profile saves update both caches immediately, and returning Home
revalidates all sections. Cache retention is five minutes after the last observer is removed;
there is no disk persistence. Only network/timeout failures may show a prior
snapshot, with its fetch timestamp and an out-of-date warning. HTTP and schema
failures do not use stale fallbacks; 401/403 hides all dashboard content.
Active access is rechecked at expiry (at most once daily for longer periods)
while Home is focused. Existing protected routing handles pending approval.

## Approval-backed development subscriptions

Until a real payment provider is integrated, the platform API can explicitly
enable development-only player subscriptions:

```dotenv
NODE_ENV=development
PLAYER_DEVELOPMENT_SUBSCRIPTIONS=true
```

Set these on the **platform API** and restart it. Never add them to the mobile
app's public environment configuration. Both settings are required;
`NODE_ENV=production` always disables this mode.
For the repository's local Docker stack, set
`PLAYER_DEVELOPMENT_SUBSCRIPTIONS=true` in `deploy/.env` and rebuild/recreate the
`server` service. Compose already sets `NODE_ENV=development`; the opt-in flag
defaults to `false`. For a directly run API, use `services/platform-api/.env`
or its process environment.

1. Register for the monthly Individual Player plan on the website. Player
   applications need no card details and create no paid invoice.
2. Sign in to the website as system admin and approve the application.
3. Sign in to the player app with that registered Google account. The app opens
   the dashboard and loads `GET /api/player/subscription` using the securely
   stored session.
4. The development subscription lasts one month, does not auto-renew, and is
   shown as expired at its end. In the web admin Customers tab, use
   **Renew player month** to give an expired player another month. Retrying
   renewal does not extend an already-active period.

Existing active individual tenants with a matching approved application receive
one initial development month on their first subscription lookup. Repeated
approval/sign-in cannot create a second subscription or reset its expiry.
Disabling the mode makes these subscriptions unavailable without deleting them.

This is a development access mechanism, not a verified payment. Real checkout,
purchase restoration, age/guardian consent, avatar media, analysis uploads and
quota counters remain gated. The app does not display a fabricated five-use
balance or reset date. See the [delivery guide](../../../docs/features/individual-player/README.md)
for the contract, test coverage and remaining production blockers.
