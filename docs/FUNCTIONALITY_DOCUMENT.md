# Fulltrack AI Functionality Document

**Application:** Fulltrack AI (`ai.fulltrack`)
**Version analyzed:** 4.7.0
**Platform:** Android, React Native release build
**Analysis basis:** Decompiled Java/Kotlin sources, Android manifest, bundled resources, API inventory, and existing codebase analysis
**Analysis date:** 2026-09-29

## 1. Executive Summary

Fulltrack AI is a cricket video and performance-analysis application. Its primary workflow is to set up a camera near a cricket pitch, calibrate the device against the stumps, record deliveries, associate deliveries with batters and bowlers, upload the captured session, and review analytical results.

The application also provides account management, session history, media review and sharing, team/player tagging, preferences, subscription purchases, notifications, deep links, and analytics/diagnostic telemetry.

This document describes behavior evidenced by the decoded APK. Items marked **Inferred** are supported by code, endpoint, model, or asset names but were not verified through live interaction with the original backend.

## 2. Primary User Roles

| Role | Capabilities evidenced |
|---|---|
| Signed-in player or coach | Capture sessions, review deliveries, view analysis, manage profile and preferences |
| Team or session organizer | Associate batters and bowlers, manage team/player tags, review session history |
| Premium subscriber | Access subscription-controlled capabilities such as exports, filtering, or automatic tagging (**Inferred from premium assets and billing integration**) |

## 3. Core Features

### 3.1 Account and Access

- Display a splash screen during startup.
- Check whether a valid authenticated session exists.
- Sign in with an account; Google sign-in integration is present.
- Register a new account and complete account verification (**Inferred from the documented flow**).
- Refresh or invalidate authentication tokens (**Inferred from API inventory**).
- Sign out.
- Protect app use when authentication expires.
- Support device biometric or fingerprint authentication (**capability evidenced by permissions and Android biometric resources; exact user flow is not confirmed**).

### 3.2 Onboarding and Setup

- Present onboarding content focused on cricket analytics, engagement, and pitch mapping.
- Start a new capture session.
- Select or configure the capture arrangement, including bowler, machine, tripod, or umpire-camera setup. These options are evidenced by bundled create-session artwork.
- Guide the user through camera positioning and calibration.
- Detect the stumps and ask the user to keep the non-striker stumps completely visible.
- Require the device to be mounted on a tripod before calibration.
- Validate portrait orientation and device steadiness.
- Confirm successful calibration and allow recalibration.

### 3.3 Cricket Session Recording

- Start and stop a recording session.
- Capture video and associated sensor or timing data.
- Keep the screen/device awake during long-running capture (**evidenced by wake-lock and foreground-service support**).
- Continue supported background work through a foreground task service.
- Review captured media before upload.
- Discard a capture or continue with upload.
- Track delivery count and delivery-level records.

### 3.4 Delivery Identification and Tagging

- Ask which batter participated in a delivery.
- Ask which bowler delivered it.
- Tag a batter and bowler to captured video/delivery records.
- Untag a batter or bowler.
- Offer to tag the current user across all videos.
- Support delivery-focused views and delivery recording screens.
- Record cricket characteristics including speed, spin, and swing (**evidenced by packaged strings and analysis models**).

### 3.5 Analysis and Results

- Upload session media and tracking data to the backend.
- Queue or process analysis after upload.
- Retrieve analysis results.
- Display session and delivery metrics.
- Support pitch-map visualization, including standard and wide pitch layouts with stump overlays.
- Display performance distributions, location/trajectory visualizations, and recommendations (**model and asset evidence; exact presentation requires live verification**).
- Show speed in km/h.
- Review results at session and delivery level.

The existing analysis identifies the following result fields as likely application data:

- Maximum speed and average speed
- Distance covered
- Course and delivery quality scores
- Shot distributions
- Location heatmaps
- Recommendations

These fields should be treated as **Inferred** until confirmed from live API responses or a captured session.

### 3.6 Session History and Media Review

- View previous sessions.
- Open a historical session and inspect its details.
- Review delivery-level media.
- Play captured media with pause, seek, rewind, fast-forward, playback-speed, and fullscreen controls.
- Search or filter session/media content (**filtering is evidenced by assets; exact filter fields are not confirmed**).
- Favorite or unfavorite content.
- Add comments.
- Delete content where the user has permission.
- Download or export selected content (**export capability is evidenced; access may be subscription-controlled**).

### 3.7 Sharing and External Handoffs

- Share session or media results using the Android share mechanism.
- Share to social applications, including WhatsApp integration support.
- Open content from Branch or Firebase dynamic links.
- Handle universal links, custom `fulltrack://` links, and HTTP/HTTPS app links.

### 3.8 Profile, Teams, and Preferences

- View and edit the user profile.
- Store a profile image or avatar (**inferred from the user model and image-picker integration**).
- Manage user preferences.
- Manage batter/bowler and team associations (**supported by team icons and tagging strings; exact team administration screens are not confirmed**).
- Open application settings.

### 3.9 Subscriptions and Payments

- Display subscription or upgrade screens.
- Retrieve available billing products.
- Purchase in-app subscriptions through Google Play Billing.
- Use RevenueCat for subscription state management.
- Support Google Pay-related payment flows.
- Gate selected capabilities such as exports, filtering, and automatic tagging (**Inferred from premium lock artwork and billing integration**).

### 3.10 Notifications and Messaging

- Receive Firebase Cloud Messaging notifications.
- Display Customer.io push and in-app messages.
- Handle notification clicks and route the user into the application.
- Request notification permission on supported Android versions.

## 4. Main User Journeys

### 4.1 First Launch

1. The splash screen appears.
2. The app checks authentication state.
3. A new or signed-out user is directed to authentication/onboarding.
4. An authenticated user is directed to the main application area.

### 4.2 Capture and Analyze a Session

1. The user starts a new session.
2. The app requests required permissions.
3. The user selects or confirms the capture setup.
4. The camera is positioned on a tripod and calibrated against the stumps.
5. The user starts recording deliveries.
6. The app captures video and supporting timing/sensor data.
7. The user stops recording and reviews the capture.
8. The user discards the capture or uploads it.
9. The backend processes the session.
10. The user opens the completed results, drills into deliveries, and shares or exports content.

### 4.3 Review an Existing Session

1. The user opens session history.
2. The user selects a previous session.
3. The app displays session details and available delivery media.
4. The user plays, filters, tags, comments on, favorites, downloads, or shares selected content, subject to account and subscription access.

## 5. Permissions and Device Capabilities

| Permission/capability | Functional purpose |
|---|---|
| Internet/network state | Authentication, session upload, analysis retrieval, telemetry |
| Camera | Video capture and camera calibration |
| Microphone | Audio capture or media recording support; exact use is not confirmed |
| Storage/media access | Selecting, saving, downloading, or sharing media |
| Contacts | Contact-related functionality or sharing; exact flow is not confirmed |
| Accelerometer/gyroscope | Device orientation, steadiness, and motion analysis |
| Wake lock/foreground service | Long-running capture and upload work |
| Notifications | Push and in-app messaging |
| Biometrics/fingerprint | Secure authentication or re-authentication |
| Google Maps/location services | Location/map functionality; exact user-facing use is not confirmed |

## 6. Backend and Data Operations

The decoded analysis identifies these application-level operations:

| Area | Operations |
|---|---|
| Authentication | Login, registration, token refresh, logout |
| User | Read/update profile, read/update preferences |
| Sessions | Start, read, end, upload tracking data |
| Analysis | Submit data for analysis, retrieve results |
| Media | Upload and download video/images |
| Billing | Read products, read/manage subscription |
| Maps | Retrieve map data |
| Telemetry | Send application analytics events |

The APK references Fulltrack API/backend domains, but the actual server contract and response behavior require a running backend or network capture to verify.

## 7. Integrations

- React Native with Hermes and the New Architecture
- Branch.io deep links and attribution
- Firebase Analytics, Cloud Messaging, Dynamic Links, and Crashlytics components
- Customer.io messaging
- RevenueCat and Google Play Billing
- Google Pay-related payment support
- Google Maps/Play Services
- Android camera, media, biometric, and sharing facilities
- WhatsApp package detection for sharing flows

## 8. Evidence and Limitations

### Confirmed from packaged artifacts

- Cricket-specific assets for batters, bowlers, sessions, pitch maps, stumps, camera setup, delivery views, and subscription locks.
- User-facing strings for camera calibration, steady-device guidance, delivery speed/spin/swing, batter/bowler selection, tagging, comments, settings, and playback.
- Android permissions and services required for camera/media capture, notifications, authentication, billing, and background work.
- React Native entry point and Branch deep-link handling.

### Inferred and requiring runtime confirmation

- Exact screen names, navigation labels, and layout details in the JavaScript bundle.
- Whether GPS/maps are used in the main cricket workflow or only by an included dependency.
- Exact metric formulas, ML model behavior, upload timing, and offline behavior.
- Subscription product names, prices, entitlement rules, and which features are gated.
- Whether contact access, microphone access, biometric login, comments, favorites, and deletion are exposed in the current production UI.
- Backend authentication scheme and complete API response schemas.

## 9. Recommended Next Verification Pass

For a fully validated product document, run the APK with a test account and capture evidence for each journey: launch/authentication, onboarding, camera calibration, recording, upload, analysis results, history, tagging, sharing, settings, and subscription. Network logs or a test backend would also allow the inferred API and data model sections to be converted into confirmed specifications.