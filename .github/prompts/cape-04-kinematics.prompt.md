---
agent: agent
description: CAPE 4/13 – 3D joint-angle and pose metrics engine
---

Follow `.github/instructions/cape-api.instructions.md` (contracts + token rules).

Spec: §9 and §11.3 (metric column only).

Implement `app/kinematics.py` (NumPy only):
- `joint_angle(a, b, c)`: the vector/dot/norm/arccos pipeline from §9.2. Clip the cosine to [-1, 1]; raise `ValueError` on a zero-length segment.
- `batter_angles(lm, handedness)`: `front_elbow`, `back_elbow`, `front_knee`, `back_knee`, `front_shoulder`, `back_shoulder`. Use MediaPipe landmark names; front side = left for a right-hander. Skip angles whose landmarks are missing.
- `pose_metrics(lm, handedness) -> dict[str, float]`: the angles above plus `head_front_knee_offset_pct` (nose vs front knee, horizontal, % of torso length, positive = head ahead), `torso_length`, `hip_center`, `front_ankle`, `back_ankle`.
- `head_travel_pct(lm_a, lm_b)` between two milestones.
Metric names here are the keys used by `coaching_rules.yaml`; keep them stable.
`tests/test_kinematics.py`: 90°, 180°, 0° and a 3D case, a zero-length error, missing landmarks, left-handed mirroring, and the head-offset sign.
