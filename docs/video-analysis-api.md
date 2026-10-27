# Technical Architecture Document (TAD)

## Automated Cricket Analytics Processing Engine (CAPE)

---

## 1. Executive System Overview

The Cricket Analytics Processing Engine (CAPE) is a high-throughput, event-driven computer vision platform designed to extract quantitative performance metrics for both batters and bowlers from high-frame-rate video feeds (60–120 FPS).

The platform isolates individual player mechanics using a hybrid cascade multi-model workflow, switching processing pipelines dynamically based on target selection and spatial-temporal game triggers. It exposes an asynchronous REST API that returns structured JSON payloads coupled with precise image visualizations for three critical milestones:

- **Pre-contact** (backlift)
- **Point of contact** (impact)
- **Post-contact** (follow-through)

---

## 2. Global Component Architecture

```text
                               [ CLIENT CAPTURE APPLICATION ]
                                  (HFR Video Upload / Stream)
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. INGESTION & DECOMPRESSION LAYER                                                          │
│    • FastAPI multi-threaded endpoint (/api/v1/analyze-cricket-video)                        │
│    • Decoupled input I/O streamer & metadata extractor (FPS, height, width)                 │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │ (Sequential frame buffer)
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. COORDINATE TRANSFORM & CALIBRATION ENGINE                                                │
│    • 2D perspective matrix mapping (OpenCV homography engine)                               │
│    • Pixel coordinate workspace ──► 2D pitch metric grid (meters) scaling layer             │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. COMPUTER VISION MODEL INFERENCE                                                          │
│  ┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐  │
│  │ YOLOv11-Pose Engine       │ │ YOLOv11-Nano (Custom Ball)│ │ YOLOv11-Seg (Bat Engine)  │  │
│  │ • Track bowler run-up     │ │ • High-speed localization │ │ • Extrapolate bat mask    │  │
│  │ • Isolate batter bounding │ │ • Velocity inversion      │ │ • Measure spatial swing   │  │
│  └─────────────┬─────────────┘ └─────────────┬─────────────┘ └─────────────┬─────────────┘  │
└────────────────┬─────────────────────────────┬─────────────────────────────┬────────────────┘
                 │ (Pose vectors)              │ (Spatial coords)            │ (Mask overlays)
                 ▼                             ▼                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. EVENT-DRIVEN STATE MACHINE ROUTER                                                        │
│                                                                                             │
│   [STATE 1: PRE-CONTACT]  ──► Extracts bowler kinetic profiles & initial ball flight speed. │
│              │                                                                              │
│              ▼ (Event trigger: ball velocity vector inflection – dot-product inversion)     │
│   [STATE 2: AT-CONTACT]   ──► Runs MediaPipe Pose exclusively on the cropped batter ROI.    │
│              │                Captures 33 high-density structural joint profiles.           │
│              ▼                                                                              │
│   [STATE 3: POST-CONTACT] ──► Initializes Kalman filter trajectory smoothing.               │
│                               Calculates ball launch angle & exit velocities.               │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │ (Annotated media buffers & vector arrays)
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 5. GRAPHICS COMPOSITING & MEDIA PERSISTENCE GENERATOR                                       │
│    • Dynamic fading polyline alpha blender (opacity & thickness curve mapping)              │
│    • Multi-milestone image renderer (exports 3 segmented artifact JPEGs to disk)            │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 6. DATA DEPLOYMENT & LIFECYCLE SCRUBBER                                                     │
│    • Asynchronous API payload constructor (maps JSON values + unique artifact storage links)│
│    • FastAPI background task pipeline (enforces zero-leak storage cleanup)                  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Sub-System Specifications

### 3.1 Ingestion & Spatial Calibration Layer

- **Dynamic I/O buffering:** Video binaries uploaded via the `/api/v1/analyze-cricket-video` endpoint pass directly into a non-blocking asynchronous streaming file directory. The system decodes native header specs to isolate frame-rate profiles ($\Delta t$) and pixel dimension scales.
- **Perspective rectification (homography matrix):** To measure physical ball and human displacement speeds (km/h), raw camera coordinates must be converted into metric distance space. The system maps four user-defined reference pixels corresponding to the pitch boundaries (batting crease corners and bowling crease corners) and solves a homography transformation matrix $H$:

$$
\begin{bmatrix} X_{\text{meters}} \\ Y_{\text{meters}} \\ 1 \end{bmatrix} = H \times \begin{bmatrix} x_{\text{pixel}} \\ y_{\text{pixel}} \\ 1 \end{bmatrix}
$$

This matrix flattens lens distortion, keeping speed calculations precise whether the camera is positioned side-on or at a high elevation behind the bowler's arm.

### 3.2 Machine Learning Inference Factory

The inference layer decouples tracking dependencies to optimize GPU operations and prevent frame bottlenecks:

- **YOLOv11-Nano (custom trained):** Optimized for single-object, high-velocity pinpoint tracking. This network runs on every frame to identify the boundaries of the cricket ball.
- **YOLOv11-Pose (off the shelf):** Tracks general body kinematics (17 structural keypoints). It calculates the bowler's approach, run-up speed profile, and the boundaries of the batter's target area.
- **YOLOv11-Seg (custom bat segmentation):** Computes pixel-level polygons framing the cricket bat. The changing angle of this mask yields swing orientation metrics.
- **MediaPipe Pose engine (targeted slicing):** To preserve processing power, MediaPipe is never run across the entire video. When a user selects the batter for analysis, the system crops that player out of the frame using the YOLO bounding box and passes the localized region to MediaPipe. This reduces processing load by up to 75% while capturing the 33 high-density landmarks (wrists, fingers, feet) needed for detailed batting analysis.

---

## 4. State Machine Tracking & Event Triggers

The core tracking loop operates as an event-driven state machine, changing its mathematical and algorithmic properties based on real-time physics thresholds.

```text
[State 1: Pre-Contact] ──► (Trigger: velocity vector inversion) ──► [State 2: At-Contact] ──► [State 3: Post-Contact]
```

### 4.1 State 1: Pre-Contact (Delivery Flight)

- **Active models:** YOLOv11-Nano (ball), YOLOv11-Pose (bowler).
- **Metrics tracked:** Bowler approach acceleration, ball release location, ball flight velocity vectors.
- **Next-state trigger:** The system evaluates the directional vector of the ball across sequential frames ($\vec{V}_t$). The frame where the velocity-vector dot product turns sharply negative, or shows an instantaneous directional inversion, triggers a switch to State 2:

$$
\vec{V}_t \cdot \vec{V}_{t-1} < 0
$$

### 4.2 State 2: At-Contact (Impact Event)

- **Active models:** YOLOv11-Nano (ball), YOLOv11-Seg (bat), MediaPipe Pose (batter box).
- **Metrics tracked:** Instantaneous entry speed of the ball, bat face angle relative to the horizon, and precise 3D posture angles of the batter's front knee, shoulders, and elbows.
- **System operations:** The system pauses the regular tracking loop to extract and lock this frame ($F_c$) as the anchor point for all trajectory and visualization outputs.

### 4.3 State 3: Post-Contact (Launch & Follow-Through)

- **Active models:** YOLOv11-Nano (ball), Kalman filter engine.
- **Metrics tracked:** Post-impact ball launch velocity, vertical launch angle, batter follow-through swing profile.
- **System operations:** Because balls often blur or drop frames after hitting a bat, a linear Kalman filter is initialized at frame $F_c$ to predict and smooth the tracking path across any missing coordinate points.

---

## 5. Visual Rendering Pipeline

The rendering engine generates images by assembling discrete data layers into a composite structure:

```text
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Text & scalar metrics overlay (km/h, joint angles) │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Vector path layer (fading alpha polylines)         │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Base decompressed video frame matrix (F_c)         │
└─────────────────────────────────────────────────────────────┘
```

- **Alpha-blended trajectory trails:** To prevent lines from cluttering the frame, the path uses an index-based decay equation. For an array of post-contact ball coordinates, the alpha transparency ($\alpha$) and line thickness ($T$) drop for older entries:

$$
\alpha_i = \frac{i}{\text{len}(\text{History})}, \quad T_i = \text{BaseThickness} \times \alpha_i
$$

- **Automated image export engine:** The pipeline saves three milestone frames to the session directory:
  1. `1_pre_contact.jpg` – displays the batter's target area and early ball vector.
  2. `2_point_of_contact.jpg` – displays a locked contact indicator, point-of-impact circle, and calibrated ball velocity text.
  3. `3_post_contact.jpg` – displays the full fading trajectory line mapping the path of the shot.

---

## 6. Data Definitions & API Schemas

### 6.1 Unified Analytical Payload Format (JSON response)

```json
{
  "status": "success",
  "session_id": "c8a49b21-4f30-4e2e-83d1-9f9cb2bf4102",
  "metadata": {
    "resolution": "1920x1080",
    "framerate_fps": 60,
    "selected_target": "batter"
  },
  "analytics_payload": {
    "pre_contact": {
      "milestone_frame": 10,
      "batter_joint_angles": {
        "left_elbow_flexion": 92.4,
        "front_knee_extension": 138.1
      }
    },
    "point_of_contact": {
      "milestone_frame": 20,
      "ball_velocity_kmh": 138.4,
      "bat_angle_degrees": 14.2,
      "batter_3d_landmarks": {
        "left_wrist": [0.12, 0.45, -0.08],
        "right_wrist": [0.15, 0.42, -0.11]
      }
    },
    "post_contact": {
      "milestone_frame": 35,
      "exit_velocity_kmh": 112.6,
      "launch_angle_degrees": 18.5
    }
  },
  "download_endpoints": {
    "pre_contact_snapshot": "/api/v1/artifacts/c8a49b21/pre_contact",
    "impact_snapshot": "/api/v1/artifacts/c8a49b21/point_of_contact",
    "post_contact_snapshot": "/api/v1/artifacts/c8a49b21/post_contact"
  }
}
```

---

## 7. Storage Lifecycle & Security Protocols

To prevent data leaks and maintain server storage capacity, session files are tightly controlled:

```text
[Inbound video upload]
         │
         ▼
[Create /cricket_workspace/{session_id}/]
         │
         ▼
[Process pipeline & output images to disk]
         │
         ▼
[Deliver API JSON packet to client UI]
         │
         ▼
[Trigger FastAPI async background cleanup thread]
         │
         ▼
[Purge /{session_id}/ directory permanently (zero retention)]
```

This ensures the workspace disk serves purely as an ephemeral processing buffer, keeping the API scalable and resource-efficient under high production loads.

---

## 8. Containerization & GPU Infrastructure Deployment Design

To run YOLOv11 architectures and MediaPipe pipelines at peak real-time efficiency, the system uses the NVIDIA Container Toolkit to expose host GPU resources to the Docker container. This configuration keeps execution speeds consistent under high workload concurrency.

### 8.1 Docker Infrastructure Visual Map

```text
              [ HOST OPERATING SYSTEM: Linux / Ubuntu ]
                                  │
       ┌──────────────────────────┴───────────────────────────┐
       │        NVIDIA CUDA Driver (Host-Level Kernel)        │
       └──────────────────────────┬───────────────────────────┘
                                  │ (PCIe GPU passthrough)
                                  ▼
           [ DOCKER CONTAINER: CAPE PRODUCTION RUNTIME ]
┌──────────────────────────────────────────────────────────────────┐
│ • Base layer: nvidia/cuda:12.4.1-runtime-ubuntu22.04             │
│ • Deep learning layer: TensorRT 10.x + ONNX Runtime GPU backend  │
│ • Application layer: Python 3.11 + FastAPI + OpenCV (headless)   │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Production `Dockerfile` Configuration

The following `Dockerfile` reduces the system footprint with a multi-stage build and drops non-essential GUI dependencies to save server memory:

```dockerfile
# Stage 1: Build & Python dependency resolver
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3-pip pip && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .

# Compile wheels directly targeting host accelerator architectures
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Minimal final production runtime
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04 AS runner

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PATH="/root/.local/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    libgl1-mesa-glx \
    libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled Python packages from the build stage
COPY --from=builder /root/.local /root/.local
COPY . /app

EXPOSE 8000

# Run the server with multiple Uvicorn worker processes
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 8.3 Orchestration Runtime Mapping (`deploy/compose.yml`)

To map host GPU devices into runtime instances, use this Compose schema:

```yaml
version: '3.8'

services:
  cape-analytics-api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: cape_production_runtime
    ports:
      - "8000:8000"
    volumes:
      - ./cricket_workspace:/app/cricket_workspace
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - NVIDIA_DRIVER_CAPABILITIES=compute,utility
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    restart: always
```

---

## 9. 3D Kinematic Joint Angle Transformation Logic

MediaPipe Pose returns normalized spatial joint values $(x, y, z)$. While $x$ and $y$ correspond directly to pixel space, the $z$ coordinate denotes relative depth. To detect biomechanical anomalies (e.g., whether a batter's front elbow drops too low during a drive), the raw coordinates are passed through a 3D vector angle transformation engine.

### 9.1 Biomechanical Spatial Reference Coordinates

To assess a joint angle (such as the elbow), the system uses three coordinates to form two intersecting vectors:

| Point | Landmark | Role |
| --- | --- | --- |
| $A$ | Shoulder | Origin vector point |
| $B$ | Elbow | Pivot vertex joint |
| $C$ | Wrist | Extension target vector |

```text
         (A) Shoulder
           \
            \  Vector BA
             \
              (B) Elbow  ◄─── Calculates angle (θ)
             /
            /  Vector BC
           /
         (C) Wrist
```

### 9.2 Trigonometric Derivation Pipeline

1. **Vector formulation:** Translate the landmark coordinates into directional vectors:

   $$
   \vec{BA} = (A_x - B_x,\ A_y - B_y,\ A_z - B_z)
   $$

   $$
   \vec{BC} = (C_x - B_x,\ C_y - B_y,\ C_z - B_z)
   $$

2. **Dot product:** Sum the products of the individual vector components:

   $$
   \vec{BA} \cdot \vec{BC} = (BA_x \times BC_x) + (BA_y \times BC_y) + (BA_z \times BC_z)
   $$

3. **Magnitude (Euclidean norm):** Measure the lengths of the bone segments:

   $$
   \lVert \vec{BA} \rVert = \sqrt{BA_x^2 + BA_y^2 + BA_z^2}
   $$

   $$
   \lVert \vec{BC} \rVert = \sqrt{BC_x^2 + BC_y^2 + BC_z^2}
   $$

4. **Angle isolation:** Compute the angle ($\theta$) in radians, then convert it to degrees for display in the front-end:

   $$
   \theta = \arccos\left(\frac{\vec{BA} \cdot \vec{BC}}{\lVert \vec{BA} \rVert \times \lVert \vec{BC} \rVert}\right)
   $$

   $$
   \theta_{\text{degrees}} = \theta \times \frac{180}{\pi}
   $$

---

## 10. Data Annotation Strategies for Custom YOLO Ball Tracking

A cricket ball is highly susceptible to motion blur, lens flare, occlusion by the bat, and background noise (such as the pitch surface or crowd clothing). Standard model weights will drop tracking frames. To build a robust dataset for custom YOLOv11-Nano training, use the following annotation strategy.

### 10.1 Label Mapping Specification

The dataset uses two annotation classes depending on the ball's movement across the frame:

| Label ID | Class | Bounding-box strategy | Application phase |
| --- | --- | --- | --- |
| 0 | `cricket_ball` | Crisp bounding box matching the ball's perimeter. | Static, slow movement, or pre-delivery. |
| 1 | `blurred_ball` | Elongated bounding box covering the entire motion-blur streak. | High-velocity flight phase (130+ km/h). |

```text
  CRISP TRACKING (Class 0)          MOTION BLUR STREAK (Class 1)
         ┌───┐                            ┌───────────┐
         │ ● │                            │ ●━━━━━━━  │
         └───┘                            └───────────┘
   (Tight box around ball)         (Box covers the whole streak)
```

### 10.2 Image Annotation Rules

```text
┌──────────────────────────────────────────────────────────────────┐
│                      DATASET SPLIT PROFILE                       │
├──────────────────────────────────────────────────────────────────┤
│  Total source dataset: min. 2,500 high-resolution video frames   │
│                                                                  │
│  ├── Train split (80%)  ──► 2,000 frames                         │
│  ├── Valid split (10%)  ──► 250 frames                           │
│  └── Test split  (10%)  ──► 250 frames                           │
└──────────────────────────────────────────────────────────────────┘
```

1. **Handling motion-blur streaks:** At high speed the ball appears on camera as a stretched line rather than a circle. Annotators must draw the bounding box around the entire visible streak and label it as class 1 (`blurred_ball`). This teaches the model to recognise velocity streaks instead of dropping frames during rapid flight.
2. **Context-driven background variation:** Collect imagery across varying conditions:
   - Bright, direct sunlight causing harsh surface glare.
   - Low-light evening scenarios under artificial stadium floodlights.
   - Background variations, including dark sightscreens, green turf, and white advertising boards.
3. **Data augmentation transforms:** To prevent overfitting to specific camera angles, apply these augmentations during training:
   - **HSV hue shift (±15%):** Improves resilience to ball colour variations (red, white, and pink cricket balls).
   - **Random bounding-box scaling (0.8× to 1.2×):** Prepares the network for differing zoom levels and focal lengths.
   - **Mosaic blending (4-image mix):** Combines parts of different frames to teach the model to separate small objects from busy backgrounds, such as fielders in the distance.

---

## 11. Coaching Output & User Experience

CAPE exists to answer one question for the player: *"What did I do, what went wrong, and how do I fix it?"* Every analysis therefore ends in a coaching verdict, not just raw numbers.

### 11.1 User Journey

```text
[Pick video: device or Google Drive]
         │
         ▼
[Describe the clip: batter or bowler, handedness, shot played / bowler type]
         │
         ▼
[Tap the 4 crease corners on the first frame (calibration)]
         │
         ▼
[Submit ──► "Analysing…" (job queued; user can leave the screen)]
         │
         ▼
[Result screen: verdict ─ pose ─ faults ─ recommendations ─ images]
         │
         ▼
[Download individual images or all as a ZIP; saved to assessment history]
```

**Inputs collected from the user:**

| Field | Values | Used for |
| --- | --- | --- |
| `target` | `batter`, `bowler` | Selects the batting or bowling rule set. |
| `handedness` | `right`, `left` | Front/back side mapping and off/leg side for line. |
| `shot_type` (batter) | `front_foot_drive`, `back_foot_drive`, `forward_defence`, `backward_defence`, `pull`, `cut`, `sweep` | Selects the reference ranges for that shot. |
| `bowler_type` (bowler) | `pace`, `spin` | Selects the length zones and pose ranges. |
| `calibration_points` | 4 `[x, y]` pixels | Homography (§3.1). |

### 11.2 Result Screen Contents

1. **Verdict card:** overall score (0–100) and a one-line verdict, e.g. *"Good-length ball on off stump at 118 km/h"* or *"Drive played with a closed front knee and head falling away"*.
2. **Pose panel:** the key joint angles at each milestone, shown against the ideal range (green within range, amber within 10%, red outside).
3. **Faults list:** ranked by severity. Each fault states what was measured, the expected range, why it matters, and the recommendation with a suggested drill.
4. **Strengths list:** checks that passed, so feedback is balanced.
5. **Images:** the milestone images with the faults drawn on them (angle arcs coloured by status, pitching point and zone overlay for bowlers), each downloadable.

### 11.3 Batting Assessment

Batting checks are evaluated at the point-of-contact frame $F_c$ (and at pre-contact for backlift). Example reference ranges:

| Shot | Check | Metric | Ideal range | Fault if outside |
| --- | --- | --- | --- | --- |
| Front-foot drive | Front knee bend | Front knee angle | 110°–150° | Locked or collapsed front knee |
| Front-foot drive | Head position | Head ahead of front knee (horizontal, % of torso length) | ≤ 10% behind | Head falling away / off balance |
| Front-foot drive | Straight bat | Bat angle from vertical | ≤ 20° | Angled bat, edge risk |
| Front-foot drive | Stride | Front-foot stride length | ≥ 0.6 m | Not getting to the pitch of the ball |
| Forward defence | Bat ahead of pad | Bat face ahead of front pad | ≥ 0 cm | Bat-pad gap, LBW/edge risk |
| Pull | Bat plane | Bat angle from vertical | 60°–100° | Hitting upward, top-edge risk |
| Pull | Head stability | Head travel pre-contact → contact | ≤ 8% of torso length | Head moving, losing sight of ball |

The full rule set lives in a coach-tunable rules file (`coaching_rules.yaml`), covering every `shot_type`. The values above are starting heuristics and must be validated with club coaches before release.

### 11.4 Bowling Assessment

Bowling is judged against what makes a *good ball* for the selected `bowler_type`:

- **Speed:** release speed (km/h), from the calibrated ball positions between release and the pitching point.
- **Pitching point:** the first bounce, detected as the sign change of the ball's vertical image velocity. Because the ball is on the ground at this instant, the homography gives an accurate metric position.
- **Length:** distance from the pitching point to the batter's stumps.
- **Line:** lateral offset of the pitching point from middle stump (positive = off side, mirrored for a left-handed batter).

| Length zone | Pace (from batter's stumps) | Spin (from batter's stumps) |
| --- | --- | --- |
| Yorker | 0–2 m | 0–1 m |
| Full | 2–5 m | 1–3 m |
| **Good length** | **5–8 m** | **3–5 m** |
| Short of a length | 8–10 m | 5–6 m |
| Short | > 10 m | > 6 m |

| Line zone | Offset from middle stump |
| --- | --- |
| Down leg | < −0.15 m |
| Stumps | −0.15 m to +0.15 m |
| **Off-stump channel** | **+0.15 m to +0.45 m** |
| Wide of off | > +0.45 m |

A *good ball* is good length **and** in the stumps or off-stump channel. Bowling pose checks include front knee angle at front-foot contact (pace ideal ≥ 160°, braced front leg) and release height.

Speed in the air is an approximation, because the homography is only exact on the ground plane. It is reported to the nearest whole km/h with a stated ±5 km/h tolerance.

### 11.5 Recommendations

- **Deterministic first:** each rule in `coaching_rules.yaml` maps a fault to a severity (from the size of the deviation), a recommendation and a drill. The same video always yields the same faults.
- **Optional AI wording:** the Node API may ask Gemini to turn the fault list into a short, friendly summary. The prompt contains only the computed metrics and faults, and Gemini must not add new faults or numbers. This is off by default.

### 11.6 Extended Payload

The §6.1 payload gains these blocks:

```json
{
  "metadata": {
    "target": "batter",
    "handedness": "right",
    "shot_type": "front_foot_drive",
    "bowler_type": null
  },
  "delivery": {
    "speed_kmh": 118,
    "speed_tolerance_kmh": 5,
    "pitching_point_m": [6.4, 0.22],
    "length_zone": "good_length",
    "line_zone": "off_stump_channel",
    "is_good_ball": true
  },
  "coaching": {
    "score": 72,
    "verdict": "Drive played with a collapsed front knee",
    "faults": [
      {
        "code": "front_knee_collapsed",
        "milestone": "point_of_contact",
        "metric": "front_knee_angle",
        "value": 98.2,
        "expected": [110, 150],
        "severity": "high",
        "message": "Front knee is over-bent at contact, so weight is not transferring into the shot.",
        "recommendation": "Stride to the pitch of the ball and keep the front knee softly flexed over the front foot.",
        "drill": "Front-foot stride drill with cones"
      }
    ],
    "strengths": ["Straight bat at contact (12°)"]
  },
  "download_endpoints": {
    "all_zip": "/api/v1/artifacts/c8a49b21/all.zip"
  }
}
```

`delivery` is `null` for batting analyses. The ball's line, length and speed are only meaningful for bowling.

### 11.7 Downloadable Images

| Target | Artifacts |
| --- | --- |
| Batter | `1_pre_contact.jpg`, `2_point_of_contact.jpg`, `3_post_contact.jpg` |
| Bowler | `1_release.jpg`, `2_pitching_point.jpg`, `3_pitch_map.jpg` (top-down pitch with zone bands and the pitching point) |

Each image is downloadable on its own (`Content-Disposition: attachment`) or as one ZIP. The Node API renames downloads to `<player>_<date>_<milestone>.jpg` and keeps a copy in the user's Google Drive alongside the source video, so they remain available after CAPE's ephemeral workspace is purged (§7).
