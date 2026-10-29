BEGIN;

-- Additive setup for existing local databases that predate the self-profile feature.
CREATE TABLE IF NOT EXISTS player_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE REFERENCES customer_tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  owner_email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  batting_handedness TEXT NOT NULL,
  bowling_style TEXT NOT NULL,
  primary_disciplines TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  experience_level TEXT NOT NULL,
  goals TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS player_dashboard_demos (
  tenant_id TEXT PRIMARY KEY REFERENCES customer_tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  owner_email TEXT NOT NULL UNIQUE,
  progress_percent INTEGER NOT NULL CHECK (progress_percent BETWEEN 0 AND 100),
  stage TEXT NOT NULL,
  focus_title TEXT NOT NULL,
  focus_discipline TEXT NOT NULL,
  focus_minutes INTEGER NOT NULL CHECK (focus_minutes BETWEEN 1 AND 180),
  focus_description TEXT NOT NULL,
  notification TEXT NOT NULL
);

COMMIT;
