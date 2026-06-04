"""Small Qiskit helpers used by the pipeline.

The Fidelity step calls these:

  ``simpleFidelityEstimator``       — noiseless ⟨0…0|U|0…0⟩ via Statevector.
                                      The "ground truth" reference: what
                                      the circuit WOULD give without noise.
  ``sampledFidelityEstimator``      — bind parameters, transpile to the
                                      noisy backend, run N shots, observe
                                      the |0…0⟩ count fraction. Reflects
                                      the actual noise model + finite-shot
                                      uncertainty the user would see on
                                      hardware.

Both helpers handle parameterised circuits gracefully — unbound parameters
are bound to zero by default (the same convention QuBound uses internally),
with the option to refuse instead. The handler in workflow_service decides
the policy from the user's param choices.

Other utilities that used to live here were absorbed into the service
layer (circuit loading in ``app/services/circuit_service.py``;
transpilation inlined at the call site; matplotlib drawing dropped, since
serving is headless).
"""

from __future__ import annotations

import logging

from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import Statevector, state_fidelity

logger = logging.getLogger(__name__)


class UnboundParametersError(ValueError):
    """Raised when a fidelity estimator is asked to operate on a
    circuit with free parameters and the policy forbids auto-binding.
    The workflow handler maps this to an actionable, user-facing
    error message naming the parameters and pointing at the policy
    option."""


def _bind_unbound_to_zero(qc: QuantumCircuit) -> tuple[QuantumCircuit, int]:
    """If ``qc`` has free parameters, bind them all to 0 and return
    ``(new_circuit, n_bound)``. Otherwise return the circuit unchanged
    with ``n_bound = 0``."""
    if qc.num_parameters == 0:
        return qc, 0
    n = qc.num_parameters
    return qc.assign_parameters([0.0] * n), n


def simpleFidelityEstimator(
    qc: QuantumCircuit,
    *,
    unbound_param_policy: str = "bind_zero",
) -> tuple[float, dict]:
    """Compute ``|⟨0…0|U|0…0⟩|²`` for the given circuit.

    Strips any final measurements (``Statevector`` can't handle them),
    evolves the all-zeros state through ``qc``, and returns the
    fidelity against ``|0…0⟩``. Returns ``(fidelity, meta)`` where
    ``meta`` documents anything we had to do to the circuit
    (parameter binding, measurement stripping) so the caller can
    surface those decisions in the UI.

    ``unbound_param_policy``:
      * ``"bind_zero"`` (default) — silently bind any free parameters
        to zero. Matches QuBound's convention.
      * ``"error"``    — raise ``UnboundParametersError`` so the
        handler can surface an actionable error to the user.
    """
    meta: dict = {"method": "statevector"}

    qc = qc.remove_final_measurements(inplace=False)

    if qc.num_parameters > 0:
        if unbound_param_policy == "error":
            raise UnboundParametersError(
                f"Circuit has {qc.num_parameters} unbound parameters "
                "(e.g. ry_chain_6q's a_0..b_5). Either bind them in the "
                "Input block, place an upstream algorithm that binds "
                "them, or set Fidelity's `unbound_param_policy` to "
                "`bind_zero`."
            )
        qc, n_bound = _bind_unbound_to_zero(qc)
        meta["bound_unbound_to_zero"] = n_bound

    final_state = Statevector.from_instruction(qc)
    target_state = Statevector.from_label("0" * qc.num_qubits)
    fidelity = state_fidelity(final_state, target_state)
    logger.debug("simpleFidelityEstimator: fidelity=%.6f meta=%s", fidelity, meta)
    return float(fidelity), meta


def sampledFidelityEstimator(
    qc: QuantumCircuit,
    backend,
    shots: int,
    *,
    unbound_param_policy: str = "bind_zero",
) -> tuple[float, dict]:
    """Run the circuit on ``backend`` (which carries the noise model)
    with ``shots`` measurements, return the observed |0…0⟩
    probability as a fidelity estimate.

    Differs from ``simpleFidelityEstimator`` in two ways:
      * Honours the noisy backend's noise model.
      * Has shot noise — the value will jitter run-to-run.

    Returns ``(fidelity, meta)``; meta documents shots, the backend
    name, and any binding/measurement transformations.
    """
    from qiskit_aer import AerSimulator  # local import to keep cold start fast

    meta: dict = {
        "method": "sampled",
        "shots": int(shots),
    }

    # 1. Remove user-supplied final measurements; we re-add a canonical
    #    measure_all so the histogram is keyed on classical bits in
    #    qubit order.
    qc = qc.remove_final_measurements(inplace=False)

    # 2. Bind / refuse on unbound params (same policy as statevector).
    if qc.num_parameters > 0:
        if unbound_param_policy == "error":
            raise UnboundParametersError(
                f"Circuit has {qc.num_parameters} unbound parameters. "
                "Bind them upstream or set Fidelity's "
                "`unbound_param_policy` to `bind_zero`."
            )
        qc, n_bound = _bind_unbound_to_zero(qc)
        meta["bound_unbound_to_zero"] = n_bound

    # 3. Add measurements on all qubits.
    qc = qc.copy()
    qc.measure_all()

    # 4. Pick a simulator. If `backend` is a Qiskit Aer fake backend
    #    object, AerSimulator.from_backend gives us that backend's
    #    calibrated noise model. Otherwise (or on failure) fall back
    #    to noiseless AerSimulator.
    try:
        sim = AerSimulator.from_backend(backend) if backend is not None else AerSimulator()
        meta["backend_name"] = getattr(backend, "name", None) or "noiseless"
    except Exception:
        # E.g. backend is a string or an unsupported type — silent
        # fallback to noiseless is informative enough at this point.
        sim = AerSimulator()
        meta["backend_name"] = "noiseless"
        meta["backend_fallback"] = True

    transpiled = transpile(qc, sim, optimization_level=0)
    counts = sim.run(transpiled, shots=int(shots)).result().get_counts()

    # 5. Observed |0…0⟩ probability. Qiskit reports bits as a string
    #    with classical-bit indexing; the all-zeros string is the
    #    same regardless of bit order.
    zero_key = "0" * qc.num_qubits
    n_zero = counts.get(zero_key, 0)
    fidelity = float(n_zero) / float(int(shots))
    meta["observed_zero_counts"] = int(n_zero)
    logger.debug("sampledFidelityEstimator: fidelity=%.6f meta=%s", fidelity, meta)
    return fidelity, meta
