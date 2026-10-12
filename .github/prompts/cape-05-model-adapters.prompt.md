---
agent: agent
description: CAPE 5/13 – YOLOv11 and MediaPipe model adapters
---

Follow `.github/instructions/cape-api.instructions.md` (contracts + token rules).

Spec: §3.2.

- `app/models/base.py`: dataclasses and Protocols per the contract.
- `ball.py` (`YoloBallDetector`, custom `ball.pt`, classes 0 `cricket_ball` and 1 `blurred_ball`; return the highest-confidence box), `pose.py` (`YoloPoseDetector`, `yolo11n-pose.pt`), `bat.py` (`YoloBatSegmenter`, `bat-seg.pt`, largest mask polygon), `landmarks.py` (`MediaPipeLandmarks` running on a cropped ROI only and mapping the 33 landmark indices to names; coordinates converted back to full-frame normalised x/y with z kept).
- `app/models/__init__.py`: `load_detectors(settings)` that is lazy and cached, raises a clear error if a weight file is missing, and falls back to CPU when CUDA is unavailable.
- `crop_roi(frame, box, pad=0.15)` helper in `landmarks.py`.
`tests/test_models.py`: `crop_roi` bounds/padding and landmark coordinate remapping only. Do not import ultralytics or mediapipe at test time (mock them).
