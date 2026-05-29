"""Tiny metric-family plugin: tally gate types in the current circuit.

Demonstrates:
  * Reading the upstream circuit from inputs.
  * Returning the basic ``summary`` + ``scalars`` for the KV table.
  * Emitting a typed ``figures`` list — markdown narrative + a bar
    chart — so the result card renders rich output instead of just a
    flat dict.
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

    # Sort bars by descending count for a more readable chart.
    sorted_ops = sorted(ops.items(), key=lambda kv: kv[1], reverse=True)
    bar_data = [{"label": name, "value": int(count)} for name, count in sorted_ops]

    # Build a short markdown narrative summarising the result. Plugin
    # authors get a place to write 1-2 sentences of "what this means".
    narrative = (
        f"The circuit has **{qc.num_qubits} qubits** at depth "
        f"**{qc.depth()}**, with **{total} total gates** across "
        f"**{len(ops)} distinct gate types**."
    )

    return {
        "summary": {
            "num_qubits": qc.num_qubits,
            "depth": qc.depth(),
            "total_gates": total,
        },
        "scalars": {"total_gates": total},
        "figures": [
            {
                "type": "markdown",
                "title": "Analysis",
                "content": narrative,
            },
            {
                "type": "bar",
                "title": "Gates by type",
                "x_label": "Gate",
                "y_label": "Count",
                "data": bar_data,
            },
            {
                "type": "table",
                "title": "Raw counts",
                "headers": ["gate", "count"],
                "rows": [[name, int(count)] for name, count in sorted_ops],
            },
        ],
    }
