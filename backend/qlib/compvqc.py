"""CompressVQC implementation (refactored from Jovin Antony Maria's original).

Algorithm overview: replace each parameterised rotation gate with the
"best" angle from a small discrete grid, chosen by solving a QUBO that
trades off (a) how far the chosen angle is from the original and
(b) how much transpiled depth the discrete choice costs on the target
backend. The QUBO is solved via QAOA + COBYLA.

The module exposes four functions consumed by
``app/services/workflow_service.py``:
:func:`get_LUT`, :func:`quadraticProgram_luttoqp`,
:func:`admmOptimizedCompVQC`, :func:`resultsCompressVQC`.
"""

from __future__ import annotations

import logging
from types import SimpleNamespace
from typing import Any

import numpy as np
from qiskit import QuantumCircuit, qasm3, qpy, transpile
from qiskit.circuit import Parameter, ParameterExpression
from qiskit.circuit.library import RYGate
from qiskit.primitives import StatevectorSampler
from qiskit_algorithms import QAOA
from qiskit_algorithms.optimizers import COBYLA
from qiskit_ibm_runtime.fake_provider import FakeFez
from qiskit_optimization.algorithms import MinimumEigenOptimizer
from qiskit_optimization.converters import QuadraticProgramToQubo
from qiskit_optimization.problems import QuadraticProgram

logger = logging.getLogger(__name__)


# ---- Hyperparameters ---------------------------------------------------

VQC_GATE_TYPES: tuple[str, ...] = ("ry", "rx", "rz", "p")
"""Parameterised single-qubit rotation gate names considered for
replacement. CX and other entanglers are left untouched."""

DEFAULT_THETA_GRID: tuple[float, ...] = (
    0.0,
    np.pi / 2,
    np.pi,
    3 * np.pi / 2,
    2 * np.pi,
)
"""Discrete angles each parameterised gate can be snapped to. Five
candidates keeps the QUBO small; denser grids blow up QAOA runtime."""

LAMBDA_PENALTY = 0.1
"""QP coefficient on transpiled-depth cost (vs. angle-distance cost)."""

COBYLA_MAXITER = 4
"""Inner-loop COBYLA iterations inside QAOA. Intentionally small —
CompressVQC runs at demo latency budgets, not research-grade accuracy."""

THETA_ID_SCALE = 1000
"""Scale factor used to encode angles as stable integer IDs in QP
variable names (avoids float formatting round-tripping)."""

DECISION_THRESHOLD = 0.5
"""Binary-variable cutoff when reading the QAOA solution back."""


# ---- Step 1: per-gate depth LUT ---------------------------------------


def get_gates_to_map(qc: QuantumCircuit) -> set[str]:
    """Return the set of parameterised rotation-gate names actually
    present in ``qc`` (a subset of :data:`VQC_GATE_TYPES`)."""
    gates_to_map: set[str] = set()
    for instruction in qc.data:
        if instruction.operation.name in VQC_GATE_TYPES:
            gates_to_map.add(instruction.operation.name)
    logger.info("Targeting gates: %s", sorted(gates_to_map))
    return gates_to_map


def get_LUT(qc: QuantumCircuit, backend: Any) -> dict[str, dict[float, int]]:
    """Build a ``{gate_name: {theta: transpiled_depth}}`` lookup table.

    For each candidate (gate, θ) pair, place the gate on a fresh
    two-qubit scratch circuit, transpile against ``backend``, and
    record the resulting depth. Used later as the QUBO's depth-cost
    term.
    """
    gates_to_map = get_gates_to_map(qc)
    lut: dict[str, dict[float, int]] = {}

    for gate in gates_to_map:
        lut[gate] = {}
        for theta in DEFAULT_THETA_GRID:
            test_qc = QuantumCircuit(2)
            if gate == "rx":
                test_qc.rx(theta, 0)
            elif gate == "ry":
                test_qc.ry(theta, 0)
            elif gate == "rz":
                test_qc.rz(theta, 0)
            elif gate == "p":
                test_qc.p(theta, 0)

            transpiled_qc = transpile(test_qc, backend=backend, optimization_level=1)
            lut[gate][round(theta, 3)] = transpiled_qc.depth()

    logger.debug("Depth LUT: %s", lut)
    return lut


# ---- Step 2: LUT → QuadraticProgram -----------------------------------


def qaoa_callback(eval_count: int, parameters: Any, value: float, metadata: Any) -> None:
    """Progress callback for the inner QAOA optimisation."""
    logger.info("QAOA eval %d: energy %.6f", eval_count, value)


def quadraticProgram_luttoqp(
    qc: QuantumCircuit, lut: dict[str, dict[float, int]]
) -> QuadraticProgram:
    """Encode the per-gate angle-selection problem as a linear QP:
    one binary variable per (gate_index, candidate_theta), minimising
    (θ - original)² + λ · depth under "exactly one candidate per gate"
    constraints."""
    qp = QuadraticProgram("CompressVQC")
    obj_dict: dict[str, float] = {}

    for i, instruction in enumerate(qc.data):
        gate = instruction.operation
        if gate.name not in lut:
            continue

        p_val = gate.params[0]
        # Parameterised placeholders have no concrete value yet — fall
        # back to 0.5 so the optimiser can still prefer "middle" angles.
        original_val = (
            float(p_val)
            if not isinstance(p_val, (Parameter, ParameterExpression))
            else 0.5
        )

        gate_var_names: list[str] = []
        for theta_lut, depth in lut[gate.name].items():
            theta_id = int(round(theta_lut * THETA_ID_SCALE))
            var_name = f"gate_{i}_{gate.name}_{theta_id}"
            qp.binary_var(name=var_name)
            gate_var_names.append(var_name)

            obj_dict[var_name] = (theta_lut - original_val) ** 2 + (LAMBDA_PENALTY * depth)

        qp.linear_constraint(
            linear={name: 1 for name in gate_var_names},
            sense="==",
            rhs=1,
        )

    qp.minimize(linear=obj_dict)
    return qp


# ---- Step 3: QAOA-solve the QUBO --------------------------------------


def admmOptimizedCompVQC(qp: QuadraticProgram) -> SimpleNamespace:
    """Solve ``qp`` via QAOA on a state-vector simulator and return a
    duck-typed object exposing ``variables_dict`` (mapping each binary
    variable back to its chosen 0/1 value). Returning
    :class:`SimpleNamespace` rather than the raw
    :class:`qiskit_optimization.algorithms.OptimizationResult` keeps
    the downstream consumer loose-coupled.
    """
    sampler = StatevectorSampler()
    optimizer = COBYLA(maxiter=COBYLA_MAXITER)

    qaoa = QAOA(
        sampler=sampler,
        optimizer=optimizer,
        callback=qaoa_callback,
    )

    conv = QuadraticProgramToQubo()
    qubo = conv.convert(qp)

    min_eigen = MinimumEigenOptimizer(qaoa)
    result = min_eigen.solve(qubo)

    # Convert QUBO solution back into original variable space.
    original_x = conv.interpret(result.x)

    variables_dict: dict[str, float] = {
        var.name: original_x[i] for i, var in enumerate(qp.variables)
    }
    return SimpleNamespace(variables_dict=variables_dict)


# ---- Step 4: rebuild circuit from chosen angles -----------------------


def resultsCompressVQC(result: SimpleNamespace, original_qc: QuantumCircuit) -> QuantumCircuit:
    """Walk ``original_qc`` and, for every ``ry`` gate, swap in the
    candidate angle that the QAOA solution marked as "chosen"
    (variable value above :data:`DECISION_THRESHOLD`). Non-``ry`` gates
    pass through unchanged.

    Currently only ``ry`` is rewritten — the QP is built over all four
    rotation types but the rebuild step here conservatively only acts
    on ``ry``; extending it to the others is straightforward if the
    underlying demo circuits ever use them.
    """
    compressed_qc = QuantumCircuit(*original_qc.qregs, *original_qc.cregs)

    for i, instr in enumerate(original_qc.data):
        gate = instr.operation
        qargs = instr.qubits
        cargs = instr.clbits

        new_gate = gate

        if gate.name == "ry":
            for var_name, var_value in result.variables_dict.items():
                if var_value > DECISION_THRESHOLD and var_name.startswith(f"gate_{i}_ry_"):
                    theta_id = int(var_name.split("_")[-1])
                    new_theta = theta_id / THETA_ID_SCALE
                    new_gate = RYGate(new_theta)

        compressed_qc.append(new_gate, qargs, cargs)

    # NOTE: we deliberately do NOT transpile the compressed circuit
    # here. Doing the obvious ``transpile(..., basis_gates=['sx', 'rz',
    # 'cx', 'id'], optimization_level=3)`` would move the compression
    # benefit into the transpiler's pocket and make before/after
    # comparisons confusing. The service layer handles backend-specific
    # transpilation at the point where it's needed.
    return compressed_qc


# ---- Sample VQC generator (used by precompute / ad-hoc testing) --------


def gen_example_vqc(out_path: str | None = None) -> QuantumCircuit:
    """Build a tiny 2-qubit example VQC with symbolic parameters.
    If ``out_path`` is given, additionally dump it as OpenQASM 3."""
    qc = QuantumCircuit(2)
    theta_0 = Parameter("theta_0")
    theta_1 = Parameter("theta_1")
    qc.ry(theta_0, 0)
    qc.ry(theta_1, 1)
    qc.cx(0, 1)

    if out_path is not None:
        with open(out_path, "w") as f:
            qasm3.dump(qc, f)
        logger.info("Wrote example VQC to %s", out_path)
    return qc


if __name__ == "__main__":
    # Minimal CLI entry for ad-hoc testing outside the web app.
    # Expects one environment variable:
    #   COMPVQC_QPY_FILE  - path to a .qpy file holding the VQC to compress
    import os

    logging.basicConfig(level=logging.INFO)

    qpy_path = os.environ["COMPVQC_QPY_FILE"]
    with open(qpy_path, "rb") as f:
        qc = qpy.load(f)[0]

    logger.info("Input circuit:\n%s", qc)

    backend = FakeFez()
    lut = get_LUT(qc, backend)
    qp = quadraticProgram_luttoqp(qc, lut)
    result = admmOptimizedCompVQC(qp)
    compressed_qc = resultsCompressVQC(result, qc)

    logger.info("==== COMPRESSED CIRCUIT ====\n%s", compressed_qc)
