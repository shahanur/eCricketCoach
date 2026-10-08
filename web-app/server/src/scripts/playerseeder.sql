-- Seed players across age groups, squads, disciplines, and development levels.
-- Safe to rerun: existing player IDs are left unchanged.
BEGIN;

INSERT INTO club_members (
    id,
    club_id,
    name,
    email,
    role,
    age_group,
    discipline,
    invitation_status,
    current_level,
    squad
)
VALUES
    ('player-u11-001', 'ten-003', 'Aarav Patel', 'aarav.patel@example.com', 'PLAYER', 'U11', 'BATTING', 'ACTIVE', 'FOUNDATION', 'U11 Foundation Squad'),
    ('player-u11-002', 'ten-003', 'Maya Singh', 'maya.singh@example.com', 'PLAYER', 'U11', 'FIELDING', 'ACTIVE', 'FOUNDATION', 'U11 Foundation Squad'),
    ('player-u11-003', 'ten-003', 'Noah Williams', 'noah.williams@example.com', 'PLAYER', 'U11', 'KEEPING', 'ACTIVE', 'DEVELOPING', 'U11 Foundation Squad'),

    ('player-u13-001', 'ten-003', 'Zara Khan', 'zara.khan@example.com', 'PLAYER', 'U13', 'BOWLING', 'ACTIVE', 'DEVELOPING', 'U13 Development Squad'),
    ('player-u13-002', 'ten-003', 'Ethan Brown', 'ethan.brown@example.com', 'PLAYER', 'U13', 'BATTING', 'ACTIVE', 'DEVELOPING', 'U13 Development Squad'),
    ('player-u13-003', 'ten-003', 'Sofia Taylor', 'sofia.taylor@example.com', 'PLAYER', 'U13', 'FIELDING', 'ACTIVE', 'INTERMEDIATE', 'U13 Development Squad'),

    ('player-u15-001', 'ten-003', 'Kabir Mehta', 'kabir.mehta@example.com', 'PLAYER', 'U15', 'BOWLING', 'ACTIVE', 'INTERMEDIATE', 'U15 Pace & Power Squad'),
    ('player-u15-002', 'ten-003', 'Amelia Jones', 'amelia.jones@example.com', 'PLAYER', 'U15', 'BATTING', 'ACTIVE', 'INTERMEDIATE', 'U15 Pace & Power Squad'),
    ('player-u15-003', 'ten-003', 'Leo Martin', 'leo.martin@example.com', 'PLAYER', 'U15', 'KEEPING', 'ACTIVE', 'ADVANCED', 'U15 Pace & Power Squad'),

    ('player-u19-001', 'ten-003', 'Dev Sharma', 'dev.sharma@example.com', 'PLAYER', 'U19', 'BATTING', 'ACTIVE', 'ADVANCED', 'U19 Performance Squad'),
    ('player-u19-002', 'ten-003', 'Isla Wilson', 'isla.wilson@example.com', 'PLAYER', 'U19', 'BOWLING', 'ACTIVE', 'ADVANCED', 'U19 Performance Squad'),
    ('player-u19-003', 'ten-003', 'Owen Davies', 'owen.davies@example.com', 'PLAYER', 'U19', 'FIELDING', 'ACTIVE', 'INTERMEDIATE', 'U19 Performance Squad'),

    ('player-senior-001', 'ten-003', 'Nikhil Rao', 'nikhil.rao@example.com', 'PLAYER', 'Senior', 'BATTING', 'ACTIVE', 'ELITE', 'Senior Academy Squad'),
    ('player-senior-002', 'ten-003', 'Grace Thompson', 'grace.thompson@example.com', 'PLAYER', 'Senior', 'BOWLING', 'ACTIVE', 'ADVANCED', 'Senior Academy Squad'),
    ('player-senior-003', 'ten-003', 'Callum Evans', 'callum.evans@example.com', 'PLAYER', 'Senior', 'KEEPING', 'ACTIVE', 'ELITE', 'Senior Academy Squad')
ON CONFLICT (id) DO NOTHING;

COMMIT;
