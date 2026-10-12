---
agent: agent
description: CAPE 8/13 – bowling delivery metrics and deterministic coaching rules
---

Follow `.github/instructions/cape-api.instructions.md` (contracts + token rules).

Spec: §11.3, §11.4 and §11.5 (deterministic part only).

1. `app/bowling.py`, `delivery_metrics(...)` per the contract:
   - Release = first tracked ball point.
   - Pitching point = the first frame where the image-y velocity changes from downward to upward (smoothed over 3 frames).
   - Map it with the calibrator to pitch metres, with the origin at the batter's middle stump.
   - Length = distance along the pitch; line = lateral offset (positive = off side; mirror for a left-handed batter).
   - Speed = the ground-projected release→pitch distance over the time between them, rounded, with tolerance 5.
   - Classify length and line zones by `bowler_type` using the §11.4 tables (loaded from the rules YAML). `is_good_ball` per §11.4.
   - Return `None` if there's no bounce.
2. `app/rules/coaching_rules.yaml`:
   - `length_zones` and `line_zones`.
   - `batting`: for every `shot_type`, a list of checks `{code, milestone, metric, min, max, severity_bands, message, recommendation, drill}`, seeded with §11.3 plus sensible checks for the remaining shots.
   - `bowling`: per `bowler_type`, pose checks plus delivery checks (`length_zone`, `line_zone`).
   - A header comment saying values are heuristics to be validated by coaches.
3. `app/coaching.py`, `evaluate(...)` per the contract:
   - Load the YAML once.
   - For each applicable check with a metric present: in range → a strength line; otherwise a `Fault`, with severity by how far it deviates (≤ 10% low, ≤ 25% medium, else high).
   - Score = 100 − weighted penalties (high 20, medium 10, low 5), clamped to 0–100.
   - Verdict = the top fault's short message, or a positive summary; for bowling include speed, length and line, e.g. "Good-length ball in the off-stump channel at 118 km/h".
   - Sort faults by severity. Skip checks whose metric is missing and list them in `coaching.unavailable`.
   - Deterministic, with no AI.
`tests/test_bowling.py` (synthetic bounce trajectory → correct zones; left-handed mirroring; no bounce → None) and `tests/test_coaching.py` (in range → strength, out of range → fault with correct severity and recommendation, score maths, every `shot_type` in the YAML has at least 3 checks).
