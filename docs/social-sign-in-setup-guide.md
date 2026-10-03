# Social Sign-In Setup Guide (Google, Microsoft, Apple)

This guide provides end-to-end instructions for configuring federated OpenID Connect (OIDC) identity providers in eCricketCoach. Once configured, users can log in and register using their **Google**, **Microsoft**, or **Apple** accounts.

---

## Architecture Overview

- **Frontend Origin**: `http://localhost:3000`
- **Backend API Gateway**: `http://localhost:5001` (proxied by Nginx at `http://localhost:3000/api/`)
- **Environment Configuration**: `web-app/.env` (cloned from `web-app/server/.env.example`)
- **JWT Verification**: Managed securely via `jose` fetching upstream JSON Web Key Sets (JWKS).

---

## Step 1: Initialize Local Environment File

In PowerShell from the repository root:

```powershell
Set-Location web-app
Copy-Item .\server\.env.example .\.env
```

Generate a secure random string for `JWT_SECRET`:

```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

Open `web-app/.env` and paste this string into `JWT_SECRET`.

---

## Step 2: Google Identity Services (Google Cloud Console)

### 1. Access Credentials
Navigate to the [Google Cloud Console Credentials Dashboard](https://console.cloud.google.com/apis/credentials).

### 2. Select or Create Project
Select an existing Google Cloud project or create a new one (e.g., `ecricketcoach-auth`).

### 3. Configure OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** user type and click **Create**.
3. Fill in the required application fields:
   - **App name**: `eCricketCoach`
   - **User support email**: Your admin/developer email.
   - **Developer contact information**: Your email address.
4. On the **Scopes** step, click **Add or Remove Scopes** and select:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
5. On the **Test Users** step, add the personal Google email address you plan to test with while the app is in Testing mode.
6. Save and finish.

### 4. Create OAuth 2.0 Web Client ID
1. Navigate to **APIs & Services** > **Credentials** > **+ Create Credentials** > **OAuth client ID**.
2. Set **Application type** to **Web application**.
3. Set **Name** to `eCricketCoach Web Client`.
4. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000`
5. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/auth/google/callback`
6. Click **Create** and copy your **Client ID** and **Client Secret**.

### 5. Update Environment File
Add the credentials to `web-app/.env`:
```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret
```

---

## Step 3: Microsoft Entra ID (Azure Portal)

### 1. Access App Registrations
Navigate to the [Azure Portal App Registrations Dashboard](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps).

### 2. Register New Application
1. Click **+ New registration**.
2. Fill in the registration form:
   - **Name**: `eCricketCoach`
   - **Supported account types**: Select **Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)**.
   - **Redirect URI**: Select **Web** and enter:
     - `http://localhost:3000/api/auth/microsoft/callback`
3. Click **Register**.

### 3. Record Application (Client) ID
On the app's **Overview** screen, copy the **Application (client) ID** (a GUID).

### 4. Generate Client Secret
1. Select **Certificates & secrets** in the left sidebar navigation.
2. Under the **Client secrets** tab, click **+ New client secret**.
3. Set **Description** to `Local Dev Secret` and choose your preferred expiration period (e.g., 180 days).
4. Click **Add**.
5. **Immediately copy the Secret Value** from the table (this value is only displayed once).

### 5. Verify Authentication Settings
1. Select **Authentication** in the left sidebar navigation.
2. Under **Web**, confirm that `http://localhost:3000/api/auth/microsoft/callback` is listed.

### 6. Update Environment File
Add the credentials to `web-app/.env`:
```env
MICROSOFT_CLIENT_ID=your-microsoft-application-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret-value
```

---

## Step 4: Apple Sign-In (Apple Developer Portal)

*(Note: Requires an active Apple Developer Program membership. If unavailable, leave Apple variables empty; Google and Microsoft will function independently.)*

### 1. Register App ID
1. Navigate to [Apple Developer Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).
2. Click **+** > **App IDs** > **Continue**.
3. Select **App**, set Description to `eCricketCoach App` and an explicit Bundle ID (e.g., `com.ecricketcoach.app`).
4. Under **Capabilities**, enable **Sign In with Apple**. Click **Register**.

### 2. Register Services ID (Web OAuth)
1. In Identifiers, click **+** > **Services IDs** > **Continue**.
2. Set Description to `eCricketCoach Web OAuth` and Identifier to `com.ecricketcoach.client` (this is your `APPLE_CLIENT_ID`).
3. Enable **Sign In with Apple**, then click **Configure**:
   - **Primary App ID**: Select the App ID created in step 1.
   - **Domains and Subdomains**: `localhost` (or your production domain).
   - **Return URLs**: `http://localhost:3000/api/auth/apple/callback`.
4. Save and click **Continue** to register.

### 3. Generate Private Key for Client Secret
1. Go to **Keys** > **+**.
2. Key Name: `eCricketCoach Auth Key`. Enable **Sign in with Apple** > **Configure** > Select your Primary App ID.
3. Download the generated `.p8` key file. Note your **Key ID** and **Team ID**.
4. Generate a signed ES256 client secret JWT using the `.p8` key (valid for up to 6 months).

### 4. Update Environment File
Add the credentials to `web-app/.env`:
```env
APPLE_CLIENT_ID=com.ecricketcoach.client
APPLE_CLIENT_SECRET=your-generated-jwt-from-p8-key
```

---

## Step 5: Complete Environment Variable Checklist

Verify that `web-app/.env` contains the required settings:

```env
APP_ORIGIN=http://localhost:3000
JWT_SECRET=your-strong-random-jwt-secret
ADMIN_EMAILS=shahanurreza@gmail.com

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-azure-application-id
MICROSOFT_CLIENT_SECRET=your-azure-client-secret

# Apple Sign-In (Optional)
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
```

---

## Step 6: Deploy & Restart Containers

Rebuild and start the updated stack from `web-app`:

```powershell
docker compose up --build -d
```

---

## Step 7: Verify Provider Status

Query the backend provider configuration endpoint:

```powershell
Invoke-RestMethod -Uri http://localhost:5001/api/auth/providers
```

Sample output when Google and Microsoft are configured:
```json
{
  "google": true,
  "microsoft": true,
  "apple": false
}
```

---

## Step 8: End-to-End Testing

1. Open **http://localhost:3000** in your browser.
2. Click **Log In** on the navigation bar.
3. Select **Continue with Google** or **Continue with Microsoft**.
4. Sign in and grant consent in the provider dialog.
5. **Observed Behavior**:
   - **New User**: Redirected to the registration checkout form with the **"Verified by social sign-in"** badge and locked name/email fields.
   - **Existing User**: Immediately logged in and routed to the assigned workspace portal (`CLUB_PORTAL` or `COACHING_PORTAL`).
