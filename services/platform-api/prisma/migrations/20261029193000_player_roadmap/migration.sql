CREATE TABLE "player_roadmaps" (
  "profile_id" TEXT PRIMARY KEY REFERENCES "player_profiles"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL DEFAULT 0,
  "answers" JSONB NOT NULL DEFAULT '{}',
  "generating_key" TEXT,
  "generation_started_at" TIMESTAMPTZ(3)
);

CREATE TABLE "player_roadmap_revisions" (
  "id" TEXT PRIMARY KEY,
  "profile_id" TEXT NOT NULL REFERENCES "player_roadmaps"("profile_id") ON DELETE CASCADE,
  "request_id" TEXT NOT NULL,
  "input_version" INTEGER NOT NULL,
  "profile_version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("profile_id", "request_id")
);
CREATE INDEX "player_roadmap_revisions_profile_id_created_at_idx" ON "player_roadmap_revisions" ("profile_id", "created_at");

CREATE TABLE "player_roadmap_practice" (
  "id" TEXT PRIMARY KEY,
  "profile_id" TEXT NOT NULL REFERENCES "player_roadmaps"("profile_id") ON DELETE CASCADE,
  "request_id" TEXT NOT NULL,
  "revision_id" TEXT NOT NULL REFERENCES "player_roadmap_revisions"("id") ON DELETE CASCADE,
  "drill_id" TEXT NOT NULL,
  "discipline" TEXT NOT NULL CHECK ("discipline" IN ('BATTING', 'BOWLING', 'KEEPING', 'FIELDING')),
  "minutes" INTEGER NOT NULL CHECK ("minutes" BETWEEN 1 AND 180),
  "reflection" TEXT NOT NULL,
  "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("profile_id", "request_id"),
  UNIQUE ("profile_id", "revision_id", "drill_id")
);
CREATE INDEX "player_roadmap_practice_profile_id_completed_at_idx" ON "player_roadmap_practice" ("profile_id", "completed_at");
