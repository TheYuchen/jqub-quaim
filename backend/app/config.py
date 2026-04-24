"""Runtime configuration for the QuAIM backend."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parent.parent  # backend/
PROJECT_ROOT = BACKEND_ROOT.parent                     # jqub-quantum-flow/
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"     # vite build output
SAMPLE_CIRCUITS_DIR = BACKEND_ROOT / "sample_circuits"
CACHE_DIR = BACKEND_ROOT / "cache"
IBM_HISTORY_CACHE_DIR = CACHE_DIR / "ibm_history"


def ibm_history_cache_path(backend_name: str) -> Path:
    """Return the on-disk cache path for a given backend's 14-day history."""
    return IBM_HISTORY_CACHE_DIR / f"{backend_name}.pkl"


@dataclass(frozen=True)
class Settings:
    """Runtime settings read from env at startup.

    Use :func:`get_settings` rather than constructing this directly.
    """

    ibm_token: str | None
    allow_live_ibm: bool
    cors_allow_origins: tuple[str, ...]
    log_level: str

    @property
    def has_ibm_token(self) -> bool:
        return bool(self.ibm_token)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw = os.environ.get(name)
    if raw is None:
        return default
    parts = tuple(p.strip() for p in raw.split(",") if p.strip())
    return parts or default


_settings: Settings | None = None


def get_settings() -> Settings:
    """Return a cached Settings instance (reads env once per process)."""
    global _settings
    if _settings is None:
        _settings = Settings(
            ibm_token=os.environ.get("IBM_QUANTUM_TOKEN") or None,
            allow_live_ibm=_env_bool("ALLOW_LIVE_IBM", default=False),
            cors_allow_origins=_env_list(
                "CORS_ALLOW_ORIGINS",
                default=("http://localhost:5173", "http://127.0.0.1:5173"),
            ),
            log_level=os.environ.get("LOG_LEVEL", "INFO"),
        )
    return _settings
