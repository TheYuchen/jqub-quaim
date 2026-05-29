"""/api/workflow — execute a user-built pipeline graph over the selected circuit."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.schemas import RunRequest, RunResponse
from app.services import auth_service
from app.services.circuit_service import CircuitNotFoundError, circuit_store
from app.services.plugin_service import RESERVED_KINDS as BUILTIN_KINDS
from app.services.run_cache import compute_cache_key, load_cached_response
from app.services.workflow_service import run_pipeline, run_pipeline_stream


def _effective_user_id(request: Request, body_user_id: str | None) -> str | None:
    """Workflow's resolution is permissive — if there's no session and
    no anon id, that's fine (most pipelines don't use plugins). The
    shared helper handles the same anon-squat guard as the plugin
    routes. We map ValueError → None here because workflow doesn't
    400 on missing id; it just won't dispatch plugins."""
    try:
        return auth_service.resolve_effective_user_id(
            request, body_user_id, required=False,
        )
    except ValueError:
        return None


def _uses_plugins(nodes) -> bool:
    """True if any node has a non-built-in type (i.e. a user plugin)."""
    return any(n.type not in BUILTIN_KINDS for n in nodes)

router = APIRouter()


@router.post("/workflow/run", response_model=RunResponse)
def run_workflow(req: RunRequest, request: Request) -> RunResponse:
    try:
        qc = circuit_store.get(req.circuit_id)
    except CircuitNotFoundError:
        raise HTTPException(status_code=404, detail="Unknown circuit_id") from None

    settings = get_settings()
    effective_user_id = _effective_user_id(request, req.user_id)

    # If caller requests live IBM but the server forbids it, refuse loudly
    # (better UX than silently swapping in a fake backend for the whole run).
    if req.use_live_ibm and not (settings.has_ibm_token and settings.allow_live_ibm):
        # User-facing 403 — don't include the env var names. The UI
        # already greys out the toggle in this state.
        raise HTTPException(
            status_code=403,
            detail="Live IBM execution is not enabled on this deployment.",
        )

    # Cache hit path: if the circuit + pipeline graph match something the
    # precompute script already ran, return the shipped response instantly
    # instead of spending 30-60s re-computing. Live IBM runs bypass the
    # cache because calibration drifts; every live run should hit hardware.
    # Plugin runs also bypass the precomputed cache — the cache was built
    # against built-in handlers only and has no idea what the user's
    # plugin will do.
    if not req.use_live_ibm and not _uses_plugins(req.nodes):
        key = compute_cache_key(qc, req.nodes, req.edges, use_live_ibm=False)
        cached = load_cached_response(key, circuit_id=req.circuit_id)
        if cached is not None:
            return cached

    steps = run_pipeline(
        circuit=qc,
        nodes=req.nodes,
        edges=req.edges,
        settings=settings,
        user_id=effective_user_id,
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
def run_workflow_stream(req: RunRequest, request: Request):
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
    effective_user_id = _effective_user_id(request, req.user_id)

    if req.use_live_ibm and not (settings.has_ibm_token and settings.allow_live_ibm):
        raise HTTPException(status_code=403, detail="Live IBM execution is disabled.")

    # Cache hit → emit all steps at once and close. Plugins bypass the
    # precomputed cache (their behavior is user-specific).
    if not req.use_live_ibm and not _uses_plugins(req.nodes):
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
            circuit=qc, nodes=req.nodes, edges=req.edges,
            settings=settings, user_id=effective_user_id,
        ):
            yield f"data: {step.model_dump_json()}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(step_stream(), media_type="text/event-stream")
