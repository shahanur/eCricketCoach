# syntax=docker/dockerfile:1
# CAPE runtime (spec §8). Build context: services/cape-api/.
# Stage 1 – build the virtualenv with the same Python (deadsnakes 3.11) the runner uses.
FROM nvidia/cuda:12.2.2-runtime-ubuntu22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends software-properties-common gpg-agent && \
    add-apt-repository -y ppa:deadsnakes/ppa && \
    apt-get update && apt-get install -y --no-install-recommends python3.11 python3.11-venv && \
    rm -rf /var/lib/apt/lists/*

RUN python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build
COPY requirements.txt .
# Pin a CUDA 12.1 PyTorch build (bundles its own CUDA/cuDNN) so drivers >= 530 work; an unpinned
# install pulls the newest wheel, which needs a much newer driver. The pip cache mount keeps
# downloaded wheels between builds, so changing a requirement doesn't re-download torch (~2.5 GB).
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu121
# ultralytics/mediapipe pull GUI OpenCV builds that need libGL; keep only the headless build.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt && \
    pip uninstall -y opencv-python opencv-contrib-python && \
    pip install --force-reinstall --no-deps "$(grep -i '^opencv-python-headless' requirements.txt)"
# MediaPipe downloads pose_landmark_heavy.tflite into site-packages on first use; the runtime user
# can't write there, so fetch it at build time.
RUN python -c "import mediapipe as mp; mp.solutions.pose.Pose(static_image_mode=True, model_complexity=2).close()" && \
    test -f /opt/venv/lib/python3.11/site-packages/mediapipe/modules/pose_landmark/pose_landmark_heavy.tflite

# Stage 2 – minimal runtime.
FROM nvidia/cuda:12.2.2-runtime-ubuntu22.04 AS runner

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    YOLO_CONFIG_DIR=/tmp/ultralytics \
    MPLCONFIGDIR=/tmp/matplotlib \
    CAPE_WORKSPACE_DIR=/app/cricket_workspace \
    CAPE_WEIGHTS_DIR=/app/weights \
    CAPE_WORKERS=1

RUN apt-get update && apt-get install -y --no-install-recommends software-properties-common gpg-agent && \
    add-apt-repository -y ppa:deadsnakes/ppa && \
    apt-get update && apt-get install -y --no-install-recommends python3.11 libglib2.0-0 && \
    apt-get purge -y --auto-remove software-properties-common gpg-agent && \
    rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 cape
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=cape:cape app ./app
RUN mkdir -p cricket_workspace weights && chown cape:cape cricket_workspace weights
USER cape

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

# Each worker loads its own copy of the models, so GPU memory grows per worker (spec §8).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${CAPE_WORKERS}"]
