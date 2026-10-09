# eCricketCoach Android

Native Android client built with Kotlin and Jetpack Compose. It supports
provider-based sign-in, club coaching workflows, shared training resources,
video analysis, and club progression features through the existing eCricketCoach
API.

## Requirements

- Android Studio with Android SDK 35 and JDK 17
- A running eCricketCoach API (`web-app/server`)
- At least one configured social identity provider on the API

Open `mobile-app` in Android Studio and run the `app` configuration on an
emulator or device. Or use the deployment helper from Bash (Git Bash on
Windows), with Android SDK tools and JDK 17 installed:

```bash
./deploy-emulator.sh
```

The helper uses the first configured AVD if none is running, waits for Android
to boot, then builds, installs, and launches the app. To choose a particular
AVD, pass `--avd NAME`; if an emulator is already running, it uses that
emulator. You can also configure the API and OAuth origins with
`--api-base-url URL` and `--oauth-origin URL`.

If `JAVA_HOME` is unset and `java` is not on `PATH`, the script uses the JDK
bundled with Android Studio (`<Android Studio>/jbr`). To use a different JDK
(17 or later), set `JAVA_HOME`.

The debug build defaults to the configured public ngrok origin for both API
requests and browser-based OAuth:

```properties
apiBaseUrl=https://unglazed-perm-flap.ngrok-free.dev
oauthOrigin=https://unglazed-perm-flap.ngrok-free.dev
```

The ngrok tunnel must remain running and forward requests to the eCricketCoach
API (or to the web nginx proxy that forwards `/api` to the API). The API health
check is available at `<origin>/api/health`. For a local Android emulator
instead, override the properties with `apiBaseUrl=http://10.0.2.2:5001` and
`oauthOrigin=http://10.0.2.2:3000`. For another network/device, set them to
the corresponding reachable API and OAuth origins when building.

Google sign-in uses Android Credential Manager, not the browser. The app gets
the existing **Web application** client ID from the API's `GOOGLE_CLIENT_ID`,
requests a nonce-bound Google ID token, and exchanges it at
`POST /api/auth/google/native` on port 5001 for the same eight-hour JWT as the web
app. The API verifies Google's signature, issuer, audience, expiry, nonce, and
verified email, then applies the existing administrator/active-roster rules.
Accounts without an active roster must complete registration in the web app first.

In the same Google Cloud project as the web OAuth client, create an **Android**
OAuth client with package name `com.ecricketcoach.mobile` and the SHA-1 of the
certificate signing the installed APK. For the debug build:

```bash
"$JAVA_HOME/bin/keytool" -list -v -keystore "$HOME/.android/debug.keystore" -alias androiddebugkey -storepass android
```

Use the release/Play signing certificate for production. Keep `GOOGLE_CLIENT_ID`
set to the **web** client ID, not the Android client ID. A Google Play-enabled
emulator/device with Google Play services is required; the native Google button
can prompt to add an account. No new Google redirect URI or tunnel is needed for
native Google login. Rebuild/recreate the API container after updating its code,
and redeploy the APK. Existing web Google redirects remain unchanged.

Microsoft and Apple sign-in open the configured `oauthOrigin` in a browser.
Register the public origin/callback with the identity provider and include it
in the API's `APP_ORIGIN` configuration if using those providers. Native Google
sign-in exchanges its token directly with the API. As in the web app, sign-in
uses Google, Microsoft, or Apple OAuth; it does not introduce a separate
password-login API.

Google Drive video analysis uses the existing server-side OAuth integration.
Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the API, add the
browser-facing API/web origin to `APP_ORIGIN`, and register
`<APP_ORIGIN>/api/google-drive/callback` as an Authorized Redirect URI on the
Google OAuth web client. Grant the Drive scopes requested by the API. Keep the
client secret and Gemini key (`GEMINI_API_KEY`) on the server; never add them
to the Android build. The app opens the existing server authorization flow;
after returning from the browser, use **Refresh videos** to recheck status and
load the account's video list.

For deployment, set `apiBaseUrl` to the externally reachable HTTPS API origin
and `oauthOrigin` to the HTTPS web/API origin registered in `APP_ORIGIN` and
the identity-provider callback settings. For example:

```powershell
.\gradlew.bat :app:assembleRelease -PapiBaseUrl=https://api.example.com -PoauthOrigin=https://coach.example.com
```

The OAuth origin routes `/api/auth/{provider}` and the provider callback
`/api/auth/{provider}/callback` to the existing API. Register that callback
origin with the identity provider and include it in the API's `APP_ORIGIN`.
The API accepts only the exact `ecricketcoach://auth/callback` return URI for
Android; it is not a general-purpose redirect URL. Session tokens use
Android Keystore-backed encrypted preferences. Use HTTPS for release builds;
cleartext traffic is allowed only in debug builds for local development.

## Current scope

- Native Google sign-in via Credential Manager when configured in Google Cloud.
- Browser-based Microsoft and Apple sign-in when enabled by the API. Microsoft
  MSAL integration is not implemented yet; Apple has no equivalent native Android SDK.
- Club coach and administrator workspaces for roster assignment, squad creation,
  session scheduling/publishing and editing, player assessments, custom club drills,
  progression, and club branding.
- Resumable session execution with preparation checklist, assigned-player
  attendance, per-drill planned/actual time and notes, incidents, player notes,
  evaluation, saved progress, and explicit completion. Session execution is
  loaded and saved through the authenticated coach API; the server enforces
  assigned-coach and scheduled-date rules.
- The session action is **Run**, matching the web UI. It is available only to
  the assigned lead, coordinator, or assistant coach. Assigned coaches and club
  administrators can use **Edit** before delivery to change the title, date,
  duration, squad, and safety instructions. Saved drills, coach assignments,
  execution progress, and individual player targeting are preserved unless
  the squad changes; changing squad replaces individual targeting. Edit errors
  stay in the dialog so unsaved input is not lost. Editing requires a live
  connection; delivered plans are read-only.
- Club-scoped session activity reports with session-title, date-range, and
  status filters; CSV and PDF exports use Android's share/save chooser.
- Completed-assessment insight generation with returned recommendations and
  explicit API/AI error reporting.
- Filterable certificate viewing and branded PDFs generated from saved
  certificate fields. Club administrators can delete certificates; other roles
  cannot. Certificate PDFs can be shared or saved through Android's chooser.
- Device-file and Google Drive video selection for Gemini analysis, plus saved
  analysis history and visible Drive connection/listing errors.
- Shared drill catalogue and training templates for signed-in coaching roles.
- Cached catalogue/template snapshots for offline read-only use.
- Dark/light theme toggle and explicit sign-out.

The encrypted offline queue supports only squad reassignment and session
execution snapshots. It is scoped to the signed-in user and tenant, preserves
stable operation IDs, retries pending changes when connectivity returns, and
compares the server's current value before replay. Conflicts or server rejections
remain visible as failed items until reviewed; a failed item can only be removed
after explicit confirmation. Other mutations (including invites, scheduling,
promotion, assessments, branding, and drill changes) require a live connection.
Queued completion is not shown as delivered until the API confirms it.

Push notifications are **not enabled**. This repository has no Firebase/FCM
Android registration or supported backend delivery/provider configuration, so
the app does not request notification permission, create a push token, or claim
that push is active. Enabling push requires adding a supported provider
integration and deployment-side credentials/token registration; provider
credentials must remain server-side. Existing server-generated in-app/web
notifications do not imply Android push delivery.

Deploy the matching API build to expose the authenticated, tenant-scoped
session-report data route and coach session-execution load route, and to enforce
tenant/role checks on session deletion. Device verification of the Google OAuth
return-to-app flow, Android share targets, and runtime behavior across
connectivity changes still requires a configured emulator or device.

If **Run** reports that the execution route is missing, rebuild and redeploy
the API (not only the Android app). From `web-app`, run
`docker compose up -d --build --no-deps server`. Existing API images may have
the execution PATCH route without the newer GET route required to open Run.
The session-edit PATCH route also requires authentication; the web caller and
mobile caller both send the signed-in session token.
