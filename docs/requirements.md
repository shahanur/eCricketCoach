# Software Requirements Specification (SRS)

## Project: eCricketCoach
**Version:** 1.0.0  
**Date:** September 2026  

---

## 1. Executive Summary & Objectives
**eCricketCoach** is a responsive, multi-tenant cricket training and performance management web application. It connects coaches, individual players, and cricket clubs/academies. 

Key capabilities include:
- Multi-tier progressive cricket training framework mapped by discipline and age group.
- Dynamic training plan modeling with solo and group-adapted drills.
- Player assessment workflows with promotion gating or AI-recommended drill refinement.
- Video analysis pipeline for short clips (batting, bowling, keeping, fielding) generating biomechanical insights, drill suggestions, and practice durations.
- Multi-tenant architecture with subscription tiers (Player, Coach, Club).
- Social and Enterprise Single Sign-On (Google, Microsoft, Apple, Facebook).

---

## 2. User Personas & Permissions (RBAC)

| Role | Description | Core Permissions |
|---|---|---|
| **Individual Player** | Self-training player (youth or adult) | Upload videos, view assigned/tailored plans, track personal skill progression, subscribe to Player plan. |
| **Coach** | Independent or club coach | Manage multiple players and squads, model customized training plans, conduct assessments, approve promotions, tailor AI recommendations. |
| **Club Admin** | Academy/Club manager | Organization-level tenant administration, manage club coaches, squad rosters, subscription billing, and club-wide drill library. |
| **System Admin** | Platform operator | Global metrics, drill moderation, platform tenant oversight. |

---

## 3. Functional Requirements

### 3.1 Multi-Tenancy & Subscriptions
- **FR-1.1 Tenant Isolation:** Logical data separation using `tenant_id` on all core entities (users, squads, drills, plans, assessments, video analysis).
- **FR-1.2 Pricing Models & Plans:**
  - **Player Plan:** 1 player profile, personal skill roadmap, limited AI video analyses per month.
  - **Coach Plan:** Manage up to N players/squads, create custom plans, assessments, unlimited drills, AI suggestions.
  - **Club Plan:** Multi-coach seats, squad segmentation, centralized billing, custom club drill branding.
- **FR-1.3 Payment Lifecycle:** Integration with Stripe/Paddle supporting recurring subscription, upgrades/downgrades, and cancellation.
- **FR-1.4 Super-Admin Management Panel:**
  - Full management of tenants/customers across all tiers (`INDIVIDUAL`, `COACH`, `CLUB`).
  - Real-time subscription lifecycle management (trial, active, past-due, canceled).
  - Billing monitoring, monthly recurring revenue (MRR) tracking, and invoice status inspection.
  - Plan override and manual tier provisioning.

### 3.2 Club Persona & Onboarding Workflow (Comprehensive)
- **FR-2.1 Subscription & System Admin Approval Gate:**
  - Following successful payment for a Club subscription, the system triggers an alert/notification to the System Admin.
  - The new Club registration enters an **"Awaiting Approval"** queue.
  - Once approved by the System Admin, the Club Admin account is activated, sending credentials/onboarding link to get into the portal.
- **FR-2.2 Club Roster Management & Invitation System:**
  - Club Admin invites Coaches and Players across designated age groups (`U9`, `U11`, `U13`, `U15`, `U19`, `Senior`).
  - Coaches and players receive email invitation links with status (`PENDING_ACCEPTANCE`, `ACTIVE`). Upon accepting, they gain access to their dedicated roles.
- **FR-2.3 Squad & Group Formation:**
  - Coaches can organize accepted players into squads/groups (e.g., *U15 Fast Bowling Unit*, *Senior Top-Order Batters*, *U13 Development Squad*).
- **FR-2.4 Session-Based Training Plans & Progression Modeling:**
  - Coaches construct date-specific, session-based training plans incorporating drills from the catalog.
  - Coaches define progression stage gates/workflows per age group and discipline.
  - When the coach clicks **"Publish Training"**, squad/group players receive an instant notification with drills, duration, and instructions.
- **FR-2.5 Post-Session AI Assessment & Drill Recommendation Loop:**
  - Following a completed training session, coaches enter field notes for the squad or individual players.
  - AI engine parses coach notes and performance logs to assess competencies, flagging gaps and automatically recommending tailored supplementary drills.
  - Coach has full authority to **Accept**, **Top-Up**, or **Modify** recommended drills before saving to the player's updated routine.
- **FR-2.6 Cloud / Google Drive Video Ingestion & AI Biomechanical Analysis:**
  - Club Admin and Coaches can upload short video clips of individual players (batting, bowling, keeping, fielding).
  - Clips are securely cataloged and integrated with Google Drive object storage (folder hierarchy: `Club / Squad / Player / Discipline`).
  - AI analyzes pose kinematics, detects biomechanical flaws, identifies focal areas, and prescribes tailored corrective drills with target repetition durations.
- **FR-2.7 Individual Player Progression & Achievement Certification:**
  - Coaches evaluate players against milestone benchmarks.
  - Based on performance records, video metrics, and coach assessments, the player is either **Promoted** to the next stage or **Retained** for focused practice.
  - The platform automatically generates a branded, printable/downloadable **Certificate of Achievement & Progression**, detailing:
    - Player name, age group, discipline, and certified level.
    - Achieved milestones and competencies.
    - Coach commendations & AI recommendations for sustained performance.

### 3.3 Skill Framework & Level Hierarchy
- **FR-3.1 Disciplines:**
  - Batting (Front foot, Back foot, Power hitting, Spin defense)
  - Bowling (Pace / Swing / Seam, Spin - Off-spin / Leg-spin)
  - Wicketkeeping (Stance, Glove work, Standing up, Standing back)
  - Fielding (Ground fielding, Catching - Close / Outfield, Throwing accuracy)
- **FR-3.2 Demographics & Age Groups:**
  - Age brackets: Under-9, Under-11, Under-13, Under-15, Under-19, Senior / Adult.
  - Progression Levels: Level 1 (Foundation) -> Level 2 (Developing) -> Level 3 (Intermediate) -> Level 4 (Advanced) -> Level 5 (Elite).
- **FR-3.3 Assessments & Promotion:**
  - Coaches evaluate players against milestone rubrics (e.g., balance at crease, high elbow, seam upright).
  - Status states: `Not Started`, `In Progress`, `Achieved`, `Needs Focus`.
  - Passing all criteria triggers an automatic or coach-approved level promotion.

### 3.4 Drill Management & Context-Aware Planning
- **FR-4.1 Context Awareness:**
  - System recognizes context: `INDIVIDUAL` (1-on-1 / Solo) or `GROUP` (squad / team session).
  - Drills automatically configure participant counts, equipment, and rotation rules.
- **FR-4.2 Multi-Tier Drill Catalog & System Admin Pre-defined Sets:**
  - **System Admin Global Drill Library:** System Admin can create, curate, and maintain official, verified pre-defined drills categorized by discipline (Batting, Bowling, Keeping, Fielding), skill set (e.g., *Power Hitting*, *Seam Bowling*, *Spin Variation*, *Slip Catching*), age bracket, and difficulty.
  - **Club & Coach Custom Drills:** Coaches and Club Admins can add their own proprietary drills specific to their club tenant or share them across squads.
  - **Source Attribution:** Drills are flagged as `SYSTEM_PREDEFINED`, `CLUB_CUSTOM`, or `AI_RECOMMENDED`.
- **FR-4.3 AI Recommendations & Ingestion:**
  - When assessment identifies weaknesses, AI suggests matching drills from existing drill set.
  - If a novel drill is generated by AI, coach can preview, accept, and save it permanently to tenant library.
- **FR-4.4 Customization:** Coaches and players can edit drill parameters (sets, reps, duration, difficulty) within any active training plan.

### 3.5 Video Upload & AI Analysis
- **FR-5.1 Video Ingestion:**
  - Direct chunked/pre-signed upload of short video clips (MP4/MOV, up to 60s, max 100MB).
  - Video tagged with discipline (Batting, Bowling, Keeping, Fielding) and camera angle (Side-on, Front-on, Behind).
- **FR-5.2 Asynchronous Analysis Pipeline:**
  - Container-based background queue processing (Redis + BullMQ / worker).
  - Keyframe extraction and biomechanical pose estimation.
  - Detected issues (e.g., falling over off-stump, early arm drop in delivery stride).
  - Output: Metrics summary, flaw identification, recommended drills, and prescribed training duration.

---

## 4. Technical Architecture

### 4.1 Frontend (React SPA)
- **Framework:** React 18+ with TypeScript and Vite.
- **Design System:** Tailwind CSS for responsive mobile, tablet, and desktop viewports.
- **Routing & State:** React Router DOM v6, TanStack Query (React Query) for API caching.
- **Components:** Modular atomic structure (Drills, Assessments, Video Player, Plans).

### 4.2 Backend (Containerized Node.js API)
- **Runtime:** Node.js 20 LTS with Express/Fastify in TypeScript.
- **Database Layer:** PostgreSQL with connection pooling (`pg` / Prisma / Drizzle).
- **Task Queue:** Redis + BullMQ for async video processing tasks.
- **Authentication:** Passport.js / JWT with multi-provider OAuth adapters.

### 4.3 Database Schema (PostgreSQL)
- `tenants` (id, name, plan_type, status, created_at)
- `users` (id, tenant_id, email, full_name, role, auth_provider, avatar_url)
- `player_profiles` (id, user_id, age_group, primary_discipline, current_level)
- `drills` (id, tenant_id, title, discipline, context_type [INDIVIDUAL/GROUP], min_age, difficulty, instructions, video_url, is_ai_generated)
- `training_plans` (id, tenant_id, coach_id, target_id, target_type [PLAYER/SQUAD], status)
- `plan_drills` (id, plan_id, drill_id, duration_minutes, sets, reps, notes, order_index)
- `assessments` (id, tenant_id, player_id, coach_id, discipline, level_id, status, notes)
- `video_submissions` (id, tenant_id, player_id, video_url, discipline, status, ai_feedback, recommended_drills)

### 4.4 Containerization & Deployment
- `docker-compose.yml` orchestrating:
  - `postgres`: Relational data store
  - `redis`: Job queue and caching
  - `server`: Node.js Express API container
  - `client`: Vite/Nginx frontend container
