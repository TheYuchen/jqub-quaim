"""/api/workflow — execute a user-built pipeline graph over the selected circuit."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.schemas import RunRequest, RunResponse, SweepRequest, SweepResponse, SweepRunResult
from app.services.circuit_service import CircuitNotFoundError, circuit_store
from app.services.run_cache import compute_cache_key, load_cached_response
from app.services.workflow_service import run_pipeline, run_pipeline_stream

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


@router.post("/workflow/run-stream")
def run_workflow_stream(req: RunRequest):
    """SSE endpoint: yields each StepResult as a Server-Sent Event as
    soon as it completes, instead of waiting for the whole pipeline.

    The frontend can show incremental progress: "Step 1 done... Step 2
    running..." instead of a single spinner followed by all results at
    once. Cache hits still return instantly (as a single event with all
    steps + a ``[CACHED]`` sentinel).
    """
    try:
        qc = circuit_store.get(req.circuit_id)
    except CircuitNotFoundError:
        raise HTTPException(status_code=404, detail="Unknown circuit_id") from None

    settings = get_settings()

    if req.use_live_ibm and not (settings.has_ibm_token and settings.allow_live_ibm):
        raise HTTPException(status_code=403, detail="Live IBM execution is disabled.")

    # Cache hit → emit all steps at once and close.
    if not req.use_live_ibm:
        key = compute_cache_key(qc, req.nodes, req.edges, use_live_ibm=False)
        cached = load_cached_response(key, circuit_id=req.circuit_id)
        if cached is not None:
            def cached_stream():
                yield f"data: {cached.model_dump_json()}\n\n"
                yield "data: [CACHED]\n\n"
            return StreamingResponse(cached_stream(), media_type="text/event-stream")

    # Cache miss → stream steps one by one.
    def step_stream():
        for step in run_pipeline_stream(
            circuit=qc, nodes=req.nodes, edges=req.edges, settings=settings,
        ):
            yield f"data: {step.model_dump_json()}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(step_stream(), media_type="text/event-stream")


@router.post("/workflow/sweep")
def run_workflow_sweep(req: SweepRequest):
    """Parameter sweep: re-runs the pipeline once per value in
    ``req.sweep.values``, mutating ``req.sweep.param_key`` of the
    target node each time.

    Yields one Server-Sent Event per completed run, plus a trailing
    ``[DONE]`` sentinel. Heavy use of the per-node intermediate cache
    means steps upstream of the swept block are computed once and
    reused across every sweep iteration, so an N-value sweep of the
    last block's parameter takes roughly N × (last-block cost) rather
    than N × (whole-pipeline cost).
    """
    try:
        qc = circuit_store.get(req.circuit_id)
    except CircuitNotFoundError:
        raise HTTPException(status_code=404, detail="Unknown circuit_id") from None

    settings = get_settings()
    if req.use_live_ibm and not (settings.has_ibm_token and settings.allow_live_ibm):
        raise HTTPException(status_code=403, detail="Live IBM execution is disabled.")

    # Verify the swept node exists.
    target_node = next((n for n in req.nodes if n.id == req.sweep.node_id), None)
    if target_node is None:
        raise HTTPException(
            status_code=400,
            detail=f"Sweep target node {req.sweep.node_id!r} not found in pipeline.",
        )
    if not req.sweep.values:
        raise HTTPException(status_code=400, detail="Sweep values list is empty.")
    if len(req.sweep.values) > 50:
        raise HTTPException(
            status_code=400,
            detail="Sweep capped at 50 values to keep server load bounded.",
        )

    def sweep_stream():
        for i, value in enumerate(req.sweep.values):
            # Clone the nodes list with the swept value patched into the
            # target node's data dict. We don't mutate req.nodes in place
            # because Pydantic models are reused across iterations.
            patched_nodes = []
            for n in req.nodes:
                if n.id == req.sweep.node_id:
                    patched_data = {**n.data, req.sweep.param_key: value}
                    patched_nodes.append(n.model_copy(update={"data": patched_data}))
                else:
                    patched_nodes.append(n)

            steps = list(
                run_pipeline_stream(
                    circuit=qc,
                    nodes=patched_nodes,
                    edges=req.edges,
                    settings=settings,
                )
            )
            ok = all(s.status != "error" for s in steps)
            run_result = SweepRunResult(param_value=value, steps=steps, ok=ok)
            yield f"data: {run_result.model_dump_json()}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(sweep_stream(), media_type="text/event-stream")
