"""Generate the demo circuits shipped with the app.

Run once locally:

    python scripts/generate_sample_circuits.py

Outputs .qpy files into ``backend/sample_circuits/``. The FastAPI layer
auto-discovers any .qpy in that folder at startup.

Circuits are intentionally small (2-4 qubits) so the algorithms run in
seconds even on CPU-only HuggingFace Spaces.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from qiskit import QuantumCircuit, qpy
from qiskit.circuit import Parameter
from qiskit.circuit.library import EfficientSU2


REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "backend" / "sample_circuits"


def bell_state() -> QuantumCircuit:
    """The canonical 2-qubit Bell pair. Used for a 'baseline fidelity' story."""
    qc = QuantumCircuit(2, name="bell_state")
    qc.h(0)
    qc.cx(0, 1)
    return qc


def vqc_2q_small() -> QuantumCircuit:
    """Tiny 2-qubit parameterised VQC. Jovin's original test circuit."""
    qc = QuantumCircuit(2, name="vqc_2q_small")
    theta_0 = Parameter("theta_0")
    theta_1 = Parameter("theta_1")
    qc.ry(theta_0, 0)
    qc.ry(theta_1, 1)
    qc.cx(0, 1)
    return qc


def vqc_efficient_su2_4q() -> QuantumCircuit:
    """A 4-qubit EfficientSU2 ansatz (reps=2) — a common QML benchmark.

    EfficientSU2 alternates SU(2) single-qubit rotations with an entangler
    block; this is the ansatz used in many hardware-efficient VQC papers.
    """
    ansatz = EfficientSU2(num_qubits=4, reps=2, entanglement="linear")
    qc = QuantumCircuit(4, name="efficient_su2_4q")
    qc.compose(ansatz.decompose(), inplace=True)
    return qc


def qaoa_maxcut_4() -> QuantumCircuit:
    """QAOA ansatz (p=1) for Max-Cut on a 4-node ring graph.

    Edges: (0,1), (1,2), (2,3), (3,0). Standard benchmark for QAOA.
    """
    edges = [(0, 1), (1, 2), (2, 3), (3, 0)]
    gamma = Parameter("gamma")
    beta = Parameter("beta")
    qc = QuantumCircuit(4, name="qaoa_maxcut_4")

    # Initial uniform superposition
    qc.h(range(4))

    # Problem unitary: ZZ on each edge with angle 2*gamma
    for a, b in edges:
        qc.cx(a, b)
        qc.rz(2 * gamma, b)
        qc.cx(a, b)

    # Mixer unitary: X rotation on each qubit with angle 2*beta
    for q in range(4):
        qc.rx(2 * beta, q)
    return qc


def ghz_3q() -> QuantumCircuit:
    """3-qubit GHZ state; illustrates entanglement depth vs fidelity."""
    qc = QuantumCircuit(3, name="ghz_3q")
    qc.h(0)
    qc.cx(0, 1)
    qc.cx(1, 2)
    return qc


BUILDERS = [
    bell_state,
    ghz_3q,
    vqc_2q_small,
    vqc_efficient_su2_4q,
    qaoa_maxcut_4,
]


def main(argv: list[str]) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Clear stale files so this script is idempotent.
    for stale in OUT_DIR.glob("*.qpy"):
        stale.unlink()

    print(f"Writing sample circuits to {OUT_DIR.relative_to(REPO_ROOT)}/")
    for build in BUILDERS:
        qc = build()
        out_path = OUT_DIR / f"{qc.name}.qpy"
        with open(out_path, "wb") as fh:
            qpy.dump(qc, fh)
        print(
            f"  [OK] {qc.name:<20s} "
            f"qubits={qc.num_qubits} depth={qc.depth()} "
            f"params={qc.num_parameters} size={qc.size()}"
        )
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
