# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POSE_OVERLAY_YOLO_MODEL=/weights/yolo11n-pose.pt

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Keep the CPU image small; this service is independent from CAPE's GPU inference container.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
# MediaPipe otherwise downloads this model on first request into its root-owned package directory.
RUN python -c "import mediapipe as mp; pose = mp.solutions.pose.Pose(static_image_mode=True, model_complexity=2); pose.close()"

COPY app.py .
RUN useradd --create-home --uid 10001 poseapi
USER poseapi

EXPOSE 8200
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8200"]
