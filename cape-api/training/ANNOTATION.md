# Ball annotation guide (spec §10)

Labels are in YOLO format: one `<class> <cx> <cy> <w> <h>` line per ball, with all values normalised to 0–1. A frame with no ball gets an empty `.txt` file (or no file), and is kept as a background example.

## Classes

| ID | Class | Box rule | When to use it |
|----|-------|----------|----------------|
| 0 | `cricket_ball` | A tight box on the ball's edge. | The ball looks round and sharp: before delivery, when it is slow, or when it is in the hand. |
| 1 | `blurred_ball` | A box around the **whole visible streak**, from end to end. | The ball is smeared into a streak or oval, which is typical in flight at 130+ km/h. |

Rules:
- **Streak rule:** never box only the bright core of a blurred ball. The box must cover the full streak, so the model learns that a streak is a ball and doesn't skip those frames.
- If a ball is partly hidden by the bat, pad or hand, box only the part you can see. Skip it if less than about 30% is visible.
- Don't label balls you can't tell apart from the background, or spare balls lying on the boundary or in a bowling machine.
- Use one box per ball. In nets with several balls, label each one you can see.

## File naming

Name each frame `<video>_<frame>.jpg`, for example `nets03_000412.jpg`. `split_dataset.py` uses the `<video>` prefix to keep every frame from one clip in the same split, so frames from a clip never appear in both training and validation.

## Coverage checklist

- [ ] At least **2,500 frames** in total. The split is 80/10/10, which gives about 2,000 train, 250 val and 250 test.
- [ ] Bright, direct sun with glare off the pitch.
- [ ] Overcast or shade.
- [ ] Evening under floodlights or nets lighting.
- [ ] Dark sightscreens, green turf and white advertising boards behind the ball.
- [ ] Busy backgrounds: fielders, crowd, nets mesh.
- [ ] Red, white and pink balls.
- [ ] Side-on and behind-the-bowler cameras at several zoom levels.
- [ ] Both classes well represented, with at least 30% `blurred_ball`.
- [ ] About 10% background frames with no ball.

## Extracting frames

`extract_frames.py` writes upright frames from your clips to `raw/images/` with the `<video>_<frame>.jpg` names above, and appends one row per frame (file, video, frame number, time in ms, whether it is a contact frame) to `raw/manifest.csv`.

```bash
python -m training.extract_frames clips/ --out raw                          # every 5th frame, near-duplicates skipped
python -m training.extract_frames nets03.mp4 --out raw --around 4250        # plus every frame within ±300 ms of contact
python -m training.extract_frames clips/ --out raw --contacts contacts.csv  # `video,ms` rows, one per contact
```

- Contact frames (`--around`, `--contacts`) are always kept, even if they look alike, because they hold the blurred ball at the bat. These are the frames the models miss most, so give a contact time for every clip where you know it.
- Use `--every 0` to keep only contact frames, `--max-sparse N` to limit how many other frames each clip adds, and `--min-change 0` to keep near-duplicate frames.
- Label the frames in any tool that exports YOLO format (CVAT, Label Studio, Roboflow) and save the `.txt` files to `raw/labels/`.
- **Label or delete every frame before splitting.** `split_dataset.py` treats a frame with no `.txt` file as a frame with no ball, so a frame you skipped would teach the model to ignore a real ball.

## Bat segmentation labels

The bat model (`train_bat.py`, which installs `weights/bat-seg.pt`) learns from **polygons**, not boxes. It has a single class, `0: cricket_bat`. Reuse the same extracted frames, but keep the bat labels in their own folder:

```powershell
Copy-Item datasets\raw\images datasets\raw_bat\images -Recurse   # same frames, separate labels
# label the bat in raw_bat/images and export YOLO *segmentation* to datasets\raw_bat\labels
python -m training.split_dataset datasets/raw_bat datasets/bat
python -m training.train_bat --data datasets/bat --device 0       # installs weights/bat-seg.pt
```

- Trace the whole bat you can see, from the blade's toe to the top of the handle, including the hands-over-handle part. When the bat is motion-blurred, trace the **whole blurred shape**, as with `blurred_ball`.
- One polygon per bat. A frame with no bat visible gets an empty `.txt` file.
- Frames around contact matter most, because they're where the model has to place the bat face exactly.
- `train_bat.py` checks the labels before training. It stops with the file and line if any label is a box, has the wrong class, has fewer than 3 points, or isn't normalised to 0–1.

### Labelling with Label Studio

Run Label Studio locally, with `cape-api/datasets` mounted read-only at `/label-studio/files` and `LABEL_STUDIO_LOCAL_FILES_SERVING_ENABLED=true`. Create a project with `PolygonLabels` (`cricket_bat`) or, for the ball, `RectangleLabels` (`cricket_ball`, `blurred_ball`), and connect local storage at `/label-studio/files/raw_bat/images`. Press **Submit** on every frame, including frames with no bat, which become background frames. Then convert:

```bash
python -m training.labelstudio_to_yolo --url http://localhost:8080 --project 1 --token <token> \
    datasets/raw_bat/labels --classes training/bat.yaml
```

The converter refuses to run while any frame is unfinished or skipped, so a frame you didn't label is never mistaken for a frame with no bat. Use `--allow-unlabelled` to leave unfinished frames out instead.

## Workflow

```bash
python -m training.extract_frames clips/ --out raw            # then label raw/images -> raw/labels
python -m training.split_dataset raw/ datasets/ball           # images/ + labels/ -> train/val/test
python -m training.train_ball --data datasets/ball --device 0 # installs weights/ball.pt
python -m training.train_ball --data datasets/ball --export engine  # optional TensorRT
```

During training, `train_ball.py` applies these augmentations: hue shift (`hsv_h=0.015`), scaling between 0.8× and 1.2× (`scale=0.2`), 4-image mosaic, and left–right flips.
