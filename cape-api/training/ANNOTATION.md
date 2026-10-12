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

## Workflow

```bash
python -m training.split_dataset raw/ datasets/ball           # images/ + labels/ -> train/val/test
python -m training.train_ball --data datasets/ball --device 0 # installs weights/ball.pt
python -m training.train_ball --data datasets/ball --export engine  # optional TensorRT
```

During training, `train_ball.py` applies these augmentations: hue shift (`hsv_h=0.015`), scaling between 0.8× and 1.2× (`scale=0.2`), 4-image mosaic, and left–right flips.
