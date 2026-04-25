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

from app.config import FRONTEND_DIST, get_settings
from app.routes import backends as backends_route
from app.routes import circuits as circuits_route
from app.routes import health as health_route
from app.routes import workflow as workflow_route


logger = logging.getLogger("jqub")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logging.basicConfig(level=settings.log_level)
    logger.info(
        "QuAIM booting (ibm_token=%s, live_ibm=%s)",
        "set" if settings.has_ibm_token else "missing",
        settings.allow_live_ibm,
    )
    yield
    logger.info("QuAIM shutting down")


app = FastAPI(
    title="QuAIM",
    description="Interactive pipeline over QuCAD / QuBound / CompressVQC / Qshot.",
    version="0.1.0",
    lifespan=lifespan,
)

_settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_settings.cors_allow_origins),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

# API routes
app.include_router(health_route.router, prefix="/api")
app.include_router(backends_route.router, prefix="/api")
app.include_router(circuits_route.router, prefix="/api")
app.include_router(workflow_route.router, prefix="/api")


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
