"""QuCAD implementation (refactored from Jovin Antony Maria's original).

Original algorithm preserved; `get_noiseModel_andBackend_ondate` now takes an
explicit `token` argument instead of reading from `st.secrets`, so this module
is usable outside Streamlit.
"""

import numpy as np
from scipy.optimize import minimize
from qiskit import qpy, transpile
from qiskit_aer.primitives import EstimatorV2 as AerEstimator
from qiskit.quantum_info import SparsePauliOp
from qiskit_aer.noise import NoiseModel
from qiskit_ibm_runtime import QiskitRuntimeService
from datetime import datetime, timedelta
from sklearn.cluster import KMeans

# --- Updated Helper for Per-Qubit Features ---
def extract_noise_features(props):
    """
    Returns a matrix of shape (num_qubits, 3) representing 
    [T1, T2, Avg_Gate_Error] for every qubit on the chip.
    """
    num_qubits = len(props.qubits)
    two_q_gates = ['cx', 'ecr', 'cz']
    
    # Map gate errors back to specific qubits
    qubit_gate_errors = {i: [] for i in range(num_qubits)}
    for g in props.gates:
        if g.gate in two_q_gates:
            for q_idx in g.qubits:
                qubit_gate_errors[q_idx].append(g.parameters[0].value)

    features = []
    for i in range(num_qubits):
        t1 = props.t1(i)
        t2 = props.t2(i)
        avg_cx = np.mean(qubit_gate_errors[i]) if qubit_gate_errors[i] else 0
        features.append([t1, t2, avg_cx])
        
    return np.array(features)

def qucad_loss_noisy(theta_values, vqc, estimator, observable, z, u, rho):
    pub = (vqc, observable, theta_values)
    job = estimator.run([pub])
    result = job.result()[0]
    qnn_expectation = result.data.evs
    penalty = (rho / 2) * np.linalg.norm(theta_values - z + u)**2
    return float(qnn_expectation + penalty)

def run_qucad_training_noisy(vqc, noise_model, backend_ibm, iterations=5, lam=0.01, rho=500.0):
    n = vqc.num_parameters
    theta = np.random.uniform(-np.pi, np.pi, n)
    z, u = np.zeros(n), np.zeros(n)
    
    noisy_estimator = AerEstimator()
    noisy_estimator.options.backend_options = {
        "method": "density_matrix", 
        "noise_model": noise_model
    }
    noisy_estimator.options.run_options = {"shots": 1024}
    
    observable = SparsePauliOp.from_list([("Z" + "I" * (vqc.num_qubits - 1), 1)])
    history = {"loss": [], "sparsity": []}

    print(f"[QuCAD] Training with Noise Profile: {backend_ibm.name}")
    
    for i in range(iterations):
        res = minimize(
            qucad_loss_noisy, 
            theta, 
            args=(vqc, noisy_estimator, observable, z, u, rho),
            method='COBYLA',
            options={'maxiter': 20} 
        )
        theta = res.x
        threshold = np.sqrt(2 * lam / rho)
        temp_z = theta + u
        z = np.where(np.abs(temp_z) > threshold, temp_z, 0)
        u = u + (theta - z)

        history["loss"].append(res.fun)
        history["sparsity"].append(np.count_nonzero(z))
        print(f"Iter:{i} , Cost:{res.fun:.4f}")

    return theta, z, history

def get_current_noise_multiplier(current_props, baseline_props):
    """Modified to check global drift against baseline for deployment selection."""
    t1_ratios = [baseline_props.t1(i) / current_props.t1(i) for i in range(len(current_props.qubits))]
    return np.mean(t1_ratios)

def deploy_qucad_model(vqc, lut, current_multiplier):
    """
    Selects the best weight set and forces the circuit onto the 
    best-performing qubit cluster identified in the LUT.
    """
    clusters = lut["clusters"]
    # Simple selection: find centroid closest to current multiplier
    query = current_multiplier
    best_dist = float("inf")
    best_cluster = None

    for c in clusters:
        dist = abs(query - np.mean(c["centroid"])) # Centroid is now per-qubit avg
        if dist < best_dist:
            best_dist = dist
            best_cluster = c

    print(f"[QuCAD] Deploying model using Qubit Cluster Mapping")
    deployed_circuit = vqc.assign_parameters(best_cluster["weights"])
    
    # Optimization: Use the best_qubits identified during LUT generation
    deployed_circuit = transpile(
        deployed_circuit, 
        initial_layout=best_cluster["best_qubits"],
        optimization_level=3
    )
    return deployed_circuit

def generate_qucad_lut(vqc, backend, days=20, clusters=4):
    """
    REWRITTEN: Now aggregates performance PER QUBIT over 20 days 
    to find the most stable qubit mapping.
    """
    print(f"\n[QuCAD] Analyzing Qubit Reliability over {days} days...")
    
    all_snapshots = []
    for day in range(days):
        cal_date = datetime.now() - timedelta(days=day)
        props = backend.properties(datetime=cal_date)
        if props:
            all_snapshots.append(extract_noise_features(props))

    # Calculate average performance for EACH qubit across time
    # Shape: (num_qubits, 3 features)
    avg_qubit_performance = np.mean(np.array(all_snapshots), axis=0)

    # Cluster qubits into quality tiers (e.g., Tier 0: Best, Tier 1: Good, etc.)
    kmeans = KMeans(n_clusters=clusters, random_state=42)
    qubit_labels = kmeans.fit_predict(avg_qubit_performance)

    lut = {"clusters": []}
    
    # Generate a model for each "Tier" of qubit quality
    for c in range(clusters):
        # Identify indices of qubits in this cluster
        qubit_indices = np.where(qubit_labels == c)[0].tolist()
        
        # We need enough qubits in the cluster to run the VQC
        if len(qubit_indices) < vqc.num_qubits:
            continue
            
        # Select the best subset from this cluster (first N qubits)
        mapping_subset = qubit_indices[:vqc.num_qubits]

        # Train a model specific to this noise level/cluster
        noise_model = NoiseModel.from_backend(backend)
        theta_trained, z_mask, _ = run_qucad_training_noisy(
            vqc, noise_model, backend, iterations=5
        )

        lut["clusters"].append({
            "centroid": kmeans.cluster_centers_[c],
            "weights": theta_trained * (z_mask != 0),
            "best_qubits": mapping_subset
        })
        print(f"Cluster {c}: {len(qubit_indices)} qubits grouped. Mapping assigned.")
        print(lut)

    return lut

def get_noiseModel_andBackend_ondate(token, date_time=None):
    """Fetch noise model + backend handle for a given calibration date.

    Parameters
    ----------
    token : str  IBM Quantum Platform API token
    date_time : datetime or None  calibration snapshot date; defaults to now
    """
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

    print("\n--- Summary ---")
    print(f"Original Parameters: {num_params}")
    print(f"Compressed Parameters: {np.count_nonzero(final_mask)}")

    bound_vqc = vqc.assign_parameters(robust_theta)
    robust_vqc_compressed = transpile(bound_vqc, optimization_level=3)
    print("--- QuCAD Compression Results ---")
    print(f"Original Depth: {vqc.depth()}")
    print(f"Robust Depth:   {robust_vqc_compressed.depth()}")
    print(f"Gate Reduction: {vqc.size() - robust_vqc_compressed.size()} gates removed")

    qucad_bank = generate_qucad_lut(vqc, backend_ibm)
    print(qucad_bank)