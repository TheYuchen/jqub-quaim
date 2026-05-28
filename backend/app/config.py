"""Runtime configuration for the QuDA Studio backend."""

from __future__ import annotations

import os
import secrets
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
    # ---- OAuth (HF Sign-in) ----
    # HF sets these env vars automatically when `hf_oauth: true` is in
    # the Space README frontmatter. Empty when running locally outside
    # an HF Space (the auth routes degrade to "feature unavailable").
    oauth_client_id: str | None
    oauth_client_secret: str | None
    openid_provider_url: str
    space_host: str | None
    # Server-side secret for signing session cookies. HF Space secret,
    # falls back to a per-process random in dev (sessions don't survive
    # restart locally — fine).
    session_secret: str
    # ---- HF Datasets persistence ----
    # Write-capable token for the per-user plugin dataset repo. Without
    # it, OAuth still works but plugins remain volatile (live in /tmp
    # only). Set as a Space secret named HF_TOKEN.
    hf_token: str | None
    # Owner/name of the dataset repo where user plugins are persisted.
    user_data_repo: str

    @property
    def has_ibm_token(self) -> bool:
        return bool(self.ibm_token)

    @property
    def oauth_enabled(self) -> bool:
        return bool(self.oauth_client_id and self.oauth_client_secret)

    @property
    def persistence_enabled(self) -> bool:
        return bool(self.hf_token and self.user_data_repo)


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
            oauth_client_id=os.environ.get("OAUTH_CLIENT_ID") or None,
            oauth_client_secret=os.environ.get("OAUTH_CLIENT_SECRET") or None,
            openid_provider_url=os.environ.get(
                "OPENID_PROVIDER_URL", "https://huggingface.co"
            ),
            space_host=os.environ.get("SPACE_HOST") or None,
            # In dev we generate a fresh random secret per process so
            # sessions don't survive a restart — that's fine for dev.
            # In prod we expect SESSION_SECRET to be set as an HF Space
            # secret so cookies survive container restarts.
            session_secret=(
                os.environ.get("SESSION_SECRET") or secrets.token_urlsafe(48)
            ),
            hf_token=os.environ.get("HF_TOKEN") or None,
            user_data_repo=os.environ.get(
                "USER_DATA_REPO", "qudastudio/quda-user-data"
            ),
        )
    return _settings
