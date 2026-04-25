"""Small Qiskit helpers used by the pipeline.

Currently exports a single helper consumed at runtime:
``simpleFidelityEstimator``, called from
``workflow_service._handle_fidelity`` to score the output circuit
against the all-zeros state. Other utilities that used to live here
were absorbed into the service layer (circuit loading in
``app/services/circuit_service.py``; transpilation inlined at the call
site; matplotlib drawing dropped, since serving is headless).
"""

from __future__ import annotations

import logging

from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector, state_fidelity

logger = logging.getLogger(__name__)


def simpleFidelityEstimator(qc: QuantumCircuit) -> float:
    """Compute ``<0...0|U|0...0>`` for the given circuit.

    Strips any final measurements (``Statevector`` can't handle them),
    evolves the all-zeros state through ``qc``, and returns the fidelity
    against ``|0...0>``. Good enough for the demo's "did the circuit
    stay close to its noiseless target" sanity check, though obviously
    not representative of arbitrary target states.
    """
    qc = qc.remove_final_measurements(inplace=False)
    final_state = Statevector.from_instruction(qc)
    target_state = Statevector.from_label("0" * qc.num_qubits)
    fidelity = state_fidelity(final_state, target_state)
    logger.debug("simpleFidelityEstimator: fidelity=%.6f", fidelity)
    return float(fidelity)
