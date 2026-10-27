# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# AIHub runs on the CPU, so install CPU-only torch first; ultralytics would otherwise pull the
# multi-GB CUDA build. The pip cache mount keeps downloaded wheels between builds.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

# Cache the baseline detector in the image. Production deployments can replace
# it with a cricket fine-tuned model through AIHUB_YOLO_MODEL.
RUN python -c "from ultralytics import YOLO; YOLO('yolo11n.pt')"

COPY app.py .

EXPOSE 8100
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8100"]
