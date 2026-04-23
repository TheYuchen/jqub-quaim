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


def w_state_3q() -> QuantumCircuit:
    """3-qubit W state.

    W-state entanglement is robust to qubit loss; a didactic contrast to
    GHZ. Built via the standard RY + controlled-RY + CX construction.
    """
    qc = QuantumCircuit(3, name="w_state_3q")
    theta0 = 2.0 * np.arccos(1.0 / np.sqrt(3.0))
    qc.ry(theta0, 0)
    qc.x(0)
    qc.cry(2.0 * np.arccos(1.0 / np.sqrt(2.0)), 0, 1)
    qc.x(0)
    qc.cx(1, 2)
    qc.cx(0, 1)
    qc.x(0)
    return qc


def qft_3q() -> QuantumCircuit:
    """3-qubit Quantum Fourier Transform.

    Core building block of Shor, phase estimation, and many quantum signal
    algorithms. Non-parameterized, so CompressVQC + Fidelity show clear
    before/after results on it.
    """
    qc = QuantumCircuit(3, name="qft_3q")
    qc.h(0)
    qc.cp(np.pi / 2, 0, 1)
    qc.cp(np.pi / 4, 0, 2)
    qc.h(1)
    qc.cp(np.pi / 2, 1, 2)
    qc.h(2)
    qc.swap(0, 2)
    return qc


def ry_chain_6q() -> QuantumCircuit:
    """6-qubit RY chain — a bigger VQC for QuCAD to sparsify.

    Two RY layers (12 params total) and a linear CX chain between them.
    Gives QuCAD enough parameters that its sparsity trace moves visibly
    over the 3 default ADMM iterations.
    """
    qc = QuantumCircuit(6, name="ry_chain_6q")
    params_a = [Parameter(f"a_{i}") for i in range(6)]
    params_b = [Parameter(f"b_{i}") for i in range(6)]
    for i, p in enumerate(params_a):
        qc.ry(p, i)
    for i in range(5):
        qc.cx(i, i + 1)
    for i, p in enumerate(params_b):
        qc.ry(p, i)
    return qc


def hardware_efficient_4q() -> QuantumCircuit:
    """4-qubit hardware-efficient ansatz.

    Three layers of RY+RZ on each qubit, interleaved with linear CX
    entanglers. A classic warm-start ansatz for VQE / VQC on
    superconducting hardware.
    """
    qc = QuantumCircuit(4, name="hardware_efficient_4q")
    layers = 3
    for L in range(layers):
        for q in range(4):
            qc.ry(Parameter(f"ry_{L}_{q}"), q)
            qc.rz(Parameter(f"rz_{L}_{q}"), q)
        if L < layers - 1:
            for i in range(3):
                qc.cx(i, i + 1)
    return qc


# Ordered from smallest/simplest (top of list) to largest — this is the
# order the circuit picker displays in the UI.
BUILDERS = [
    bell_state,
    ghz_3q,
    w_state_3q,
    vqc_2q_small,
    qft_3q,
    qaoa_maxcut_4,
    vqc_efficient_su2_4q,
    hardware_efficient_4q,
    ry_chain_6q,
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
