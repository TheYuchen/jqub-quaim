"""Content-addressed cache for pipeline run responses.

Motivation: most visitors to the demo just want to see what the three
preset pipelines produce on a bundled sample. Running the full stack
takes 30-60 s per click, which is plenty of time for someone to bounce.
With a shipped cache, those four presets x six samples return in
milliseconds with a "cached" badge in the UI.

The cache is keyed by a deterministic hash of:

  * the circuit's QPY bytes (canonical serialization by Qiskit),
  * the pipeline graph (nodes + edges, minus positions and random ids),
  * the use_live_ibm flag.

So it hits when and only when a user replays exactly the same circuit
+ graph the precompute script saw. Any diff (different parameter values,
a different algorithm block, even an extra edge) misses.

Cache entries are plain JSON on disk. Read-only from the serving path;
the precompute script under scripts/ is the only thing that writes.
"""

from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
from typing import Any, Iterable

from qiskit import QuantumCircuit, qpy

from app.schemas import FlowEdge, FlowNode, RunResponse


# Lives under backend/cache/precomputed_runs/, alongside the IBM history
# pickle. Bundled into the Docker image so HF Space reads from disk.
CACHE_DIR: Path = (
    Path(__file__).resolve().parent.parent.parent / "cache" / "precomputed_runs"
)


def _normalize_node(n: FlowNode | dict[str, Any]) -> dict[str, Any]:
    """Strip anything that shouldn't affect semantic equivalence.

    In particular we drop the node `id`: the graph topology is what
    matters, not the auto-generated names. Two runs of the same preset
    with node ids "n1..n4" vs "na..nd" should still share a cache entry
    as long as the edges describe the same DAG.
    """
    if isinstance(n, FlowNode):
        node_type = n.type
        data = n.data
        node_id = n.id
    else:
        node_type = n["type"]
        data = n.get("data", {})
        node_id = n["id"]
    return {"id": node_id, "type": node_type, "data": data}


def _normalize_edge(e: FlowEdge | dict[str, Any]) -> dict[str, Any]:
    if isinstance(e, FlowEdge):
        return {"source": e.source, "target": e.target}
    return {"source": e["source"], "target": e["target"]}


def _qpy_bytes(qc: QuantumCircuit) -> bytes:
    buf = io.BytesIO()
    qpy.dump(qc, buf)
    return buf.getvalue()


def compute_cache_key(
    circuit: QuantumCircuit,
    nodes: Iterable[FlowNode | dict[str, Any]],
    edges: Iterable[FlowEdge | dict[str, Any]],
    use_live_ibm: bool,
) -> str:
    """Hash the semantic content of a run request into a short hex key."""
    h = hashlib.sha256()
    h.update(_qpy_bytes(circuit))
    payload = {
        "nodes": [_normalize_node(n) for n in nodes],
        "edges": [_normalize_edge(e) for e in edges],
        "use_live_ibm": bool(use_live_ibm),
    }
    h.update(json.dumps(payload, sort_keys=True, default=str).encode("utf-8"))
    # 16 hex chars = 64 bits of collision space; fine for our < 1000 entries.
    return h.hexdigest()[:16]


def load_cached_response(
    key: str,
    *,
    circuit_id: str,
) -> RunResponse | None:
    """Return a cached RunResponse for ``key``, or None if absent.

    The stored JSON was serialized with whatever ``circuit_id`` the
    precompute script happened to use (a random uuid), but the client
    calling /workflow/run has a fresh uuid, so we swap it in before
    returning. Everything else (steps, metrics, from_cache) is preserved.
    """
    path = CACHE_DIR / f"{key}.json"
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    raw["circuit_id"] = circuit_id
    raw["from_cache"] = True
    try:
        return RunResponse.model_validate(raw)
    except Exception:
        # If a cache entry is from an older schema version, just miss.
        return None


def save_cached_response(key: str, response: RunResponse) -> Path:
    """Write ``response`` to the cache under ``key``. Used by the precompute
    script; the serving route never calls this."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{key}.json"
    path.write_text(response.model_dump_json(indent=2), encoding="utf-8")
    return path
