# Ekota 24-Week Training Programme Seed

The seed command creates Ekota's 24 weekly training sessions and schedules an individual assessment for each active player in Weeks 12 and 24. Each week's planned activity is saved as a club drill and linked to its session. Assessment metrics are left unscored for coaches to complete.

Run from `web-app/server` after Ekota's club tenant, at least one active coach, and active player roster exist:

```powershell
npm run seed:ekota-program
```

By default, the programme starts on the next Monday in UTC. To use another Monday, set `EKOTA_PROGRAM_START_DATE` in `YYYY-MM-DD` format before running the command:

```powershell
$env:EKOTA_PROGRAM_START_DATE = '2026-10-12'
npm run seed:ekota-program
```

The script targets `Ekota Academy` by default (case-insensitive), assigns all its active players to each session, and uses its first active coach for assessments. Override the target with `EKOTA_CLUB_NAME` if needed. Sessions remain unpublished. It is safe to rerun: seeded sessions, drills, and assessments are upserted by stable IDs, and rerunning does not reset assessment scores or feedback.
