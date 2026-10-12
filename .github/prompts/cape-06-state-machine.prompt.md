---
agent: agent
description: CAPE 6/13 – event-driven state machine and Kalman smoothing
---

Follow `.github/instructions/cape-api.instructions.md` (contracts + token rules).

Spec: §4.

- `app/tracking/kalman.py`: a constant-velocity 2D Kalman filter (`predict()`, `update(p)`, `step(p | None) -> Point`), with process/measurement noise configurable.
- `app/tracking/state_machine.py` per the contract:
  - PRE → AT when `V_t · V_{t-1} < 0`, both speeds exceed `min_speed_px`, and the condition holds for 1 frame after debouncing (ignore it within the first 3 tracked points).
  - AT → POST on the next frame.
  - In POST, initialise Kalman at the contact point and fill missing detections for up to `max_gap` frames.
  - Record per-phase histories.
`tests/test_state_machine.py`: a synthetic straight-in/bounce-back trajectory gives the correct contact frame; noise doesn't trigger early; gaps after contact are filled; no inversion keeps PRE.
