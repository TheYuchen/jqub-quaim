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


# --- device noise-model memoization -----------------------------------------
# ``AerSimulator.from_backend`` / ``NoiseModel.from_backend`` rebuild the
# full device noise model from calibration data on EVERY call — for the
# 100+ qubit Fake* snapshots that is tens of seconds of mostly
# GIL-bound Python, and it dominated every sampled-fidelity and QuCAD
# step (each fresh run paid ~40-90 s just to re-derive an identical
# model). Fake backends carry a frozen calibration snapshot shipped
# with qiskit-ibm-runtime, so the derived model is immutable for the
# process lifetime and safe to memoize by backend name. Live IBM
# backends are deliberately NEVER cached here: their calibration is
# fetched fresh and drifts between fetches.
#
# Consumers treat the returned objects as read-only: the simulator is
# only used for ``transpile(qc, sim)`` + ``sim.run(...)`` (per-call
# kwargs, no ``set_options``), and QuCAD passes the noise model into
# Aer run options untouched.

_FAKE_MODEL_CACHE_MAX = 4  # one per fake backend the UI exposes
_AER_SIM_CACHE: dict = {}
_NOISE_MODEL_CACHE: dict = {}


def _is_static_fake_backend(backend) -> bool:
    """True for qiskit-ibm-runtime Fake* snapshot backends only."""
    return type(backend).__name__.startswith("Fake")


def _memo_get(cache: dict, backend, build):
    name = str(getattr(backend, "name", "") or type(backend).__name__)
    obj = cache.get(name)
    if obj is None:
        obj = build()
        while len(cache) >= _FAKE_MODEL_CACHE_MAX:
            cache.pop(next(iter(cache)))
        cache[name] = obj
    return obj


def aer_simulator_for(backend):
    """``AerSimulator.from_backend`` memoized for Fake* backends."""
    from qiskit_aer import AerSimulator

    if backend is None:
        return AerSimulator()
    if not _is_static_fake_backend(backend):
        return AerSimulator.from_backend(backend)
    return _memo_get(
        _AER_SIM_CACHE, backend, lambda: AerSimulator.from_backend(backend)
    )


def noise_model_for(backend):
    """``NoiseModel.from_backend`` memoized for Fake* backends."""
    from qiskit_aer.noise import NoiseModel

    if not _is_static_fake_backend(backend):
        return NoiseModel.from_backend(backend)
    return _memo_get(
        _NOISE_MODEL_CACHE, backend, lambda: NoiseModel.from_backend(backend)
    )


def sampledFidelityEstimator(
    qc: QuantumCircuit,
    backend,
    shots: int,
    *,
    unbound_param_policy: str = "bind_zero",
    seed: int | None = None,
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
        sim = aer_simulator_for(backend)
        meta["backend_name"] = (
            getattr(backend, "name", None) or "noiseless"
        ) if backend is not None else "noiseless"
    except Exception:
        # E.g. backend is a string or an unsupported type — silent
        # fallback to noiseless is informative enough at this point.
        sim = AerSimulator()
        meta["backend_name"] = "noiseless"
        meta["backend_fallback"] = True

    transpiled = transpile(qc, sim, optimization_level=0)
    run_kwargs: dict = {"shots": int(shots)}
    if seed is not None:
        # Pinning the simulator seed makes this draw exactly
        # reproducible — the backbone of "replay this historical run".
        run_kwargs["seed_simulator"] = int(seed)
        meta["seed"] = int(seed)
    counts = sim.run(transpiled, **run_kwargs).result().get_counts()

    # 5. Observed |0…0⟩ probability. Qiskit reports bits as a string
    #    with classical-bit indexing; the all-zeros string is the
    #    same regardless of bit order.
    zero_key = "0" * qc.num_qubits
    n_zero = counts.get(zero_key, 0)
    fidelity = float(n_zero) / float(int(shots))
    meta["observed_zero_counts"] = int(n_zero)
    # Compact histogram material for the frontend's distribution view:
    # top outcomes by count (capped so the payload stays small even for
    # wide circuits) plus how many distinct outcomes were observed.
    top = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:16]
    meta["counts_top"] = {k: int(v) for k, v in top}
    meta["distinct_outcomes"] = len(counts)
    logger.debug("sampledFidelityEstimator: fidelity=%.6f meta=%s", fidelity, meta)
    return fidelity, meta
