# Cricket Kinematics Analytics: Requirements and Approach

To build an advanced cricket analytics system that tracks players, ball speeds, and bat metrics while overlaying trajectory paths, you cannot rely on MediaPipe alone. You must build a hybrid architecture combining YOLO for multi-object detection, a custom pixel-to-metric calibration pipeline for speed tracking, and specialized optical flow models for fast-moving elements.

This document describes how to design and build this solution step by step.

---

## 1. System Architecture Design

Because a cricket ball travels at speeds up to 160 km/h (100 mph) and a bat swings rapidly, standard 30 FPS cameras will cause motion-blur artifacts. You will need to ingest video (ideally 60–120 FPS), process it frame by frame, and pass it to three dedicated processing pipelines.

```text
[ Video Input (60-120 FPS) ]
            │
            ▼
┌──────────────────────────────────────┐
│  Homography & Camera Calibration     │  (Maps video pixels to real-world meters)
└──────────────────────────────────────┘
            │
            ├───► [ Pipeline A: Player Analytics (YOLO + MediaPipe) ]
            ├───► [ Pipeline B: Ball Tracking & Contact (YOLO + Optical Flow) ]
            └───► [ Pipeline C: Bat Swing Analytics (YOLO + Segmentation) ]
```

---

## 2. Step-by-Step Implementation Guide

### Step 1: Camera Calibration (The Foundation for Speed)

Computer vision models only output pixel coordinates $(x, y)$. To calculate actual speed (km/h), you must translate pixels into real-world meters.

- **What to do:** Use OpenCV homography (`cv2.getPerspectiveTransform`).
- **How it works:** Manually map known physical landmarks on a cricket pitch (e.g., the 22-yard / 20.12-meter pitch length, crease lines, and stumps) to your camera view. This gives you a matrix to convert pixel movement over time into actual velocity.

### Step 2: Batting, Bowling, and Fielding Analysis (The Hybrid Approach)

Tracking 22 players, their specific joint mechanics, and their roles requires splitting the load between YOLO and MediaPipe.

- **For fielders and bowlers:** Use YOLOv8-Pose or YOLOv11-Pose. It easily detects multiple people simultaneously, tracks the bowler's run-up speed using bounding boxes, and monitors fielders' reaction times and distances covered.
- **For batter biomechanics:** Once YOLO isolates the batter's bounding box, crop that region and feed it into MediaPipe Pose. MediaPipe's 33 high-density keypoints let you calculate precise joint angles (e.g., front-foot knee flexion, elbow extension during a drive), which YOLO's standard 17 keypoints cannot capture accurately.

### Step 3: Ball Tracking and Ball Speed

A cricket ball is tiny and moves fast, often disappearing or blurring across consecutive frames.

- **Detection:** Train a custom, lightweight YOLO Nano object-detection model specifically on cricket balls.
- **Tracking and speed:** When YOLO misses the ball due to motion blur, bridge the gap using Lucas–Kanade optical flow or a Kalman filter to predict its position between frames.
- **Speed math:** Calculate the distance the ball travelled in meters (via Step 1) between frame $A$ and frame $B$, then divide by the frame time delta (e.g., $1/60$ of a second) to get the speed.

### Step 4: Bat Swing and Speed Tracking

A bat is a rigid object, but its orientation changes rapidly during a swing.

- **What to do:** Use YOLO segmentation (YOLO-Seg) to isolate the mask of the cricket bat, or train a custom YOLO model to detect two specific points: the handle tip and the toe (bottom) of the bat.
- **Metrics:** Tracking the velocity of the bat's toe provides the absolute bat swing speed, while the changing angle between the handle and toe provides the swing path profile.

### Step 5: Contact Point Detection and Trajectory Overlay (Core Requirement)

To draw the ball's travel line from the exact split second it impacts the bat, you need an event-detection trigger.

1. **Detecting the contact point:** Monitor the velocity vector of the ball. Write a conditional loop tracking the ball's $(x, y)$ coordinates. The exact frame where the ball's trajectory experiences a sharp, sudden inversion of direction or velocity vector (an inflection point) is programmatically marked as the contact point.
2. **Drawing the trajectory line:** Maintain an array of the ball's coordinates only after the contact-frame trigger. Use OpenCV's `cv2.line` or `cv2.polylines` to loop through this array and paint the continuous path directly onto the video frames. To make it look professional, apply a fading alpha blend over older coordinates so the tail travels smoothly behind the ball.

---

## 3. Recommended Technology Stack

| Area | Recommendation |
| --- | --- |
| Programming language | Python (development and prototyping) or C++ (real-time 60+ FPS processing on the edge) |
| Core frameworks | `ultralytics` (YOLOv8/YOLOv11 pose, detection, and segmentation) and `mediapipe` (cropped batter analysis) |
| Video math and overlays | OpenCV (homography matrix, image warping, and drawing lines) and NumPy |
| Hardware | A dedicated NVIDIA GPU (e.g., RTX 4060 or higher) is highly recommended for custom YOLO segmentation and multi-pose architectures |

---

## 4. Open Questions

To tailor the code and model-training steps, the following need to be decided:

- Will this be an offline video analysis tool (processing recorded videos) or a live, real-time system at the ground?
- Is a high-frame-rate camera (60 FPS+) available, or will standard broadcast/smartphone footage be processed?
