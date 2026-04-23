"""/api/circuits — upload user circuits, list built-in demos, fetch metadata."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.config import SAMPLE_CIRCUITS_DIR
from app.schemas import CircuitInfo, SampleCircuit
from app.services.circuit_service import (
    CircuitNotFoundError,
    circuit_store,
    discover_samples,
    load_sample,
    parse_uploaded,
    summarize,
)

router = APIRouter()


@router.get("/circuits/samples", response_model=list[SampleCircuit])
def list_samples() -> list[SampleCircuit]:
    return discover_samples()


@router.post("/circuits/samples/{key}", response_model=CircuitInfo)
def load_sample_circuit(key: str) -> CircuitInfo:
    try:
        qc = load_sample(key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"No sample circuit named {key!r}") from None
    circuit_id = circuit_store.put(qc)
    return summarize(qc, circuit_id)


@router.get("/circuits/samples/{key}/download")
def download_sample_qpy(key: str):
    """Serve the raw .qpy file for a built-in sample so users can try the
    upload flow with a known-good file without writing Qiskit code."""
    # Only allow bare filenames to avoid path traversal.
    safe = key.replace("/", "").replace("\\", "").replace("..", "")
    path = SAMPLE_CIRCUITS_DIR / f"{safe}.qpy"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No sample circuit named {key!r}")
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=f"{safe}.qpy",
    )


@router.post("/circuits/upload", response_model=CircuitInfo)
async def upload_circuit(file: UploadFile = File(...)) -> CircuitInfo:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    try:
        qc = parse_uploaded(file.filename or "upload", data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse circuit: {exc}") from exc
    circuit_id = circuit_store.put(qc)
    return summarize(qc, circuit_id)


@router.get("/circuits/{circuit_id}", response_model=CircuitInfo)
def get_circuit(circuit_id: str) -> CircuitInfo:
    try:
        qc = circuit_store.get(circuit_id)
    except CircuitNotFoundError:
        raise HTTPException(status_code=404, detail="Unknown circuit_id") from None
    return summarize(qc, circuit_id)
