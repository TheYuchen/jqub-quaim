"""One-time fetch of 14-day IBM backend noise history for QuBound.

Run:

    IBM_QUANTUM_TOKEN=... python scripts/fetch_ibm_history.py

Writes a pickled dict to ``backend/cache/ibm_history/<backend>.pkl`` of the
form::

    {
      "backend_name": "ibm_fez",
      "fetched_at": "2026-04-23T00:00:00",
      "days": [
          {"date": "YYYY-MM-DD", "properties": <BackendProperties>},
          ...
      ],
    }

QuBound loads this pickle offline instead of hitting the live IBM API at
demo time.
"""

from __future__ import annotations

import argparse
import os
import pickle
import sys
from datetime import datetime, timedelta
from pathlib import Path

from qiskit_ibm_runtime import QiskitRuntimeService


REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = REPO_ROOT / "backend" / "cache" / "ibm_history"


def fetch_history(*, token: str, backend_name: str, look_back_days: int) -> dict:
    print(f"[fetch] Opening QiskitRuntimeService with plans=['open'] ...")
    service = QiskitRuntimeService(
        channel="ibm_quantum_platform",
        token=token,
        plans_preference=["open"],
    )
    print(f"[fetch] Using backend: {backend_name}")
    backend = service.backend(backend_name)

    days = []
    today = datetime.now()
    for i in range(look_back_days, 0, -1):
        target_date = today - timedelta(days=i)
        props = backend.properties(datetime=target_date)
        if props is None:
            print(f"  [WARN] no properties returned for {target_date.date()}")
            continue
        days.append({
            "date": target_date.strftime("%Y-%m-%d"),
            "properties": props,
        })
        print(f"  [OK] {target_date.date()}  last_update={props.last_update_date}")

    return {
        "backend_name": backend_name,
        "fetched_at": datetime.now().isoformat(),
        "days": days,
    }


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--backend", default="ibm_fez")
    p.add_argument("--days", type=int, default=14, help="Number of days of history to fetch.")
    p.add_argument(
        "--token",
        default=os.environ.get("IBM_QUANTUM_TOKEN"),
        help="IBM Quantum Platform API token; falls back to IBM_QUANTUM_TOKEN env var.",
    )
    args = p.parse_args(argv)

    if not args.token:
        print("ERROR: no IBM token provided (flag --token or env IBM_QUANTUM_TOKEN)", file=sys.stderr)
        return 2

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    payload = fetch_history(token=args.token, backend_name=args.backend, look_back_days=args.days)

    out_path = CACHE_DIR / f"{args.backend}.pkl"
    with open(out_path, "wb") as fh:
        pickle.dump(payload, fh)
    kb = out_path.stat().st_size / 1024
    print(f"[fetch] Wrote {len(payload['days'])} day(s) to {out_path.relative_to(REPO_ROOT)} ({kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
