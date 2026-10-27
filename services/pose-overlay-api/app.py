"""Single cropped-frame cricket pose overlay API, isolated from CAPE's video contract."""

from __future__ import annotations

import base64
import hmac
import json
import math
import os
import threading
from pathlib import Path
from typing import Any

import cv2
import mediapipe as mp
import numpy as np
import yaml
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
CAPE_RULES_PATH = Path(os.getenv("CAPE_COACHING_RULES_PATH", "/rules/coaching_rules.yaml"))
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


def geometry_metrics(
    points: dict[str, tuple[float, float] | None],
    handedness: str,
    frame_height: int,
) -> tuple[dict[str, float | None], float]:
    front = "left" if handedness == "right" else "right"
    back = "right" if front == "left" else "left"
    shoulder_mid = midpoint(points.get("left_shoulder"), points.get("right_shoulder"))
    hip_mid = midpoint(points.get("left_hip"), points.get("right_hip"))
    ankle_mid = midpoint(points.get("left_ankle"), points.get("right_ankle"))
    body_height = math.dist(shoulder_mid, ankle_mid) if shoulder_mid and ankle_mid else float(frame_height)
    torso_length_px = math.dist(shoulder_mid, hip_mid) if shoulder_mid and hip_mid else body_height
    front_shoulder = points.get(f"{front}_shoulder")
    front_elbow = points.get(f"{front}_elbow")
    front_hip = points.get(f"{front}_hip")
    front_knee = points.get(f"{front}_knee")
    front_ankle = points.get(f"{front}_ankle")
    front_toe = points.get(f"{front}_toe")
    back_shoulder = points.get(f"{back}_shoulder")
    back_elbow = points.get(f"{back}_elbow")
    back_hip = points.get(f"{back}_hip")
    back_knee = points.get(f"{back}_knee")
    back_ankle = points.get(f"{back}_ankle")
    head = points.get("head")
    metrics = {
        "front_elbow_angle_degrees": point_angle(front_shoulder, front_elbow, points.get(f"{front}_wrist")),
        "back_elbow_angle_degrees": point_angle(back_shoulder, back_elbow, points.get(f"{back}_wrist")),
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
        )), 1) if points.get("left_shoulder") and points.get("right_shoulder") else None,
    }
    metrics["chin_front_toe_offset_pct"] = percent_of_body(
        abs(head[0] - front_toe[0]) if head and front_toe else None, torso_length_px
    )
    front_reference = front_ankle or front_hip
    back_reference = back_ankle or back_hip
    forward_sign = None
    if front_reference and back_reference and abs(front_reference[0] - back_reference[0]) > 1e-6:
        forward_sign = 1.0 if front_reference[0] > back_reference[0] else -1.0
    metrics["head_front_knee_offset_pct"] = percent_of_body(
        (head[0] - front_knee[0]) * forward_sign if head and front_knee and forward_sign is not None else None,
        torso_length_px,
    )
    # CAPE rule metric names for corresponding contact-frame geometry checks.
    metrics["front_knee"] = metrics["front_knee_angle_degrees"]
    metrics["back_knee"] = metrics["back_knee_angle_degrees"]
    metrics["front_elbow"] = metrics["front_elbow_angle_degrees"]
    metrics["front_elbow_height_pct"] = percent_of_body(
        front_shoulder[1] - front_elbow[1] if front_shoulder and front_elbow else None,
        torso_length_px,
    )
    return metrics, body_height


def bat_line_angle(start: tuple[float, float] | None, end: tuple[float, float] | None) -> float | None:
    """CAPE convention: start-to-end direction from straight down in the image, 0-180 degrees."""
    if start is None or end is None:
        return None
    direction = np.asarray(end, dtype=np.float64) - np.asarray(start, dtype=np.float64)
    length = float(np.linalg.norm(direction))
    if length < 1:
        return None
    return round(math.degrees(math.acos(max(-1.0, min(1.0, float(direction[1] / length))))), 1)


def bat_angle_from_contact(
    points: dict[str, tuple[float, float] | None],
    contact: tuple[float, float] | None,
) -> float | None:
    """CAPE's bat-angle fallback: vector from visible wrist midpoint to contact."""
    wrists = [points.get(name) for name in ("left_wrist", "right_wrist") if points.get(name) is not None]
    if not wrists:
        return None
    hands = tuple(np.mean(np.asarray(wrists, dtype=np.float64), axis=0))
    return bat_line_angle(hands, contact)


def mediapipe_world_angles(pose_result: Any, handedness: str) -> dict[str, float]:
    """CAPE-style 3D joint angles from MediaPipe world landmarks for OpenAI-missing joints."""
    world = getattr(pose_result, "pose_world_landmarks", None) if pose_result is not None else None
    if world is None:
        return {}
    sides = ("left", "right") if handedness == "right" else ("right", "left")
    joints = {
        "elbow": ("shoulder", "elbow", "wrist"),
        "knee": ("hip", "knee", "ankle"),
    }
    output: dict[str, float] = {}
    for role, side in zip(("front", "back"), sides):
        for joint, suffixes in joints.items():
            keypoints = [getattr(POSE.PoseLandmark, f"{side.upper()}_{suffix.upper()}").value for suffix in suffixes]
            a, b, c = (world.landmark[index] for index in keypoints)
            vectors = [np.array((point.x, point.y, point.z), dtype=float) for point in (a, b, c)]
            first, second = vectors[0] - vectors[1], vectors[2] - vectors[1]
            denominator = float(np.linalg.norm(first) * np.linalg.norm(second))
            if denominator <= 1e-8:
                continue
            cosine = float(np.clip(np.dot(first, second) / denominator, -1.0, 1.0))
            output[f"{role}_{joint}"] = round(math.degrees(math.acos(cosine)), 1)
    return output


OPENAI_LANDMARK_NAMES = frozenset((
    "head", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee",
    "right_knee", "left_ankle", "right_ankle", "front_toe",
))


def parse_normalized_landmarks(raw: str) -> dict[str, tuple[float, float]]:
    try:
        payload = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="OpenAI landmarks must be valid JSON.") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="OpenAI landmarks must be an object.")
    result: dict[str, tuple[float, float]] = {}
    for name, point in payload.items():
        if name not in OPENAI_LANDMARK_NAMES:
            raise HTTPException(status_code=400, detail=f"Unsupported OpenAI landmark: {name}.")
        if point is None:
            continue
        if not isinstance(point, dict):
            raise HTTPException(status_code=400, detail=f"OpenAI landmark {name} must contain normalized x/y values.")
        x, y = point.get("x"), point.get("y")
        if (
            isinstance(x, bool) or isinstance(y, bool)
            or not isinstance(x, (int, float)) or not isinstance(y, (int, float))
            or not math.isfinite(x) or not math.isfinite(y)
            or x < 0 or x > 1 or y < 0 or y > 1
        ):
            raise HTTPException(status_code=400, detail=f"OpenAI landmark {name} is outside the normalized image bounds.")
        result[name] = (float(x), float(y))
    return result


def parse_normalized_point(raw: str) -> tuple[float, float] | None:
    try:
        payload = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="OpenAI contact point must be valid JSON.") from None
    if payload is None:
        return None
    points = parse_normalized_landmarks(json.dumps({"head": payload}))
    return points.get("head")


def parse_bat_points(raw: str) -> dict[str, Any] | None:
    """OpenAI bat handle/toe (crop-normalized) and full-frame contact bat angle; any may be absent."""
    try:
        payload = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="OpenAI bat points must be valid JSON.") from None
    if not payload:
        return None
    if not isinstance(payload, dict) or set(payload) - {"handle", "toe", "angle"}:
        raise HTTPException(status_code=400, detail="OpenAI bat points must be an object with handle, toe and angle.")
    angle = payload.get("angle")
    if angle is not None and (
        isinstance(angle, bool) or not isinstance(angle, (int, float)) or not math.isfinite(angle) or not 0 <= angle <= 180
    ):
        raise HTTPException(status_code=400, detail="OpenAI bat angle must be between 0 and 180 degrees.")
    return {
        "handle": parse_normalized_point(json.dumps(payload.get("handle"))),
        "toe": parse_normalized_point(json.dumps(payload.get("toe"))),
        "angle": None if angle is None else round(float(angle), 1),
    }


def evaluate_cape_rules(metrics: dict[str, float | None], shot_type: str) -> dict[str, Any]:
    if shot_type not in {"front_foot_drive", "back_foot_drive", "forward_defence", "backward_defence", "pull", "cut", "sweep"}:
        raise HTTPException(status_code=400, detail="Choose a supported batting shot type for CAPE rule comparison.")
    try:
        with CAPE_RULES_PATH.open(encoding="utf-8") as rules_file:
            rules = yaml.safe_load(rules_file)
    except (OSError, yaml.YAMLError) as error:
        print(f"CAPE coaching rules unavailable: {error}")
        raise HTTPException(status_code=503, detail="CAPE coaching rules could not be loaded.") from None

    checks = [
        *({**check, "group": "alignment"} for check in rules["batting"].get("alignment", [])),
        *({**check, "group": "shot"} for check in rules["batting"].get(shot_type, [])),
    ]
    default_bands = rules["scoring"].get("default_severity_bands", [10, 25])
    penalties = rules["scoring"].get("penalties", {"high": 20, "medium": 10, "low": 5})
    faults = []
    strengths = []
    unavailable = []
    check_rows = []
    evaluated = 0
    severity_order = {"high": 0, "medium": 1, "low": 2}
    text_keys = ("code", "message", "recommendation", "drill", "verdict")

    for check in checks:
        if check["milestone"] in {"pre_contact", "post_contact"}:
            value = metrics.get(f"{check['milestone']}.{check['metric']}")
        else:
            value = metrics.get(f"{check['milestone']}.{check['metric']}", metrics.get(check["metric"]))
        if value is None:
            if not check.get("optional") and check["metric"] not in unavailable:
                unavailable.append(check["metric"])
            check_rows.append({
                "group": check["group"],
                "code": check["code"],
                "milestone": check["milestone"],
                "metric": check["metric"],
                "value": None,
                "expected": [check.get("min"), check.get("max")],
                "status": "unavailable",
                "severity": None,
                "message": check.get("message", ""),
                "recommendation": check.get("recommendation", ""),
                "drill": check.get("drill"),
            })
            continue
        evaluated += 1
        lower, upper = check.get("min"), check.get("max")
        if lower is not None and value < lower:
            side, bound = "below", lower
        elif upper is not None and value > upper:
            side, bound = "above", upper
        else:
            strength = check.get("strength")
            if strength:
                strengths.append(strength.format(value=value))
            check_rows.append({
                "group": check["group"],
                "code": check["code"],
                "milestone": check["milestone"],
                "metric": check["metric"],
                "value": round(value, 2),
                "expected": [lower, upper],
                "status": "measured",
                "severity": None,
                "message": None,
                "recommendation": None,
                "drill": None,
            })
            continue
        scale = check.get("scale") or abs(bound) or 1.0
        deviation_pct = abs(value - bound) / scale * 100.0
        bands = check.get("severity_bands") or default_bands
        severity = "low" if deviation_pct <= bands[0] else "medium" if deviation_pct <= bands[1] else "high"
        detail = {key: check.get(key) for key in text_keys} | check.get(side, {})
        faults.append({
            "code": detail.get("code", check["code"]),
            "milestone": check["milestone"],
            "metric": check["metric"],
            "value": round(value, 2),
            "expected": [lower, upper],
            "severity": severity,
            "message": detail.get("message", check.get("message", "")),
            "recommendation": detail.get("recommendation", check.get("recommendation", "")),
            "drill": detail.get("drill", check.get("drill")),
            "verdict": detail.get("verdict", check.get("verdict")),
        })
        check_rows.append({
            "group": check["group"],
            "code": detail.get("code", check["code"]),
            "milestone": check["milestone"],
            "metric": check["metric"],
            "value": round(value, 2),
            "expected": [lower, upper],
            "status": "fault",
            "severity": severity,
            "message": detail.get("message", check.get("message", "")),
            "recommendation": detail.get("recommendation", check.get("recommendation", "")),
            "drill": detail.get("drill", check.get("drill")),
        })

    faults.sort(key=lambda fault: severity_order[fault["severity"]])
    partial = bool(unavailable)
    score = max(0, min(100, 100 - sum(penalties[fault["severity"]] for fault in faults)))
    verdict = next((fault["verdict"] for fault in faults if fault["verdict"]), None)
    return {
        "source": "services/cape-api/app/rules/coaching_rules.yaml",
        "shot_type": shot_type,
        "score": score,
        "score_scope": "partial; only available contact-frame metrics were scored" if partial else "all required checks available",
        "metric_basis": "2D image-plane estimates; CAPE thresholds are a screening comparison, not calibrated CAPE biomechanics",
        "verdict": verdict or rules["labels"]["positive"]["batting"],
        "checks_applicable": len(checks),
        "checks_evaluated": evaluated,
        "checks": check_rows,
        "faults": faults,
        "strengths": strengths,
        "unavailable": unavailable,
    }


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


def crop_detected_person(frame: np.ndarray) -> tuple[np.ndarray, list[int] | None]:
    person = detect_person(frame)
    if person is None:
        return frame, None
    height, width = frame.shape[:2]
    x1, y1, x2, y2 = person["box_px"]
    pad_x = max(12, round((x2 - x1) * 0.18))
    pad_y = max(12, round((y2 - y1) * 0.12))
    left = max(0, x1 - pad_x)
    top = max(0, y1 - pad_y)
    right = min(width, x2 + pad_x)
    bottom = min(height, y2 + pad_y)
    if right - left < 32 or bottom - top < 32:
        return frame, None
    crop = frame[top:bottom, left:right].copy()
    crop_height, crop_width = crop.shape[:2]
    scale = min(2.0, 960 / max(crop_width, crop_height))
    if scale > 1.05:
        crop = cv2.resize(crop, (round(crop_width * scale), round(crop_height * scale)), interpolation=cv2.INTER_CUBIC)
    return crop, [left, top, right, bottom]


def analyse_frame(
    frame: np.ndarray,
    handedness: str,
    openai_landmarks_norm: dict[str, tuple[float, float]] | None = None,
    openai_contact_point_norm: tuple[float, float] | None = None,
    shot_type: str = "front_foot_drive",
    openai_bat_points_norm: dict[str, Any] | None = None,
) -> dict[str, Any]:
    height, width = frame.shape[:2]
    person = detect_person(frame)
    openai_points: dict[str, tuple[float, float]] = {
        name: (x * width, y * height)
        for name, (x, y) in (openai_landmarks_norm or {}).items()
    }
    front = "left" if handedness == "right" else "right"
    back = "right" if front == "left" else "left"
    if "front_toe" in openai_points:
        openai_points[f"{front}_toe"] = openai_points["front_toe"]
    pose_result = None
    mediapipe_points: dict[str, tuple[float, float] | None] = {}
    serialized_landmarks: dict[str, dict[str, float] | None] = {}
    needs_mediapipe_fallback = not OPENAI_LANDMARK_NAMES.issubset(openai_points)
    if needs_mediapipe_fallback:
        pose_model = get_pose_model()
        with POSE_LOCK:
            pose_result = pose_model.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        if pose_result.pose_landmarks is None and not openai_points:
            raise HTTPException(status_code=422, detail="No batter pose could be detected in the selected frame.")
        if pose_result.pose_landmarks is not None:
            raw_landmarks = pose_result.pose_landmarks.landmark
            for name, landmark_id in LANDMARK_LABELS.items():
                landmark = raw_landmarks[landmark_id.value]
                visible = float(getattr(landmark, "visibility", 1.0))
                if visible < 0.25:
                    mediapipe_points[name] = None
                    serialized_landmarks[name] = None
                    continue
                pixel = (float(landmark.x) * width, float(landmark.y) * height)
                mediapipe_points[name] = pixel
                serialized_landmarks[name] = {
                    "x": round(float(landmark.x), 4),
                    "y": round(float(landmark.y), 4),
                    "visibility": round(visible, 4),
                }

    # OpenAI wins per point; MediaPipe supplies only points the OpenAI estimate omitted.
    points = dict(mediapipe_points)
    points.update(openai_points)
    mediapipe_metrics, _ = geometry_metrics(mediapipe_points, handedness, height)
    openai_metrics, _ = geometry_metrics(openai_points, handedness, height)
    metrics, _ = geometry_metrics(points, handedness, height)
    world_angles = mediapipe_world_angles(pose_result, handedness)
    metric_sources: dict[str, str] = {}
    front, back = ("left", "right") if handedness == "right" else ("right", "left")
    angle_requirements = {
        "front_elbow_angle_degrees": ("front_elbow", (f"{front}_shoulder", f"{front}_elbow", f"{front}_wrist")),
        "back_elbow_angle_degrees": ("back_elbow", (f"{back}_shoulder", f"{back}_elbow", f"{back}_wrist")),
        "front_knee_angle_degrees": ("front_knee", (f"{front}_hip", f"{front}_knee", f"{front}_ankle")),
        "back_knee_angle_degrees": ("back_knee", (f"{back}_hip", f"{back}_knee", f"{back}_ankle")),
    }
    for metric, (cape_alias, required_points) in angle_requirements.items():
        openai_angle = openai_metrics.get(metric)
        if openai_angle is not None and all(name in openai_points for name in required_points):
            metrics[metric] = openai_angle
            metric_sources[metric] = "OpenAI 2D"
        elif cape_alias in world_angles:
            metrics[metric] = world_angles[cape_alias]
            metric_sources[metric] = "MediaPipe 3D fallback"
        elif metrics.get(metric) is not None:
            metric_sources[metric] = "MediaPipe 2D fallback" if any(name not in openai_points for name in required_points) else "OpenAI 2D"
        else:
            metric_sources[metric] = "Unavailable"
        metrics[cape_alias] = metrics.get(metric)
        metric_sources[cape_alias] = metric_sources[metric]

    for metric, value in metrics.items():
        if metric in metric_sources:
            continue
        if openai_metrics.get(metric) is not None:
            metric_sources[metric] = "OpenAI 2D"
        elif mediapipe_metrics.get(metric) is not None:
            metric_sources[metric] = "MediaPipe 2D fallback"
        else:
            metric_sources[metric] = "OpenAI + MediaPipe geometry" if value is not None else "Unavailable"

    openai_contact_pixel = None if openai_contact_point_norm is None else (
        openai_contact_point_norm[0] * width,
        openai_contact_point_norm[1] * height,
    )
    used_mediapipe_fallback = any(
        name not in openai_points and point is not None for name, point in mediapipe_points.items()
    )
    geometry_points = points
    if openai_contact_pixel:
        front_shoulder_point = geometry_points.get(f"{front}_shoulder")
        back_shoulder_point = geometry_points.get(f"{back}_shoulder")
        if front_shoulder_point and back_shoulder_point:
            shoulder_vector = np.subtract(front_shoulder_point, back_shoulder_point, dtype=np.float64)
            target_vector = np.subtract(openai_contact_pixel, front_shoulder_point, dtype=np.float64)
            shoulder_length, target_length = np.linalg.norm(shoulder_vector), np.linalg.norm(target_vector)
            if shoulder_length >= 1 and target_length >= 1:
                cosine = float(np.dot(shoulder_vector, target_vector) / (shoulder_length * target_length))
                angle = math.degrees(math.acos(max(-1.0, min(1.0, cosine))))
                shoulder_target_angle = min(angle, 180 - angle)
                metrics["front_shoulder_target_angle_deg"] = round(shoulder_target_angle, 1)
                metric_sources["front_shoulder_target_angle_deg"] = "OpenAI + MediaPipe geometry" if used_mediapipe_fallback else "OpenAI 2D"
    if openai_contact_pixel and "front_shoulder_target_angle_deg" in metrics:
        metric_sources["front_shoulder_target_angle_deg"] = "OpenAI + MediaPipe geometry" if used_mediapipe_fallback else "OpenAI 2D"
    openai_bat = openai_bat_points_norm or {}
    bat_handle_pixel, bat_toe_pixel = (
        None if openai_bat.get(key) is None else (openai_bat[key][0] * width, openai_bat[key][1] * height)
        for key in ("handle", "toe")
    )
    wrists = [geometry_points.get(name) for name in ("left_wrist", "right_wrist") if geometry_points.get(name) is not None]
    grip_pixel = tuple(np.mean(np.asarray(wrists, dtype=np.float64), axis=0)) if wrists else None
    openai_bat_pixels = None
    shaft_bat_angle = None
    if bat_handle_pixel and bat_toe_pixel:
        shaft_bat_angle = bat_line_angle(bat_handle_pixel, bat_toe_pixel)
        openai_bat_pixels = (bat_handle_pixel, bat_toe_pixel)
        bat_source = "OpenAI 2D bat handle-to-toe"
    if shaft_bat_angle is None and bat_toe_pixel and grip_pixel:
        # The handle is usually hidden by the hands; CAPE also measures from the hands to the bat tip.
        shaft_bat_angle = bat_line_angle(grip_pixel, bat_toe_pixel)
        openai_bat_pixels = (grip_pixel, bat_toe_pixel)
        bat_source = "OpenAI bat toe + wrist grip"
    if shaft_bat_angle is not None:
        metrics["bat_angle_deg"] = shaft_bat_angle
        metric_sources["bat_angle_deg"] = bat_source
    elif openai_contact_pixel:
        contact_bat_angle = bat_angle_from_contact(geometry_points, openai_contact_pixel)
        openai_bat_angle = bat_angle_from_contact(openai_points, openai_contact_pixel)
        mediapipe_bat_angle = bat_angle_from_contact(mediapipe_points, openai_contact_pixel)
        if contact_bat_angle is not None:
            metrics["bat_angle_deg"] = contact_bat_angle
            if openai_bat_angle is not None:
                metric_sources["bat_angle_deg"] = "OpenAI 2D"
            elif mediapipe_bat_angle is not None:
                metric_sources["bat_angle_deg"] = "MediaPipe wrist + OpenAI contact fallback"
            else:
                metric_sources["bat_angle_deg"] = "Merged wrist/contact estimate"
    if metrics.get("bat_angle_deg") is None and openai_bat.get("angle") is not None:
        metrics["bat_angle_deg"] = openai_bat["angle"]
        metric_sources["bat_angle_deg"] = "OpenAI full-frame bat estimate"
    metrics_source = "openai+mediapipe-fallback" if openai_points and used_mediapipe_fallback else "openai" if openai_points else "mediapipe"
    rules_comparison = evaluate_cape_rules(metrics, shot_type)
    front_shoulder = points.get(f"{front}_shoulder")
    front_elbow = points.get(f"{front}_elbow")
    front_toe = points.get(f"{front}_toe")
    head = points.get("head")

    overlay = frame.copy()
    if pose_result is not None:
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
        point = mediapipe_points.get(name)
        if name in openai_points:
            continue
        if point:
            color = magenta if name == "head" else cyan
            location = tuple(map(round, point))
            cv2.circle(overlay, location, max(4, width // 180), color, -1, cv2.LINE_AA)
            put_label(overlay, name.replace("_", " ").upper(), (location[0] + 8, location[1] - 5), color)
    if front_toe:
        cv2.circle(overlay, tuple(map(round, front_toe)), max(5, width // 150), yellow, 2, cv2.LINE_AA)
    if openai_points:
        openai_color = (255, 80, 245)
        openai_head = openai_points.get("head")
        openai_front_toe = openai_points.get(f"{front}_toe")
        if openai_head and openai_front_toe:
            openai_head_point = tuple(map(round, openai_head))
            openai_toe_point = tuple(map(round, openai_front_toe))
            dashed_line(overlay, openai_head_point, (openai_head_point[0], openai_toe_point[1]), openai_color)
            cv2.line(overlay, (openai_head_point[0], openai_toe_point[1]), openai_toe_point, openai_color, 2, cv2.LINE_AA)
        openai_edges = (
            ("head", "left_shoulder"), ("head", "right_shoulder"), ("left_shoulder", "right_shoulder"),
            ("left_shoulder", "left_elbow"), ("left_elbow", "left_wrist"),
            ("right_shoulder", "right_elbow"), ("right_elbow", "right_wrist"),
            ("left_shoulder", "left_hip"), ("right_shoulder", "right_hip"), ("left_hip", "right_hip"),
            ("left_hip", "left_knee"), ("left_knee", "left_ankle"),
            ("right_hip", "right_knee"), ("right_knee", "right_ankle"),
            (f"{front}_ankle", "front_toe"),
        )
        for start_name, end_name in openai_edges:
            start, end = openai_points.get(start_name), openai_points.get(end_name)
            if start and end:
                cv2.line(overlay, tuple(map(round, start)), tuple(map(round, end)), openai_color, 2, cv2.LINE_AA)
        for name, point in openai_points.items():
            location = tuple(map(round, point))
            cv2.circle(overlay, location, max(5, width // 150), openai_color, 2, cv2.LINE_AA)
            put_label(overlay, f"AI {name.replace('_', ' ').upper()}", (location[0] + 7, location[1] + 15), openai_color)
        if openai_contact_pixel:
            cv2.drawMarker(overlay, tuple(map(round, openai_contact_pixel)), (0, 80, 255), cv2.MARKER_CROSS, max(14, width // 30), 3, cv2.LINE_AA)
    if openai_bat_pixels:
        bat_color = (133, 113, 251)
        handle_point, toe_point = (tuple(map(round, point)) for point in openai_bat_pixels)
        dashed_line(overlay, handle_point, toe_point, bat_color)
        if shaft_bat_angle is not None:
            put_label(overlay, f"AI BAT {shaft_bat_angle:.0f} deg", (toe_point[0] + 8, toe_point[1] - 6), bat_color)
    footer = f"2D pose overlay · {handedness}-handed · {width}x{height}"
    cv2.rectangle(overlay, (0, 0), (width, min(30, height)), (14, 23, 38), -1)
    cv2.putText(overlay, footer[:100], (8, min(21, height - 2)), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (235, 245, 255), 1, cv2.LINE_AA)
    if openai_points and height > 48:
        cv2.putText(overlay, "OpenAI landmark estimate: magenta", (8, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 80, 245), 1, cv2.LINE_AA)
    ok, encoded = cv2.imencode(".png", overlay)
    if not ok:
        raise HTTPException(status_code=500, detail="Could not encode the pose overlay image.")

    return {
        "status": "success",
        "width": width,
        "height": height,
        "handedness": handedness,
        "landmark_source": metrics_source,
        "landmark_sources": {
            name: "openai" if name in openai_points else "mediapipe_fallback" if point is not None else "unavailable"
            for name, point in points.items()
        },
        "metric_sources": metric_sources,
        "shot_type": shot_type,
        "person_detection": person,
        "landmarks": serialized_landmarks,
        "metrics": metrics,
        "mediapipe_world_metrics": world_angles,
        "openai_landmarks": {
            name: {"x": round(point[0] / width, 4), "y": round(point[1] / height, 4)}
            for name, point in openai_points.items()
        },
        "openai_contact_point": None if openai_contact_pixel is None else {
            "x": round(openai_contact_pixel[0] / width, 4),
            "y": round(openai_contact_pixel[1] / height, 4),
        },
        "coaching_rules": rules_comparison,
        "limitations": [
            "The selected shot's coaching_rules.yaml checks use OpenAI landmarks as primary when supplied; unavailable checks are not inferred.",
            "OpenAI joint/alignment values are 2D image-plane estimates from one cropped frame, not calibrated 3D biomechanics.",
            "MediaPipe pose detection is skipped on the selected contact crop when OpenAI landmarks are provided; it remains used on surrounding frames.",
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
    shot_type: str = Form("front_foot_drive"),
    openai_landmarks: str = Form("{}"),
    openai_contact_point: str = Form("null"),
    openai_bat_points: str = Form("{}"),
    sequence_images: list[UploadFile] = File(default=[]),
    sequence_metadata: str = Form("[]"),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
) -> JSONResponse:
    if API_KEY and not hmac.compare_digest(x_api_key or "", API_KEY):
        raise HTTPException(status_code=401, detail="Invalid service API key.")
    if handedness not in {"right", "left"}:
        raise HTTPException(status_code=400, detail="Handedness must be right or left.")
    if shot_type not in {"front_foot_drive", "back_foot_drive", "forward_defence", "backward_defence", "pull", "cut", "sweep"}:
        raise HTTPException(status_code=400, detail="Choose a supported batting shot type for rule comparison.")
    parsed_openai_landmarks = parse_normalized_landmarks(openai_landmarks)
    parsed_openai_contact_point = parse_normalized_point(openai_contact_point)
    parsed_openai_bat_points = parse_bat_points(openai_bat_points)
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP crop.")
    if len(sequence_images) > 9:
        raise HTTPException(status_code=400, detail="At most nine neighboring contact frames are supported.")
    try:
        sequence_info = json.loads(sequence_metadata)
    except (TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Contact-sequence metadata must be valid JSON.") from None
    if not isinstance(sequence_info, list) or len(sequence_info) != len(sequence_images):
        raise HTTPException(status_code=400, detail="Each sequence image must have matching frame and timestamp metadata.")
    allowed_phases = {"PRE_CONTACT", "CONTACT", "POST_CONTACT"}
    for item in sequence_info:
        if (
            not isinstance(item, dict)
            or not isinstance(item.get("frameIndex"), int)
            or item["frameIndex"] < 0
            or not isinstance(item.get("timestampSeconds"), (int, float))
            or not math.isfinite(item["timestampSeconds"])
            or item["timestampSeconds"] < 0
            or item.get("phase") not in allowed_phases
        ):
            raise HTTPException(status_code=400, detail="Contact-sequence metadata contains an invalid frame index, time, or phase.")
    if any(frame.content_type not in {"image/jpeg", "image/png", "image/webp"} for frame in sequence_images):
        raise HTTPException(status_code=415, detail="Sequence frames must be JPEG, PNG, or WebP images.")
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
    result = await run_in_threadpool(
        analyse_frame, frame, handedness, parsed_openai_landmarks, parsed_openai_contact_point, shot_type, parsed_openai_bat_points
    )
    sequence_results = []
    for sequence_image, metadata in zip(sequence_images, sequence_info):
        sequence_bytes = await sequence_image.read(MAX_IMAGE_BYTES + 1)
        if not sequence_bytes or len(sequence_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="A sequence frame is empty or exceeds the 12 MB limit.")
        source_frame = cv2.imdecode(np.frombuffer(sequence_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        if source_frame is None:
            raise HTTPException(status_code=422, detail="A contact-sequence frame could not be decoded.")
        source_height, source_width = source_frame.shape[:2]
        if source_width < 32 or source_height < 32 or source_width > MAX_IMAGE_DIMENSION or source_height > MAX_IMAGE_DIMENSION:
            raise HTTPException(status_code=422, detail="Sequence frame dimensions must be between 32 and 4096 pixels.")
        player_crop, crop_box = crop_detected_person(source_frame)
        try:
            sequence_result = await run_in_threadpool(analyse_frame, player_crop, handedness, None, None, shot_type)
            sequence_results.append({
                "frame_index": metadata["frameIndex"],
                "timestamp_seconds": float(metadata["timestampSeconds"]),
                "phase": metadata["phase"],
                "status": "success",
                "crop_box_px": crop_box,
                "width": sequence_result["width"],
                "height": sequence_result["height"],
                "metrics": sequence_result["metrics"],
                "mediapipe_world_metrics": sequence_result.get("mediapipe_world_metrics", {}),
                "overlay_image_base64": sequence_result["overlay_image_base64"],
                "overlay_mime_type": sequence_result["overlay_mime_type"],
            })
        except HTTPException as error:
            if error.status_code != 422:
                raise
            sequence_results.append({
                "frame_index": metadata["frameIndex"],
                "timestamp_seconds": float(metadata["timestampSeconds"]),
                "phase": metadata["phase"],
                "status": "unavailable",
                "error": error.detail,
            })
    result["sequence"] = sequence_results
    contact_metadata = next((item for item in sequence_info if item["phase"] == "CONTACT"), None)
    temporal_angle_estimates: dict[str, dict[str, Any]] = {}
    if contact_metadata is not None:
        contact_time = float(contact_metadata["timestampSeconds"])
        for metric in ("front_elbow", "back_elbow", "front_knee", "back_knee"):
            if result["metrics"].get(metric) is not None:
                continue
            candidates = [
                item for item in sequence_results
                if item["status"] == "success"
                and item.get("mediapipe_world_metrics", {}).get(metric) is not None
                and abs(item["timestamp_seconds"] - contact_time) <= 0.3 + 1e-6
            ]
            if not candidates:
                continue
            closest = min(candidates, key=lambda item: abs(item["timestamp_seconds"] - contact_time))
            temporal_angle_estimates[metric] = {
                "value": closest["mediapipe_world_metrics"][metric],
                "frame_index": closest["frame_index"],
                "timestamp_seconds": closest["timestamp_seconds"],
                "offset_ms": round((closest["timestamp_seconds"] - contact_time) * 1000),
                "source": "MediaPipe 3D at nearest visible frame",
            }
    result["temporal_angle_estimates"] = temporal_angle_estimates
    return JSONResponse(result)
