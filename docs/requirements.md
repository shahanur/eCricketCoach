# Software Requirements Specification (SRS)

## Project: eCricketCoach
**Version:** 1.1.0
**Date:** October 5, 2026
**Status:** As-built implementation baseline

---

## 1. Executive Summary & Scope

**eCricketCoach** is a responsive web application prototype for cricket coaching, player development, club administration, drill management, and video analysis. This document describes the behavior present in the repository as of the date above. It is not a statement that every feature is production-ready; incomplete and simulated behavior is explicitly identified.

The current application includes:

- A React single-page web app with home, player/coach, club, system-admin, and help/support views.
- Google, Microsoft, and Apple sign-in flows that issue JWTs.
- Club roster, squad, and scheduled training-session management.
- System and club drill catalog management.
- Google Drive connection and video browsing/upload, plus Gemini-based video analysis when configured.
- Subscription plan display and a checkout flow that records a paid application for admin review.
- Admin views for tenants, invoices, club approvals, notifications, and support tickets.

The implementation is an evolving prototype. External payment processing, email delivery, comprehensive server-side role and tenant authorization, live push notifications, and an asynchronous video-processing queue are not implemented.

---

## 2. User Personas & Access

| Role | Current application view | Current behavior |
|---|---|---|
| **Player** | Player/coaching workspace | Can access the player-oriented dashboard and video-analysis features available in the UI. |
| **Coach** | Coaching portal | Can work with drills, club members, squads, sessions, and player progression flows exposed by the application. |
| **Club Coach** | Club portal and coaching portal | An active club coach can use squad, session, drill, certificate, and video-analysis workflows. The club roster is hidden, and the club portal opens on Squads. Coaches cannot invite or activate members or manage other club admins. |
| **Club Admin** | Club portal | Can access club roster, squad, session, and club-level workflows exposed by the application. |
| **System Admin** | Admin panel | Can view and manage tenant/billing records, club approvals, notifications, drills, and support tickets. |

The sign-in callback maps an authenticated tenant to a role and the client selects a corresponding workspace. The API does not consistently enforce role-based permissions or tenant isolation: several admin, club, drill, and session endpoints are not protected by authentication middleware. The role-specific views must not be treated as a security boundary.

---

## 3. Functional Requirements (Current Behavior)

### 3.1 Sign-In and Session
- **FR-1.1 Supported providers:** Google, Microsoft, and Apple OAuth/OpenID Connect sign-in are implemented. Facebook sign-in is not implemented.
- **FR-1.2 Provider configuration:** The API reports whether provider credentials are configured. A provider without credentials is unavailable.
- **FR-1.3 Token and client state:** Successful sign-in returns an eight-hour JWT. The browser stores the token and user display information in `localStorage`.
- **FR-1.4 Registration handoff:** An identity not associated with an active/trial tenant is redirected to the registration/checkout flow using a short-lived registration token.
- **FR-1.5 Role assignment:** Configured admin email addresses receive the `SUPER_ADMIN` role; active tenant type determines `PLAYER`, `COACH`, or `CLUB_ADMIN`.

### 3.2 Subscription Plans and Administration
- **FR-2.1 Plan catalog:** The API lists Individual Player, Coach Pro, and Club/Academy plans with monthly and annual prices and feature descriptions.
- **FR-2.2 Checkout record:** The checkout endpoint records an application, invoice, and admin notification, then puts the application in `AWAITING_APPROVAL`.
- **FR-2.3 Payment limitation:** Checkout does not integrate with Stripe, Paddle, or another payment processor. The current endpoint records the invoice as `PAID` without charging or verifying a payment method; it is a prototype flow, not production billing.
- **FR-2.4 Admin management:** The admin API supports listing/filtering tenants, changing tenant status or plan, viewing/updating invoice status, listing and approving pending registrations, and viewing notifications.
- **FR-2.5 Support desk:** Users can submit support tickets. Admin users can list/filter tickets and record a resolution.
- **FR-2.6 Notification limitation:** Admin notifications are persisted records displayed in the admin interface. The application does not send email, SMS, or push notifications.

### 3.3 Club, Squad, and Training Session Workflows
- **FR-3.1 Roster:** Club admins can list, invite, edit, and activate roster members. Club coaches do not see the club roster tab or roster shortcut; member data remains available to their squad, session, and player-selection workflows.
- **FR-3.2 Invitation limitation:** Creating or accepting an invitation updates application data only. No invitation email or account provisioning is performed.
- **FR-3.3 Club coach restrictions:** Club coaches cannot manage other club administrators. Invitation and activation endpoints require a club-admin token, and member updates prevent coaches from changing invitation status.
- **FR-3.4 Squads:** Coaches and club users can create, list, update, and delete squads, including age group, discipline, coach display name, and member count.
- **FR-3.5 Sessions:** Users can create, list, edit, and delete scheduled sessions. A session stores its selected squad ID (nullable for individually assigned players) and its own head, coordinator, and assistant coach assignments; coach assignments are not stored on squads. Sessions can associate drill IDs and be published by setting their published state.
- **FR-3.6 Publish limitation:** Publishing a session does not deliver a notification to players; the API returns a confirmation message and updates the session record.
- **FR-3.7 Executed sessions and player notes:** A session can be marked as executed; past-dated sessions are also available for review. Coaches can select an executed session and save separate post-session notes for each player assigned to its squad. These notes are stored with the session and persist across reloads.
- **FR-3.8 Post-session evaluation:** The API evaluates session notes and returns suggested gaps, drills, progression readiness, and commendations. This flow uses deterministic keyword-based rules in the current service; it is not generated by Gemini.
- **FR-3.9 Player progression:** The progression endpoint supports promoting a member to a supplied level and creating a certificate record, or retaining the member at the current level. The current endpoint does not evaluate a milestone rubric before promotion.
- **FR-3.10 Certificates:** The API stores and lists progression certificate records. A printable or downloadable certificate export is not exposed by the current API.

### 3.4 Drill Catalog
- **FR-4.1 Drill metadata:** Drills have a title, discipline, skill set, context (`INDIVIDUAL` or `GROUP`), age group, difficulty, duration, source, and optional instructions/image.
- **FR-4.2 Catalog sources:** The API supports `SYSTEM_PREDEFINED`, `CLUB_CUSTOM`, and `AI_RECOMMENDED` source values. System and club drill creation endpoints currently create system or club drills.
- **FR-4.3 Drill operations:** The API supports listing drills with context, discipline, source, and club filters; creating system or club drills; editing drill details; and deleting drills.
- **FR-4.4 Session use:** Coaches can add/remove drill IDs on a scheduled session. Per-player training plans and customizable sets/repetitions are not implemented as a separate plan workflow.
- **FR-4.5 AI recommendation limitation:** Video analysis and post-session evaluation return suggested drills, but a general AI-generated drill authoring and permanent catalog-ingestion workflow is not implemented.

### 3.5 Video Analysis and Google Drive
- **FR-5.1 Video sources:** The video-analysis endpoint accepts an uploaded video file or a video selected by Google Drive file ID.
- **FR-5.2 Analysis provider:** Uploaded video is analyzed with Google's Gemini multimodal API when `GEMINI_API_KEY` is configured. The service dynamically discovers supported models (or uses configured/fallback model names) and retries transient failures. Gemini outages or quota errors are returned as errors; the analysis service does not substitute a mock video-analysis result.
- **FR-5.3 Analysis result:** Results include an overall score, detected issues, biomechanical metric descriptions, and one or more recommended drills. Analysis runs as part of the HTTP request; no background worker/queue processes it.
- **FR-5.4 History and adoption:** When persistence succeeds, signed-in users can retrieve analysis history and details and mark a recommended drill as adopted.
- **FR-5.5 Google Drive connection:** Signed-in users can connect/disconnect Google Drive, view video files, upload a video, and select a Drive video for analysis. Uploaded files are organized under `eCricketCoach / Player / Discipline` in the user's Drive.
- **FR-5.6 Upload constraints:** The API uses in-memory multipart upload with a configured maximum file size of 500 MB. The original 60-second and 100-MB limits and chunked/pre-signed upload behavior are not implemented.
- **FR-5.7 Storage limitation:** Direct video uploads are passed to analysis in the request and are not independently persisted as application video files. A Google Drive upload is stored in the user's Drive; analysis metadata/results are stored in PostgreSQL when persistence succeeds.

### 3.6 User Interface and Preferences
- **FR-6.1 Workspaces:** The single-page app provides home, coaching, club, admin, dashboard, and help/support views.
- **FR-6.2 Theme:** The client supports dark, light, and pure-light themes and persists the selected theme in browser storage.
- **FR-6.3 Help and support:** The help interface presents user guidance and provides a support-ticket submission flow.

---

## 4. Technical Architecture (As Implemented)

### 4.1 Frontend
- **Framework:** React 18 with TypeScript and Vite.
- **Styling and icons:** Tailwind CSS and `lucide-react`.
- **Navigation/state:** A single-page application with local React state and browser storage. React Router and TanStack Query are not dependencies in the current client.
- **API access:** Client API helpers call the backend through same-origin `/api` paths.

### 4.2 Backend
- **Runtime/framework:** Node.js and TypeScript with Express 4.
- **Database access:** Prisma ORM with PostgreSQL.
- **Authentication:** Provider-specific OAuth/OpenID Connect flows, JWT signing/verification, and role middleware. Authorization middleware is currently applied only to selected routes; see Section 2.
- **AI video analysis:** Google Generative AI SDK, using Gemini's video understanding API.
- **Other integrations:** Google Drive API for user-owned video storage and retrieval.
- **Redis limitation:** Redis is included in Docker Compose, but no Redis client or BullMQ worker is configured in the application code.

### 4.3 Persistence

The active Prisma schema defines persistence for:

- Customer tenants, invoices, admin notifications, and club approvals.
- Drill catalog entries, club members, squads, and training sessions.
- Progression certificates and support tickets.
- Google Drive connections and video-analysis results.

Prisma models use domain names without a `Store` suffix and map to snake-case table names without `_store` in the `public` schema. The obsolete `_store` tables were removed in a one-time destructive reset; startup only creates the active tables if missing. The older normalized tables are kept in the `legacy` schema to avoid naming collisions. `server/src/config/init.sql` creates that historical normalized schema under `legacy` for new databases. Its presence does not mean those historical workflows are implemented or used by the current API.

### 4.4 Local Deployment

`web-app/docker-compose.yml` defines:

- `postgres`: PostgreSQL 16, exposed on host port 5433.
- `redis`: Redis 7, exposed on host port 6379; not currently consumed by a queue worker.
- `server`: Express API, exposed on host port 5001.
- `client`: Vite-built static client served by Nginx on host port 3000.

The stack is intended to run locally with `docker compose up --build` from `web-app`. Provider credentials, `JWT_SECRET`, and `GEMINI_API_KEY` must be configured to enable the corresponding integrations. The Compose defaults are for local development and are not production secrets or production deployment settings.

---

## 5. Known Gaps Before Production

The following previously stated goals are not met by the current implementation and must not be represented as available production capabilities:

- Payment collection, recurring billing, plan changes through a payment provider, refunds, or verified invoice settlement.
- Server-side authorization and tenant isolation consistently applied to all endpoints and records.
- Email delivery for invitations, account activation, or session announcements; live/push notification delivery.
- A Redis/BullMQ-based asynchronous video-processing pipeline.
- Automated milestone-rubric evaluation, complete player assessment history, or separate individual training-plan management.
- Video duration/type policy enforcement matching the earlier 60-second/100-MB requirement, chunked uploads, and application-managed video storage.
- Certificate PDF/print export.
- Facebook sign-in, formal tenant-wide drill branding, and production administration/audit controls.
