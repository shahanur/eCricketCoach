# Club Admin User Flow

This document details the end-to-end journey and lifecycle of a **Club / Academy Administrator** in the eCricketCoach platform, from initial registration and payment through organization setup, roster onboarding, squad delegation, and subscription oversight.

---

## 1. High-Level Flowchart

```mermaid
flowchart TD
    subgraph Onboarding["1. Registration & Super-Admin Approval"]
        A[Club Admin visits Registration] --> B[Submit Club Details & Tier Selection]
        B --> C[Process Stripe Payment / Invoice]
        C --> D{Payment Succeeded?}
        D -- No --> E[Retry Payment / Contact Support]
        D -- Yes --> F[Enters Super-Admin Approval Queue]
        F --> G[Super-Admin Approves Club Application]
        G --> H[Admin Receives Welcome & Onboarding Email]
        H --> I[Club Admin Logs into Club Portal]
    end

    subgraph OrgSetup["2. Organization & Structure Configuration"]
        I --> J[Configure Club Profile & Branding]
        J --> K[Define Age Groups & Discipline Tracks\ne.g., U13, U15, U19, Senior]
        K --> L[Connect Club Google Drive / Cloud Storage]
    end

    subgraph RosterMgmt["3. Staff & Player Onboarding"]
        L --> M[Invite Coaches via Email]
        L --> N[Invite Players via Email]
        M --> O[Coaches Receive Invite Link]
        N --> P[Players/Parents Receive Invite Link]
        O --> Q[Coach Accepts & Sets Up Profile]
        P --> R[Player Accepts & Sets Up Profile]
        Q --> S[Club Admin Views Active Coaching Staff]
        R --> T[Club Admin Views Active Player Roster]
    end

    subgraph SquadDelegation["4. Squad Formation & Allocation"]
        S & T --> U[Create Squads / Batches]
        U --> V[Assign Head / Assistant Coaches to Squad]
        V --> W[Assign Players to Squad]
    end

    subgraph OperationsOversight["5. Ongoing Monitoring & Administration"]
        W --> X[Monitor Training Session Schedules & Attendance]
        X --> Y[Review Skill Level Progression & Issued Certificates]
        Y --> Z[Audit Custom Drills Created by Club Coaches]
        Z --> AA[Manage Billing, Invoices & Plan Upgrades]
    end
```

---

## 2. Sequence Diagram: Club Registration, Approval & Member Invitation

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Club Admin
    participant Web as eCricketCoach Web UI
    participant API as API Gateway / Club Router
    participant DB as Postgres DB
    participant Stripe as Stripe Billing
    actor Super as Super-Admin
    actor Coach as Coach
    actor Player as Player

    %% Phase 1: Registration & Payment
    Admin->>Web: Register Club & Select "Club/Academy" Plan
    Web->>API: POST /api/subscriptions/checkout
    API->>Stripe: Create Subscription Intent ($199.99/mo or $2399/yr)
    Stripe-->>Admin: Prompt Payment Modal
    Admin->>Stripe: Authorize Credit Card / ACH
    Stripe-->>API: Webhook payment_intent.succeeded
    API->>DB: Record Club in mockClubApprovals (Status: AWAITING_APPROVAL)
    API-->>Web: Application Submitted Confirmation

    %% Phase 2: Super Admin Approval
    Super->>Web: Navigate to Admin Panel > Club Approvals
    Web->>API: GET /api/admin/club-approvals
    API-->>Web: Return Pending Club Applications
    Super->>Web: Click "Approve Club"
    Web->>API: POST /api/admin/club-approvals/:id/approve
    API->>DB: Set Status: APPROVED & Create Active Customer Tenant
    API-->>Admin: Send Magic Link / Onboarding Access Email

    %% Phase 3: Login & Member Invitations
    Admin->>Web: Login to Club Portal
    Web->>API: GET /api/club/members
    API-->>Web: Current Roster List

    Admin->>Web: Submit Coach Invitation (Name, Email, Role: COACH)
    Web->>API: POST /api/club/members/invite
    API->>DB: Insert Member (Status: PENDING_ACCEPTANCE)
    API-->>Coach: Send Invitation Email

    Coach->>Web: Open Invitation Link & Accept
    Web->>API: POST /api/club/members/:id/accept-invitation
    API->>DB: Update Member (Status: ACTIVE)

    Admin->>Web: Submit Player Invitation (Name, Email, Role: PLAYER, AgeGroup)
    Web->>API: POST /api/club/members/invite
    API->>DB: Insert Member (Status: PENDING_ACCEPTANCE)
    API-->>Player: Send Player Onboarding Email
    Player->>Web: Accept Invite & Fill Bio
    Web->>API: POST /api/club/members/:id/accept-invitation
    API->>DB: Update Member (Status: ACTIVE)
    Web-->>Admin: Real-time Updated Active Members Roster
```

---

## 3. State Machine: Club Tenant Lifecycle

```mermaid
stateDiagram-v2
    [*] --> ApplicationSubmitted: Club Registers & Pays
    ApplicationSubmitted --> UnderReview: Placed in Super-Admin Queue
    UnderReview --> Approved: Super-Admin Verification Passed
    UnderReview --> Rejected: Verification Failed / Refunded
    Rejected --> [*]

    Approved --> ActiveTenant: Admin Completes Onboarding
    ActiveTenant --> PastDue: Monthly/Annual Renewal Fails
    PastDue --> ActiveTenant: Payment Resolved / Retried
    PastDue --> Suspended: Grace Period Expires (14 days)
    Suspended --> ActiveTenant: Reactivated upon Invoice Settlement
    ActiveTenant --> Cancelled: Voluntarily Closed by Admin
    Cancelled --> [*]
```

---

## 4. Club Admin Functional Responsibilities Matrix

| Stage | Action | Endpoint / Service | Artifact Generated |
| :--- | :--- | :--- | :--- |
| **1. Registration** | Register club & pay fee | `POST /api/subscriptions/checkout` | Stripe Customer & Invoice record |
| **2. Approval** | Super-Admin approval | `POST /api/admin/club-approvals/:id/approve` | Active Tenant Entry, Tenant ID |
| **3. Staffing** | Invite coaches & staff | `POST /api/club/members/invite` (Role: `COACH`) | Coach Credentials & Permissions |
| **4. Onboarding** | Invite youth/adult players | `POST /api/club/members/invite` (Role: `PLAYER`) | Player Profile & Base Skill Rank |
| **5. Squads** | Create age-group squads | `POST /api/club/squads` | Squad ID, Assigned Coaches & Players |
| **6. Drills Library** | Audit/Approve club drills | `GET /api/drills?source=CLUB_CUSTOM` | Club Drill Catalog |
| **7. Governance** | Review promotion certs | `GET /api/club/certificates` | Official Digital Certificates |
| **8. Billing** | Review monthly invoices | `GET /api/admin/invoices` | Tax Invoices & Receipts |
