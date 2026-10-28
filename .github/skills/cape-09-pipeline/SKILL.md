---
name: cape-09-pipeline
description: "CAPE 9/13 – pipeline orchestration and the full coaching payload"
disable-model-invocation: true
---
Follow `.github/instructions/cape-api.instructions.md` (contracts + token rules).

Spec: §2 (diagram), §6.1 and §11.6. Modules 1–8 exist; use their contracts and don't re-read their code beyond signatures.

Implement `app/pipeline.analyze(video_path, req, session_dir, detectors)`, single pass with `cv2.VideoCapture`:
1. Calibrate.
2. For each frame, run ball detection and feed the `Tracker`. Run pose only until the target player box is locked: batter = the person nearest the batting crease, bowler = the moving person nearest the bowling crease. Keep only the frames needed for the artifacts.
3. **Batter:**
   - At contact, run MediaPipe on the batter ROI (also once at the pre-contact frame, `fps*0.15` before contact) and the bat segmenter.
   - Metrics: `pose_metrics`, bat angle from vertical (polygon principal axis), `head_travel_pct`, stride length (front-ankle → back-ankle pixel points through the calibrator), and bat-ahead-of-pad (bat polygon vs front-knee x, in cm).
   - Post-contact: exit velocity and launch angle from the first ~5 smoothed post points.
   - No contact → 422 `no_contact_detected`.
4. **Bowler:**
   - Get the delivery from `delivery_metrics`. At release, run MediaPipe on the bowler ROI for the front knee angle and release height (wrist above ground in metres, approximate).
   - A missing bat contact is fine. No bounce → 422 `no_pitching_point_detected`.
5. Call `coaching.evaluate`. Render overlays: angle arcs for each checked angle, coloured by the fault status; a trail; a metrics panel; and the pitch map for the bowler.
6. Export the artifacts and build `AnalysisResponse` with download URLs and `all_zip`.

Wire it into the endpoint from task 2, replacing the 501 stub.
`tests/test_pipeline.py`: fake detectors scripted over a synthetic 60-frame video, covering a batter payload (faults present, 3 artifacts), a bowler payload (delivery zones, pitch map), and the no-contact / no-bounce errors.
