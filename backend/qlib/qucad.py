"""QuCAD implementation (refactored from Jovin Antony Maria's original).

Algorithm overview: train a VQC's parameters with an ADMM-style
soft-thresholding step that pushes near-zero weights exactly to zero
— producing a compact mask of "useful" parameters. Together with
per-qubit noise features and K-means clustering, this gives a look-up
table that selects the best qubit mapping for deployment on a drifting
device.

The only entry point used by the web app is
:func:`run_qucad_training_noisy`. The LUT + deployment functions are
retained for parity with the original CLI pipeline but are not wired
into the FastAPI service.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import numpy as np
from qiskit import qpy, transpile
from qiskit.quantum_info import SparsePauliOp
from qiskit_aer.noise import NoiseModel
from qiskit_aer.primitives import EstimatorV2 as AerEstimator
from qiskit_ibm_runtime import QiskitRuntimeService
from scipy.optimize import minimize
from sklearn.cluster import KMeans

logger = logging.getLogger(__name__)


# ---- Hyperparameters ---------------------------------------------------

TWO_QUBIT_GATES: tuple[str, ...] = ("cx", "ecr", "cz")
"""Gate names we treat as "the" two-qubit error source per qubit."""

SHOTS_PER_EVAL = 1024
"""Aer shots used per ADMM objective evaluation."""

QUCAD_DEFAULT_ITERATIONS = 5
QUCAD_DEFAULT_LAM = 0.01
QUCAD_DEFAULT_RHO = 500.0
"""ADMM hyperparameters: ``lam`` is the ℓ1 weight, ``rho`` the quadratic
penalty coefficient. Defaults match Jovin's original Streamlit config."""

COBYLA_MAXITER = 20
"""Inner-loop COBYLA iterations per ADMM outer iteration."""

LUT_DEFAULT_DAYS = 20
LUT_DEFAULT_CLUSTERS = 4
KMEANS_RANDOM_STATE = 42


# ---- Feature extraction ------------------------------------------------


def extract_noise_features(props: Any) -> np.ndarray:
    """Per-qubit noise features as a ``(num_qubits, 3)`` matrix of
    ``[T1, T2, avg_two_qubit_gate_error]``."""
    num_qubits = len(props.qubits)

    # Aggregate two-qubit gate errors back onto each participating qubit.
    qubit_gate_errors: dict[int, list[float]] = {i: [] for i in range(num_qubits)}
    for g in props.gates:
        if g.gate in TWO_QUBIT_GATES:
            for q_idx in g.qubits:
                qubit_gate_errors[q_idx].append(g.parameters[0].value)

    features = []
    for i in range(num_qubits):
        t1 = props.t1(i)
        t2 = props.t2(i)
        avg_cx = np.mean(qubit_gate_errors[i]) if qubit_gate_errors[i] else 0
        features.append([t1, t2, avg_cx])

    return np.array(features)


# ---- ADMM training -----------------------------------------------------


def qucad_loss_noisy(
    theta_values: np.ndarray,
    vqc: Any,
    estimator: AerEstimator,
    observable: SparsePauliOp,
    z: np.ndarray,
    u: np.ndarray,
    rho: float,
) -> float:
    """ADMM inner objective: noisy expectation value of ``observable``
    plus a quadratic proximal penalty ``(rho/2) * ||theta - z + u||^2``
    pulling ``theta`` towards the current consensus ``z``."""
    pub = (vqc, observable, theta_values)
    job = estimator.run([pub])
    result = job.result()[0]
    qnn_expectation = result.data.evs
    penalty = (rho / 2) * np.linalg.norm(theta_values - z + u) ** 2
    return float(qnn_expectation + penalty)


def run_qucad_training_noisy(
    vqc: Any,
    noise_model: NoiseModel,
    backend_ibm: Any,
    iterations: int = QUCAD_DEFAULT_ITERATIONS,
    lam: float = QUCAD_DEFAULT_LAM,
    rho: float = QUCAD_DEFAULT_RHO,
) -> tuple[np.ndarray, np.ndarray, dict[str, list]]:
    """ADMM training with soft-thresholding. Returns the final
    ``(theta, mask, history)`` where ``mask`` (= ``z`` in ADMM) has the
    same shape as ``theta`` but with near-zero entries zeroed out; the
    non-zero positions represent the "kept" parameters."""
    n = vqc.num_parameters
    theta = np.random.uniform(-np.pi, np.pi, n)
    z, u = np.zeros(n), np.zeros(n)

    noisy_estimator = AerEstimator()
    noisy_estimator.options.backend_options = {
        "method": "density_matrix",
        "noise_model": noise_model,
    }
    noisy_estimator.options.run_options = {"shots": SHOTS_PER_EVAL}

    observable = SparsePauliOp.from_list([("Z" + "I" * (vqc.num_qubits - 1), 1)])
    history: dict[str, list] = {"loss": [], "sparsity": []}

    logger.info("[QuCAD] Training with noise profile: %s", backend_ibm.name)

    for i in range(iterations):
        res = minimize(
            qucad_loss_noisy,
            theta,
            args=(vqc, noisy_estimator, observable, z, u, rho),
            method="COBYLA",
            options={"maxiter": COBYLA_MAXITER},
        )
        theta = res.x

        # Soft-threshold step: anything with magnitude under
        # sqrt(2*lam/rho) gets pushed to zero (the ℓ1 prox operator
        # under the ADMM quadratic).
        threshold = np.sqrt(2 * lam / rho)
        temp_z = theta + u
        z = np.where(np.abs(temp_z) > threshold, temp_z, 0)
        u = u + (theta - z)

        history["loss"].append(res.fun)
        history["sparsity"].append(np.count_nonzero(z))
        logger.info("Iter %d | cost=%.4f | nonzeros=%d", i, res.fun, np.count_nonzero(z))

    return theta, z, history


# ---- Deployment / LUT (CLI-only; not consumed by web app) --------------


def get_current_noise_multiplier(current_props: Any, baseline_props: Any) -> float:
    """Ratio of baseline T1 to current T1 averaged over all qubits —
    a coarse "how much has the device drifted" signal used to pick
    which LUT cluster to deploy.

    Kept for parity with the original CLI pipeline; not called by the
    web service layer.
    """
    t1_ratios = [
        baseline_props.t1(i) / current_props.t1(i)
        for i in range(len(current_props.qubits))
    ]
    return float(np.mean(t1_ratios))


def deploy_qucad_model(vqc: Any, lut: dict[str, Any], current_multiplier: float) -> Any:
    """Pick the LUT cluster whose centroid is closest to the current
    drift multiplier and compile the VQC against that cluster's best
    qubits."""
    clusters = lut["clusters"]
    query = current_multiplier
    best_dist = float("inf")
    best_cluster = None

    for c in clusters:
        dist = abs(query - np.mean(c["centroid"]))
        if dist < best_dist:
            best_dist = dist
            best_cluster = c

    logger.info("[QuCAD] Deploying model using qubit-cluster mapping")
    deployed_circuit = vqc.assign_parameters(best_cluster["weights"])
    deployed_circuit = transpile(
        deployed_circuit,
        initial_layout=best_cluster["best_qubits"],
        optimization_level=3,
    )
    return deployed_circuit


def generate_qucad_lut(
    vqc: Any,
    backend: Any,
    days: int = LUT_DEFAULT_DAYS,
    clusters: int = LUT_DEFAULT_CLUSTERS,
) -> dict[str, Any]:
    """Aggregate per-qubit noise features over ``days`` of calibration
    snapshots, cluster qubits into quality tiers via K-means, and train
    one QuCAD model per tier. Returns a LUT mapping tier → (centroid,
    trained weights, best qubit layout)."""
    logger.info("[QuCAD] Analyzing qubit reliability over %d days", days)

    all_snapshots = []
    for day in range(days):
        cal_date = datetime.now() - timedelta(days=day)
        props = backend.properties(datetime=cal_date)
        if props:
            all_snapshots.append(extract_noise_features(props))

    # Shape: (num_qubits, 3 features), averaged across time.
    avg_qubit_performance = np.mean(np.array(all_snapshots), axis=0)

    kmeans = KMeans(n_clusters=clusters, random_state=KMEANS_RANDOM_STATE)
    qubit_labels = kmeans.fit_predict(avg_qubit_performance)

    lut: dict[str, Any] = {"clusters": []}

    for c in range(clusters):
        qubit_indices = np.where(qubit_labels == c)[0].tolist()
        if len(qubit_indices) < vqc.num_qubits:
            continue

        mapping_subset = qubit_indices[: vqc.num_qubits]

        noise_model = NoiseModel.from_backend(backend)
        theta_trained, z_mask, _ = run_qucad_training_noisy(
            vqc, noise_model, backend, iterations=QUCAD_DEFAULT_ITERATIONS
        )

        lut["clusters"].append(
            {
                "centroid": kmeans.cluster_centers_[c],
                "weights": theta_trained * (z_mask != 0),
                "best_qubits": mapping_subset,
            }
        )
        logger.info("Cluster %d: %d qubits grouped; mapping assigned", c, len(qubit_indices))

    return lut


def get_noiseModel_andBackend_ondate(
    token: str, date_time: datetime | None = None
) -> tuple[NoiseModel, Any, Any]:
    """Fetch ``(noise_model, backend, target_props)`` for a given
    calibration date. Requires a live IBM Quantum Platform token."""
    if date_time is None:
        date_time = datetime.now()
    service = QiskitRuntimeService(
        channel="ibm_quantum_platform",
        token=token,
        plans_preference=["open"],
    )
    backend_ibm = service.backend("ibm_fez")
    target_props = backend_ibm.properties(datetime=date_time)
    noise_model = NoiseModel.from_backend(backend_ibm)
    return noise_model, backend_ibm, target_props


if __name__ == "__main__":
    # Minimal CLI entry for ad-hoc testing outside the web app.
    # Expects two environment variables:
    #   IBM_QUANTUM_TOKEN  - IBM Quantum Platform API token
    #   QUCAD_QPY_FILE     - path to a .qpy file holding the VQC
    import os

    logging.basicConfig(level=logging.INFO)

    token = os.environ["IBM_QUANTUM_TOKEN"]
    qpy_path = os.environ["QUCAD_QPY_FILE"]

    noise_model, backend_ibm, _target_props = get_noiseModel_andBackend_ondate(token)
    with open(qpy_path, "rb") as file:
        vqc = qpy.load(file)[0]
    num_params = vqc.num_parameters

    final_theta, final_mask, _stats = run_qucad_training_noisy(
        vqc,
        noise_model,
        backend_ibm,
        iterations=10,
        lam=0.005,
        rho=500.0,
    )

    robust_theta = final_theta * (final_mask != 0)

    logger.info("--- Summary ---")
    logger.info("Original parameters: %d", num_params)
    logger.info("Compressed parameters: %d", int(np.count_nonzero(final_mask)))

    bound_vqc = vqc.assign_parameters(robust_theta)
    robust_vqc_compressed = transpile(bound_vqc, optimization_level=3)
    logger.info("--- QuCAD compression results ---")
    logger.info("Original depth: %d", vqc.depth())
    logger.info("Robust depth:   %d", robust_vqc_compressed.depth())
    logger.info(
        "Gate reduction: %d gates removed",
        vqc.size() - robust_vqc_compressed.size(),
    )

    qucad_bank = generate_qucad_lut(vqc, backend_ibm)
    logger.info("LUT: %s", qucad_bank)
