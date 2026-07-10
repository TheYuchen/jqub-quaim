"""FastAPI entry point.

Serves:
  * JSON API under /api/*
  * Static React bundle under / (frontend/dist, built ahead of time)

Importable as ``app.main:app`` for uvicorn.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app._version import APP_VERSION
from app.config import FRONTEND_DIST, get_settings
from app.routes import auth as auth_route
from app.routes import backends as backends_route
from app.routes import circuits as circuits_route
from app.routes import health as health_route
from app.routes import plugins as plugins_route
from app.routes import workflow as workflow_route


logger = logging.getLogger("jqub")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logging.basicConfig(level=settings.log_level)
    logger.info(
        "QuDA Studio booting (ibm_token=%s, live_ibm=%s)",
        "set" if settings.has_ibm_token else "missing",
        settings.allow_live_ibm,
    )
    yield
    logger.info("QuDA Studio shutting down")


app = FastAPI(
    title="QuDA Studio",
    description="Interactive pipeline over QuCAD / QuBound / CompressVQC / Qshot.",
    version=APP_VERSION,
    lifespan=lifespan,
)

_settings = get_settings()

# Safety net: with allow_credentials=True a wildcard origin would let
# any malicious page on the internet read /api/auth/me with the user's
# session cookie. CORSMiddleware itself refuses `["*"]` in that
# combination, but we also strip any literal "*" upstream so a typo in
# CORS_ALLOW_ORIGINS becomes "no cross-origin" rather than silently
# enabling it. In production the React bundle is served by the same
# FastAPI process — no cross-origin reads needed at all.
_safe_origins = [o for o in _settings.cors_allow_origins if o != "*"]
if len(_safe_origins) != len(_settings.cors_allow_origins):
    logger.warning(
        "CORS_ALLOW_ORIGINS contained '*'; dropped because allow_credentials=True."
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=_safe_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    # We need cookies on cross-origin requests for the Vite dev server
    # (5173) to talk to the API (7860). In production both bundles
    # come from the same origin so this doesn't relax anything.
    allow_credentials=True,
)

# API routes
app.include_router(health_route.router, prefix="/api")
app.include_router(backends_route.router, prefix="/api")
app.include_router(circuits_route.router, prefix="/api")
app.include_router(workflow_route.router, prefix="/api")
app.include_router(plugins_route.router, prefix="/api")
app.include_router(auth_route.router, prefix="/api")


# ---------- Static frontend ----------

_index_file = FRONTEND_DIST / "index.html"

if FRONTEND_DIST.exists() and _index_file.exists():
    # Serve hashed JS/CSS from /assets (Vite default output path).
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):  # pragma: no cover - static serving
        """SPA fallback: let React Router handle unknown paths."""
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        candidate = FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_index_file)
else:
    @app.get("/")
    async def dev_root():  # pragma: no cover - dev-only path
        return {
            "status": "ok",
            "note": (
                "Frontend bundle not built. Run `pnpm --dir frontend build` (or "
                "`npm run build`) to populate frontend/dist, or start the Vite "
                "dev server on :5173 for development."
            ),
            "api": "/api/health",
        }
