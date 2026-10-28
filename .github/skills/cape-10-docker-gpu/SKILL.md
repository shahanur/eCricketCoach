---
name: cape-10-docker-gpu
description: "CAPE 10/13 – Docker image and GPU compose"
disable-model-invocation: true
---
Follow `.github/instructions/cape-api.instructions.md` (contracts + token rules).

Spec: §8. Use it as the target design, but fix these known defects in the spec's snippets:
- There is no apt package `pip`.
- Ubuntu 22.04 has no `python3.11` without the deadsnakes PPA.
- The builder used a different Python from the runner.
- `libgl1-mesa-glx` is unneeded with OpenCV headless (keep `libglib2.0-0`).
- The compose `version` key is obsolete.

Create `services/cape-api/Dockerfile` as a multi-stage build on `nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04`: install Python 3.11 via deadsnakes, build into `/opt/venv` in the builder, copy the venv to the runner, use a non-root user and a `HEALTHCHECK` on `/health`. Use `--workers 1` by default, configurable via `CAPE_WORKERS`, and note that GPU memory scales per worker.
Also add `.dockerignore` and `services/cape-api/docker-compose.yml` (GPU reservation per §8.3, `restart: unless-stopped`, workspace + weights volumes, env file), plus a CPU override `docker-compose.cpu.yml`.
Verify with `docker compose -f services/cape-api/docker-compose.yml config` only; don't build.
