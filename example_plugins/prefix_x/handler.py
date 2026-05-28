"""Tiny algorithm-family plugin: prepend an X gate on the chosen qubit.

Demonstrates returning a modified circuit. The new circuit propagates
to downstream blocks (Output, Fidelity, etc.) just like a built-in
algorithm block would.
"""

from __future__ import annotations

import io


def run(inputs: dict, params: dict) -> dict:
    from qiskit import QuantumCircuit, qpy

    blob = inputs.get("circuit_qpy_bytes")
    if not blob:
        return {"error": "No upstream circuit. Place this block downstream of an Input."}

    loaded = qpy.load(io.BytesIO(blob))
    qc = loaded[0] if isinstance(loaded, list) else loaded

    target = int(params.get("target_qubit", 0))
    if not (0 <= target < qc.num_qubits):
        return {
            "error": (
                f"target_qubit={target} is out of range for a "
                f"{qc.num_qubits}-qubit circuit."
            ),
        }

    new_qc = QuantumCircuit(qc.num_qubits, name="x_prefixed")
    new_qc.x(target)
    new_qc.compose(qc, inplace=True)

    out = io.BytesIO()
    qpy.dump(new_qc, out)

    return {
        "summary": {
            "target_qubit": target,
            "depth_before": qc.depth(),
            "depth_after": new_qc.depth(),
            "size_before": qc.size(),
            "size_after": new_qc.size(),
        },
        "circuit_qpy_bytes": out.getvalue(),
    }
