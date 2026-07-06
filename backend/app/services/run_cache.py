"""Content-addressed cache for pipeline run responses.

Motivation: most visitors to the demo just want to see what the bundled
preset pipelines produce on a bundled sample. Running the full stack
takes 30-60 s per click, which is plenty of time for someone to bounce.
With a shipped cache, the covered preset × sample combinations return
in milliseconds with a "cached" badge in the UI. (At time of writing:
the two torch-light presets, qucad + compvqc, × 9 samples — the
torch-heavy presets run fresh on purpose; see
scripts/regenerate_precomputed_cache_live.py.)

The cache is keyed by a deterministic hash of:

  * the circuit's QPY bytes (canonical serialization by Qiskit),
  * the pipeline graph (nodes + edges, minus positions and random ids),
  * the use_live_ibm flag.

So it hits when and only when a user replays exactly the same circuit
+ graph the precompute script saw. Any diff (different parameter values,
a different algorithm block, even an extra edge) misses.

Cache entries are plain JSON on disk, stamped with ``cache_schema``
(see CACHE_SCHEMA below — entries from an older schema are treated as
misses instead of being served with rendering-critical fields absent).
Read-only from the serving path; the regeneration/precompute scripts
under scripts/ are the only things that write.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
from pathlib import Path
from typing import Any, Iterable

from qiskit import QuantumCircuit, qpy

from app.schemas import FlowEdge, FlowNode, RunResponse

log = logging.getLogger(__name__)

# Schema stamp written into every cache file (top-level "cache_schema"
# key, popped before pydantic validation). The provenance rework taught
# the UI to expect per-step ``transformation`` / ``distribution`` /
# ``seed_used`` payloads; a pre-rework cache entry still VALIDATES as a
# RunResponse (all those fields default to None) but renders a crippled
# first-run experience — no ribbons, no glyphs, no CIs — which is worse
# than a slow fresh run. Entries without the current stamp are treated
# as misses. Bump this whenever RunResponse/StepResult gain fields the
# UI's rendering depends on and regenerate the cache
# (scripts/regenerate_precomputed_cache_live.py).
CACHE_SCHEMA = 2

# Log each stale key once per process, not once per request — a popular
# preset would otherwise spam the log on every drive-by visitor.
_stale_keys_logged: set[str] = set()


# Lives under backend/cache/precomputed_runs/, alongside the IBM history
# pickle. Bundled into the Docker image so HF Space reads from disk.
CACHE_DIR: Path = (
    Path(__file__).resolve().parent.parent.parent / "cache" / "precomputed_runs"
)


def _normalize_node(n: FlowNode | dict[str, Any]) -> dict[str, Any]:
    """Pull the cache-relevant fields out of a node payload.

    Strips React-Flow UI noise (position, selected, dragHandle, …) and
    keeps only ``id`` / ``type`` / ``data``. The id IS kept on purpose:
    edges reference nodes by id, so dropping it on the node side without
    canonicalising ids on the edge side would make the hash meaningless.
    The frontend presets and the precompute script in
    ``scripts/precompute_preset_results.py`` both use the same ``n1, n2,
    …`` convention, which is what makes the cache hit in practice.
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


def qpy_dump_bytes(qc: QuantumCircuit) -> bytes:
    """Serialise a circuit to QPY bytes. Used both for prefix hashing
    in the run cache and as the inputs payload for plugin
    subprocesses — same wire format, one implementation."""
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
    h.update(qpy_dump_bytes(circuit))
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
    # Schema gate: refuse to serve entries written before the current
    # cache schema (see CACHE_SCHEMA above). Missing key == legacy.
    if raw.pop("cache_schema", None) != CACHE_SCHEMA:
        if key not in _stale_keys_logged:
            _stale_keys_logged.add(key)
            log.warning(
                "precomputed cache entry %s predates cache_schema=%s; "
                "skipping it (the run executes fresh instead)",
                key,
                CACHE_SCHEMA,
            )
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
    data = json.loads(response.model_dump_json())
    data["cache_schema"] = CACHE_SCHEMA
    # The disk cache is seed-free by design: it serves FRESH-mode
    # requests, and the serving route advertises root_seed=None ("no
    # seed drawn") because the cached numbers were not produced with
    # that request's seed draw. Scrubbing the producing run's envelope
    # here keeps the committed files from carrying a seed that nothing
    # may ever honour. Per-step ``seed_used`` values stay: they are the
    # honest record of how the cached numbers were actually produced.
    data["run_id"] = None
    data["seed_mode"] = None
    data["root_seed"] = None
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return path
