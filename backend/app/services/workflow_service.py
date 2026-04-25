"""Orchestrates a user-built pipeline graph over the qlib algorithms.

The frontend (React Flow) posts a graph of nodes and edges. We walk it,
dispatch each node to the appropriate qlib entry point, and stream back a
list of ``StepResult`` panels describing what happened.

Live IBM calls (noise history lookups) are expensive and guarded; if the
server was started without an IBM token or ``ALLOW_LIVE_IBM=false``, any
node that requires live data is short-circuited with ``status="skipped"``.

This module intentionally does NOT import torch/qiskit at module load — we
defer heavy imports inside each handler so that the FastAPI process can
still boot quickly and answer ``/api/health`` even if an algorithm module
fails to import.
"""

from __future__ import annotations

import time
from typing import Callable

from qiskit import QuantumCircuit, transpile

from app.config import Settings, ibm_history_cache_path
from app.schemas import FlowEdge, FlowNode, StepResult


def _now() -> float:
    return time.time()


def _make_step(
    node: FlowNode,
    status: str,
    summary: dict | None = None,
    message: str | None = None,
    started_at: float | None = None,
    label: str | None = None,
) -> StepResult:
    t0 = started_at if started_at is not None else _now()
    return StepResult(
        node_id=node.id,
        node_type=node.type,
        label=label or _default_label(node.type),
        status=status,  # type: ignore[arg-type]
        started_at=t0,
        finished_at=_now(),
        summary=summary or {},
        message=message,
    )


def _default_label(node_type: str) -> str:
    return {
        "input_circuit": "Input circuit",
        "ibm_backend": "IBM backend",
        "fake_backend": "Noisy simulator",
        "qucad": "QuCAD",
        "qubound": "QuBound",
        "compvqc": "CompressVQC",
        "qshot": "Qshot",
        "fidelity": "Fidelity estimate",
        "output": "Output",
    }.get(node_type, node_type)


def _load_fake_backend(name: str):
    """Lazy-import a fake backend by name; falls back to FakeFez."""
    from qiskit_ibm_runtime.fake_provider import FakeFez, FakeMarrakesh, FakeTorino

    return {
        "FakeFez": FakeFez,
        "FakeMarrakesh": FakeMarrakesh,
        "FakeTorino": FakeTorino,
    }.get(name, FakeFez)()


# ---------- Per-node handlers ----------

def _handle_fake_backend(node: FlowNode, ctx: dict, _settings: Settings) -> StepResult:
    t0 = _now()
    name = node.data.get("backend_name", "FakeFez")
    backend = _load_fake_backend(name)
    ctx["backend"] = backend
    ctx["backend_is_live"] = False
    return _make_step(
        node,
        "ok",
        started_at=t0,
        summary={
            "backend_name": name,
            "num_qubits": backend.configuration().n_qubits,
        },
    )


def _handle_ibm_backend(node: FlowNode, ctx: dict, settings: Settings) -> StepResult:
    t0 = _now()
    if not settings.has_ibm_token or not settings.allow_live_ibm:
        # Silently downgrade to fake so the rest of the pipeline still runs.
        fallback = _load_fake_backend(node.data.get("fallback_backend", "FakeFez"))
        ctx["backend"] = fallback
        ctx["backend_is_live"] = False
        return _make_step(
            node,
            "skipped",
            started_at=t0,
            message="Live IBM call disabled; falling back to FakeFez.",
            summary={"fallback": "FakeFez"},
        )
    from qiskit_ibm_runtime import QiskitRuntimeService

    service = QiskitRuntimeService(
        channel="ibm_quantum_platform",
        token=settings.ibm_token,
        plans_preference=["open"],
    )
    name = node.data.get("backend_name", "ibm_fez")
    backend = service.backend(name)
    ctx["backend"] = backend
    ctx["backend_is_live"] = True
    return _make_step(
        node,
        "ok",
        started_at=t0,
        summary={"backend_name": name, "live": True},
    )


def _handle_qucad(node: FlowNode, ctx: dict, settings: Settings) -> StepResult:
    t0 = _now()
    qc: QuantumCircuit = ctx["circuit"]
    backend = ctx.get("backend")
    if backend is None:
        return _make_step(node, "error", started_at=t0, message="QuCAD needs a backend node upstream.")

    # Heavy import deferred so startup stays cheap.
    from qiskit_aer.noise import NoiseModel

    from qlib.qucad import run_qucad_training_noisy

    iterations = int(node.data.get("iterations", 3))
    lam = float(node.data.get("lam", 0.005))
    rho = float(node.data.get("rho", 500.0))

    noise_model = NoiseModel.from_backend(backend)
    theta, mask, history = run_qucad_training_noisy(
        qc, noise_model, backend, iterations=iterations, lam=lam, rho=rho
    )
    bound_qc = qc.assign_parameters(theta * (mask != 0))
    ctx["circuit"] = bound_qc
    return _make_step(
        node,
        "ok",
        started_at=t0,
        summary={
            "iterations": iterations,
            "original_parameters": qc.num_parameters,
            "kept_parameters": int((mask != 0).sum()),
            "final_loss": float(history["loss"][-1]) if history["loss"] else None,
            "sparsity_trace": [int(s) for s in history["sparsity"]],
        },
    )


def _handle_qubound(node: FlowNode, ctx: dict, settings: Settings) -> StepResult:
    """QuBound — LSTM-based hardware-aware error bound predictor.

    Default path: load 14-day ibm_fez calibration history from the offline
    pickle shipped in ``backend/cache/ibm_history/`` and train the LSTM
    locally (~2 min on HF's shared CPU, a few seconds on a real GPU).
    This lets the demo work without any IBM credentials or network access.

    Live path (``allow_live_ibm=True`` + token set): pull fresh history
    from the IBM Quantum Platform API — accurate-as-of-today but slower
    and fragile.
    """
    t0 = _now()
    from qlib.qbound import call_QuBound, call_QuBound_from_cache

    qc: QuantumCircuit = ctx["circuit"]
    backend = ctx.get("backend")

    # Bind any free parameters with zeros so Aer can simulate them.
    if qc.num_parameters > 0:
        qc = qc.assign_parameters([0.0] * qc.num_parameters)

    # Prefer live IBM history when we have a token and it's enabled.
    if settings.has_ibm_token and settings.allow_live_ibm:
        reference = backend or _load_fake_backend("FakeFez")
        bound, _model = call_QuBound(qc, reference, token=settings.ibm_token)
        ctx["qubound_value"] = float(bound)
        return _make_step(
            node,
            "ok",
            started_at=t0,
            summary={"predicted_error_bound": float(bound), "source": "live_ibm"},
        )

    # Offline path — use cached 14-day pickle shipped with the repo.
    cache_backend_name = node.data.get("cache_backend", "ibm_fez")
    cache_path = ibm_history_cache_path(cache_backend_name)
    if not cache_path.exists():
        return _make_step(
            node,
            "error",
            started_at=t0,
            message=(
                f"No cached noise history at {cache_path.name}; run "
                f"scripts/fetch_ibm_history.py --backend {cache_backend_name} "
                f"once to populate it."
            ),
        )

    reference = backend  # may be None — call_QuBound_from_cache will default to FakeFez
    bound, _model, meta = call_QuBound_from_cache(qc, cache_path, reference_backend=reference)
    ctx["qubound_value"] = float(bound)
    return _make_step(
        node,
        "ok",
        started_at=t0,
        summary={
            "predicted_error_bound": float(bound),
            "source": "cached_ibm_history",
            "cached_backend": meta["backend_name"],
            "history_window": f"{meta['first_date']} → {meta['last_date']}",
            "num_days": meta["num_days"],
        },
    )


def _handle_compvqc(node: FlowNode, ctx: dict, _settings: Settings) -> StepResult:
    t0 = _now()
    qc: QuantumCircuit = ctx["circuit"]
    if qc.num_parameters == 0:
        return _make_step(
            node,
            "skipped",
            started_at=t0,
            message=(
                "CompressVQC only acts on parameterized rotation gates; this "
                f"circuit has 0 parameters."
            ),
            summary={"num_parameters": 0},
        )

    from qlib.compvqc import admmOptimizedCompVQC, get_LUT, quadraticProgram_luttoqp, resultsCompressVQC

    backend = ctx.get("backend") or _load_fake_backend("FakeFez")

    lut = get_LUT(qc, backend)
    if not lut:
        return _make_step(
            node,
            "skipped",
            started_at=t0,
            message="CompressVQC found no compressible rotation pairs in this circuit.",
            summary={"lut_size": 0},
        )
    qp = quadraticProgram_luttoqp(qc, lut)
    result = admmOptimizedCompVQC(qp)
    compressed = resultsCompressVQC(result, qc)

    ctx["circuit"] = compressed
    return _make_step(
        node,
        "ok",
        started_at=t0,
        summary={
            "original_depth": qc.depth(),
            "compressed_depth": compressed.depth(),
            "gates_removed": qc.size() - compressed.size(),
            "lut_candidates": len(lut),
        },
    )


def _handle_qshot(node: FlowNode, ctx: dict, _settings: Settings) -> StepResult:
    """Qshot — noise-aware shot-count recommender.

    Qshot is self-contained by design: the recommender picks its own
    `AerSimulator`, runs its own transpile pass, and consumes
    calibration data through a bundled noise JSON. So this handler
    ignores any upstream `ctx["backend"]`; the user steers noise via
    the node's ``noise_snapshot`` parameter.

    Heavy imports (torch-geometric, hdbscan) are deferred to the first
    call — that's also when the singleton `QshotRecommender` does its
    ~30-40s HDBSCAN warmup. Subsequent calls reuse the same instance.
    """
    t0 = _now()
    # Deferred so boot stays cheap and `/api/health` answers even if
    # Qshot's deps failed to install for some reason.
    from qlib.qshot import (
        DEFAULT_SNAPSHOT_KEY,
        get_recommender,
        resolve_noise_snapshot,
    )

    qc: QuantumCircuit = ctx["circuit"]
    snapshot_key = str(node.data.get("noise_snapshot", DEFAULT_SNAPSHOT_KEY))
    alpha = float(node.data.get("alpha", 0.95))
    # Clamp alpha to a sane range — model was fit for fractions close to 1.
    alpha = max(0.50, min(0.99, alpha))

    # Qshot's pilot-measurement path runs `sim.run(tqc)` directly on the
    # circuit; Aer refuses if there are unbound parameters. Bind any free
    # parameters to zero so parametric samples (HEA / EfficientSU2 / VQC)
    # still produce a usable circuit. This mirrors what QuBound does.
    if qc.num_parameters > 0:
        qc = qc.assign_parameters([0.0] * qc.num_parameters)

    noise_path = resolve_noise_snapshot(snapshot_key)
    recommender = get_recommender()
    result = recommender.predict(qc, noise_path, alpha=alpha)

    if result is None:
        return _make_step(
            node,
            "error",
            started_at=t0,
            message=(
                "Qshot could not produce a recommendation for this circuit. "
                "It may be out of the trained distribution (5–8 qubits, "
                "QAOA-like / HEA / random layered circuits)."
            ),
        )

    # `result` is whatever recommend_shots() returned plus the keys the
    # public API promises (`recommended_shots`, `method`, …). Lift the
    # interesting fields into `summary` so the React card can render
    # them without having to know the internal fit-dict shape.
    fit = result.get("fit") or {}
    summary = {
        "recommended_shots": int(result["recommended_shots"]),
        "predicted_fidelity": float(result["predicted_fidelity"]),
        "predicted_std": float(result.get("predicted_std", 0.0)),
        "method": result.get("method", "regression"),
        "cluster_label": result.get("cluster_label"),
        "tier": result.get("tier"),
        "n_matched": result.get("n_matched"),
        "alpha": alpha,
        "noise_snapshot": snapshot_key,
        # Fit parameters — used by the UI to render the target formula line.
        "fit": {
            "F_inf": float(fit["F_inf"]) if fit.get("F_inf") is not None else None,
            "a": float(fit["a"]) if fit.get("a") is not None else None,
            "b": float(fit["b"]) if fit.get("b") is not None else None,
            "target": float(fit["target"]) if fit.get("target") is not None else None,
        },
        # Pilot measurements (shots → observed fidelity proxy) — handy for
        # the "where the curve came from" chart in the card.
        "pilot_pf": {
            str(k): float(v) for k, v in (result.get("pilot_pf") or {}).items()
        },
    }
    return _make_step(node, "ok", started_at=t0, summary=summary)


def _handle_fidelity(node: FlowNode, ctx: dict, _settings: Settings) -> StepResult:
    t0 = _now()
    from qlib.qiskit_utils import simpleFidelityEstimator

    fid = simpleFidelityEstimator(ctx["circuit"])
    ctx["fidelity"] = float(fid)
    return _make_step(node, "ok", started_at=t0, summary={"fidelity": float(fid)})


def _handle_output(node: FlowNode, ctx: dict, _settings: Settings) -> StepResult:
    t0 = _now()
    qc: QuantumCircuit = ctx["circuit"]
    backend = ctx.get("backend")
    summary: dict = {
        "num_qubits": qc.num_qubits,
        "depth": qc.depth(),
        "size": qc.size(),
        "ops": {k: int(v) for k, v in qc.count_ops().items()},
        "diagram_text": str(qc.draw(output="text", fold=120)),
    }
    if backend is not None:
        # Transpile onto the selected backend so user sees hardware-native gate count.
        try:
            native = transpile(qc, backend=backend, optimization_level=3)
            summary["transpiled_depth"] = native.depth()
            summary["transpiled_size"] = native.size()
        except Exception as exc:  # transpile failures shouldn't kill the run
            summary["transpile_error"] = str(exc)
    if "fidelity" in ctx:
        summary["fidelity"] = ctx["fidelity"]
    if "qubound_value" in ctx:
        summary["qubound_error_bound"] = ctx["qubound_value"]
    return _make_step(node, "ok", started_at=t0, summary=summary)


_HANDLERS: dict[str, Callable[[FlowNode, dict, Settings], StepResult]] = {
    "ibm_backend": _handle_ibm_backend,
    "fake_backend": _handle_fake_backend,
    "qucad": _handle_qucad,
    "qubound": _handle_qubound,
    "compvqc": _handle_compvqc,
    "qshot": _handle_qshot,
    "fidelity": _handle_fidelity,
    "output": _handle_output,
}


# ---------- Graph ordering ----------

def topological_order(nodes: list[FlowNode], edges: list[FlowEdge]) -> list[FlowNode]:
    """Kahn's algorithm. Raises ValueError if the graph has a cycle."""
    by_id = {n.id: n for n in nodes}
    indeg = {n.id: 0 for n in nodes}
    out: dict[str, list[str]] = {n.id: [] for n in nodes}
    for e in edges:
        if e.source not in by_id or e.target not in by_id:
            continue
        indeg[e.target] += 1
        out[e.source].append(e.target)

    queue = [nid for nid, d in indeg.items() if d == 0]
    ordered: list[FlowNode] = []
    while queue:
        nid = queue.pop(0)
        ordered.append(by_id[nid])
        for target in out[nid]:
            indeg[target] -= 1
            if indeg[target] == 0:
                queue.append(target)

    if len(ordered) != len(nodes):
        raise ValueError("Pipeline graph has a cycle")
    return ordered


# ---------- Public entry ----------

def run_pipeline(
    *,
    circuit: QuantumCircuit,
    nodes: list[FlowNode],
    edges: list[FlowEdge],
    settings: Settings,
) -> list[StepResult]:
    """Execute the user's pipeline. Returns a StepResult per visited node."""
    ctx: dict = {"circuit": circuit}
    steps: list[StepResult] = []

    ordered = topological_order(nodes, edges)
    for node in ordered:
        if node.type == "input_circuit":
            steps.append(
                _make_step(
                    node,
                    "ok",
                    summary={
                        "num_qubits": circuit.num_qubits,
                        "depth": circuit.depth(),
                        "num_parameters": circuit.num_parameters,
                    },
                )
            )
            continue

        handler = _HANDLERS.get(node.type)
        if handler is None:
            steps.append(_make_step(node, "skipped", message=f"No handler for node type {node.type!r}"))
            continue
        try:
            steps.append(handler(node, ctx, settings))
        except Exception as exc:  # never let one bad node kill the whole run
            steps.append(_make_step(node, "error", message=f"{type(exc).__name__}: {exc}"))
            break

    return steps
