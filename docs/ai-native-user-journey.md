# eCricketCoach Platform User Journey

This document outlines the user journey, core product services, and conversion architecture of **eCricketCoach**—connecting video-based AI biomechanical analysis, curated practice planning, and multi-tenant academy operations.

---

## 1. User Journey Funnel Map

```mermaid
flowchart TD
    subgraph Discovery["1. Discovery & Social Proof"]
        A["Hero: 'Master Modern Cricket with AI Video Biomechanics & Structured Coaching'"] --> B["Dual CTAs: Subscription Plans OR Interactive Demo"]
        B --> C["Performance Metrics: 99.4% Keypoint Precision, 250+ Drills, 5-Tier Pathway"]
        C --> D["Trusted Academies (Melbourne Cricket Academy, Sydney Thunder, Yorkshire Strikers)"]
    end

    subgraph CoreCapabilities["2. Core Product Capabilities"]
        D --> E["'Everything You Need to Run, Coach, and Train Cricket'"]
        E --> F["Service 1: AI Video Biomechanical Analysis"]
        E --> G["Service 2: Curated Drills & Practice Planning (250+ Drills)"]
        E --> H["Service 3: Club & Squad Roster Management (U9 to Senior)"]
        E --> I["Service 4: Player Progression & Digital Certificates (Foundation to Elite)"]
    end

    subgraph ValuePillars["3. Core Value Pillars"]
        F & G & H & I --> J["Performance Proven in the Nets (Sensorless 33-Keypoint Pose Tracking)"]
        F & G & H & I --> K["Coaching Curricula You Already Trust (Batting, Bowling, Keeping, Fielding)"]
        F & G & H & I --> L["Built for How Academies Scale (Squad Delegation & Session Publishing)"]
        F & G & H & I --> M["Economics that Compound as You Grow (Flat-Rate Monthly/Annual Plans)"]
    end

    subgraph Conversion["4. Transparent Pricing & Verified Checkout"]
        J & K & L & M --> N["Tiered Subscriptions with Monthly/Annual Savings Toggle"]
        N --> O["1-Click Plan Selection (Individual Player, Coach Pro, Club Academy)"]
        O --> P["Identity-Verified Registration Modal (Pre-populated from Social SSO)"]
        P --> Q["Super-Admin Queue & Immediate Account Activation"]
    end

    subgraph DeepDives["5. Authority & Knowledge Base"]
        N --> R["Coaching Science & Training Guides"]
        R --> S["Kinematic Elbow Angle Thresholds (ICC Bowling Action Legality)"]
        R --> T["Multi-Tenant Academy Video Isolation & Google Drive Storage"]
        R --> U["Structuring Age-Group Training Circuits with AI Feedback"]
    end
```

---

## 2. Core Platform Capabilities & Architecture

| Service | Primary Role | Key Features | Benchmark |
|---|---|---|---|
| **AI Video Biomechanics** | Smartphone video pose estimation for technique evaluation | 33-point body landmarking, bowling arm flexion (15° ICC rule), head-over-ball batting balance, weight transfer vectors | `< 2s` Analysis Turnaround |
| **Drills & Practice Planning** | Curated technical drill catalog + custom academy drills | 250+ master drills across Batting, Pace Bowling, Spin, Keeping, and Fielding; proprietary club drill authoring | `250+` Curated Drills |
| **Club & Squad Operations** | Academy management and squad scheduling | Age groups from Under-9 to Senior, 1-click email roster invitations, coach assignment, published session alerts | `100%` Tenant Data Isolation |
| **Skill Progression & Certification** | 5-stage competency framework & verifiable credentials | Foundation → Developing → Intermediate → Advanced → Elite milestones; branded downloadable PDF certificates | `5 Tiers` Standardized Pathway |

---

## 3. Targeted User Personas & Flows

### 1. Individual Player
- **Goal:** Improve personal batting or bowling technique through self-guided practice.
- **Workflow:** Records practice delivery or shot on smartphone → Uploads to AI Biomechanics → Receives kinematic score and prescribed corrective drills → Tracks level milestone progression.

### 2. Private Coach (Coach Pro)
- **Goal:** Manage a client roster of up to 25 players with individualized development plans.
- **Workflow:** Conducts net sessions → Logs post-session observation notes → AI recommends tailored top-up drills → Coach approves drills into player schedule → Issues official achievement certificates upon promotion.

### 3. Club / Academy Administrator (Club Academy)
- **Goal:** Full academy governance across coaches, age-group squads, and parents.
- **Workflow:** Subscribes via social SSO checkout → Super-Admin approves tenancy → Dispatches email invitations to coaches and players → Organizes squads (e.g., U15 Pace, Senior Batting) → Connects Google Drive cloud video archive → Oversees academy progression metrics.
