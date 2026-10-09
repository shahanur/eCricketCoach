# eCricketCoach Android

Native Android client built with Kotlin and Jetpack Compose. This first release
supports provider-based sign-in, the shared drill catalogue, coach training
templates, and cached read-only access to the last successfully synchronized
catalogues.

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

The debug build calls the API directly at
`http://10.0.2.2:5001`, matching the API port exposed by Docker Compose.
For a physical device, set `apiBaseUrl` to the server's reachable address on
port 5001, for example:

```properties
apiBaseUrl=http://192.168.1.20:5001
```

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

Microsoft and Apple still use a separate browser origin: the debug build defaults to
`http://10.0.2.2:3000`, the web application's Docker port. The API calls
`/api/auth/providers` and authenticated endpoints on port 5001; sign-in opens
the existing web/API OAuth route on port 3000 for those providers, which returns the same API JWT
to the app. For a physical device set `oauthOrigin` to the reachable web
origin. As in the web app, sign-in uses Google, Microsoft, or Apple OAuth; it
does not introduce a separate password-login API.

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
- Shared drill catalogue for all signed-in roles.
- Shared training templates for coaches and club administrators.
- Cached catalogue/template snapshots for offline read-only use.
- Dark/light theme toggle and explicit sign-out.

Push notifications, video capture/upload, and offline write synchronization
are not enabled in this starter. They need API-side push registration/delivery
and durable mutation/sync endpoints before the mobile app can safely support
them.
