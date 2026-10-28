# eCricketCoach Player

The individual-player app is a separate Expo/React Native application. It does
not import the club Android app or backend code. This foundation uses Expo SDK
58, Expo Router, TypeScript, Expo SecureStore, TanStack Query, and Zod. Secure
storage is only a credential store; a locally stored token never proves that
the player is approved or entitled.

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
- Google sign-in requires an Android OAuth client in the same Google Cloud
  project as `GOOGLE_CLIENT_ID`, registered for package
  `com.ecricketcoach.player` and the signing certificate SHA-1 (the debug
  keystore's SHA-1 for development builds; the release/Play signing SHA-1 for
  store builds). iOS native sign-in, Microsoft/Apple in-app sign-in, browser
  callback handling, and approval status remain gated; on those paths the
  screen directs players to the website.
- Home and Profile show the player's server-derived subscription status and
  expiry, with refresh, renewal guidance and sign-out. Practice, Analyze and
  Progress remain gated until their APIs and feature modules are implemented.
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
