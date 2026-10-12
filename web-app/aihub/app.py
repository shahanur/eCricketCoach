import base64
import hashlib
import io
import math
import os
import tempfile
from typing import Any

import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from PIL import Image

try:
    from ultralytics import YOLO
except ImportError:  # Allows the service to boot for pose-only development images.
    YOLO = None

app = FastAPI(title="eCricketCoach AIHub", version="0.1.0")

POSE_CONNECTIONS = tuple(mp.solutions.pose.POSE_CONNECTIONS)
YOLO_MODEL_PATH = os.getenv("AIHUB_YOLO_MODEL", "yolo11n.pt")
YOLO_BALL_CLASS = 32  # COCO sports ball; fine-tuned cricket models may use a custom class map.
YOLO_MODEL: Any | None = None
# CPU inference costs ~0.5 s per frame, so long clips are sampled down to this many frames.
MAX_SCAN_FRAMES = max(10, int(os.getenv("AIHUB_MAX_SCAN_FRAMES", "120")))
MAX_CONTACT_CANDIDATES = max(5, int(os.getenv("AIHUB_MAX_CONTACT_CANDIDATES", "40")))
BALL_PATH_CACHE: dict[str, list[tuple[int, int, int]]] = {}
BALL_PATH_CACHE_SIZE = 8


def get_yolo_model() -> Any | None:
    global YOLO_MODEL
    if YOLO_MODEL is not None or YOLO is None:
        return YOLO_MODEL
    try:
        import torch

        torch.set_num_threads(os.cpu_count() or 1)
        YOLO_MODEL = YOLO(YOLO_MODEL_PATH)
    except Exception as error:
        print(f"AIHub YOLO detector unavailable; using CV fallback: {error}")
        YOLO_MODEL = None
    return YOLO_MODEL


def point(landmarks: Any, index: int, width: int, height: int) -> tuple[int, int]:
    landmark = landmarks[index]
    return int(landmark.x * width), int(landmark.y * height)


def angle(a: tuple[int, int], b: tuple[int, int], c: tuple[int, int]) -> float:
    ba = np.array(a, dtype=float) - np.array(b, dtype=float)
    bc = np.array(c, dtype=float) - np.array(b, dtype=float)
    denominator = np.linalg.norm(ba) * np.linalg.norm(bc)
    if denominator == 0:
        return 0.0
    return math.degrees(math.acos(float(np.clip(np.dot(ba, bc) / denominator, -1.0, 1.0))))


def point_segment_distance(point_value: tuple[int, int], start: tuple[int, int], end: tuple[int, int]) -> float:
    segment = np.array(end, dtype=float) - np.array(start, dtype=float)
    length_squared = float(np.dot(segment, segment))
    if length_squared == 0:
        return math.dist(point_value, start)
    projection = float(np.clip(np.dot(np.array(point_value, dtype=float) - np.array(start, dtype=float), segment) / length_squared, 0, 1))
    closest = np.array(start, dtype=float) + projection * segment
    return float(np.linalg.norm(np.array(point_value, dtype=float) - closest))


def find_bat_segment(frame: np.ndarray, ball: tuple[int, int], wrists: list[tuple[int, int]]) -> tuple[tuple[int, int], tuple[int, int]] | None:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=28, minLineLength=45, maxLineGap=18)
    if lines is None:
        return None
    best: tuple[float, tuple[int, int], tuple[int, int]] | None = None
    max_length = max(frame.shape[:2]) * 0.55
    for line in lines[:, 0]:
        start = (int(line[0]), int(line[1]))
        end = (int(line[2]), int(line[3]))
        length = math.dist(start, end)
        if length < 45 or length > max_length:
            continue
        ball_distance = point_segment_distance(ball, start, end)
        if ball_distance > max(90, min(frame.shape[:2]) * 0.16):
            continue
        wrist_distance = min(point_segment_distance(wrist, start, end) for wrist in wrists)
        score = ball_distance + wrist_distance * 0.35 - min(length, 160) * 0.08
        if best is None or score < best[0]:
            best = (score, start, end)
    return (best[1], best[2]) if best else None


def draw_label(image: np.ndarray, text: str, origin: tuple[int, int], color: tuple[int, int, int]) -> None:
    x, y = origin
    (text_width, text_height), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
    cv2.rectangle(image, (x - 6, y - text_height - baseline - 8), (x + text_width + 8, y + 5), (18, 24, 35), -1)
    cv2.putText(image, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2, cv2.LINE_AA)


def detect_ball_path(video_path: str, width: int, height: int) -> list[tuple[int, int, int]]:
    def candidates_for(frame: np.ndarray) -> list[tuple[int, int, float]]:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.medianBlur(gray, 5)
        candidates: list[tuple[int, int, float]] = []
        circles = cv2.HoughCircles(
            gray,
            cv2.HOUGH_GRADIENT,
            dp=1.15,
            minDist=7,
            param1=75,
            param2=11,
            minRadius=max(2, int(min(width, height) * 0.002)),
            maxRadius=max(10, int(min(width, height) * 0.045)),
        )
        if circles is not None:
            candidates.extend((int(round(x)), int(round(y)), float(r)) for x, y, r in np.round(circles[0]).tolist())

        # Cricket balls are commonly red/orange; this catches motion-blurred balls
        # that no longer present a clean Hough circle.
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        red_low = cv2.inRange(hsv, np.array([0, 70, 35]), np.array([18, 255, 255]))
        red_high = cv2.inRange(hsv, np.array([165, 70, 35]), np.array([179, 255, 255]))
        mask = cv2.morphologyEx(red_low | red_high, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 8 or area > max(3000, width * height * 0.01):
                continue
            perimeter = cv2.arcLength(contour, True)
            circularity = 4 * math.pi * area / (perimeter * perimeter) if perimeter else 0
            if circularity < 0.25:
                continue
            (x, y), radius = cv2.minEnclosingCircle(contour)
            if 2 <= radius <= max(10, min(width, height) * 0.06):
                candidates.append((int(round(x)), int(round(y)), float(radius)))
        return candidates

    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        return []
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    path: list[tuple[int, int, int]] = []
    last: tuple[int, int] | None = None
    velocity = np.array([0.0, 0.0])
    yolo = get_yolo_model()
    frame_index = 0
    frame_stride = max(1, int(os.getenv("AIHUB_FRAME_STRIDE", "2")), math.ceil(frame_count / MAX_SCAN_FRAMES))
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        sample_ms = int((frame_index / fps) * 1000)
        frame_index += 1
        if frame_index % frame_stride != 0:
            continue
        candidates = []
        if yolo is not None:
            try:
                prediction = yolo.predict(frame, classes=[YOLO_BALL_CLASS], verbose=False, conf=0.12, imgsz=640)[0]
                if prediction.boxes is not None:
                    for box in prediction.boxes:
                        confidence = float(box.conf[0])
                        x1, y1, x2, y2 = [int(value) for value in box.xyxy[0].tolist()]
                        candidates.append(((x1 + x2) // 2, (y1 + y2) // 2, max(2.0, min(x2 - x1, y2 - y1) / 2.0, confidence)))
            except Exception as error:
                print(f"AIHub YOLO frame inference failed; using CV fallback: {error}")
                yolo = None
        candidates.extend(candidates_for(frame))
        if not candidates:
            continue
        if last is not None:
            predicted = np.array(last, dtype=float) + velocity
            candidates = sorted(candidates, key=lambda item: math.dist(item[:2], predicted))
            candidate = candidates[0]
            max_jump = max(width, height) * 0.28
            if math.hypot(candidate[0] - last[0], candidate[1] - last[1]) > max_jump:
                continue
        else:
            # Prefer small, saturated candidates over large red equipment or clothing.
            candidate = min(candidates, key=lambda item: abs(item[2] - min(width, height) * 0.012))
        point_value = (candidate[0], candidate[1])
        if 0 <= point_value[0] < width and 0 <= point_value[1] < height:
            if last is not None:
                velocity = 0.65 * velocity + 0.35 * (np.array(point_value, dtype=float) - np.array(last, dtype=float))
            path.append((point_value[0], point_value[1], int(sample_ms)))
            last = point_value
    capture.release()
    deduplicated: list[tuple[int, int, int]] = []
    for item in path:
        if not deduplicated or math.dist(item[:2], deduplicated[-1][:2]) >= 4:
            deduplicated.append(item)
    return deduplicated if len(deduplicated) >= 3 else []


def estimate_contact_ms(video_path: str, ball_path: list[tuple[int, int, int]], width: int, height: int) -> tuple[int | None, tuple[tuple[int, int], tuple[int, int]] | None, str]:
    if len(ball_path) < 3:
        return None, None, "NO_BALL_TRACK"
    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        return None, None, "VIDEO_UNAVAILABLE"
    best: tuple[float, int, tuple[tuple[int, int], tuple[int, int]] | None, str] | None = None
    step = max(1, math.ceil(len(ball_path) / MAX_CONTACT_CANDIDATES))
    with mp.solutions.pose.Pose(static_image_mode=True, model_complexity=1, enable_segmentation=False, min_detection_confidence=0.35) as pose:
        for ball_x, ball_y, timestamp_ms in ball_path[::step]:
            capture.set(cv2.CAP_PROP_POS_MSEC, timestamp_ms)
            success, frame = capture.read()
            if not success:
                continue
            result = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            if not result.pose_landmarks:
                continue
            landmarks = result.pose_landmarks.landmark
            wrists = [
                point(landmarks, mp.solutions.pose.PoseLandmark.LEFT_WRIST, width, height),
                point(landmarks, mp.solutions.pose.PoseLandmark.RIGHT_WRIST, width, height),
            ]
            bat_segment = find_bat_segment(frame, (ball_x, ball_y), wrists)
            wrist_distance = min(math.dist((ball_x, ball_y), wrist) for wrist in wrists)
            bat_distance = point_segment_distance((ball_x, ball_y), *bat_segment) if bat_segment else wrist_distance + 100
            score = bat_distance + wrist_distance * 0.2
            method = "BAT_SEGMENT" if bat_segment else "WRIST_PROXIMITY"
            if best is None or score < best[0]:
                best = (score, timestamp_ms, bat_segment, method)
    capture.release()
    return (best[1], best[2], best[3]) if best else (None, None, "NO_POSE")


def analyze_frame(frame: np.ndarray, discipline: str, timestamp_ms: int, ball_path: list[tuple[int, int, int]], contact_detected: bool, contact_segment: tuple[tuple[int, int], tuple[int, int]] | None = None, contact_method: str = "NONE") -> dict[str, Any]:
    height, width = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    with mp.solutions.pose.Pose(static_image_mode=True, model_complexity=1, enable_segmentation=False, min_detection_confidence=0.5) as pose:
        result = pose.process(rgb)

    if not result.pose_landmarks:
        raise HTTPException(status_code=422, detail="No player pose was detected in the selected video frame.")

    landmarks = result.pose_landmarks.landmark
    overlay = frame.copy()
    mp.solutions.drawing_utils.draw_landmarks(
        overlay,
        result.pose_landmarks,
        mp.solutions.pose.POSE_CONNECTIONS,
        mp.solutions.drawing_styles.get_default_pose_landmarks_style(),
    )

    left_shoulder = point(landmarks, mp.solutions.pose.PoseLandmark.LEFT_SHOULDER, width, height)
    right_shoulder = point(landmarks, mp.solutions.pose.PoseLandmark.RIGHT_SHOULDER, width, height)
    left_hip = point(landmarks, mp.solutions.pose.PoseLandmark.LEFT_HIP, width, height)
    right_hip = point(landmarks, mp.solutions.pose.PoseLandmark.RIGHT_HIP, width, height)
    left_knee = point(landmarks, mp.solutions.pose.PoseLandmark.LEFT_KNEE, width, height)
    right_knee = point(landmarks, mp.solutions.pose.PoseLandmark.RIGHT_KNEE, width, height)
    left_ankle = point(landmarks, mp.solutions.pose.PoseLandmark.LEFT_ANKLE, width, height)
    right_ankle = point(landmarks, mp.solutions.pose.PoseLandmark.RIGHT_ANKLE, width, height)
    nose = point(landmarks, mp.solutions.pose.PoseLandmark.NOSE, width, height)

    shoulder_mid = ((left_shoulder[0] + right_shoulder[0]) // 2, (left_shoulder[1] + right_shoulder[1]) // 2)
    hip_mid = ((left_hip[0] + right_hip[0]) // 2, (left_hip[1] + right_hip[1]) // 2)
    head_drop_degrees = round(math.degrees(math.atan2(nose[1] - shoulder_mid[1], abs(nose[0] - shoulder_mid[0]) + 1)), 1)
    left_knee_angle = round(angle(left_hip, left_knee, left_ankle), 1)
    right_knee_angle = round(angle(right_hip, right_knee, right_ankle), 1)
    torso_angle = round(math.degrees(math.atan2(hip_mid[0] - shoulder_mid[0], shoulder_mid[1] - hip_mid[1] + 1)), 1)

    issues: list[str] = []
    if head_drop_degrees > 35:
        issues.append("Head is falling forward or down at the selected frame.")
    if abs(torso_angle) > 18:
        issues.append("Torso is tilted significantly away from the central line.")
    if min(left_knee_angle, right_knee_angle) < 105:
        issues.append("One knee is deeply flexed; check base stability and balance.")
    if not issues:
        issues.append("No high-confidence posture error was detected in this frame.")

    warning = (0, 105, 255)
    draw_label(overlay, f"HEAD DROP {head_drop_degrees} deg", (max(12, nose[0] + 12), max(30, nose[1] - 12)), warning if head_drop_degrees > 35 else (80, 220, 120))
    draw_label(overlay, f"TORSO {torso_angle} deg", (max(12, shoulder_mid[0] + 12), max(55, shoulder_mid[1])), warning if abs(torso_angle) > 18 else (80, 220, 120))
    draw_label(overlay, f"L KNEE {left_knee_angle} deg", (left_knee[0] + 10, left_knee[1]), warning if left_knee_angle < 105 else (80, 220, 120))
    draw_label(overlay, f"R KNEE {right_knee_angle} deg", (right_knee[0] + 10, right_knee[1] + 25), warning if right_knee_angle < 105 else (80, 220, 120))
    cv2.putText(overlay, f"AIHub kinematics · {discipline} · frame {timestamp_ms} ms", (18, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (235, 245, 255), 2, cv2.LINE_AA)
    if ball_path:
        for start, end in zip(ball_path, ball_path[1:]):
            cv2.line(overlay, start[:2], end[:2], (0, 0, 255), 8, cv2.LINE_AA)
        contact_point = min(ball_path, key=lambda item: abs(item[2] - timestamp_ms))
        cv2.circle(overlay, contact_point[:2], 24, (0, 0, 255), 5, cv2.LINE_AA)
        cv2.line(overlay, (contact_point[0] - 28, contact_point[1]), (contact_point[0] + 28, contact_point[1]), (0, 0, 255), 4, cv2.LINE_AA)
        cv2.line(overlay, (contact_point[0], contact_point[1] - 28), (contact_point[0], contact_point[1] + 28), (0, 0, 255), 4, cv2.LINE_AA)
        draw_label(overlay, "CONTACT MOMENT", (contact_point[0] + 24, contact_point[1]), (0, 0, 255))
        if contact_segment:
            cv2.line(overlay, contact_segment[0], contact_segment[1], (255, 180, 0), 8, cv2.LINE_AA)
            draw_label(overlay, "BAT EDGE", (contact_segment[0][0], max(35, contact_segment[0][1] - 12)), (255, 180, 0))

    success, encoded = cv2.imencode(".png", overlay)
    if not success:
        raise HTTPException(status_code=500, detail="Unable to encode the kinematic overlay image.")

    return {
        "timestampMs": timestamp_ms,
        "discipline": discipline,
        "issues": issues,
        "metrics": {
            "headDropDegrees": head_drop_degrees,
            "torsoAngleDegrees": torso_angle,
            "leftKneeAngleDegrees": left_knee_angle,
            "rightKneeAngleDegrees": right_knee_angle,
        },
        "ballLine": {
            "status": "DETECTED" if ball_path else "NOT_VISIBLE",
            "points": [{"x": round(x / width, 4), "y": round(y / height, 4), "timestampMs": timestamp} for x, y, timestamp in ball_path],
            "contactFrame": contact_detected,
            "contactTimestampMs": timestamp_ms,
            "contactMethod": contact_method,
            "evidence": "OpenCV linked circular ball candidates across sampled frames." if ball_path else "The ball was not detected reliably across sampled frames."
        },
        "overlayImageBase64": base64.b64encode(encoded.tobytes()).decode("ascii"),
        "overlayMimeType": "image/png",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "eCricketCoach AIHub"}


@app.post("/v1/kinematics/analyze")
async def kinematics_analyze(
    file: UploadFile = File(...),
    discipline: str = Form("BATTING"),
    timestamp_ms: int = Form(0),
    force_timestamp: bool = Form(False),
) -> JSONResponse:
    if discipline not in {"BATTING", "BOWLING", "KEEPING", "FIELDING"}:
        raise HTTPException(status_code=400, detail="Unsupported cricket discipline.")

    suffix = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded video is empty.")
    # The analysis is CPU-bound; run it off the event loop so health checks and other requests stay responsive.
    result = await run_in_threadpool(analyze_video, content, suffix, discipline, timestamp_ms, force_timestamp)
    return JSONResponse(result)


def analyze_video(content: bytes, suffix: str, discipline: str, timestamp_ms: int, force_timestamp: bool) -> dict[str, Any]:
    with tempfile.NamedTemporaryFile(suffix=suffix) as source:
        source.write(content)
        source.flush()
        capture = cv2.VideoCapture(source.name)
        if not capture.isOpened():
            raise HTTPException(status_code=422, detail="AIHub could not open this video.")
        fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        selected_ms = max(0, timestamp_ms)
        capture.set(cv2.CAP_PROP_POS_MSEC, selected_ms)
        success, frame = capture.read()
        if not success:
            raise HTTPException(status_code=422, detail="AIHub could not read a frame from this video.")
        height, width = frame.shape[:2]
        # Scan the complete clip from frame zero before choosing a contact frame. The server calls again
        # with a forced contact timestamp for the same video, so reuse the track from the first call.
        video_key = hashlib.sha256(content).hexdigest()
        ball_path = BALL_PATH_CACHE.get(video_key)
        if ball_path is None:
            ball_path = detect_ball_path(source.name, width, height)
            BALL_PATH_CACHE[video_key] = ball_path
            while len(BALL_PATH_CACHE) > BALL_PATH_CACHE_SIZE:
                BALL_PATH_CACHE.pop(next(iter(BALL_PATH_CACHE)))
        if force_timestamp and timestamp_ms > 0:
            contact_ms, contact_segment, contact_method = None, None, "NONE"
        else:
            contact_ms, contact_segment, contact_method = estimate_contact_ms(source.name, ball_path, width, height)
        if force_timestamp and timestamp_ms > 0:
            contact_ms = timestamp_ms
            contact_segment = None
            contact_method = "GEMINI_TIMESTAMP"
        contact_detected = contact_ms is not None
        if contact_ms is not None:
            selected_ms = contact_ms
            capture.set(cv2.CAP_PROP_POS_MSEC, selected_ms)
            success, frame = capture.read()
            if not success:
                raise HTTPException(status_code=422, detail="AIHub could not read the detected contact frame.")
        result = analyze_frame(frame, discipline, selected_ms, ball_path, contact_detected, contact_segment, contact_method)
        series = []
        for offset_ms in (-300, -100, 0, 250):
            series_ms = max(0, selected_ms + offset_ms)
            capture.set(cv2.CAP_PROP_POS_MSEC, series_ms)
            series_success, series_frame = capture.read()
            if not series_success:
                continue
            series_result = analyze_frame(
                series_frame,
                discipline,
                series_ms,
                ball_path,
                contact_detected and offset_ms == 0,
                contact_segment if offset_ms == 0 else None,
                contact_method if offset_ms == 0 else "NONE"
            )
            series.append({
                "timestampMs": series_ms,
                "overlayImageBase64": series_result["overlayImageBase64"],
                "overlayMimeType": series_result["overlayMimeType"],
                "phase": "PRE_CONTACT" if offset_ms < 0 else "CONTACT" if offset_ms == 0 else "FOLLOW_THROUGH",
            })
        result["overlaySeries"] = series
        capture.release()

    return result
