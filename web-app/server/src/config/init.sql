-- eCricketCoach Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants (Multi-Tenancy support: Coach, Individual, Club)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('INDIVIDUAL', 'COACH', 'CLUB')),
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'FREE_TRIAL',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users with federated SSO support
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('PLAYER', 'COACH', 'CLUB_ADMIN')),
    auth_provider VARCHAR(50) NOT NULL CHECK (auth_provider IN ('GOOGLE', 'MICROSOFT', 'APPLE', 'FACEBOOK', 'LOCAL')),
    provider_id VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Player Profiles
CREATE TABLE IF NOT EXISTS player_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    age_group VARCHAR(50) NOT NULL, -- e.g., 'U9', 'U11', 'U13', 'U15', 'U19', 'SENIOR'
    primary_discipline VARCHAR(50) NOT NULL CHECK (primary_discipline IN ('BATTING', 'BOWLING', 'KEEPING', 'FIELDING', 'ALL_ROUNDER')),
    current_level VARCHAR(50) NOT NULL DEFAULT 'FOUNDATION',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Drills (Catalog supporting Individual vs Group and AI Ingestion)
CREATE TABLE IF NOT EXISTS drills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    discipline VARCHAR(50) NOT NULL CHECK (discipline IN ('BATTING', 'BOWLING', 'KEEPING', 'FIELDING')),
    context_type VARCHAR(50) NOT NULL CHECK (context_type IN ('INDIVIDUAL', 'GROUP')),
    min_age_group VARCHAR(50) NOT NULL,
    difficulty VARCHAR(50) NOT NULL CHECK (difficulty IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    default_duration_minutes INT DEFAULT 15,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Training Plans (Tailored for squad or individual player)
CREATE TABLE IF NOT EXISTS training_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('INDIVIDUAL', 'GROUP')),
    target_id UUID NOT NULL, -- Player user_id or Squad/Team id
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Drills mapped to training plans with custom duration/reps
CREATE TABLE IF NOT EXISTS plan_drills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES training_plans(id) ON DELETE CASCADE,
    drill_id UUID REFERENCES drills(id) ON DELETE CASCADE,
    duration_minutes INT NOT NULL,
    sets INT DEFAULT 3,
    reps INT DEFAULT 10,
    coach_notes TEXT,
    order_index INT DEFAULT 1
);

-- Player Assessments & Promotion Gating
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES users(id) ON DELETE SET NULL,
    discipline VARCHAR(50) NOT NULL,
    milestone_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'NEEDS_FOCUS')),
    notes TEXT,
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Video Uploads & AI Biomechanical Analysis
CREATE TABLE IF NOT EXISTS video_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    google_drive_file_id VARCHAR(255),
    google_drive_folder_path TEXT,
    discipline VARCHAR(50) NOT NULL CHECK (discipline IN ('BATTING', 'BOWLING', 'KEEPING', 'FIELDING')),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    ai_feedback JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Club Approvals & Onboarding Queue
CREATE TABLE IF NOT EXISTS club_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    club_name VARCHAR(255) NOT NULL,
    admin_name VARCHAR(255) NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'PAID',
    approval_status VARCHAR(50) DEFAULT 'AWAITING_APPROVAL' CHECK (approval_status IN ('AWAITING_APPROVAL', 'APPROVED', 'REJECTED')),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Squads & Groups within a Club
CREATE TABLE IF NOT EXISTS squads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    age_group VARCHAR(50) NOT NULL,
    discipline VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Squad Roster (Coaches & Players mapping)
CREATE TABLE IF NOT EXISTS squad_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    squad_id UUID REFERENCES squads(id) ON DELETE CASCADE,
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Session-Based Training Schedules
CREATE TABLE IF NOT EXISTS training_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES users(id) ON DELETE SET NULL,
    squad_id UUID REFERENCES squads(id) ON DELETE SET NULL,
    player_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    session_date DATE NOT NULL,
    start_time TIME,
    duration_minutes INT DEFAULT 90,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    post_session_notes TEXT,
    ai_feedback JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Player Progression Certificates
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES users(id) ON DELETE SET NULL,
    certificate_number VARCHAR(100) UNIQUE NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    discipline VARCHAR(50) NOT NULL,
    achieved_level VARCHAR(50) NOT NULL,
    issued_date DATE NOT NULL,
    coach_notes TEXT,
    ai_recommendations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
