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

import hashlib
import io
import json
import logging
import time
from collections import OrderedDict
from typing import Callable, Generator

from qiskit import QuantumCircuit, qpy, transpile

from app.config import Settings, ibm_history_cache_path
from app.schemas import FlowEdge, FlowNode, StepResult

logger = logging.getLogger(__name__)


def _now() -> float:
    return time.time()


# ---- Per-node intermediate result cache --------------------------------
#
# After each step, we snapshot the StepResult + the ctx dict (shallow
# copy — QuantumCircuit/backend objects stay in memory by reference).
# The cache key is a hash of (original_circuit_qpy, node_types_and_
# params up to this step), so if the user changes only the last block
# the first N-1 steps are instant cache hits.
#
# The cache lives in process memory — it resets on container restart.
# An LRU cap prevents unbounded growth.

_STEP_CACHE_MAX = 200
_step_cache: OrderedDict[str, tuple[StepResult, dict]] = OrderedDict()


# Re-export under the old name so other call sites in this module
# don't have to change. The canonical implementation lives in
# run_cache so cache-hash + plugin-payload use identical bytes.
from app.services.run_cache import qpy_dump_bytes as _qpy_bytes_for_hash  # noqa: E402


def _prefix_hash(circuit_qpy: bytes, nodes_so_far: list[FlowNode]) -> str:
    """Hash the pipeline prefix up to and including the last node in
    ``nodes_so_far``. Two runs with the same circuit + same node
    sequence (types and params) will produce the same prefix hash at
    each step, enabling cache hits for unchanged prefixes."""
    h = hashlib.sha256(circuit_qpy)
    for n in nodes_so_far:
        h.update(
            json.dumps(
                {"type": n.type, "data": n.data}, sort_keys=True, default=str,
            ).encode()
        )
    return h.hexdigest()[:16]


def _cache_put(key: str, result: StepResult, ctx: dict) -> None:
    # Deep-copy QuantumCircuit objects to prevent a future handler that
    # mutates in-place from silently corrupting the cached snapshot.
    # Other ctx values (backend, floats) are either immutable or cheap.
    snapshot = {}
    for k, v in ctx.items():
        if isinstance(v, QuantumCircuit):
            snapshot[k] = v.copy()
        else:
            snapshot[k] = v
    _step_cache[key] = (result, snapshot)
    _step_cache.move_to_end(key)
    while len(_step_cache) > _STEP_CACHE_MAX:
        _step_cache.popitem(last=False)


def _make_step(
    node: FlowNode,
    status: str,
    summary: dict | None = None,
    message: str | None = None,
    started_at: float | None = None,
    label: str | None = None,
    figures: list[dict] | None = None,
    circuit_shape: dict | None = None,
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
        figures=figures,
        circuit_shape=circuit_shape,  # type: ignore[arg-type]
    )


def _shape_of(qc: "QuantumCircuit") -> dict:
    """Extract the small (qubits, depth, size, num_parameters) shape
    tuple from a QuantumCircuit, JSON-ready for the StepResult. Used
    by the run-loop to attach a per-step snapshot for edge labels."""
    return {
        "num_qubits": qc.num_qubits,
        "depth": qc.depth(),
        "size": qc.size(),
        "num_parameters": qc.num_parameters,
    }


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
    """Local noisy simulator using a Qiskit Aer fake backend. Exposes
    a user-configurable ``shots`` count so downstream blocks that
    actually run measurements (e.g. Fidelity in `sampled` mode) can
    pick it up from ctx without each having its own shots param."""
    t0 = _now()
    name = node.data.get("backend_name", "FakeFez")
    # Clamp shots to a sensible range to avoid DOS via "shots=10**9".
    shots_raw = node.data.get("shots", 1024)
    shots = int(shots_raw) if isinstance(shots_raw, (int, float)) else 1024
    shots = max(1, min(shots, 65536))
    backend = _load_fake_backend(name)
    ctx["backend"] = backend
    ctx["backend_is_live"] = False
    ctx["shots"] = shots
    return _make_step(
        node,
        "ok",
        started_at=t0,
        summary={
            "backend_name": name,
            "num_qubits": backend.configuration().n_qubits,
            "shots": shots,
        },
    )


def _handle_ibm_backend(node: FlowNode, ctx: dict, settings: Settings) -> StepResult:
    t0 = _now()
    shots_raw = node.data.get("shots", 1024)
    shots = int(shots_raw) if isinstance(shots_raw, (int, float)) else 1024
    shots = max(1, min(shots, 65536))
    if not settings.has_ibm_token or not settings.allow_live_ibm:
        # Silently downgrade to fake so the rest of the pipeline still runs.
        fallback = _load_fake_backend(node.data.get("fallback_backend", "FakeFez"))
        ctx["backend"] = fallback
        ctx["backend_is_live"] = False
        ctx["shots"] = shots
        return _make_step(
            node,
            "skipped",
            started_at=t0,
            message="Live IBM call disabled; falling back to FakeFez.",
            summary={"fallback": "FakeFez", "shots": shots},
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
    ctx["shots"] = shots
    return _make_step(
        node,
        "ok",
        started_at=t0,
        summary={"backend_name": name, "live": True, "shots": shots},
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

    # Optional acceptance threshold for the predicted bound. Defaults
    # are absent ("none" means the user didn't set one, so no
    # pass/fail decision is rendered — just the predicted number).
    threshold_raw = node.data.get("threshold")
    threshold = float(threshold_raw) if isinstance(threshold_raw, (int, float)) and threshold_raw > 0 else None

    def _build_summary(bound_value: float, source: str, extra: dict | None = None) -> dict:
        out: dict = {
            "predicted_error_bound": float(bound_value),
            "source": source,
        }
        if threshold is not None:
            passes = float(bound_value) <= threshold
            out["threshold"] = threshold
            out["passes_threshold"] = bool(passes)
            out["margin"] = float(threshold - bound_value)  # >0 = headroom, <0 = over
        if extra:
            out.update(extra)
        return out

    # Prefer live IBM history when we have a token and it's enabled.
    if settings.has_ibm_token and settings.allow_live_ibm:
        reference = backend or _load_fake_backend("FakeFez")
        bound, _model = call_QuBound(qc, reference, token=settings.ibm_token)
        ctx["qubound_value"] = float(bound)
        return _make_step(
            node,
            "ok",
            started_at=t0,
            summary=_build_summary(bound, "live_ibm"),
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
        summary=_build_summary(
            bound, "cached_ibm_history",
            {
                "cached_backend": meta["backend_name"],
                "history_window": f"{meta['first_date']} → {meta['last_date']}",
                "num_days": meta["num_days"],
            },
        ),
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
    """Fidelity estimator. Two methods:

      * ``statevector`` (default) — noiseless ⟨0…0|U|0…0⟩.
      * ``sampled``               — bind params, run on the noisy
                                    backend with N shots, observe
                                    the |0…0⟩ count fraction.

    The choice is made by the ``method`` param on the node. The
    ``unbound_param_policy`` param controls whether unbound circuit
    parameters get silently bound to zero (default, matches QuBound's
    convention) or refused with an actionable error.
    """
    t0 = _now()
    from qlib.qiskit_utils import (
        UnboundParametersError,
        sampledFidelityEstimator,
        simpleFidelityEstimator,
    )

    method = node.data.get("method", "statevector")
    unbound_policy = node.data.get("unbound_param_policy", "bind_zero")

    try:
        if method == "sampled":
            backend = ctx.get("backend")
            shots = int(ctx.get("shots", 1024))
            fid, meta = sampledFidelityEstimator(
                ctx["circuit"], backend, shots,
                unbound_param_policy=unbound_policy,
            )
        else:
            fid, meta = simpleFidelityEstimator(
                ctx["circuit"], unbound_param_policy=unbound_policy,
            )
    except UnboundParametersError as exc:
        # User-actionable: tell them exactly which lever to flip.
        return _make_step(node, "error", started_at=t0, message=str(exc))
    except Exception:
        # Unknown failure — log traceback server-side, generic to user.
        logger.exception("Fidelity handler crashed for node %s", node.id)
        return _make_step(
            node, "error", started_at=t0,
            message=(
                "Fidelity estimation failed. The most common cause is a "
                "circuit shape the estimator doesn't support (e.g. classical "
                "registers attached). Check the server run log for the "
                "underlying error."
            ),
        )

    ctx["fidelity"] = float(fid)
    summary: dict = {"fidelity": float(fid), **meta}
    return _make_step(node, "ok", started_at=t0, summary=summary)


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


def _handle_plugin(
    node: FlowNode,
    ctx: dict,
    _settings: Settings,
    *,
    user_id: str,
) -> StepResult:
    """Dispatch a user-uploaded plugin block.

    Translates the in-process ``ctx`` (QuantumCircuit object, possible
    Qiskit Backend object, scalar values) into the JSON-friendly
    ``inputs`` shape the plugin subprocess expects, invokes
    ``plugin_runner.run_plugin``, then translates the result back into
    ctx mutations + a StepResult.
    """
    t0 = _now()
    # Heavy / cross-module imports kept inside the handler so the
    # plugin path doesn't run unless a plugin is actually used.
    from app.services import plugin_service, plugin_runner

    found = plugin_service.find_plugin(user_id, node.type)
    if found is None:
        return _make_step(
            node, "error", started_at=t0,
            message=(
                f"No plugin {node.type!r} found for this session. "
                "If you uploaded it on another device, re-upload it here."
            ),
        )
    manifest, plugin_dir_path = found

    # Build the inputs payload. Plugins of family=source legitimately
    # have no upstream circuit; everything else gets the current ctx
    # circuit serialized to QPY.
    inputs: dict = {"scalars": {}, "backend_name": None}
    if "circuit" in ctx:
        inputs["circuit_qpy_bytes"] = _qpy_bytes_for_hash(ctx["circuit"])
    if "backend" in ctx and ctx["backend"] is not None:
        # The Qiskit FakeBackend objects have a `.name` attribute the
        # plugin can use; live IBM backends also have one. We pass it
        # as a string so plugins can decide how to re-create a model.
        try:
            inputs["backend_name"] = ctx["backend"].name
        except AttributeError:
            inputs["backend_name"] = None
    # Pass any scalar values already in ctx so a metric/sink plugin
    # can read them without re-deriving.
    for k in ("fidelity", "qubound_value"):
        if k in ctx and isinstance(ctx[k], (int, float)):
            inputs["scalars"][k] = ctx[k]
    # Allow plugin-set scalars from prior plugin steps too.
    if "_plugin_scalars" in ctx and isinstance(ctx["_plugin_scalars"], dict):
        for k, v in ctx["_plugin_scalars"].items():
            inputs["scalars"].setdefault(k, v)

    try:
        result = plugin_runner.run_plugin(
            handler_dir=plugin_dir_path,
            inputs=inputs,
            params=node.data or {},
        )
    except plugin_runner.PluginRunError as exc:
        return _make_step(
            node, "error", started_at=t0,
            message=f"Plugin {node.type} failed: {exc}",
        )
    except Exception as exc:  # extra defence — should be rare
        return _make_step(
            node, "error", started_at=t0,
            message=f"Plugin {node.type} crashed unexpectedly: {type(exc).__name__}: {exc}",
        )

    # ---- merge the plugin's outputs back into ctx ----
    # 1. circuit replacement
    if "circuit_qpy_bytes" in result:
        try:
            buf = io.BytesIO(result["circuit_qpy_bytes"])
            new_qc = qpy.load(buf)
            new_qc = new_qc[0] if isinstance(new_qc, list) else new_qc
            ctx["circuit"] = new_qc
        except Exception as exc:
            return _make_step(
                node, "error", started_at=t0,
                message=f"Plugin {node.type} returned an invalid circuit QPY: {exc}",
            )
    # 2. backend selection (limited to known fake backends)
    if "backend_name" in result:
        bn = result["backend_name"]
        try:
            ctx["backend"] = _load_fake_backend(bn)
        except Exception as exc:
            return _make_step(
                node, "error", started_at=t0,
                message=(
                    f"Plugin {node.type} requested backend {bn!r}, "
                    f"which isn't supported: {exc}"
                ),
            )
    # 3. scalar writes — fold into ctx by their stated key, and also
    #    keep a separate _plugin_scalars dict so downstream plugins
    #    can read them without confusing the built-in handlers.
    scalars = result.get("scalars") or {}
    if scalars:
        plugin_scalars = ctx.setdefault("_plugin_scalars", {})
        for k, v in scalars.items():
            if not isinstance(v, (int, float, str, bool)) and v is not None:
                continue
            plugin_scalars[k] = v
            # Built-in keys also overwrite the canonical ctx slot so
            # the Output block picks them up.
            if k in ("fidelity", "qubound_value"):
                ctx[k] = v

    summary = result.get("summary") or {}
    # Include scalar writes in the summary too so users see them in
    # the result card even if they didn't put them in summary.
    if scalars:
        summary = {**summary}
        for k, v in scalars.items():
            summary.setdefault(k, v)

    # Plugin's typed rich-output figures (markdown / table / bar /
    # svg / image_png_b64), already sanitised by plugin_runner.
    figures = result.get("figures") or None

    return _make_step(node, "ok", started_at=t0, summary=summary, figures=figures)


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
    user_id: str | None = None,
) -> list[StepResult]:
    """Execute the user's pipeline. Returns a StepResult per visited node."""
    ctx: dict = {"circuit": circuit}
    steps: list[StepResult] = []

    # If any node in the graph is a plugin and we know the user, make
    # sure their plugins are hydrated from the HF Datasets backing
    # store before dispatching. Without this, an authenticated user
    # running a pipeline on a freshly-restarted Space (or on the OTHER
    # Space mirroring the same dataset) would see "plugin not found"
    # even though it's safely in their dataset.
    if user_id and any(n.type not in _HANDLERS and n.type != "input_circuit" for n in nodes):
        from app.services import plugin_service
        try:
            plugin_service.hydrate_from_dataset_if_needed(user_id)
        except Exception:
            logger.exception("Pre-run plugin hydration failed for %s (continuing)", user_id)

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
                    circuit_shape=_shape_of(circuit),
                )
            )
            continue

        handler = _HANDLERS.get(node.type)
        if handler is not None:
            try:
                step = handler(node, ctx, settings)
                # Snapshot the circuit's current shape onto the step.
                # Handlers don't bother setting this themselves —
                # they just mutate ctx, and we read it here.
                if step.status == "ok" and "circuit" in ctx:
                    step = step.model_copy(
                        update={"circuit_shape": _shape_of(ctx["circuit"])},
                    )
                steps.append(step)
            except Exception:
                # Log the real traceback server-side; the user-facing
                # message stays generic so library exception text
                # (file paths, stack fragments) doesn't leak.
                logger.exception(
                    "Built-in handler %s crashed for node %s",
                    node.type, node.id,
                )
                steps.append(_make_step(
                    node, "error",
                    message=(
                        f"The {node.type} block hit an unexpected error. "
                        "See the run log for details."
                    ),
                ))
                break
            continue

        # Not a built-in — try a user plugin if we have a user_id.
        if user_id:
            step = _handle_plugin(node, ctx, settings, user_id=user_id)
            if step.status == "ok" and "circuit" in ctx:
                step = step.model_copy(
                    update={"circuit_shape": _shape_of(ctx["circuit"])},
                )
            steps.append(step)
            if step.status == "error":
                break
            continue

        steps.append(_make_step(
            node, "skipped",
            message=f"No handler for node type {node.type!r}",
        ))

    return steps


def run_pipeline_stream(
    *,
    circuit: QuantumCircuit,
    nodes: list[FlowNode],
    edges: list[FlowEdge],
    settings: Settings,
    user_id: str | None = None,
) -> Generator[StepResult, None, None]:
    """Generator version of run_pipeline: yields each StepResult as it
    completes, enabling Server-Sent Events in the route layer.

    Uses an in-memory per-node prefix cache so that unchanged pipeline
    prefixes resolve instantly. If the user changes only the last block
    and re-runs, all preceding steps are served from cache (~0 ms each)
    instead of re-executing (which can take minutes for QuBound/Qshot).

    When ``user_id`` is provided, unknown node types are dispatched to
    the per-user plugin registry (see services/plugin_service.py).
    Plugin steps participate in the cache: the prefix hash includes
    the plugin's kind + params, so re-running with the same plugin
    settings hits the cache; modifying the plugin's params (or
    re-uploading) busts only the suffix.
    """
    ctx: dict = {"circuit": circuit}
    ordered = topological_order(nodes, edges)

    # Same hydration as run_pipeline — without this, a logged-in user
    # running a pipeline on a freshly-restarted Space or on the OTHER
    # mirror Space would see "plugin not found" even though it sits
    # in their HF Datasets backing store.
    if user_id and any(n.type not in _HANDLERS and n.type != "input_circuit" for n in nodes):
        from app.services import plugin_service
        try:
            plugin_service.hydrate_from_dataset_if_needed(user_id)
        except Exception:
            logger.exception("Pre-stream plugin hydration failed for %s (continuing)", user_id)

    # Compute the circuit's QPY hash once (expensive) — reused for
    # every prefix hash in this run.
    circuit_qpy = _qpy_bytes_for_hash(circuit)
    nodes_so_far: list[FlowNode] = []

    for node in ordered:
        nodes_so_far.append(node)
        prefix_key = _prefix_hash(circuit_qpy, nodes_so_far)

        # ---- cache hit: return saved result + restore ctx ----
        if prefix_key in _step_cache:
            cached_result, cached_ctx = _step_cache[prefix_key]
            ctx.update(cached_ctx)
            _step_cache.move_to_end(prefix_key)  # refresh LRU
            logger.debug("Step cache HIT for %s (%s)", node.type, prefix_key[:8])
            yield cached_result.model_copy(update={"from_step_cache": True})
            continue

        # ---- cache miss: execute the step ----
        logger.debug("Step cache MISS for %s (%s)", node.type, prefix_key[:8])

        if node.type == "input_circuit":
            result = _make_step(
                node,
                "ok",
                summary={
                    "num_qubits": circuit.num_qubits,
                    "depth": circuit.depth(),
                    "num_parameters": circuit.num_parameters,
                },
                circuit_shape=_shape_of(circuit),
            )
            _cache_put(prefix_key, result, ctx)
            yield result
            continue

        handler = _HANDLERS.get(node.type)
        if handler is not None:
            try:
                result = handler(node, ctx, settings)
                if result.status == "ok" and "circuit" in ctx:
                    result = result.model_copy(
                        update={"circuit_shape": _shape_of(ctx["circuit"])},
                    )
                _cache_put(prefix_key, result, ctx)
                yield result
            except Exception:
                # Same policy as run_pipeline above: log traceback,
                # surface generic message to the user.
                logger.exception(
                    "Built-in handler %s crashed (stream) for node %s",
                    node.type, node.id,
                )
                result = _make_step(
                    node, "error",
                    message=(
                        f"The {node.type} block hit an unexpected error. "
                        "See the run log for details."
                    ),
                )
                yield result
                break
            continue

        # Not a built-in — plugin dispatch path.
        if user_id:
            result = _handle_plugin(node, ctx, settings, user_id=user_id)
            if result.status == "ok" and "circuit" in ctx:
                result = result.model_copy(
                    update={"circuit_shape": _shape_of(ctx["circuit"])},
                )
            # Only cache successful plugin runs so a transient crash
            # doesn't get pinned to the prefix.
            if result.status == "ok":
                _cache_put(prefix_key, result, ctx)
            yield result
            if result.status == "error":
                break
            continue

        result = _make_step(
            node, "skipped",
            message=f"No handler for node type {node.type!r}",
        )
        _cache_put(prefix_key, result, ctx)
        yield result
