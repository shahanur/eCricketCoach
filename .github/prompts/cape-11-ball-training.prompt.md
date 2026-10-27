---
agent: agent
description: CAPE 11/13 – ball dataset spec and YOLOv11-Nano training script
---

Follow `.github/instructions/cape-api.instructions.md` (contracts + token rules).

Spec: §10.

Create:
- `services/cape-api/training/ball.yaml`: Ultralytics dataset config with classes `0: cricket_ball`, `1: blurred_ball` and train/val/test paths.
- `training/split_dataset.py`: deterministic 80/10/10 split of an images+labels folder (seeded). Split by source video to avoid leakage.
- `training/train_ball.py`: fine-tune `yolo11n.pt` with the augmentations from §10.2 (`hsv_h=0.015`, `scale=0.2`, `mosaic=1.0`, plus `fliplr`), configurable `imgsz` (default 1280 for small objects), and an export to ONNX/TensorRT flag. Copy `best.pt` to `weights/ball.pt`.
- `training/ANNOTATION.md`: a concise labelling guide (the class rules, the blur-streak box rule, lighting/background coverage checklist, and a minimum of 2,500 frames).
Add a `tests/test_split.py` for the split script only.
