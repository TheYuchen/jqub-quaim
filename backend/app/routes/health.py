"""/api/health — lightweight liveness probe used by HF Space + the frontend."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings
from app.schemas import HealthResponse

router = APIRouter()


def _safe_version(mod_name: str) -> str:
    try:
        mod = __import__(mod_name)
    except Exception as exc:  # pragma: no cover - diagnostic path
        return f"unavailable ({exc.__class__.__name__})"
    return getattr(mod, "__version__", "unknown")


APP_VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        version=APP_VERSION,
        qiskit_version=_safe_version("qiskit"),
        torch_version=_safe_version("torch"),
        ibm_token_configured=settings.has_ibm_token,
        live_ibm_allowed=settings.allow_live_ibm,
    )
