"""Re-record frontend/src/data/demoArchive.json against the LIVE API.

Why this script exists: Wave I changed sampled fidelity's draw scheme
(one monolithic N-shot draw -> deterministic per-batch seeds derived
from the node seed). The bundled demo records advertise "replayable
bit-exact via the pinned seed"; after the scheme change their archived
numbers no longer match what a replay produces. Rather than weaken the
honesty claim, we re-run every record's graph with its ORIGINAL pinned
root seed against the deployed backend and swap in the new response —
the same way the archive was recorded in the first place. (It must be
the live Space, not a local run: the fake-backend noise models need
qiskit-ibm-runtime, which the dev sandbox doesn't ship.)

Preserved verbatim per record: run_id + circuit_id (forkedFrom edges
and record keys reference them), created_at, graph, sampleKey /
circuitName / circuitId, useLiveIbm, forkedFrom, seed_mode, root_seed.
Replaced: steps, ok, final_metrics, app_version. Same-seed replay
pairs keep their defining property automatically — same seed, same
batched draws.

RESUMABLE by design: every record is seed-pinned, so the server's
pinned step cache makes a re-request of an already-computed record
instant. The script walks records in order, updating the archive file
and a state file after each success; on a per-record timeout it exits
(the fired request keeps computing server-side) and the next
invocation picks up where it left off — run it repeatedly until it
prints ALL DONE. This shape exists because the dev sandbox caps any
one process at ~40 s.

Usage: python3 scripts/rerecord_demo_archive.py [base_url]
(default base_url: https://jqub21-quaim.hf.space)
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request
from pathlib import Path

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://jqub21-quaim.hf.space"
ARCHIVE = (
    Path(__file__).resolve().parent.parent
    / "frontend" / "src" / "data" / "demoArchive.json"
)


def _post(path: str, payload: dict | None = None, timeout: float = 240):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(payload).encode() if payload is not None else b"",
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return urllib.request.urlopen(req, timeout=timeout)


STATE = Path("/tmp/rerecord_state.json")


def main() -> None:
    entries = json.loads(ARCHIVE.read_text())
    t_start = time.time()
    start = json.loads(STATE.read_text())["done"] if STATE.exists() else 0
    # One circuit handle per sample key is enough — the server store
    # is content-addressed per upload, and runs only need a valid id.
    circuit_ids: dict[str, str] = {}
    for idx, rec in enumerate(entries):
        if idx < start:
            continue
        resp = rec["response"]
        root_seed = resp["root_seed"]
        assert root_seed is not None, f"record {idx} has no root seed"
        sk = rec["sampleKey"]
        if sk not in circuit_ids:
            with _post(f"/api/circuits/samples/{sk}", timeout=30) as r:
                circuit_ids[sk] = json.loads(r.read())["circuit_id"]
        body = {
            "circuit_id": circuit_ids[sk],
            "nodes": [
                {"id": n["i"], "type": n["k"], "data": n.get("p") or {}}
                for n in rec["graph"]["n"]
            ],
            "edges": [
                {"source": e["s"], "target": e["t"]} for e in rec["graph"]["e"]
            ],
            "use_live_ibm": False,
            "seed": int(root_seed),
        }
        try:
            with _post("/api/workflow/run", body, timeout=42) as r:
                new = json.loads(r.read())
        except Exception as exc:  # fired; server keeps computing + caches
            print(
                f"[{idx + 1}/{len(entries)}] {sk} pending "
                f"({type(exc).__name__}) — re-run the script to resume",
                flush=True,
            )
            return
        assert new["ok"], f"record {idx} re-ran with errors: {new['steps']}"
        assert new["root_seed"] == root_seed and new["seed_mode"] == "pinned"
        resp["steps"] = new["steps"]
        resp["ok"] = new["ok"]
        resp["final_metrics"] = new["final_metrics"]
        resp["app_version"] = new["app_version"]
        ARCHIVE.write_text(json.dumps(entries, separators=(",", ":")))
        STATE.write_text(json.dumps({"done": idx + 1}))
        # run_id / circuit_id deliberately NOT taken from `new` — see
        # module docstring (lineage edges reference the old run_ids).
        print(
            f"[{idx + 1}/{len(entries)}] {sk} seed={root_seed} "
            f"ok={new['ok']} ({time.time() - t_start:.1f}s elapsed)",
            flush=True,
        )
    print(f"ALL DONE — wrote {ARCHIVE} ({ARCHIVE.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
