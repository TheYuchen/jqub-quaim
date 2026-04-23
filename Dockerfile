# syntax=docker/dockerfile:1.6
#
# JQub Quantum Flow — two-stage image.
#   stage 1 (node): vite build of the React frontend
#   stage 2 (python): backend deps + qlib + the built frontend/dist
#
# Targets HuggingFace Spaces (sdk: docker, app_port: 7860).

# ---------- Stage 1: build the frontend ----------
FROM node:20-bookworm-slim AS frontend

WORKDIR /build

# Install deps first for better layer caching.
COPY frontend/package.json frontend/package-lock.json* frontend/pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then \
        corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
        npm ci; \
    else \
        npm install; \
    fi

COPY frontend/ ./

# Static base path so it works at the site root on HF.
ENV VITE_API_BASE=/api
RUN if [ -f pnpm-lock.yaml ]; then pnpm run build; else npm run build; fi


# ---------- Stage 2: runtime ----------
FROM python:3.11-slim-bookworm AS runtime

# HF Spaces user setup — the user inside the container must own /home/user.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    APP_HOME=/home/user/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 user

WORKDIR ${APP_HOME}

# Install torch first from the CPU-only wheel index (~200 MB vs 2 GB for CUDA).
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1

COPY --chown=user:user backend/requirements.txt ./backend/requirements.txt
RUN pip install -r backend/requirements.txt

# App code
COPY --chown=user:user backend/ ./backend/

# Prebuilt frontend bundle from stage 1
COPY --chown=user:user --from=frontend /build/dist ./frontend/dist

# Clean caches the user can't write at runtime (HF runs as non-root).
RUN chown -R user:user ${APP_HOME}

USER user

# HF Spaces expects 7860
EXPOSE 7860
ENV PORT=7860

# FastAPI app lives in backend/app/main.py
WORKDIR ${APP_HOME}/backend
# --proxy-headers + --forwarded-allow-ips='*' so FastAPI trusts HF Space's
# edge nginx when it sets X-Forwarded-Proto: https. Without this, FastAPI's
# automatic trailing-slash redirects and any request.url_for() calls come
# back as http:// and get mixed-content-blocked by the browser on an https
# page. HF's reverse proxy IP isn't stable, so we accept any.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips=*"]
