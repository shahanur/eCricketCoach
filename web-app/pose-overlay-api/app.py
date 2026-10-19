"""Single cropped-frame cricket pose overlay API, isolated from CAPE's video contract."""

from __future__ import annotations

import base64
import hmac
import math
import os
import threading
from typing import Any

import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

try:
    from ultralytics import YOLO
except ImportError:  # MediaPipe can still produce the joint overlay if YOLO is unavailable.
    YOLO = None

app = FastAPI(title="eCricketCoach Cropped Pose Overlay API", version="1.0.0")
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_IMAGE_DIMENSION = 4096
API_KEY = os.getenv("POSE_OVERLAY_API_KEY", "").strip()
YOLO_MODEL_PATH = os.getenv("POSE_OVERLAY_YOLO_MODEL", "/weights/yolo11n-pose.pt")
POSE_MODEL: Any | None = None
YOLO_MODEL: Any | None = None
POSE_LOCK = threading.Lock()
YOLO_LOCK = threading.Lock()

POSE = mp.solutions.pose
LANDMARK_LABELS = {
    "head": POSE.PoseLandmark.NOSE,
    "left_shoulder": POSE.PoseLandmark.LEFT_SHOULDER,
    "right_shoulder": POSE.PoseLandmark.RIGHT_SHOULDER,
    "left_elbow": POSE.PoseLandmark.LEFT_ELBOW,
    "right_elbow": POSE.PoseLandmark.RIGHT_ELBOW,
    "left_wrist": POSE.PoseLandmark.LEFT_WRIST,
    "right_wrist": POSE.PoseLandmark.RIGHT_WRIST,
    "left_hip": POSE.PoseLandmark.LEFT_HIP,
    "right_hip": POSE.PoseLandmark.RIGHT_HIP,
    "left_knee": POSE.PoseLandmark.LEFT_KNEE,
    "right_knee": POSE.PoseLandmark.RIGHT_KNEE,
    "left_ankle": POSE.PoseLandmark.LEFT_ANKLE,
    "right_ankle": POSE.PoseLandmark.RIGHT_ANKLE,
    "left_toe": POSE.PoseLandmark.LEFT_FOOT_INDEX,
    "right_toe": POSE.PoseLandmark.RIGHT_FOOT_INDEX,
}
LABEL_KEYS = frozenset(("head", "left_elbow", "right_elbow", "left_knee", "right_knee", "left_toe", "right_toe"))


def get_pose_model() -> Any:
    global POSE_MODEL
    with POSE_LOCK:
        if POSE_MODEL is None:
            POSE_MODEL = POSE.Pose(
                static_image_mode=True,
                model_complexity=2,
                enable_segmentation=False,
                min_detection_confidence=0.45,
            )
        return POSE_MODEL


def get_yolo_model() -> Any | None:
    global YOLO_MODEL
    if YOLO_MODEL is not None or YOLO is None or not os.path.isfile(YOLO_MODEL_PATH):
        return YOLO_MODEL
    with YOLO_LOCK:
        if YOLO_MODEL is None and YOLO is not None and os.path.isfile(YOLO_MODEL_PATH):
            try:
                import torch

                torch.set_num_threads(os.cpu_count() or 1)
                YOLO_MODEL = YOLO(YOLO_MODEL_PATH)
            except Exception as error:
                print(f"Pose overlay YOLO detector unavailable; continuing with MediaPipe: {error}")
    return YOLO_MODEL


def point_angle(a: tuple[float, float] | None, b: tuple[float, float] | None, c: tuple[float, float] | None) -> float | None:
    if a is None or b is None or c is None:
        return None
    first = np.asarray(a, dtype=float) - np.asarray(b, dtype=float)
    second = np.asarray(c, dtype=float) - np.asarray(b, dtype=float)
    denominator = float(np.linalg.norm(first) * np.linalg.norm(second))
    if denominator <= 1e-8:
        return None
    cosine = float(np.clip(np.dot(first, second) / denominator, -1.0, 1.0))
    return round(math.degrees(math.acos(cosine)), 1)


def midpoint(a: tuple[float, float] | None, b: tuple[float, float] | None) -> tuple[float, float] | None:
    if a is None or b is None:
        return None
    return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)


def percent_of_body(numerator: float | None, body_height: float) -> float | None:
    return None if numerator is None or body_height <= 1 else round(numerator / body_height * 100.0, 1)


def put_label(image: np.ndarray, text: str, point: tuple[int, int], color: tuple[int, int, int]) -> None:
    height, width = image.shape[:2]
    x = int(np.clip(point[0], 4, max(4, width - 4)))
    y = int(np.clip(point[1], 18, max(18, height - 4)))
    (text_width, text_height), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
    x = min(x, max(2, width - text_width - 10))
    y = min(y, max(text_height + baseline + 3, height - 2))
    cv2.rectangle(image, (x - 3, y - text_height - baseline - 3), (x + text_width + 5, y + 3), (14, 23, 38), -1)
    cv2.putText(image, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)


def dashed_line(image: np.ndarray, start: tuple[int, int], end: tuple[int, int], color: tuple[int, int, int], dash: int = 12) -> None:
    length = math.dist(start, end)
    if length <= 0:
        return
    dx = (end[0] - start[0]) / length
    dy = (end[1] - start[1]) / length
    for offset in range(0, int(length), dash * 2):
        finish = min(length, offset + dash)
        p0 = (round(start[0] + dx * offset), round(start[1] + dy * offset))
        p1 = (round(start[0] + dx * finish), round(start[1] + dy * finish))
        cv2.line(image, p0, p1, color, 2, cv2.LINE_AA)


def detect_person(frame: np.ndarray) -> dict[str, Any] | None:
    model = get_yolo_model()
    if model is None:
        return None
    try:
        with YOLO_LOCK:
            prediction = model.predict(frame, classes=[0], conf=0.2, imgsz=640, verbose=False)[0]
        if prediction.boxes is None or len(prediction.boxes) == 0:
            return None
        candidates = []
        for box in prediction.boxes:
            coords = [int(round(value)) for value in box.xyxy[0].tolist()]
            confidence = float(box.conf[0])
            candidates.append((confidence, coords))
        confidence, (x1, y1, x2, y2) = max(candidates, key=lambda item: item[0])
        height, width = frame.shape[:2]
        return {
            "confidence": round(confidence, 4),
            "box_px": [x1, y1, x2, y2],
            "box_norm": [round(x1 / width, 4), round(y1 / height, 4), round(x2 / width, 4), round(y2 / height, 4)],
        }
    except Exception as error:
        print(f"Pose overlay YOLO inference failed; continuing with MediaPipe: {error}")
        return None


def analyse_frame(frame: np.ndarray, handedness: str) -> dict[str, Any]:
    height, width = frame.shape[:2]
    person = detect_person(frame)
    pose_model = get_pose_model()
    with POSE_LOCK:
        pose_result = pose_model.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    if pose_result.pose_landmarks is None:
        raise HTTPException(status_code=422, detail="No batter pose could be detected in the cropped image.")

    raw_landmarks = pose_result.pose_landmarks.landmark
    points: dict[str, tuple[float, float] | None] = {}
    serialized_landmarks: dict[str, dict[str, float] | None] = {}
    for name, landmark_id in LANDMARK_LABELS.items():
        landmark = raw_landmarks[landmark_id.value]
        visible = float(getattr(landmark, "visibility", 1.0))
        if visible < 0.25:
            points[name] = None
            serialized_landmarks[name] = None
            continue
        pixel = (float(landmark.x) * width, float(landmark.y) * height)
        points[name] = pixel
        serialized_landmarks[name] = {
            "x": round(float(landmark.x), 4),
            "y": round(float(landmark.y), 4),
            "visibility": round(visible, 4),
        }

    front = "left" if handedness == "right" else "right"
    back = "right" if front == "left" else "left"
    shoulder_mid = midpoint(points["left_shoulder"], points["right_shoulder"])
    ankle_mid = midpoint(points["left_ankle"], points["right_ankle"])
    body_height = math.dist(shoulder_mid, ankle_mid) if shoulder_mid and ankle_mid else float(height)
    front_shoulder = points[f"{front}_shoulder"]
    front_elbow = points[f"{front}_elbow"]
    front_hip = points[f"{front}_hip"]
    front_knee = points[f"{front}_knee"]
    front_ankle = points[f"{front}_ankle"]
    front_toe = points[f"{front}_toe"]
    back_shoulder = points[f"{back}_shoulder"]
    back_elbow = points[f"{back}_elbow"]
    back_hip = points[f"{back}_hip"]
    back_knee = points[f"{back}_knee"]
    back_ankle = points[f"{back}_ankle"]
    head = points["head"]

    metrics = {
        "front_elbow_angle_degrees": point_angle(front_shoulder, front_elbow, points[f"{front}_wrist"]),
        "back_elbow_angle_degrees": point_angle(back_shoulder, back_elbow, points[f"{back}_wrist"]),
        "front_knee_angle_degrees": point_angle(front_hip, front_knee, front_ankle),
        "back_knee_angle_degrees": point_angle(back_hip, back_knee, back_ankle),
        "front_elbow_height_above_shoulder_pct": percent_of_body(
            front_shoulder[1] - front_elbow[1] if front_shoulder and front_elbow else None, body_height
        ),
        "head_to_front_toe_horizontal_offset_pct": percent_of_body(
            head[0] - front_toe[0] if head and front_toe else None, body_height
        ),
        "front_knee_to_toe_horizontal_offset_pct": percent_of_body(
            front_knee[0] - front_toe[0] if front_knee and front_toe else None, body_height
        ),
        "shoulder_tilt_degrees": round(math.degrees(math.atan2(
            points["right_shoulder"][1] - points["left_shoulder"][1],
            points["right_shoulder"][0] - points["left_shoulder"][0],
        )), 1) if points["left_shoulder"] and points["right_shoulder"] else None,
    }

    overlay = frame.copy()
    mp.solutions.drawing_utils.draw_landmarks(
        overlay,
        pose_result.pose_landmarks,
        POSE.POSE_CONNECTIONS,
        landmark_drawing_spec=mp.solutions.drawing_styles.get_default_pose_landmarks_style(),
    )
    cyan = (220, 230, 30)
    magenta = (210, 65, 245)
    yellow = (20, 220, 255)
    if person:
        x1, y1, x2, y2 = person["box_px"]
        cv2.rectangle(overlay, (x1, y1), (x2, y2), yellow, max(1, width // 500), cv2.LINE_AA)
        put_label(overlay, f"YOLO person {person['confidence']:.2f}", (x1 + 4, y1 + 22), yellow)
    if head and front_toe:
        head_point = tuple(map(round, head))
        toe_point = tuple(map(round, front_toe))
        dashed_line(overlay, head_point, (head_point[0], toe_point[1]), magenta)
        cv2.line(overlay, (head_point[0], toe_point[1]), toe_point, cyan, 2, cv2.LINE_AA)
    for name in LABEL_KEYS:
        point = points.get(name)
        if point:
            color = magenta if name == "head" else cyan
            location = tuple(map(round, point))
            cv2.circle(overlay, location, max(4, width // 180), color, -1, cv2.LINE_AA)
            put_label(overlay, name.replace("_", " ").upper(), (location[0] + 8, location[1] - 5), color)
    if front_toe:
        cv2.circle(overlay, tuple(map(round, front_toe)), max(5, width // 150), yellow, 2, cv2.LINE_AA)
    footer = f"2D pose overlay · {handedness}-handed · {width}x{height}"
    cv2.rectangle(overlay, (0, 0), (width, min(30, height)), (14, 23, 38), -1)
    cv2.putText(overlay, footer[:100], (8, min(21, height - 2)), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (235, 245, 255), 1, cv2.LINE_AA)
    ok, encoded = cv2.imencode(".png", overlay)
    if not ok:
        raise HTTPException(status_code=500, detail="Could not encode the pose overlay image.")

    return {
        "status": "success",
        "width": width,
        "height": height,
        "handedness": handedness,
        "person_detection": person,
        "landmarks": serialized_landmarks,
        "metrics": metrics,
        "limitations": [
            "Joint angles and alignment values are 2D image-plane estimates from one cropped frame, not calibrated 3D biomechanics.",
            "Head location uses the nose landmark as a visible head proxy; hidden or low-confidence landmarks are omitted.",
            "No force, pressure, power, weight transfer, or motion speed is measured from this still image.",
        ],
        "overlay_image_base64": base64.b64encode(encoded.tobytes()).decode("ascii"),
        "overlay_mime_type": "image/png",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "eCricketCoach Cropped Pose Overlay API"}


@app.post("/v1/pose-overlay")
async def pose_overlay(
    image: UploadFile = File(...),
    handedness: str = Form("right"),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
) -> JSONResponse:
    if API_KEY and not hmac.compare_digest(x_api_key or "", API_KEY):
        raise HTTPException(status_code=401, detail="Invalid service API key.")
    if handedness not in {"right", "left"}:
        raise HTTPException(status_code=400, detail="Handedness must be right or left.")
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP crop.")
    content = await image.read(MAX_IMAGE_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="The cropped image is empty.")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="The cropped image exceeds the 12 MB limit.")
    frame = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=422, detail="The cropped image could not be decoded.")
    height, width = frame.shape[:2]
    if width < 32 or height < 32 or width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
        raise HTTPException(status_code=422, detail="The cropped image dimensions must be between 32 and 4096 pixels.")
    result = await run_in_threadpool(analyse_frame, frame, handedness)
    return JSONResponse(result)
