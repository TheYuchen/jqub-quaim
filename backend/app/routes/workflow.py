"""/api/workflow — execute a user-built pipeline graph over the selected circuit."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.schemas import RunRequest, RunResponse
from app.services.circuit_service import CircuitNotFoundError, circuit_store
from app.services.run_cache import compute_cache_key, load_cached_response
from app.services.workflow_service import run_pipeline

router = APIRouter()


@router.post("/workflow/run", response_model=RunResponse)
def run_workflow(req: RunRequest) -> RunResponse:
    try:
        qc = circuit_store.get(req.circuit_id)
    except CircuitNotFoundError:
        raise HTTPException(status_code=404, detail="Unknown circuit_id") from None

    settings = get_settings()

    # If caller requests live IBM but the server forbids it, refuse loudly
    # (better UX than silently swapping in a fake backend for the whole run).
    if req.use_live_ibm and not (settings.has_ibm_token and settings.allow_live_ibm):
        raise HTTPException(
            status_code=403,
            detail=(
                "Live IBM execution is disabled on this server. "
                "Set IBM_QUANTUM_TOKEN and ALLOW_LIVE_IBM=true to enable."
            ),
        )

    # Cache hit path: if the circuit + pipeline graph match something the
    # precompute script already ran, return the shipped response instantly
    # instead of spending 30-60s re-computing. Live IBM runs bypass the
    # cache because calibration drifts; every live run should hit hardware.
    if not req.use_live_ibm:
        key = compute_cache_key(qc, req.nodes, req.edges, use_live_ibm=False)
        cached = load_cached_response(key, circuit_id=req.circuit_id)
        if cached is not None:
            return cached

    steps = run_pipeline(
        circuit=qc,
        nodes=req.nodes,
        edges=req.edges,
        settings=settings,
    )

    ok = all(s.status != "error" for s in steps)
    final_metrics: dict = {}
    for s in reversed(steps):
        if s.node_type == "output" and s.status == "ok":
            final_metrics = s.summary
            break

    return RunResponse(
        circuit_id=req.circuit_id,
        ok=ok,
        from_cache=False,
        steps=steps,
        final_metrics=final_metrics,
    )
