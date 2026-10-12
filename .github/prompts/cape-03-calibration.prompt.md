---
agent: agent
description: CAPE 3/13 – homography calibration pixel → metres
---

Follow `.github/instructions/cape-api.instructions.md` (contracts + token rules).

Spec: §3.1 (homography bullet).

Implement `app/calibration.py` per the contract using `cv2.getPerspectiveTransform` (exactly 4 points; reject collinear or degenerate sets with `ValueError`). `speed_kmh` = metric distance / dt × 3.6.
`tests/test_calibration.py`: the identity-scale case, a known perspective warp round-trip (error < 1e-6), the speed of a known displacement, and degenerate-input rejection.
