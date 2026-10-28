---
name: cape-07-render
description: "CAPE 7/13 – annotated overlays and downloadable images"
disable-model-invocation: true
---
Follow `.github/instructions/cape-api.instructions.md` (contracts + token rules).

Spec: §5 and §11.2 (item 5) + §11.7.

Implement `app/render.py`:
- `draw_trail(frame, pts, color, base_thickness=6)` with the §5 alpha/thickness decay (blend per segment onto a copy).
- `draw_metrics(frame, lines: list[str])` as a semi-transparent text panel.
- `draw_contact(frame, point)` as an impact circle and a "CONTACT" label.
- `draw_angle(frame, a, b, c, value, status)`: an arc at vertex `b` coloured by status (ok = green, warn = amber, fault = red), with a degree label. Points are in pixels.
- `draw_pitch_map(delivery, size=(400, 900)) -> np.ndarray`: a top-down pitch with stumps, the §11.4 length bands (labelled), the line channel shaded, and the pitching point marked.
- `export_artifacts(session_dir, target, frames, overlays) -> dict[str, Path]`: write the §11.7 files (JPEG quality 90) for the given target.
`tests/test_render.py`: the output shape/dtype is unchanged; the trail and arc modify pixels; the pitch map places the point in the correct band; the per-target file names are written.
