"""Precompute RunResponses for every (sample_circuit x preset_pipeline) pair.

Writes JSON files into backend/cache/precomputed_runs/<hash>.json, keyed
by the same content hash that the live /workflow/run endpoint uses to
look entries up. The cache directory is bundled into the Docker image
(see .dockerignore), so HF Space visitors hitting one of these presets
on a shipped sample get an instant response with from_cache=true.

Run from the repo root:

    python scripts/precompute_preset_results.py              # all samples
    python scripts/precompute_preset_results.py --only qubound,qucad
    python scripts/precompute_preset_results.py --samples bell_state,ghz_3q
    python scripts/precompute_preset_results.py --clean      # wipe first

Keep the preset list here in sync with frontend/src/lib/presets.ts.
Drift is easy to notice because the frontend sample+preset combos just
stop hitting cache and start doing 30-60s live runs.
"""

from __future__ import annotations

import argparse
import shutil
import sys
import time
from pathlib import Path

# Make `app`, `qlib` importable when run from repo root.
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.config import get_settings  # noqa: E402
from app.schemas import FlowEdge, FlowNode, RunResponse  # noqa: E402
from app.services.circuit_service import (  # noqa: E402
    SAMPLE_CIRCUITS_DIR,
    load_sample,
)
from app.services.run_cache import (  # noqa: E402
    CACHE_DIR,
    compute_cache_key,
    save_cached_response,
)
from app.services.workflow_service import run_pipeline  # noqa: E402


# Mirror of frontend/src/lib/presets.ts. Node defaults (params) must match
# what the frontend sends: backend_name, cache_backend, iterations, etc.
# If you add a preset in the TS file, mirror it here.
PRESETS: dict[str, dict] = {
    "qubound": {
        "label": "QuBound",
        "nodes": [
            {"id": "n1", "type": "input_circuit", "data": {}},
            {"id": "n2", "type": "fake_backend", "data": {"backend_name": "FakeFez"}},
            {"id": "n3", "type": "qubound", "data": {"cache_backend": "ibm_fez"}},
            {"id": "n4", "type": "output", "data": {}},
        ],
        "edges": [
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "n3"},
            {"source": "n3", "target": "n4"},
        ],
    },
    "qucad": {
        "label": "QuCAD",
        "nodes": [
            {"id": "n1", "type": "input_circuit", "data": {}},
            {"id": "n2", "type": "fake_backend", "data": {"backend_name": "FakeFez"}},
            {
                "id": "n3",
                "type": "qucad",
                "data": {"iterations": 3, "lam": 0.005, "rho": 500.0},
            },
            {"id": "n4", "type": "fidelity", "data": {}},
            {"id": "n5", "type": "output", "data": {}},
        ],
        "edges": [
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "n3"},
            {"source": "n3", "target": "n4"},
            {"source": "n4", "target": "n5"},
        ],
    },
    "compvqc": {
        "label": "CompressVQC",
        "nodes": [
            {"id": "n1", "type": "input_circuit", "data": {}},
            {"id": "n2", "type": "fake_backend", "data": {"backend_name": "FakeFez"}},
            {"id": "n3", "type": "compvqc", "data": {}},
            {"id": "n4", "type": "fidelity", "data": {}},
            {"id": "n5", "type": "output", "data": {}},
        ],
        "edges": [
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "n3"},
            {"source": "n3", "target": "n4"},
            {"source": "n4", "target": "n5"},
        ],
    },
    "full": {
        "label": "Full stack",
        "nodes": [
            {"id": "n1", "type": "input_circuit", "data": {}},
            {"id": "n2", "type": "fake_backend", "data": {"backend_name": "FakeFez"}},
            {
                "id": "n3",
                "type": "qucad",
                "data": {"iterations": 3, "lam": 0.005, "rho": 500.0},
            },
            {"id": "n4", "type": "compvqc", "data": {}},
            {"id": "n5", "type": "qubound", "data": {"cache_backend": "ibm_fez"}},
            {"id": "n6", "type": "fidelity", "data": {}},
            {"id": "n7", "type": "output", "data": {}},
        ],
        "edges": [
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "n3"},
            {"source": "n3", "target": "n4"},
            {"source": "n4", "target": "n5"},
            {"source": "n5", "target": "n6"},
            {"source": "n6", "target": "n7"},
        ],
    },
}


def list_sample_keys() -> list[str]:
    return sorted(p.stem for p in SAMPLE_CIRCUITS_DIR.glob("*.qpy"))


def precompute_one(
    sample_key: str,
    preset_key: str,
    preset: dict,
    *,
    dry_run: bool = False,
) -> tuple[str, Path | None, float, bool]:
    """Returns (cache_key, path-or-None, elapsed_seconds, ok)."""
    qc = load_sample(sample_key)
    nodes = [FlowNode(**n) for n in preset["nodes"]]
    edges = [FlowEdge(**e) for e in preset["edges"]]
    cache_key = compute_cache_key(qc, nodes, edges, use_live_ibm=False)

    t0 = time.time()
    settings = get_settings()
    steps = run_pipeline(circuit=qc, nodes=nodes, edges=edges, settings=settings)
    elapsed = time.time() - t0

    ok = all(s.status != "error" for s in steps)
    final_metrics: dict = {}
    for s in reversed(steps):
        if s.node_type == "output" and s.status == "ok":
            final_metrics = s.summary
            break
    response = RunResponse(
        circuit_id=f"precomputed_{sample_key}_{preset_key}",
        ok=ok,
        from_cache=False,  # stored as False; served as True by the route
        steps=steps,
        final_metrics=final_metrics,
    )
    if dry_run:
        return cache_key, None, elapsed, ok
    path = save_cached_response(cache_key, response)
    return cache_key, path, elapsed, ok


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument(
        "--only",
        help="Comma-separated preset keys to run (default: all).",
    )
    ap.add_argument(
        "--samples",
        help="Comma-separated sample keys to run (default: all bundled samples).",
    )
    ap.add_argument(
        "--clean",
        action="store_true",
        help="Delete the cache directory before running.",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute runs but don't write cache files (for timing).",
    )
    args = ap.parse_args()

    if args.clean and CACHE_DIR.exists():
        print(f"Removing {CACHE_DIR} ...")
        shutil.rmtree(CACHE_DIR)

    preset_keys = (
        [k.strip() for k in args.only.split(",")] if args.only else list(PRESETS)
    )
    for k in preset_keys:
        if k not in PRESETS:
            print(f"Unknown preset {k!r}. Known: {list(PRESETS)}", file=sys.stderr)
            return 2
    sample_keys = (
        [k.strip() for k in args.samples.split(",")]
        if args.samples
        else list_sample_keys()
    )

    print(
        f"Precomputing {len(preset_keys)} preset(s) x {len(sample_keys)} sample(s) "
        f"= {len(preset_keys) * len(sample_keys)} runs"
    )
    print(f"Cache dir: {CACHE_DIR}\n")

    total_ok = 0
    total_err = 0
    grand_t0 = time.time()
    for si, sk in enumerate(sample_keys, 1):
        for pi, pk in enumerate(preset_keys, 1):
            label = f"[{si}/{len(sample_keys)} sample={sk} | {pi}/{len(preset_keys)} preset={pk}]"
            try:
                key, path, elapsed, ok = precompute_one(
                    sk, pk, PRESETS[pk], dry_run=args.dry_run
                )
                status = "ok" if ok else "WITH_ERRORS"
                where = path.name if path else "(dry-run)"
                print(f"{label} {status} in {elapsed:5.1f}s  -> {where}  (key={key})")
                if ok:
                    total_ok += 1
                else:
                    total_err += 1
            except Exception as e:  # noqa: BLE001
                print(f"{label} FAILED: {e}", file=sys.stderr)
                total_err += 1
    grand = time.time() - grand_t0
    print(
        f"\nDone. {total_ok} ok, {total_err} with-errors/failed in {grand:.1f}s total."
    )
    return 0 if total_err == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
