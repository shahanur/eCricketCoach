-- Local development only. Does not grant approval, paid access, quota or real achievements.
-- Re-running resets only this account's dashboard demo, preserving its real profile.
BEGIN;

DO $$
DECLARE
  player_tenant_id TEXT;
BEGIN
  IF (SELECT count(*) FROM customer_tenants
      WHERE lower(trim(email)) = 'shahanur.reza.rony@gmail.com') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one existing player tenant; no account was created or changed.';
  END IF;
  SELECT id INTO player_tenant_id FROM customer_tenants
    WHERE lower(trim(email)) = 'shahanur.reza.rony@gmail.com'
      AND type = 'INDIVIDUAL' AND status IN ('ACTIVE', 'TRIAL');
  IF player_tenant_id IS NULL THEN
    RAISE EXCEPTION 'The target account must already be an active individual player.';
  END IF;

  INSERT INTO player_dashboard_demos
    (tenant_id, owner_email, progress_percent, stage, focus_title,
     focus_discipline, focus_minutes, focus_description, notification)
  VALUES
    (player_tenant_id, 'shahanur.reza.rony@gmail.com', 72, 'Developing Player',
     'Front Foot Drive Drill', 'Batting', 15,
     'Demo focus: practise a balanced forward stride and a straight bat path. This sample drill is not a personal assessment or a completed practice session.',
     'Your sample training focus is ready. Explore the Front Foot Drive Drill on Home.')
  ON CONFLICT (tenant_id) DO UPDATE SET
    progress_percent = EXCLUDED.progress_percent,
    stage = EXCLUDED.stage,
    focus_title = EXCLUDED.focus_title,
    focus_discipline = EXCLUDED.focus_discipline,
    focus_minutes = EXCLUDED.focus_minutes,
    focus_description = EXCLUDED.focus_description,
    notification = EXCLUDED.notification
  WHERE player_dashboard_demos.owner_email = EXCLUDED.owner_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dashboard owner mismatch; no demo data was changed.';
  END IF;
END $$;

COMMIT;
