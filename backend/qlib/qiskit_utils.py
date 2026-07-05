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

import hashlib
import logging
import math

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


# --- anytime evidence: batched sampling --------------------------------------
#
# Sampled fidelity no longer runs as one monolithic N-shot draw: shots
# are split into deterministic batches so the estimate (and its Wilson
# interval) can be reported to the caller after EVERY batch. That is
# what makes the interface's live-narrowing CI and optional stopping
# ("stop at +/-2pp") possible. The batch plan and the per-batch seeds
# depend only on (shots, node seed) — never on where a previous run
# stopped — so a pinned replay that runs k batches reproduces the same
# first k draws bit-exactly regardless of the original run's stopping
# point.


def wilson_interval_95(successes: int, n: int) -> tuple[float, float]:
    """95% Wilson score interval for a binomial proportion.

    Deliberate DUPLICATE of ``app.services.stats.wilson_interval``:
    qlib is the dependency-free library layer and must not import
    ``app.*`` (the app imports qlib, never the reverse). Duplicating a
    ~10-line pure function was judged cheaper than threading a
    ``ci_fn`` parameter through every call site; a unit test
    (tests/test_anytime_evidence.py) pins the two implementations to
    identical outputs so they cannot drift silently.
    """
    z = 1.959963984540054
    if n <= 0:
        return (0.0, 1.0)
    k = max(0, min(int(successes), int(n)))
    p = k / n
    z2 = z * z
    denom = 1.0 + z2 / n
    centre = (p + z2 / (2 * n)) / denom
    half = (z / denom) * math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))
    return (max(0.0, centre - half), min(1.0, centre + half))


def derive_batch_seed(seed: int, batch_i: int) -> int:
    """Per-batch simulator seed, derived from the step's node seed.

    Mirrors the app's ``derive_node_seed`` construction (sha256 of a
    colon-joined string, first 4 bytes, mod 2**31): deterministic,
    order-independent, and 31-bit so it fits Aer's ``seed_simulator``.
    Batch i's seed never depends on batch j or on how many batches end
    up executing — the property that makes early-stopped runs replay
    bit-exactly.
    """
    digest = hashlib.sha256(f"{seed}:batch:{batch_i}".encode()).digest()
    return int.from_bytes(digest[:4], "big") % (2**31)


def plan_batches(shots: int) -> list[int]:
    """Split ``shots`` into the batch sizes the estimator will run.

    B = min(8, max(2, shots // 128)): small shot counts still get 2
    batches (so the CI visibly narrows at least once and the min-2-
    batches stopping rule is meaningful), large ones cap at 8 (progress
    events stay cheap; each batch is one Aer invocation and per-call
    overhead is nontrivial). Remainder shots go to the earliest
    batches so sizes differ by at most 1. Deterministic in ``shots``
    alone — part of the replay contract.
    """
    shots = int(shots)
    if shots <= 0:
        return []
    n_batches = min(8, max(2, shots // 128))
    n_batches = max(1, min(n_batches, shots))  # never a 0-shot batch
    base, rem = divmod(shots, n_batches)
    return [base + (1 if i < rem else 0) for i in range(n_batches)]


def sampledFidelityEstimator(
    qc: QuantumCircuit,
    backend,
    shots: int,
    *,
    unbound_param_policy: str = "bind_zero",
    seed: int | None = None,
    progress_cb=None,
    precision_target: float | None = None,
) -> tuple[float, dict]:
    """Run the circuit on ``backend`` (which carries the noise model)
    with ``shots`` measurements, return the observed |0…0⟩
    probability as a fidelity estimate.

    Differs from ``simpleFidelityEstimator`` in two ways:
      * Honours the noisy backend's noise model.
      * Has shot noise — the value will jitter run-to-run.

    Returns ``(fidelity, meta)``; meta documents shots, the backend
    name, and any binding/measurement transformations.

    Anytime-evidence parameters:

    ``progress_cb``
        Called after every completed shot batch with a dict
        ``{batch_i, n_batches, shots_done, successes, point, ci95}``
        (``batch_i`` is 1-based = batches completed so far; ``ci95``
        is the Wilson 95% interval over ALL shots so far). Exceptions
        from the callback propagate — the caller owns its channel.

    ``precision_target``
        Optional-stopping rule, in absolute fidelity units: stop as
        soon as the CI half-width — defined as ``(hi - lo) / 2``
        because Wilson is asymmetric near 0/1 — is <= the target,
        but never before 2 batches have run (a 1-batch "CI" would
        reward tiny pilots with fake precision). ``meta["shots"]``
        then reflects the shots actually executed and
        ``meta["stopped_early"]`` is True.
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

    # Batched execution. Always batched — even without a progress
    # consumer or a target — so that fresh runs, streamed runs and
    # pinned replays all draw from the identical seed schedule. (This
    # supersedes the pre-Wave-I single-draw scheme; meta["seed_scheme"]
    # marks payloads produced by the new schedule so old archived runs
    # can be told apart.)
    batch_sizes = plan_batches(int(shots))
    n_batches = len(batch_sizes)
    zero_key = "0" * qc.num_qubits
    counts_total: dict[str, int] = {}
    shots_done = 0
    successes = 0
    batches_done = 0
    stopped_early = False
    trace: list[dict] = []

    if seed is not None:
        meta["seed"] = int(seed)
        meta["seed_scheme"] = "batch-sha256-v1"

    for i, batch_shots in enumerate(batch_sizes):
        run_kwargs: dict = {"shots": int(batch_shots)}
        if seed is not None:
            run_kwargs["seed_simulator"] = derive_batch_seed(int(seed), i)
        counts = sim.run(transpiled, **run_kwargs).result().get_counts()
        for key, v in counts.items():
            counts_total[key] = counts_total.get(key, 0) + int(v)
        shots_done += int(batch_shots)
        successes = int(counts_total.get(zero_key, 0))
        lo, hi = wilson_interval_95(successes, shots_done)
        batches_done = i + 1
        snap = {
            "batch_i": batches_done,
            "n_batches": n_batches,
            "shots_done": shots_done,
            "successes": successes,
            "point": float(successes) / float(shots_done),
            "ci95": [lo, hi],
        }
        trace.append(snap)
        if progress_cb is not None:
            progress_cb(dict(snap))
        # Optional stopping: evidence is precise enough, stop paying
        # for shots. Guarded by min-2-batches; if the target is only
        # met on the final batch nothing was saved, so it is not
        # flagged as an early stop.
        if (
            precision_target is not None
            and batches_done >= 2
            and batches_done < n_batches
            and (hi - lo) / 2.0 <= float(precision_target)
        ):
            stopped_early = True
            break

    fidelity = float(successes) / float(max(1, shots_done))
    meta["shots"] = shots_done  # shots actually executed
    meta["shots_requested"] = int(shots)
    meta["n_batches_planned"] = n_batches
    meta["n_batches_done"] = batches_done
    meta["stopped_early"] = stopped_early
    if precision_target is not None:
        meta["precision_target"] = float(precision_target)
    meta["observed_zero_counts"] = successes
    # Cumulative per-batch evidence trajectory — the raw material for
    # the interface's "evidence funnel". Kept in meta (and forwarded
    # into the step's distribution payload) so an ARCHIVED run still
    # carries its full narrowing history, not just the final interval.
    meta["batch_trace"] = trace
    # Compact histogram material for the frontend's distribution view:
    # top outcomes by count (capped so the payload stays small even for
    # wide circuits) plus how many distinct outcomes were observed.
    top = sorted(counts_total.items(), key=lambda kv: (-kv[1], kv[0]))[:16]
    meta["counts_top"] = {k: int(v) for k, v in top}
    meta["distinct_outcomes"] = len(counts_total)
    logger.debug("sampledFidelityEstimator: fidelity=%.6f meta=%s", fidelity, meta)
    return fidelity, meta
