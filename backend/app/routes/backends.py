"""/api/backends — list selectable simulator / IBM backends."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings
from app.schemas import BackendInfo

router = APIRouter()


# Static list of the three Heron-family fake backends supported by the
# `_load_fake_backend` helper in workflow_service.
_FAKE_BACKENDS: list[dict] = [
    {
        "name": "FakeFez",
        "kind": "fake",
        "num_qubits": 156,
        "description": "Heron r2 (Fez) fake backend — default for demo runs.",
    },
    {
        "name": "FakeMarrakesh",
        "kind": "fake",
        "num_qubits": 156,
        "description": "Heron r2 (Marrakesh) fake backend.",
    },
    {
        "name": "FakeTorino",
        "kind": "fake",
        "num_qubits": 133,
        "description": "Heron r1 (Torino) fake backend.",
    },
]


@router.get("/backends", response_model=list[BackendInfo])
def list_backends() -> list[BackendInfo]:
    items = [BackendInfo(**b) for b in _FAKE_BACKENDS]
    settings = get_settings()
    if settings.has_ibm_token and settings.allow_live_ibm:
        items.append(
            BackendInfo(
                name="ibm_fez",
                kind="ibm",
                num_qubits=156,
                description="Live IBM Heron r2 (Fez) — 14-day noise history available.",
            )
        )
    return items
