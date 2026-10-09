---
name: implement-clubcoach-mobile
description: finish the remaining Club Coach web workflows in the native Android app
---

Implement the Club Coach functionality that is still missing from the native Android app in `mobile-app`, bringing it into parity with the existing Club Coach web experience. The Android app already includes club roster/squad workflows, basic session scheduling and publishing/delivery, player assessments, custom drills, progression, branding, and local-video analysis. Do not replace or regress those features.

Before coding, inspect the current Android implementation, the matching web UI/API methods, and the Express routes. Reuse the existing backend contracts where possible. If a capability needs API or persistence support that does not exist, add it to the current backend architecture with authentication, role checks, tenant isolation, validation, and tests; do not simulate success in the client or put secrets in source control.

Complete the remaining Club Coach workflows:

- **Full session execution:** bring the mobile delivery flow to parity with the web execution workflow, including preparation/checklist state, assigned-player attendance, per-drill planned/actual duration and completion notes, incidents, evaluation, player notes, resumable progress, and explicit completion. Load and save through the existing coach execution API. Enforce the server's scheduled-date and assigned-coach rules and show actionable errors.
- **Session reports:** add the web report filters and useful mobile presentation, plus CSV and PDF export/share for the selected club's session and participant activity. Keep exports scoped to the authenticated club and avoid exposing unrelated tenant data.
- **Assessment insights:** support the web assessment insight-generation action for completed assessments, render the returned summary/recommendations, and clearly report AI/API failures.
- **Certificates:** provide the web certificate viewing and filtering workflow, PDF download/share, and admin certificate deletion where allowed. Generate PDFs from the actual certificate fields and club branding; do not fabricate certificate data.
- **Google Drive video analysis:** show Drive connection status, implement the existing connect/disconnect and video-list APIs, let coaches select a Drive video for analysis, and retain the existing device-file upload option and analysis history. Use the authenticated API and surface connection, permission, and upload errors.
- **Push notifications:** inspect the existing notification and deployment setup first. Implement native Android notification permission/channel/token registration and backend delivery for relevant club events only if there is a supported provider/configuration path. Keep provider credentials server-side; document required deployment configuration. Never report push as enabled if registration or delivery is unavailable.
- **Offline writes and synchronization:** add durable, retryable mutation queuing for supported club edits and safe synchronization when connectivity returns. Use stable operation IDs/idempotency and clear pending/synced/failed states. Handle conflicts explicitly and scope queued data to the signed-in user and tenant; clear or isolate it on sign-out/account changes. Do not silently discard mutations or replay an operation into another club.

Review the web Club Portal and Coach Operations screens against Android after implementation and address any other clearly missing Club Coach action in those flows. Preserve the current provider sign-in, dark/light themes, responsive Compose UI, encrypted token storage, role-specific access, and existing same-origin/API configuration. Do not introduce React Native, a web view, React Router, or an unrelated state-management framework.

Update `mobile-app/README.md` with completed capabilities, backend/provider configuration, offline behavior and limitations. Add or update focused tests for API contracts, persistence/queue behavior, permission/access rules, and export formatting. Run the Android unit tests and the relevant backend tests/builds; resolve failures introduced by the changes and report any external configuration or device-only verification that could not be completed.
