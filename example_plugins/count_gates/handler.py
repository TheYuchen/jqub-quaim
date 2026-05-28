"""Tiny metric-family plugin: tally gate types in the current circuit.

Demonstrates the minimal handler contract: read the upstream circuit
from inputs, compute something, return a dict with a `summary` and
maybe `scalars`.
"""

from __future__ import annotations

import io


def run(inputs: dict, params: dict) -> dict:
    from qiskit import qpy

    blob = inputs.get("circuit_qpy_bytes")
    if not blob:
        return {"error": "No upstream circuit. Place this block downstream of an Input."}

    loaded = qpy.load(io.BytesIO(blob))
    qc = loaded[0] if isinstance(loaded, list) else loaded

    ops = dict(qc.count_ops())
    if params.get("include_barriers", "yes") == "no":
        ops.pop("barrier", None)

    total = sum(int(v) for v in ops.values())
    return {
        "summary": {
            "num_qubits": qc.num_qubits,
            "depth": qc.depth(),
            "total_gates": total,
            "by_gate": ops,
        },
        "scalars": {"total_gates": total},
    }
