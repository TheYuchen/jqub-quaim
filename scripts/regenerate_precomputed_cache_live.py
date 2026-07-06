"""Regenerate the precomputed-run disk cache from the LIVE Space.

Why live and not local (`precompute_preset_results.py`): the deployed
Space has torch and the exact runtime that will later SERVE these
entries, so responses recorded here carry every provenance field the
current UI renders (transformation signatures, gate diffs,
circuit_shape, distribution payloads) with the deployed code's exact
semantics. The 2026-07 audit found the shipped cache predated the
provenance rework — schema-less entries that would render a crippled
first run — AND that every key had silently gone unreachable because
a qiskit upgrade changed the QPY bytes the key hashes. This script
closes both holes:

  * responses come from the live API (fresh mode, NO seed — the disk
    cache is seed-free by design; `save_cached_response` scrubs the
    envelope and stamps `cache_schema`);
  * keys are computed locally with `run_cache.compute_cache_key`, and
    the script REFUSES to run unless the local qiskit version equals
    the live server's (/api/health) — the only way the keys can match
    what the deployed server computes at request time.

Torch-heavy presets (qubound, qshot, full — LSTM training / GNN
warmup, tens of seconds to minutes per run) are deliberately NOT
cached by default: the schema gate makes those combos run fresh,
which is honest — better a slow true answer than an instant stale one.

Resumable: combos whose cache file already exists are skipped, and
`--budget-seconds` stops the script cleanly between combos, so it can
be re-invoked under a hard process cap (the dev sandbox kills
processes at ~40 s) until it reports "nothing left to do".

Usage, from the repo root (match the venv's qiskit to the live pin!):

    python scripts/regenerate_precomputed_cache_live.py             # qucad+compvqc x all samples
    python scripts/regenerate_precomputed_cache_live.py --presets qucad --samples bell_state
    python scripts/regenerate_precomputed_cache_live.py --base-url http://localhost:8000
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import qiskit  # noqa: E402

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
from precompute_preset_results import PRESETS  # noqa: E402

DEFAULT_BASE = "https://jqub21-quaim.hf.space"
# Cheap, torch-light presets only — see module docstring.
DEFAULT_PRESETS = "qucad,compvqc"


def _get(base: str, path: str, timeout: float = 30) -> dict:
    with urllib.request.urlopen(f"{base}/api{path}", timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _post(base: str, path: str, body: dict | None, timeout: float) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else b""
    req = urllib.request.Request(
        f"{base}/api{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _frontend_body(preset: dict, circuit_id: str) -> dict:
    """The exact JSON the frontend's Run button sends (FlowCanvas
    makeBody): id/type/data per node, id/source/target per edge,
    fresh mode (no seed, no precision_target)."""
    return {
        "circuit_id": circuit_id,
        "nodes": [
            {"id": n["id"], "type": n["type"], "data": n["data"]}
            for n in preset["nodes"]
        ],
        "edges": [
            {"id": f"e{i + 1}", "source": e["source"], "target": e["target"]}
            for i, e in enumerate(preset["edges"])
        ],
        "use_live_ibm": False,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--base-url", default=DEFAULT_BASE)
    ap.add_argument("--presets", default=DEFAULT_PRESETS)
    ap.add_argument("--samples", default=None, help="default: all bundled")
    ap.add_argument("--run-timeout", type=float, default=120.0)
    ap.add_argument(
        "--budget-seconds",
        type=float,
        default=None,
        help="stop cleanly (exit 3) before starting a combo that would "
        "exceed this wall-clock budget; re-invoke to resume",
    )
    ap.add_argument("--force", action="store_true", help="rewrite existing files")
    args = ap.parse_args()

    health = _get(args.base_url, "/health")
    live_qiskit = health.get("qiskit_version")
    if live_qiskit != qiskit.__version__:
        print(
            f"REFUSING: local qiskit {qiskit.__version__} != live {live_qiskit}.\n"
            "The cache key hashes QPY bytes, which are qiskit-version-"
            "dependent; keys computed here would never match what the "
            "deployed server computes. Install the matching version, e.g.\n"
            f"  python -m venv --system-site-packages /tmp/qk && "
            f"/tmp/qk/bin/pip install --no-deps qiskit=={live_qiskit}",
            file=sys.stderr,
        )
        return 2

    preset_keys = [k.strip() for k in args.presets.split(",") if k.strip()]
    for k in preset_keys:
        if k not in PRESETS:
            print(f"Unknown preset {k!r}. Known: {list(PRESETS)}", file=sys.stderr)
            return 2
    sample_keys = (
        [k.strip() for k in args.samples.split(",")]
        if args.samples
        else sorted(p.stem for p in SAMPLE_CIRCUITS_DIR.glob("*.qpy"))
    )

    t0 = time.time()
    done = skipped = failed = 0
    for pk in preset_keys:
        preset = PRESETS[pk]
        for sk in sample_keys:
            qc = load_sample(sk)
            nodes = [FlowNode(**n) for n in preset["nodes"]]
            edges = [FlowEdge(**e) for e in preset["edges"]]
            key = compute_cache_key(qc, nodes, edges, use_live_ibm=False)
            path = CACHE_DIR / f"{key}.json"
            tag = f"{pk} x {sk} (key={key})"
            if path.exists() and not args.force:
                print(f"skip  {tag} — file exists")
                skipped += 1
                continue
            if (
                args.budget_seconds is not None
                and time.time() - t0 > args.budget_seconds
            ):
                print(f"budget reached — resume by re-running ({tag} next)")
                return 3
            try:
                ci = _post(args.base_url, f"/circuits/samples/{sk}", None, 30)
                resp_raw = _post(
                    args.base_url,
                    "/workflow/run",
                    _frontend_body(preset, ci["circuit_id"]),
                    args.run_timeout,
                )
            except Exception as e:  # noqa: BLE001
                print(f"FAIL  {tag}: {e}", file=sys.stderr)
                failed += 1
                continue
            if resp_raw.get("from_cache"):
                # The live server already serves this key from ITS disk
                # cache (i.e. a previous regeneration was deployed).
                # Re-storing what the cache returned would be a no-op at
                # best; if the local file is missing something is
                # inconsistent — surface it instead of writing.
                print(f"skip  {tag} — live already serves from cache")
                skipped += 1
                continue
            if not resp_raw.get("ok"):
                msgs = [
                    s.get("message")
                    for s in resp_raw.get("steps", [])
                    if s.get("status") == "error"
                ]
                print(f"skip  {tag} — run not ok: {msgs}", file=sys.stderr)
                failed += 1
                continue
            ok_steps = [s for s in resp_raw["steps"] if s.get("status") == "ok"]
            if not ok_steps or "transformation" not in ok_steps[0]:
                print(
                    f"FAIL  {tag}: live response lacks transformation payload — "
                    "refusing to cache a schema-less response",
                    file=sys.stderr,
                )
                failed += 1
                continue
            response = RunResponse.model_validate(resp_raw)
            save_cached_response(key, response)
            done += 1
            print(f"wrote {tag} -> {path.name}")
    print(f"\n{done} written, {skipped} skipped, {failed} failed in {time.time() - t0:.1f}s")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
