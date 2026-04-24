#!/usr/bin/env python3
"""
recommend_shots_v4.py — Noise-aware shots recommender for historic noise datasets.

Changes from v3:
  - Loads from multiple dataset directories (different noise JSONs)
  - Adapts to v4.1 schema (circuit_id, noise_source)
  - Clustering features include 3 noise descriptors:
      twoq_gate_error_mean, readout_mean, T2_mean
  - QAOA-specific shots sequence (ratio 1.5, 100–15000)
  - Pilot phase builds NoiseModel from noise JSON
  - Backend selection from noise JSON (not hardcoded FakeSherbrooke)

Flow:
  Step 1: Load multiple DBs → merge → train/test split
          → HDBSCAN on [circuit features + noise features]
  Step 2: Input circuit + noise JSON → transpile → extract features
          → append noise features → find nearest cluster
  Step 3–7: Same as v3 (kNN → pilot PF → match → fit → recommend)
"""

import argparse
import json
import math
import os
import datetime
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from qiskit import QuantumCircuit, transpile, qpy
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator
from qiskit_aer.noise import (
    NoiseModel, depolarizing_error, thermal_relaxation_error, ReadoutError,
)

try:
    import hdbscan
except ImportError:
    hdbscan = None


# ============================================================
# 0) Constants
# ============================================================

def _geo_seq(start, ratio, max_shots):
    seq = []
    v = float(start)
    while v <= max_shots:
        r = round(v)
        if not seq or r > seq[-1]:
            seq.append(r)
        v *= ratio
    return seq

# Shots sequences (must match dataset_builder_historic.py)
SHOTS_SEQUENCE_QAOA = _geo_seq(100, 1.5, 15000)     # QAOA-like circuits
SHOTS_SEQUENCE_DEFAULT = _geo_seq(50, 1.25, 4000)    # General (HEA, semi-structured, random)
SHOTS_SEQUENCE = SHOTS_SEQUENCE_QAOA                  # fallback default

OPT_LEVEL = 1
SEED_TRANSPILE = 1234

GATE_LENGTH_1Q = 57e-9
GATE_LENGTH_2Q = 533e-9

# HDBSCAN
MIN_CLUSTER_SIZE = 25
MIN_SAMPLES = 12
N_TIERS = 3

# kNN / matching
K_STRUCT = 5
K_PF_MATCH = 3
PILOT_POINTS = 4
PILOT_REPS = 20

# Curve fitting
B_GRID_N = 101
ALPHA_DEFAULT = 0.95
Z_VAL = 1.645

# Circuit structure features
CIRCUIT_FEATURE_KEYS = [
    "depth", "num_2q", "swap", "unique_2q_edges",
    "max_2q_edge_mult", "size",
]

# Noise features (from noise_summary in record.json)
NOISE_FEATURE_KEYS = [
    "twoq_gate_error_mean",
    "readout_mean",       # (prob_meas0_prep1_mean + prob_meas1_prep0_mean) / 2
    "T2_mean",
]


# ============================================================
# 0b) Default paths — auto-discovered relative to this file.
# Supports two layouts:
#   - Research repo:   recommend_shots_v4.py next to shots_dataset_historic_*/,
#                      ibm_*.json, and Yipei/dual_gnn_ckpt/best_model.pt
#   - Handover package: src/recommend_shots_v4.py, data/shots_dataset_*/,
#                       data/noise_json/ibm_*.json, checkpoint/best_model.pt
# ============================================================

_DATASET_DIR_NAMES = [
    "shots_dataset_historic_250113",
    "shots_dataset_historic_250506",
    "shots_dataset_historic_260116",
    "shots_dataset_historic2_250611",
    "shots_dataset_historic2_250724",
    "shots_dataset_historic2_251126",
    "shots_dataset_historic_qaoa_250113",
    "shots_dataset_historic_qaoa_250506",
    "shots_dataset_historic_qaoa_260116",
    "shots_dataset_historic2_qaoa_250611",
    "shots_dataset_historic2_qaoa_250724",
    "shots_dataset_historic2_qaoa_251126",
]


def _discover_default_paths():
    here = Path(__file__).resolve().parent
    roots = [here, here.parent, here.parent / "data", here / "data"]

    dataset_root = next(
        (r for r in roots if (r / _DATASET_DIR_NAMES[0]).is_dir()), None)
    dataset_dirs = ([dataset_root / n for n in _DATASET_DIR_NAMES]
                    if dataset_root else [])

    ckpt_candidates = [
        here / "Yipei" / "dual_gnn_ckpt" / "best_model.pt",
        here.parent / "checkpoint" / "best_model.pt",
        here / "checkpoint" / "best_model.pt",
    ]
    gnn_ckpt = next((c for c in ckpt_candidates if c.exists()), None)

    return dataset_dirs, gnn_ckpt


DEFAULT_DATASET_DIRS, DEFAULT_GNN_CKPT = _discover_default_paths()


# ============================================================
# 1) Utility
# ============================================================

def safe_float(x, default=np.nan):
    try:
        return float(x)
    except Exception:
        return float(default)

def hellinger_fidelity(p, q):
    p = np.clip(p, 0.0, 1.0)
    q = np.clip(q, 0.0, 1.0)
    return float(np.sum(np.sqrt(p * q)) ** 2)

def counts_to_prob(counts, nq):
    dim = 2 ** nq
    p = np.zeros(dim, dtype=float)
    tot = sum(counts.values())
    for b, c in counts.items():
        p[int(b, 2)] = c / tot
    return p

def zscore_fit(X):
    mu = np.nanmean(X, axis=0)
    sd = np.nanstd(X, axis=0)
    sd = np.where(sd < 1e-12, 1.0, sd)
    return mu, sd

def zscore_apply(X, mu, sd):
    return (X - mu) / np.where(sd < 1e-12, 1.0, sd)

def euclid_distances(Xz, xz):
    d = Xz - xz[None, :]
    return np.sqrt(np.sum(d * d, axis=1))


import re as _re

def _qasm3_to_qasm2(qasm3_str: str) -> str:
    """Convert simple OpenQASM 3.0 to OpenQASM 2.0 (basic gates only).

    Handles the subset used by QAOA-like circuits:
      - OPENQASM 3.0  →  OPENQASM 2.0
      - include "stdgates.inc"  →  include "qelib1.inc"
      - qubit[N] name  →  qreg name[N]
      - bit[N] name    →  creg name[N]
    Gate lines (cx, rz, rx, ry, h, sx, cz, etc.) pass through unchanged.
    """
    lines_out = []
    for line in qasm3_str.splitlines():
        s = line.strip()
        if not s:
            lines_out.append(line)
            continue
        if s.startswith("OPENQASM 3"):
            lines_out.append("OPENQASM 2.0;")
            continue
        if s == 'include "stdgates.inc";':
            lines_out.append('include "qelib1.inc";')
            continue
        # qubit[7] q;  →  qreg q[7];
        m = _re.match(r'qubit\[(\d+)\]\s+(\w+)\s*;', s)
        if m:
            lines_out.append(f"qreg {m.group(2)}[{m.group(1)}];")
            continue
        # bit[7] c;  →  creg c[7];
        m = _re.match(r'bit\[(\d+)\]\s+(\w+)\s*;', s)
        if m:
            lines_out.append(f"creg {m.group(2)}[{m.group(1)}];")
            continue
        lines_out.append(line)
    return "\n".join(lines_out)


# ============================================================
# 2) Data record
# ============================================================

@dataclass
class DBRecord:
    record_id: str
    circuit_id: str
    rec_dir: Path
    nq: int
    bucket: str
    family: str
    converged_shots: int
    converged: bool
    features: Dict[str, float]
    noise_features: Dict[str, float]
    # v4 curves
    real_fid_summary: Dict[str, Dict[str, float]]
    real_fid_shots: List[int]
    pf_summary: Dict[str, Dict[str, float]]
    pf_shots: List[int]
    # noise source info
    noise_file: str = ""
    backend_name: str = ""
    # assigned by clustering
    cluster_label: int = -1
    tier: int = -1


# ============================================================
# 3) DB loading (v4.1 schema, multi-directory)
# ============================================================

def extract_noise_features_from_record(rec: dict) -> Dict[str, float]:
    """Extract 3 noise features from a record's noise_source.noise_summary."""
    ns = rec.get("noise_source", {}).get("noise_summary", {})

    p0g1 = safe_float(ns.get("prob_meas0_prep1_mean"))
    p1g0 = safe_float(ns.get("prob_meas1_prep0_mean"))
    readout_mean = (p0g1 + p1g0) / 2.0 if np.isfinite(p0g1) and np.isfinite(p1g0) else np.nan

    return {
        "twoq_gate_error_mean": safe_float(ns.get("twoq_gate_error_mean")),
        "readout_mean": readout_mean,
        "T2_mean": safe_float(ns.get("T2_mean")),
    }


def load_all_records(dataset_dirs: List[Path],
                     circuit_feature_keys: List[str],
                     noise_feature_keys: List[str],
                     restrict_nq: Optional[List[int]] = None,
                     ) -> Tuple[List[DBRecord], np.ndarray]:
    """Load records from multiple dataset directories."""
    db: List[DBRecord] = []
    X_rows = []

    for dataset_dir in dataset_dirs:
        index_path = dataset_dir / "index.jsonl"
        if not index_path.exists():
            print(f"[WARN] index.jsonl not found: {index_path}")
            continue

        record_paths = []
        with index_path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                rid = obj.get("record_id")
                if not rid:
                    continue
                rec_dir = dataset_dir / rid
                rj = rec_dir / "record.json"
                if rj.exists():
                    record_paths.append(rj)

        for p in record_paths:
            with p.open("r", encoding="utf-8") as f:
                rec = json.load(f)

            # v4.1: nq from features or circuit_id lookup
            feats = rec.get("features", {})
            nq = None
            # Try to get nq from base circuit stats in record
            # In v4.1, nq is not in base_spec but can be inferred from features
            # or from the index entry. We'll try multiple sources.
            if "base_spec" in rec:
                nq = rec["base_spec"].get("num_qubits")
            if nq is None:
                # Infer from index entry
                nq_from_idx = None
                index_path_check = dataset_dir / "index.jsonl"
                rid = rec.get("record_id", "")
                with index_path_check.open("r") as fi:
                    for line in fi:
                        try:
                            obj = json.loads(line)
                            if obj.get("record_id") == rid:
                                nq_from_idx = obj.get("nq")
                                break
                        except Exception:
                            pass
                nq = nq_from_idx

            if nq is None:
                continue
            nq = int(nq)
            if restrict_nq and nq not in restrict_nq:
                continue

            # Circuit features
            circ_row = []
            ok = True
            for k in circuit_feature_keys:
                v = safe_float(feats.get(k))
                if not np.isfinite(v):
                    ok = False
                    break
                circ_row.append(v)
            if not ok:
                continue

            # Noise features
            noise_feats = extract_noise_features_from_record(rec)
            noise_row = []
            for k in noise_feature_keys:
                v = safe_float(noise_feats.get(k))
                if not np.isfinite(v):
                    ok = False
                    break
                noise_row.append(v)
            if not ok:
                continue

            row = circ_row + noise_row

            conv = rec.get("convergence", {})
            rfc = rec.get("real_fidelity_curve", {})
            pfc = rec.get("progress_fidelity_curve", {})

            ns_info = rec.get("noise_source", {})

            # Get bucket/family from base_spec or index
            bucket = ""
            family = ""
            if "base_spec" in rec:
                bucket = str(rec["base_spec"].get("bucket", ""))
                family = str(rec["base_spec"].get("family", ""))
            if not family:
                # Try from index
                with (dataset_dir / "index.jsonl").open("r") as fi:
                    for line in fi:
                        try:
                            obj = json.loads(line)
                            if obj.get("record_id") == rec.get("record_id"):
                                bucket = obj.get("bucket", "")
                                family = obj.get("family", "")
                                break
                        except Exception:
                            pass

            db.append(DBRecord(
                record_id=rec.get("record_id", p.parent.name),
                circuit_id=rec.get("circuit_id", ""),
                rec_dir=p.parent,
                nq=nq,
                bucket=bucket,
                family=family,
                converged_shots=int(conv.get("converged_shots", 0)),
                converged=bool(conv.get("converged", False)),
                features={k: safe_float(feats.get(k)) for k in feats},
                noise_features=noise_feats,
                real_fid_summary=rfc.get("summary", {}),
                real_fid_shots=rfc.get("shots_sequence", []),
                pf_summary=pfc.get("summary", {}),
                pf_shots=pfc.get("shots_axis", []),
                noise_file=ns_info.get("json_file", ""),
                backend_name=ns_info.get("backend_name", ""),
            ))
            X_rows.append(row)

    if not db:
        raise RuntimeError("No records loaded.")

    print(f"[INFO] Loaded {len(db)} records from {len(dataset_dirs)} directories")
    return db, np.array(X_rows, dtype=float)


# ============================================================
# 4) Train / Test split
# ============================================================

def train_test_split(db, X, test_ratio=0.2, seed=42):
    rng = np.random.default_rng(seed)
    n = len(db)
    n_test = max(1, round(n * test_ratio))
    perm = rng.permutation(n)
    test_idx = sorted(perm[:n_test])
    train_idx = sorted(perm[n_test:])
    return ([db[i] for i in train_idx], X[train_idx],
            [db[i] for i in test_idx], X[test_idx], test_idx)


# ============================================================
# 5) HDBSCAN clustering + tier assignment
# ============================================================

def build_clusters(db, X, min_cluster_size=MIN_CLUSTER_SIZE,
                   min_samples=MIN_SAMPLES, n_tiers=N_TIERS):
    mu, sd = zscore_fit(X)
    Xz = zscore_apply(X, mu, sd)

    if hdbscan is None:
        raise ImportError("hdbscan required: pip install hdbscan")

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric='euclidean',
        prediction_data=True,  # required for approximate_predict on new points
    )
    labels = clusterer.fit_predict(Xz)

    cluster_info = {}
    for label in set(labels):
        if label == -1:
            continue
        indices = [i for i, l in enumerate(labels) if l == label]
        conv_shots = [db[i].converged_shots for i in indices]

        if len(indices) >= n_tiers:
            percentiles = np.linspace(0, 100, n_tiers + 1)
            bounds = [float(np.percentile(conv_shots, p)) for p in percentiles]
        else:
            bounds = [min(conv_shots), max(conv_shots) + 1]

        cluster_info[label] = {"tier_bounds": bounds, "indices": indices}

        for i in indices:
            db[i].cluster_label = label
            cs = db[i].converged_shots
            tier = 0
            for t in range(len(bounds) - 1):
                if cs >= bounds[t]:
                    tier = t
            db[i].tier = tier

    for i, l in enumerate(labels):
        if l == -1:
            db[i].cluster_label = -1
            db[i].tier = -1

    return labels, mu, sd, cluster_info, clusterer


# ============================================================
# 6) NoiseModel building (same as dataset_builder_historic)
# ============================================================

def load_noise_json(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)

def extract_noise_data(noise_json):
    rec = noise_json["original_record"]
    qubit_data = {}
    for entry in rec["qubit_noise"]:
        qi = entry["qubit"]
        qubit_data[qi] = {
            "t1": entry["T1"] * 1e-6, "t2": entry["T2"] * 1e-6,
            "p0g1": entry["prob_meas0_prep1"],
            "p1g0": entry["prob_meas1_prep0"],
        }
    sx_errors = {}
    for entry in rec["gate_noise"]["sx_gate_error"]:
        sx_errors[entry["qubits"][0]] = entry["gate_error"]
    twoq_errors = {}
    for entry in rec["gate_noise"]["twoq_gate_error"]:
        twoq_errors[tuple(entry["qubits"])] = entry["gate_error"]
    return {"qubit_data": qubit_data, "sx_errors": sx_errors,
            "twoq_errors": twoq_errors}

def build_noise_model(noise_data, basis_gates, gate_2q_name):
    nm = NoiseModel(basis_gates=basis_gates)
    qubit_data = noise_data["qubit_data"]
    sx_errors = noise_data["sx_errors"]
    twoq_errors = noise_data["twoq_errors"]

    for qi, qd in qubit_data.items():
        t1, t2 = qd["t1"], qd["t2"]
        if t2 > 2 * t1: t2 = 2 * t1
        sx_err = sx_errors.get(qi, 0)
        if sx_err > 0:
            dep = depolarizing_error(sx_err, 1)
            th = thermal_relaxation_error(t1, t2, GATE_LENGTH_1Q)
            combined = dep.compose(th)
            nm.add_quantum_error(combined, 'sx', [qi])
            nm.add_quantum_error(combined, 'x', [qi])
        ro = ReadoutError([[1 - qd["p1g0"], qd["p1g0"]],
                           [qd["p0g1"], 1 - qd["p0g1"]]])
        nm.add_readout_error(ro, [qi])

    for edge, err in twoq_errors.items():
        if err >= 1.0: continue
        q0, q1 = edge
        if q0 not in qubit_data or q1 not in qubit_data: continue
        dep = depolarizing_error(err, 2)
        t1_0, t2_0 = qubit_data[q0]["t1"], qubit_data[q0]["t2"]
        t1_1, t2_1 = qubit_data[q1]["t1"], qubit_data[q1]["t2"]
        if t2_0 > 2 * t1_0: t2_0 = 2 * t1_0
        if t2_1 > 2 * t1_1: t2_1 = 2 * t1_1
        th0 = thermal_relaxation_error(t1_0, t2_0, GATE_LENGTH_2Q)
        th1 = thermal_relaxation_error(t1_1, t2_1, GATE_LENGTH_2Q)
        combined = dep.compose(th0.expand(th1))
        nm.add_quantum_error(combined, gate_2q_name, list(edge))
    return nm

def select_fake_backend(noise_json):
    from qiskit_ibm_runtime.fake_provider import (
        FakeSherbrooke, FakeBrisbane, FakeKyiv, FakeOsaka,
        FakeCusco, FakeKawasaki, FakeKyoto, FakeQuebec,
        FakeTorino, FakeFez, FakeMarrakesh,
    )
    cfg = noise_json["configuration_summary"]
    recommended = cfg.get("recommended_fake_backend", "")
    gate_2q = cfg.get("twoq_gate_type", "cz")
    NAME_MAP = {
        "FakeSherbrooke": FakeSherbrooke, "FakeBrisbane": FakeBrisbane,
        "FakeKyiv": FakeKyiv, "FakeOsaka": FakeOsaka,
        "FakeCusco": FakeCusco, "FakeKawasaki": FakeKawasaki,
        "FakeKyoto": FakeKyoto, "FakeQuebec": FakeQuebec,
        "FakeTorino": FakeTorino,
        "FakeFez": FakeFez, "FakeMarrakesh": FakeMarrakesh,
    }
    if recommended in NAME_MAP:
        return NAME_MAP[recommended](), gate_2q
    n_qubits = cfg.get("n_qubits", 0)
    FALLBACK = {(156,"cz"): FakeFez, (133,"cz"): FakeTorino,
                (127,"ecr"): FakeSherbrooke}
    key = (n_qubits, gate_2q)
    if key in FALLBACK:
        return FALLBACK[key](), gate_2q
    raise ValueError(f"Cannot match: {recommended}, {n_qubits}q, {gate_2q}")

def build_sim_from_noise_json(noise_json):
    """Build AerSimulator with NoiseModel from a noise JSON."""
    cfg = noise_json["configuration_summary"]
    gate_2q = cfg["twoq_gate_type"]
    noise_data = extract_noise_data(noise_json)
    nm = build_noise_model(noise_data, cfg["basis_gates"], gate_2q)
    fake_backend, _ = select_fake_backend(noise_json)
    sim = AerSimulator.from_backend(fake_backend)
    sim.set_options(noise_model=nm)
    return sim

def noise_features_from_json(noise_json):
    """Extract 3 noise features from a noise JSON (for query vector)."""
    ns = noise_json.get("noise_summary", {})
    p0g1 = safe_float(ns.get("prob_meas0_prep1_mean"))
    p1g0 = safe_float(ns.get("prob_meas1_prep0_mean"))
    readout_mean = (p0g1 + p1g0) / 2.0 if np.isfinite(p0g1) and np.isfinite(p1g0) else np.nan
    return {
        "twoq_gate_error_mean": safe_float(ns.get("twoq_gate_error_mean")),
        "readout_mean": readout_mean,
        "T2_mean": safe_float(ns.get("T2_mean")),
    }


# ============================================================
# 7) Feature extraction
# ============================================================

def extract_features(tqc):
    op = tqc.count_ops()
    depth = float(tqc.depth())
    size = float(tqc.size())
    num_2q = 0
    swap = float(op.get("swap", 0))
    edge_mult = {}
    for ci in tqc.data:
        if ci.operation.num_qubits == 2:
            num_2q += 1
            a = tqc.find_bit(ci.qubits[0]).index
            b = tqc.find_bit(ci.qubits[1]).index
            e = (min(a, b), max(a, b))
            edge_mult[e] = edge_mult.get(e, 0) + 1
    return {
        "depth": depth, "size": size, "num_2q": float(num_2q),
        "swap": swap, "unique_2q_edges": float(len(edge_mult)),
        "max_2q_edge_mult": float(max(edge_mult.values()) if edge_mult else 0),
        "cx": float(op.get("cx", 0)), "ecr": float(op.get("ecr", 0)),
        "cz": float(op.get("cz", 0)),
        "rz": float(op.get("rz", 0)), "ry": float(op.get("ry", 0)),
        "rx": float(op.get("rx", 0)), "sx": float(op.get("sx", 0)),
        "h": float(op.get("h", 0)),
    }


# ============================================================
# 8) Cluster assignment
# ============================================================

def find_nearest_cluster(xq, train_db, X_train, mu, sd, cluster_info,
                         clusterer):
    """Assign a query vector to a cluster using HDBSCAN's approximate_predict.

    Uses the same density-based criterion as training: if the query point
    falls in a low-density region, HDBSCAN assigns label -1 (outlier),
    ensuring consistent train/inference behavior with no extra hyperparameters.

    Returns (label, indices) or (-1, []) for outliers.
    """
    xqz = zscore_apply(xq[None, :], mu, sd)  # shape (1, d)
    labels, strengths = hdbscan.approximate_predict(clusterer, xqz)
    label = int(labels[0])
    strength = float(strengths[0])

    if label == -1 or label not in cluster_info:
        print(f"  [OUTLIER] HDBSCAN approximate_predict → label={label}, "
              f"strength={strength:.4f}")
        return -1, []

    print(f"  Cluster assignment: label={label}, strength={strength:.4f}")
    return label, cluster_info[label]["indices"]


# ============================================================
# 9) Tier voting + pilot shots
# ============================================================

def vote_tier(neighbors):
    votes = {}
    for nb in neighbors:
        votes[nb.tier] = votes.get(nb.tier, 0) + 1
    return max(votes, key=lambda x: votes[x]) if votes else 0


def detect_shots_sequence(cluster_records):
    """Detect which shots sequence the cluster records use.

    Compares the stored shots levels against the known QAOA and General
    sequences and returns the one with greater overlap.  This allows the
    system to automatically adapt pilot shots and PF matching to the
    circuit family without requiring user input.
    """
    qaoa_set = set(SHOTS_SEQUENCE_QAOA)
    general_set = set(SHOTS_SEQUENCE_DEFAULT)

    qaoa_hits, general_hits = 0, 0
    for rec in cluster_records:
        stored = set(rec.real_fid_shots)
        qaoa_hits += len(stored & qaoa_set)
        general_hits += len(stored & general_set)

    if general_hits > qaoa_hits:
        return SHOTS_SEQUENCE_DEFAULT
    return SHOTS_SEQUENCE_QAOA


def determine_pilot_shots(tier, tier_bounds, shots_sequence,
                          pilot_points=PILOT_POINTS):
    upper = tier_bounds[tier + 1] if tier + 1 < len(tier_bounds) else tier_bounds[-1]
    target = max(upper * 0.20, 100.0)
    ranked = sorted(shots_sequence, key=lambda s: abs(s - target))
    return sorted(ranked[:pilot_points])


# ============================================================
# 10) Pilot PF computation
# ============================================================

def compute_pilot_pf(tqc, nq, pilot_shots, sim,
                     reps=PILOT_REPS, seed=99999):
    rng = np.random.default_rng(seed)
    dim = 2 ** nq
    level_dists = {}

    for shots in pilot_shots:
        dists = np.zeros((reps, dim), dtype=np.float64)
        for r in range(reps):
            seed_sim = int(rng.integers(1, 2**31 - 1))
            result = sim.run(tqc, shots=shots, seed_simulator=seed_sim).result()
            dists[r] = counts_to_prob(result.get_counts(), nq)
        level_dists[shots] = dists

    pf_means, pf_stds = {}, {}
    for k in range(len(pilot_shots) - 1):
        s_cur, s_next = pilot_shots[k], pilot_shots[k + 1]
        pfs = [hellinger_fidelity(level_dists[s_cur][r], level_dists[s_next][r])
               for r in range(reps)]
        arr = np.array(pfs)
        pf_means[s_cur] = float(arr.mean())
        pf_stds[s_cur] = float(arr.std(ddof=1)) if len(arr) > 1 else 0.0

    return pf_means, pf_stds


# ============================================================
# 11) PF curve matching
# ============================================================

def pf_curve_distance(pilot_pf, nb):
    d, c = 0.0, 0
    for s, pf_val in pilot_pf.items():
        s_str = str(s)
        if s_str not in nb.pf_summary:
            continue
        nb_pf = safe_float(nb.pf_summary[s_str].get("mean"))
        if np.isfinite(nb_pf):
            d += (pf_val - nb_pf) ** 2
            c += 1
    return math.sqrt(d / c) if c > 0 else float("inf")

def match_by_pf(pilot_pf, candidates, k=K_PF_MATCH):
    scored = [(pf_curve_distance(pilot_pf, nb), nb)
              for nb in candidates]
    scored = [(d, nb) for d, nb in scored if np.isfinite(d)]
    scored.sort(key=lambda t: t[0])
    return scored[:k]


# ============================================================
# 12) Curve fitting
# ============================================================

def fit_curve_grid_b(shots, y, w, b_low, b_high, f_low, f_high,
                     b_grid_n=B_GRID_N):
    shots = np.maximum(shots.astype(float), 1.0)
    w = np.maximum(w.astype(float), 1e-9)
    best_F, best_a, best_b, best_sse = 0.0, 0.0, 1.0, float("inf")
    bs = np.linspace(b_low, b_high, b_grid_n)
    sw = np.sqrt(w)
    yw = y * sw
    for b in bs:
        x = 1.0 / (shots ** b)
        A = np.stack([np.ones_like(x), -x], axis=1)
        Aw = A * sw[:, None]
        theta, *_ = np.linalg.lstsq(Aw, yw, rcond=None)
        F_inf, a = float(theta[0]), float(theta[1])
        F_inf = min(max(F_inf, f_low), f_high)
        a = max(a, 0.0)
        yhat = F_inf - a * x
        sse = float(np.sum(w * (yhat - y) ** 2))
        if sse < best_sse:
            best_F, best_a, best_b, best_sse = F_inf, a, float(b), sse
    return best_F, best_a, best_b, best_sse

def fit_from_neighbors(matched, alpha=ALPHA_DEFAULT, z_val=Z_VAL):
    if not matched:
        return None

    shots_all, y_all, w_all = [], [], []
    conv_fids, conv_stds, conv_weights = [], [], []

    for dist, nb in matched:
        weight = 1.0 / (1.0 + dist)
        for s_str, stats in nb.real_fid_summary.items():
            try:
                s_int = int(s_str)
            except ValueError:
                continue
            mu = safe_float(stats.get("mean"))
            if np.isfinite(mu):
                shots_all.append(s_int)
                y_all.append(mu)
                w_all.append(weight)

        s_conv_str = str(nb.converged_shots)
        if s_conv_str in nb.real_fid_summary:
            conv_mean = safe_float(nb.real_fid_summary[s_conv_str].get("mean"))
            conv_std = safe_float(nb.real_fid_summary[s_conv_str].get("std"))
            if np.isfinite(conv_mean):
                conv_fids.append(conv_mean)
                conv_weights.append(weight)
            if np.isfinite(conv_std):
                conv_stds.append(conv_std)

    if len(shots_all) < 3 or not conv_fids:
        return None

    w_conv = np.array(conv_weights, dtype=float)
    F_conv_pred = float(np.average(conv_fids, weights=w_conv))
    sigma_conv_pred = float(np.mean(conv_stds)) if conv_stds else 0.01
    target = alpha * F_conv_pred

    shots_arr = np.array(shots_all, dtype=float)
    y_arr = np.array(y_all, dtype=float)
    w_arr = np.array(w_all, dtype=float)
    f_low = max(0.0, min(conv_fids) - 0.03)
    f_high = min(1.0, max(conv_fids) + 0.03)

    F_inf, a, b, sse = fit_curve_grid_b(
        shots_arr, y_arr, w_arr, 0.3, 1.6, f_low, f_high)

    std_vals, std_shots = [], []
    for _, nb in matched:
        for s_str, stats in nb.real_fid_summary.items():
            s_val = safe_float(s_str)
            s_std = safe_float(stats.get("std"))
            if np.isfinite(s_val) and np.isfinite(s_std) and s_std > 0:
                std_vals.append(s_std)
                std_shots.append(s_val)

    if std_vals:
        log_c = float(np.mean(
            np.log(np.array(std_vals)) + 0.5 * np.log(np.array(std_shots))))
        c_std = float(np.exp(log_c))
    else:
        c_std = 0.01

    n_star = 10
    for n in range(10, 30001):
        mean_n = F_inf - a / (n ** b)
        std_n = c_std / math.sqrt(n)
        if mean_n - z_val * std_n >= target:
            n_star = n
            break
    else:
        n_star = 30000

    n_star_rounded = int(math.ceil(n_star / 10) * 10)

    return {
        "F_inf": F_inf, "a": a, "b": b, "sse": sse,
        "c_std": c_std, "F_conv_pred": F_conv_pred,
        "sigma_conv_pred": sigma_conv_pred,
        "alpha": alpha, "z_val": z_val, "target": target,
        "n_star": n_star, "n_star_rounded": n_star_rounded,
        "f_bounds": (f_low, f_high), "n_neighbors": len(matched),
    }


# ============================================================
# 13) Plotting
# ============================================================

def plot_recommendation(pilot_shots, pilot_pf, matched, fit_result,
                        alpha, nq, out_prefix,
                        actual_curve=None):
    def curve_fn(F_inf, a, b, n):
        return F_inf - a / (n ** b)

    n_star = fit_result["n_star_rounded"]
    x_max = max(n_star * 2, 2000)
    n_dense = np.linspace(10, x_max, 400)

    fig, axes = plt.subplots(1, 2, figsize=(14, 5.5))

    ax = axes[0]
    for i, (dist, nb) in enumerate(matched):
        shots_nb, y_nb = [], []
        for s_str, stats in nb.real_fid_summary.items():
            try:
                s = int(s_str)
            except ValueError:
                continue
            m = safe_float(stats.get("mean"))
            if np.isfinite(m):
                shots_nb.append(s)
                y_nb.append(m)
        if shots_nb:
            order = np.argsort(shots_nb)
            ax.plot(np.array(shots_nb)[order], np.array(y_nb)[order],
                    'o-', alpha=0.4, markersize=3,
                    label=f"Neighbor {i+1} (d={dist:.4f})")

    y_fit = curve_fn(fit_result["F_inf"], fit_result["a"],
                     fit_result["b"], n_dense)
    y_fit = np.clip(y_fit, 0.0, 1.0)  # avoid unrealistic negative values
    ax.plot(n_dense, y_fit, 'r-', linewidth=2.5,
            label=f"Fit: F_inf={fit_result['F_inf']:.4f}")

    if actual_curve:
        shots_a, y_a = [], []
        for s_str, stats in actual_curve.items():
            try:
                s = int(s_str)
            except ValueError:
                continue
            m = safe_float(stats.get("mean"))
            if np.isfinite(m):
                shots_a.append(s)
                y_a.append(m)
        if shots_a:
            order = np.argsort(shots_a)
            ax.plot(np.array(shots_a)[order], np.array(y_a)[order],
                    'k*-', markersize=8, linewidth=1.5, label="Actual (test)")

    ax.axvline(n_star, color='red', linestyle=':', linewidth=1.5,
               label=f"Recommended = {n_star}")
    ax.axhline(fit_result["target"], color='orange', linestyle=':',
               linewidth=1.2, label=f"Target = {fit_result['target']:.4f}")
    if "F_conv_pred" in fit_result:
        ax.axhline(fit_result["F_conv_pred"], color='green', linestyle='--',
                   linewidth=1.0, alpha=0.6,
                   label=f"F_conv_pred = {fit_result['F_conv_pred']:.4f}")
    if "c_std" in fit_result and fit_result["c_std"] > 0:
        z = fit_result.get("z_val", 1.645)
        c = fit_result["c_std"]
        n_band = np.linspace(max(10, n_star * 0.3), n_star * 2.5, 200)
        mean_band = fit_result["F_inf"] - fit_result["a"] / (n_band ** fit_result["b"])
        lower_band = mean_band - z * c / np.sqrt(n_band)
        mean_band = np.clip(mean_band, 0.0, 1.0)
        lower_band = np.clip(lower_band, 0.0, 1.0)
        ax.fill_between(n_band, lower_band, mean_band, alpha=0.1, color='red',
                        label="95% confidence band")
    ax.set_xlabel("Shots")
    ax.set_ylabel("Real Fidelity")
    ax.set_title(f"Real fidelity prediction (nq={nq})")
    ax.set_ylim(0.0, 1.02)  # fixed range for cross-plot comparison
    ax.legend(fontsize=7, loc="lower right")
    ax.grid(True, linestyle=':', alpha=0.4)

    ax2 = axes[1]
    if pilot_pf:
        ps = sorted(pilot_pf.keys())
        ax2.plot(ps, [pilot_pf[s] for s in ps], 'ko-', markersize=6,
                 linewidth=2, label="Pilot PF")
    for i, (dist, nb) in enumerate(matched):
        pf_s, pf_v = [], []
        for s_str, stats in nb.pf_summary.items():
            try:
                s = int(s_str)
            except ValueError:
                continue
            m = safe_float(stats.get("mean"))
            if np.isfinite(m):
                pf_s.append(s)
                pf_v.append(m)
        if pf_s:
            order = np.argsort(pf_s)
            ax2.plot(np.array(pf_s)[order], np.array(pf_v)[order],
                     's--', alpha=0.5, markersize=3,
                     label=f"Neighbor {i+1} PF")
    ax2.set_xlabel("Shots")
    ax2.set_ylabel("Progressive Fidelity")
    ax2.set_title("PF curve matching")
    ax2.set_ylim(0.0, 1.02)  # fixed range for consistency
    ax2.legend(fontsize=7, loc="lower right")
    ax2.grid(True, linestyle=':', alpha=0.4)

    fig.tight_layout()
    path = f"{out_prefix}_recommendation.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"[Plot] Saved: {path}")

    # ── Save plot data as JSON for later re-plotting ──
    plot_data = {
        "nq": nq,
        "alpha": alpha,
        "fit_result": {
            k: (float(v) if isinstance(v, (int, float, np.integer, np.floating)) else v)
            for k, v in fit_result.items()
        },
        "neighbors_real_fidelity": [],
        "neighbors_pf": [],
        "pilot_pf": {int(s): float(v) for s, v in pilot_pf.items()} if pilot_pf else {},
        "actual_curve": None,
    }

    # Neighbor real fidelity curves
    for i, (dist, nb) in enumerate(matched):
        shots_nb, y_nb = [], []
        for s_str, stats in nb.real_fid_summary.items():
            try:
                s = int(s_str)
            except ValueError:
                continue
            m = safe_float(stats.get("mean"))
            std_val = safe_float(stats.get("std", 0))
            if np.isfinite(m):
                shots_nb.append(s)
                y_nb.append({"mean": m, "std": std_val})
        order = np.argsort(shots_nb).tolist()
        plot_data["neighbors_real_fidelity"].append({
            "neighbor_idx": i + 1,
            "record_id": nb.record_id,
            "distance": float(dist),
            "converged_shots": nb.converged_shots,
            "noise_file": nb.noise_file,
            "shots": [shots_nb[j] for j in order],
            "fidelity": [y_nb[j] for j in order],
        })

    # Neighbor PF curves
    for i, (dist, nb) in enumerate(matched):
        pf_s, pf_v = [], []
        for s_str, stats in nb.pf_summary.items():
            try:
                s = int(s_str)
            except ValueError:
                continue
            m = safe_float(stats.get("mean"))
            std_val = safe_float(stats.get("std", 0))
            if np.isfinite(m):
                pf_s.append(s)
                pf_v.append({"mean": m, "std": std_val})
        order = np.argsort(pf_s).tolist()
        plot_data["neighbors_pf"].append({
            "neighbor_idx": i + 1,
            "record_id": nb.record_id,
            "distance": float(dist),
            "shots": [pf_s[j] for j in order],
            "pf": [pf_v[j] for j in order],
        })

    # Actual curve (test ground truth)
    if actual_curve:
        shots_a, y_a = [], []
        for s_str, stats in actual_curve.items():
            try:
                s = int(s_str)
            except ValueError:
                continue
            m = safe_float(stats.get("mean"))
            std_val = safe_float(stats.get("std", 0))
            if np.isfinite(m):
                shots_a.append(s)
                y_a.append({"mean": m, "std": std_val})
        order = np.argsort(shots_a).tolist()
        plot_data["actual_curve"] = {
            "shots": [shots_a[j] for j in order],
            "fidelity": [y_a[j] for j in order],
        }

    data_path = f"{out_prefix}_recommendation_data.json"
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(plot_data, f, indent=2, ensure_ascii=False)
    print(f"[Data] Saved: {data_path}")


# ============================================================
# 13b) GNN Fallback for outlier circuits
# ============================================================

class GNNFallback:
    """Wraps the DualGraphFidelityNet for shots recommendation.

    When a query circuit is an outlier (no matching cluster), this
    class predicts fidelity at each shots level in SHOTS_SEQUENCE
    and finds the convergence point.
    """

    def __init__(self, ckpt_path: str):
        self.ckpt_path = Path(ckpt_path)
        self._model = None
        self._ckpt = None
        self._device = None
        print(f"[GNN] Checkpoint registered: {self.ckpt_path}")

    def _lazy_load(self):
        """Load model on first use to avoid import errors if not needed."""
        if self._model is not None:
            return

        import torch
        # Package-relative imports so Qshot works as a proper Python package
        # under `qlib.qshot.*` instead of relying on `sys.path` tricks.
        from .dual_gnn_model import DualGraphFidelityNet
        from .show_dag import qasm_to_graph_data
        from .train_dual_gnn import (
            BACKEND_FEATURE_KEYS, CIRCUIT_FEATURE_KEYS,
            normalize_tensor,
        )
        # store references for later use
        self._qasm_to_graph_data = qasm_to_graph_data
        self._normalize_tensor = normalize_tensor
        self._torch = torch
        self._BACKEND_FEATURE_KEYS = BACKEND_FEATURE_KEYS
        self._CIRCUIT_FEATURE_KEYS = CIRCUIT_FEATURE_KEYS

        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._ckpt = torch.load(self.ckpt_path, map_location="cpu")

        self._model = DualGraphFidelityNet(
            node_dim=self._ckpt["node_dim"],
            edge_dim=self._ckpt["edge_dim"],
            shot_dim=self._ckpt["shot_dim"],
            backend_dim=self._ckpt["backend_dim"],
            circuit_dim=self._ckpt["circuit_dim"],
            graph_attr_dim=self._ckpt["graph_attr_dim"],
            hidden_dim=self._ckpt["hidden_dim"],
            gnn_layers=self._ckpt["gnn_layers"],
            dropout=self._ckpt["dropout"],
            predict_uncertainty=self._ckpt["predict_uncertainty"],
        ).to(self._device)
        self._model.load_state_dict(self._ckpt["model_state"])
        self._model.eval()
        print(f"[GNN] Model loaded on {self._device}")

    def _write_temp_qasm(self, qc, path):
        """Write a QuantumCircuit to a temporary QASM file."""
        try:
            from qiskit.qasm3 import dumps as qasm3_dumps
            path.write_text(qasm3_dumps(qc), encoding="utf-8")
        except Exception:
            try:
                path.write_text(qc.qasm(), encoding="utf-8")
            except Exception:
                path.write_text(str(qc), encoding="utf-8")

    def _build_record_dict(self, feats_q, noise_features_q, nq,
                           converged_shots, real_curve_len, sample_reps,
                           noise_json=None, tqc=None):
        """Build a minimal record dict compatible with the GNN dataset loader."""
        # Use full noise_summary from noise_json if available
        if noise_json is not None:
            ns = dict(noise_json.get("noise_summary", {}))
        else:
            ns = {}
            for k, v in noise_features_q.items():
                ns[k] = v
            # ensure required keys exist with fallback defaults
            ns.setdefault("T1_mean", 0.0)
            ns.setdefault("T2_mean", 0.0)
            ns.setdefault("prob_meas0_prep1_mean", 0.0)
            ns.setdefault("prob_meas1_prep0_mean", 0.0)
            ns.setdefault("sx_gate_error_mean", 0.0)
            ns.setdefault("twoq_gate_error_mean", 0.0)

        feats = dict(feats_q)
        feats["num_qubits"] = float(nq)

        # Add gate-type counts from transpiled circuit if available
        if tqc is not None:
            op_counts = tqc.count_ops()
            for gate_name in ["cx", "ecr", "cz", "rz", "ry", "rx", "sx", "h"]:
                feats.setdefault(gate_name, float(op_counts.get(gate_name, 0)))

        return {
            "features": feats,
            "noise_source": {"noise_summary": ns},
            "transpile": {"optimization_level": OPT_LEVEL},
            "convergence": {"converged": False, "converged_shots": converged_shots},
            "real_fidelity_curve": {
                "shots_sequence": [],
                "sample_reps": sample_reps,
            },
        }

    def _load_noise_features_from_dict(self, record):
        """Mirror of QAOADualGraphDataset._load_noise_features."""
        torch = self._torch
        noise_summary = record.get("noise_source", {}).get("noise_summary", {})
        norm_vec = noise_summary.get("normalized_feature_vector", {})

        num_cz = float(record.get("features", {}).get("cz", 0.0))
        num_cx = float(record.get("features", {}).get("cx", 0.0))
        num_ecr = float(record.get("features", {}).get("ecr", 0.0))
        twoq_type = ""
        if num_cz > 0: twoq_type = "cz"
        elif num_cx > 0: twoq_type = "cx"
        elif num_ecr > 0: twoq_type = "ecr"

        feat_map = {
            "n_qubits": float(record.get("features", {}).get("num_qubits", 0.0)),
            "num_qubit_entries": float(record.get("features", {}).get("num_qubits", 0.0)),
            "num_sx_edges": 0.0,
            "num_twoq_edges": float(record.get("features", {}).get("unique_2q_edges", 0.0)),
            "T1_mean": float(noise_summary.get("T1_mean", 0.0)),
            "T1_std": 0.0,
            "T2_mean": float(noise_summary.get("T2_mean", 0.0)),
            "T2_std": 0.0,
            "prob_meas0_prep1_mean": float(noise_summary.get("prob_meas0_prep1_mean", 0.0)),
            "prob_meas1_prep0_mean": float(noise_summary.get("prob_meas1_prep0_mean", 0.0)),
            "sx_gate_error_mean": float(noise_summary.get("sx_gate_error_mean", 0.0)),
            "twoq_gate_error_mean": float(noise_summary.get("twoq_gate_error_mean", 0.0)),
            "T1_inv_mean": 1.0 / max(float(noise_summary.get("T1_mean", 0.0)), 1e-6),
            "T2_inv_mean": 1.0 / max(float(noise_summary.get("T2_mean", 0.0)), 1e-6),
            "noise_score": (
                float(noise_summary.get("sx_gate_error_mean", 0.0))
                + float(noise_summary.get("twoq_gate_error_mean", 0.0))
                + float(noise_summary.get("prob_meas0_prep1_mean", 0.0))
                + float(noise_summary.get("prob_meas1_prep0_mean", 0.0))
            ) / 4.0,
            "norm_T1_inv_mean": float(norm_vec.get("T1_inv_mean", 0.0)),
            "norm_T2_inv_mean": float(norm_vec.get("T2_inv_mean", 0.0)),
            "norm_prob_meas0_prep1_mean": float(norm_vec.get("prob_meas0_prep1_mean", 0.0)),
            "norm_prob_meas1_prep0_mean": float(norm_vec.get("prob_meas1_prep0_mean", 0.0)),
            "norm_sx_gate_error_mean": float(norm_vec.get("sx_gate_error_mean", 0.0)),
            "norm_twoq_gate_error_mean": float(norm_vec.get("twoq_gate_error_mean", 0.0)),
            "twoq_gate_is_cz": 1.0 if twoq_type == "cz" else 0.0,
            "twoq_gate_is_cx": 1.0 if twoq_type == "cx" else 0.0,
            "twoq_gate_is_ecr": 1.0 if twoq_type == "ecr" else 0.0,
        }
        return torch.tensor(
            [feat_map[k] for k in self._BACKEND_FEATURE_KEYS], dtype=torch.float32)

    def _load_circuit_features_from_dict(self, record):
        """Mirror of QAOADualGraphDataset._load_circuit_features."""
        torch = self._torch
        feat_src = dict(record.get("features", {}))
        feat_src["optimization_level"] = float(
            record.get("transpile", {}).get("optimization_level", 0.0))
        feat_src["converged"] = 1.0 if record.get(
            "convergence", {}).get("converged", False) else 0.0
        feat_src["converged_shots"] = float(
            record.get("convergence", {}).get("converged_shots", 0.0) or 0.0)
        feat_src["real_curve_len"] = float(
            len(record.get("real_fidelity_curve", {}).get("shots_sequence", [])))
        feat_src["sample_reps"] = float(
            record.get("real_fidelity_curve", {}).get("sample_reps", 0.0))
        return torch.tensor(
            [float(feat_src.get(k, 0.0)) for k in self._CIRCUIT_FEATURE_KEYS],
            dtype=torch.float32)

    @staticmethod
    def _find_convergence(shots_list, fid_list, w=3, eps=0.003, n_min=4):
        """Find convergence point from predicted fidelity curve."""
        if len(fid_list) < n_min:
            return shots_list[-1], False
        for i in range(n_min, len(fid_list)):
            converged = True
            for j in range(max(0, i - w + 1), i):
                if fid_list[j + 1] - fid_list[j] >= eps:
                    converged = False
                    break
            if converged:
                return shots_list[max(0, i - w)], True
        return shots_list[-1], False

    def predict_shots(self, base, tqc, nq, feats_q, noise_features_q,
                      noise_json=None,
                      alpha=ALPHA_DEFAULT, shots_sequence=None,
                      plot_prefix=None,
                      actual_real_curve=None, actual_converged=None):
        """Use GNN to predict fidelity curve and recommend shots.

        Returns a result dict compatible with recommend_shots output, or None.
        """
        import tempfile
        self._lazy_load()
        torch = self._torch

        print("  [GNN] Running GNN fallback for outlier circuit...")

        # Use provided sequence, or default to general sequence
        # (GNN is trained on general circuits only, not QAOA)
        if shots_sequence is None:
            shots_sequence = list(SHOTS_SEQUENCE_DEFAULT)

        # Write temp QASM files
        tmp_dir = Path(tempfile.mkdtemp(prefix="gnn_shots_"))
        base_qasm_path = tmp_dir / "base.qasm"
        transpiled_qasm_path = tmp_dir / "transpiled.qasm"
        self._write_temp_qasm(base, base_qasm_path)
        self._write_temp_qasm(tqc, transpiled_qasm_path)

        # Build graph representations
        try:
            pre_graph, pre_attr = self._qasm_to_graph_data(base_qasm_path)
            post_graph, post_attr = self._qasm_to_graph_data(transpiled_qasm_path)
        except Exception as e:
            print(f"  [GNN] Failed to build graph from QASM: {e}")
            return None

        graph_attr_feat = torch.cat([pre_attr, post_attr, post_attr - pre_attr], dim=0)

        # Build feature vectors using full noise JSON when available
        record_dict = self._build_record_dict(
            feats_q, noise_features_q, nq,
            converged_shots=0, real_curve_len=0, sample_reps=30,
            noise_json=noise_json, tqc=tqc,
        )
        backend_feat = self._load_noise_features_from_dict(record_dict)
        circuit_feat = self._load_circuit_features_from_dict(record_dict)

        stats = self._ckpt["feature_stats"]
        normalize = self._normalize_tensor

        # Predict curve parameters (f_inf, theta, log_c) once, then
        # compute fidelity/variance analytically for all shots levels.
        shots_list = shots_sequence

        backend_norm = normalize(backend_feat, stats["backend"]).unsqueeze(0).to(self._device)
        circuit_norm = normalize(circuit_feat, stats["circuit"]).unsqueeze(0).to(self._device)
        graph_attr_norm = normalize(graph_attr_feat, stats["graph_attr"]).unsqueeze(0).to(self._device)

        pre_batch = pre_graph.clone().to(self._device)
        pre_batch.batch = torch.zeros(pre_batch.x.size(0), dtype=torch.long, device=self._device)
        post_batch = post_graph.clone().to(self._device)
        post_batch.batch = torch.zeros(post_batch.x.size(0), dtype=torch.long, device=self._device)

        with torch.no_grad():
            f_inf, theta, log_c = self._model.predict_curve_params(
                pre_batch, post_batch, backend_norm, circuit_norm, graph_attr_norm)

        shots_tensor = torch.tensor(shots_list, dtype=torch.float32)
        pred_fid_tensor = self._model.compute_fidelity(shots_tensor, f_inf, theta)
        pred_fids = pred_fid_tensor.cpu().tolist()

        if self._ckpt["predict_uncertainty"]:
            pred_var_tensor = self._model.compute_variance(shots_tensor, log_c)
            pred_stds = torch.sqrt(pred_var_tensor).cpu().tolist()
        else:
            pred_stds = [0.0] * len(shots_list)

        print(f"  [GNN] Curve params: f_inf={float(f_inf):.4f}, "
              f"theta={float(theta):.1f}, log_c={float(log_c):.4f}")

        # Clean up temp files
        try:
            base_qasm_path.unlink(missing_ok=True)
            transpiled_qasm_path.unlink(missing_ok=True)
            tmp_dir.rmdir()
        except Exception:
            pass

        print(f"  [GNN] Predicted fidelity curve:")
        for s, f, st in zip(shots_list, pred_fids, pred_stds):
            print(f"    shots={s:>6d}  fid={f:.4f}  std={st:.4f}")

        # Find convergence and set target
        conv_shots, converged = self._find_convergence(shots_list, pred_fids)
        F_inf = pred_fids[-1]
        target = alpha * F_inf

        # GNN recommendation: use convergence detection directly.
        # Unlike the regression path which has reliable std estimates from
        # matched neighbors, the GNN's uncertainty prediction does not
        # capture the 1/sqrt(s) scaling, making the confidence bound
        # criterion unreliable. Instead, we recommend the convergence
        # point where the predicted fidelity curve has plateaued.
        if converged:
            n_star = conv_shots
        else:
            # If no convergence detected, find smallest s where F(s) >= target
            n_star = shots_list[-1]
            for s, f in zip(shots_list, pred_fids):
                if f >= target:
                    n_star = s
                    break

        # Look up predicted fidelity/std at recommended point
        rec_idx = shots_list.index(n_star) if n_star in shots_list else -1
        pred_fid_at_rec = pred_fids[rec_idx]
        pred_std_at_rec = pred_stds[rec_idx]

        print(f"\n  === GNN Recommendation ===")
        print(f"  F_inf (predicted) = {F_inf:.4f}")
        print(f"  Target = {alpha} x {F_inf:.4f} = {target:.4f}")
        print(f"  Convergence detected: {converged} @ {conv_shots}")
        print(f"  Predicted F({n_star}) = {pred_fid_at_rec:.4f} "
              f"± {pred_std_at_rec:.4f}")
        print(f"  RECOMMENDED SHOTS = {n_star}")

        # Plot
        if plot_prefix:
            self._plot_gnn_result(
                shots_list, pred_fids, pred_stds,
                n_star, target, F_inf, alpha, nq, plot_prefix,
                actual_curve=actual_real_curve,
            )

        return {
            "recommended_shots": n_star,
            "method": "gnn_fallback",
            "predicted_fidelity": pred_fid_at_rec,
            "predicted_std": pred_std_at_rec,
            "fit": {
                "F_inf": F_inf, "target": target, "alpha": alpha,
                "z_val": None,  # GNN uses convergence detection, not confidence bound
                "n_star_rounded": n_star, "converged": converged,
                "conv_shots": conv_shots,
            },
            "gnn_curve": {
                "shots": shots_list,
                "pred_fidelity": pred_fids,
                "pred_std": pred_stds,
            },
            "cluster_label": -1,
            "tier": -1,
            "n_matched": 0,
            "pilot_pf": {},
            "actual_converged": actual_converged,
        }

    def _plot_gnn_result(self, shots_list, pred_fids, pred_stds,
                         n_star, target, F_inf, alpha, nq, out_prefix,
                         actual_curve=None):
        """Plot GNN prediction result."""
        fig, ax = plt.subplots(figsize=(8, 5.5))

        ax.plot(shots_list, pred_fids, 'r-o', linewidth=2, markersize=4,
                label=f"GNN predicted (F_inf={F_inf:.4f})")

        # Confidence band
        pred_fids_arr = np.array(pred_fids)
        pred_stds_arr = np.array(pred_stds)
        if np.any(pred_stds_arr > 0):
            lower = np.clip(pred_fids_arr - 1.96 * pred_stds_arr, 0, 1)
            upper = np.clip(pred_fids_arr + 1.96 * pred_stds_arr, 0, 1)
            ax.fill_between(shots_list, lower, upper, alpha=0.15, color='red',
                            label="GNN 95% CI")

        if actual_curve:
            shots_a, y_a = [], []
            for s_str, stats in actual_curve.items():
                try:
                    s = int(s_str)
                except ValueError:
                    continue
                m = safe_float(stats.get("mean"))
                if np.isfinite(m):
                    shots_a.append(s)
                    y_a.append(m)
            if shots_a:
                order = np.argsort(shots_a)
                ax.plot(np.array(shots_a)[order], np.array(y_a)[order],
                        'k*-', markersize=8, linewidth=1.5, label="Actual (test)")

        ax.axvline(n_star, color='red', linestyle=':', linewidth=1.5,
                   label=f"Recommended = {n_star}")
        ax.axhline(target, color='orange', linestyle=':',
                   linewidth=1.2, label=f"Target = {target:.4f}")

        ax.set_xlabel("Shots")
        ax.set_ylabel("Real Fidelity")
        ax.set_title(f"GNN Fallback prediction (nq={nq}, outlier)")
        ax.set_ylim(0.0, 1.02)
        ax.legend(fontsize=7, loc="lower right")
        ax.grid(True, linestyle=':', alpha=0.4)

        fig.tight_layout()
        path = f"{out_prefix}_gnn_recommendation.png"
        fig.savefig(path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        print(f"[Plot] Saved: {path}")

        # Save data JSON
        data_path = f"{out_prefix}_gnn_recommendation_data.json"
        plot_data = {
            "method": "gnn_fallback",
            "nq": nq, "alpha": alpha,
            "n_star": n_star, "target": target, "F_inf": F_inf,
            "shots": shots_list,
            "pred_fidelity": pred_fids,
            "pred_std": pred_stds,
            "actual_curve": None,
        }
        if actual_curve:
            shots_a, y_a = [], []
            for s_str, stats in actual_curve.items():
                try:
                    s = int(s_str)
                except ValueError:
                    continue
                m = safe_float(stats.get("mean"))
                std_val = safe_float(stats.get("std", 0))
                if np.isfinite(m):
                    shots_a.append(s)
                    y_a.append({"mean": m, "std": std_val})
            order = np.argsort(shots_a).tolist()
            plot_data["actual_curve"] = {
                "shots": [shots_a[j] for j in order],
                "fidelity": [y_a[j] for j in order],
            }
        with open(data_path, "w", encoding="utf-8") as f:
            json.dump(plot_data, f, indent=2, ensure_ascii=False)
        print(f"[Data] Saved: {data_path}")


# ============================================================
# 14) Main recommendation flow
# ============================================================

def recommend_shots(
    train_db, X_train, mu, sd, cluster_info,
    clusterer,
    # Input circuit (QPY path or built circuit)
    base: QuantumCircuit,
    nq: int,
    # Noise condition
    sim: AerSimulator,
    noise_features_q: Dict[str, float],
    # Settings
    circuit_feature_keys: List[str],
    noise_feature_keys: List[str],
    alpha=ALPHA_DEFAULT,
    k_struct=K_STRUCT, k_pf=K_PF_MATCH,
    pilot_points=PILOT_POINTS, pilot_reps=PILOT_REPS,
    z_val=Z_VAL,
    plot_prefix=None,
    actual_real_curve=None, actual_converged=None,
    gnn_fallback=None,
    noise_json=None,
):
    # --- Transpile + extract features ---
    qc_meas = base.copy()
    qc_meas.measure_all()
    tqc = transpile(qc_meas, sim, optimization_level=OPT_LEVEL,
                    seed_transpiler=SEED_TRANSPILE)

    feats_q = extract_features(tqc)

    # Build query vector: circuit features + noise features
    circ_row = [safe_float(feats_q.get(k, np.nan)) for k in circuit_feature_keys]
    noise_row = [safe_float(noise_features_q.get(k, np.nan)) for k in noise_feature_keys]
    xq = np.array(circ_row + noise_row, dtype=float)

    if not np.all(np.isfinite(xq)):
        print("[WARN] Query has NaN features.")
        return None

    print(f"  Circuit features: { {k: feats_q.get(k) for k in circuit_feature_keys} }")
    print(f"  Noise features:   { {k: f'{v:.4e}' for k, v in noise_features_q.items()} }")

    # --- Helper: call GNN fallback ---
    def _try_gnn(shots_seq=None):
        if gnn_fallback is None:
            return None
        return gnn_fallback.predict_shots(
            base=base, tqc=tqc, nq=nq,
            feats_q=feats_q, noise_features_q=noise_features_q,
            noise_json=noise_json,
            alpha=alpha, shots_sequence=shots_seq,
            plot_prefix=plot_prefix,
            actual_real_curve=actual_real_curve,
            actual_converged=actual_converged,
        )

    # --- Find nearest cluster ---
    cluster_label, cluster_indices = find_nearest_cluster(
        xq, train_db, X_train, mu, sd, cluster_info,
        clusterer=clusterer)

    if cluster_label == -1 or not cluster_indices:
        print("[OUTLIER] No matching cluster found → trying GNN fallback.")
        return _try_gnn()  # no sequence info → GNN uses merged sequence

    cluster_records = [train_db[i] for i in cluster_indices]
    print(f"  Cluster: {cluster_label} ({len(cluster_records)} records)")

    # --- Detect which shots sequence this cluster uses ---
    active_shots_seq = detect_shots_sequence(cluster_records)
    seq_tag = "QAOA" if active_shots_seq is SHOTS_SEQUENCE_QAOA else "General"
    print(f"  Shots sequence: {seq_tag} "
          f"({active_shots_seq[0]}..{active_shots_seq[-1]}, "
          f"{len(active_shots_seq)} levels)")

    # --- kNN → vote tier ---
    Xz_cluster = zscore_apply(X_train[cluster_indices], mu, sd)
    xqz = zscore_apply(xq[None, :], mu, sd)[0]
    dists = euclid_distances(Xz_cluster, xqz)
    order = np.argsort(dists)
    k_s = min(k_struct, len(order))
    neighbors_struct = [cluster_records[i] for i in order[:k_s]]

    tier = vote_tier(neighbors_struct)
    tier_bounds = cluster_info[cluster_label]["tier_bounds"]
    print(f"  Tier: {tier} (bounds: {tier_bounds})")

    # --- Pilot shots ---
    pilot_shots = determine_pilot_shots(tier, tier_bounds,
                                        active_shots_seq, pilot_points)
    print(f"  Pilot shots: {pilot_shots}")

    if len(pilot_shots) < 2:
        print("[RESULT] Not enough pilot shots → trying GNN fallback.")
        return _try_gnn(active_shots_seq)

    # --- Run pilot PF ---
    print(f"  Running pilot ({pilot_reps} reps per level)...")
    pilot_pf, pilot_pf_stds = compute_pilot_pf(
        tqc, nq, pilot_shots, sim, reps=pilot_reps,
        seed=99991 + hash(str(base)) % (2**20))

    print(f"  Pilot PF: { {s: f'{v:.4f}' for s, v in pilot_pf.items()} }")

    # --- Match PF ---
    matched = match_by_pf(pilot_pf, cluster_records, k=k_pf)
    if not matched:
        print("[RESULT] No PF-matched neighbors → trying GNN fallback.")
        return _try_gnn(active_shots_seq)

    print(f"  PF-matched {len(matched)} neighbors:")
    for dist, nb in matched:
        print(f"    {nb.record_id}  dist={dist:.4f}  "
              f"conv_shots={nb.converged_shots}  noise={nb.noise_file[:30]}...")

    # --- Fit ---
    fit_result = fit_from_neighbors(matched, alpha=alpha, z_val=z_val)
    if fit_result is None:
        print("[RESULT] Fitting failed → trying GNN fallback.")
        return _try_gnn(active_shots_seq)

    print(f"\n  === Recommendation ===")
    print(f"  Curve fit: F_inf={fit_result['F_inf']:.4f}  "
          f"a={fit_result['a']:.4f}  b={fit_result['b']:.3f}")
    print(f"  Target: {alpha} x {fit_result['F_conv_pred']:.4f} = {fit_result['target']:.4f}")
    print(f"  RECOMMENDED SHOTS = {fit_result['n_star_rounded']}")

    # Compute predicted fidelity and std at recommended shots
    s_rec = fit_result["n_star_rounded"]
    pred_fid_at_rec = fit_result["F_inf"] - fit_result["a"] / (s_rec ** fit_result["b"])
    pred_std_at_rec = fit_result["c_std"] / math.sqrt(s_rec)
    print(f"  Predicted F({s_rec}) = {pred_fid_at_rec:.4f} ± {pred_std_at_rec:.4f}")
    print(f"  Lower bound = {pred_fid_at_rec - z_val * pred_std_at_rec:.4f} "
          f"(z={z_val})")

    if plot_prefix:
        plot_recommendation(pilot_shots, pilot_pf, matched, fit_result,
                            alpha, nq, plot_prefix, actual_curve=actual_real_curve)

    return {
        "recommended_shots": fit_result["n_star_rounded"],
        "method": "regression",
        "predicted_fidelity": pred_fid_at_rec,
        "predicted_std": pred_std_at_rec,
        "fit": fit_result,
        "cluster_label": cluster_label,
        "tier": tier,
        "n_matched": len(matched),
        "pilot_pf": pilot_pf,
        "actual_converged": actual_converged,
    }


# ============================================================
# 15) Test-set evaluation
# ============================================================

def _lookup_actual_fidelity(real_fid_summary, recommended_shots):
    """Look up actual fidelity at recommended shots from ground-truth curve.

    Finds the smallest shots level >= recommended_shots in the curve.
    If recommended_shots exceeds all levels, uses the maximum.

    Returns (actual_fid_at_rec, actual_fid_at_max) or (None, None).
    """
    if not real_fid_summary:
        return None, None

    # Parse all (shots, mean_fidelity) pairs
    curve = []
    for s_str, stats in real_fid_summary.items():
        try:
            s = int(s_str)
        except ValueError:
            continue
        m = safe_float(stats.get("mean"))
        if np.isfinite(m):
            curve.append((s, m))

    if not curve:
        return None, None

    curve.sort(key=lambda x: x[0])
    actual_at_max = curve[-1][1]

    # Find smallest shots level >= recommended
    actual_at_rec = None
    for s, f in curve:
        if s >= recommended_shots:
            actual_at_rec = f
            break

    # If recommended exceeds all levels, use max
    if actual_at_rec is None:
        actual_at_rec = actual_at_max

    return actual_at_rec, actual_at_max


def evaluate_test_set(train_db, X_train, mu, sd, cluster_info,
                      clusterer,
                      test_db, circuit_feature_keys, noise_feature_keys,
                      noise_json_map, alpha=ALPHA_DEFAULT,
                      out_dir="eval_v4", gnn_fallback=None):
    os.makedirs(out_dir, exist_ok=True)
    results = []
    print(f"\n{'='*60}")
    print(f"  Evaluating {len(test_db)} test circuits")
    print(f"{'='*60}")

    for i, test_rec in enumerate(test_db):
        print(f"\n--- Test {i+1}/{len(test_db)}: {test_rec.record_id} ---")

        # Reconstruct base circuit: try base_spec (v3) or base.qasm (v4.1)
        base = None

        # Try reading record.json for circuit reconstruction info
        rj = test_rec.rec_dir / "record.json"
        if rj.exists():
            with rj.open() as f:
                rec_data = json.load(f)
            # If base_spec exists (v3), build from spec
            base_spec = rec_data.get("base_spec")
            if base_spec:
                family = base_spec.get("family", "")
                nq = base_spec.get("num_qubits", test_rec.nq)
                reps = base_spec.get("reps", 1)
                seed = base_spec.get("seed", 0)
                variant = base_spec.get("variant", {})
                rng = np.random.default_rng(seed)
                if family == "qaoa_like":
                    base = build_qaoa_like(nq, reps,
                                           variant.get("angle_scale", 1.0), rng)

        # Fallback: load from base.qasm file (v4.1 schema)
        if base is None:
            base_qasm_path = test_rec.rec_dir / "base.qasm"
            if base_qasm_path.exists():
                try:
                    with open(base_qasm_path, "r") as fq:
                        qasm_str = fq.read()
                    if qasm_str.strip().startswith("OPENQASM 3"):
                        try:
                            from qiskit.qasm3 import loads as qasm3_loads
                            base = qasm3_loads(qasm_str)
                        except Exception:
                            qasm_str = _qasm3_to_qasm2(qasm_str)
                            base = QuantumCircuit.from_qasm_str(qasm_str)
                    else:
                        base = QuantumCircuit.from_qasm_str(qasm_str)
                except Exception as e:
                    print(f"  [WARN] Failed to load base.qasm: {e}")

        if base is None:
            print("  [SKIP] Cannot reconstruct circuit")
            continue

        # Get sim for this test record's noise condition
        noise_file = test_rec.noise_file
        if noise_file in noise_json_map:
            sim = noise_json_map[noise_file]["sim"]
            nf_q = noise_json_map[noise_file]["noise_features"]
            nj_full = noise_json_map[noise_file].get("json", None)
        else:
            print(f"  [SKIP] No noise JSON for {noise_file}")
            continue

        plot_prefix = os.path.join(out_dir,
            f"test_{i+1}_{test_rec.nq}q_{test_rec.record_id[:8]}")

        res = recommend_shots(
            train_db=train_db, X_train=X_train, mu=mu, sd=sd,
            cluster_info=cluster_info, clusterer=clusterer,
            base=base, nq=test_rec.nq,
            sim=sim, noise_features_q=nf_q,
            circuit_feature_keys=circuit_feature_keys,
            noise_feature_keys=noise_feature_keys,
            alpha=alpha, plot_prefix=plot_prefix,
            actual_real_curve=test_rec.real_fid_summary,
            actual_converged=test_rec.converged_shots,
            gnn_fallback=gnn_fallback,
            noise_json=nj_full,
        )
        if res is not None:
            # Look up actual fidelity at recommended shots from ground-truth curve
            rec_shots = res["recommended_shots"]
            actual_at_rec, actual_at_max = _lookup_actual_fidelity(
                test_rec.real_fid_summary, rec_shots)
            target = res["fit"].get("target", 0.0)

            res["actual_fidelity_at_rec"] = actual_at_rec
            res["actual_fidelity_at_max"] = actual_at_max
            res["target"] = target
            res["sufficient"] = (actual_at_rec >= target) if actual_at_rec is not None else None
            res["fidelity_gap"] = (actual_at_rec - target) if actual_at_rec is not None else None
            results.append(res)

    # Summary
    print(f"\n{'='*60}")
    print(f"  Evaluation Summary")
    print(f"{'='*60}")

    if not results:
        print("  No successful recommendations.")
        return

    evaluated = [r for r in results if r["actual_fidelity_at_rec"] is not None]
    n_regression = sum(1 for r in results if r["method"] == "regression")
    n_gnn = sum(1 for r in results if r["method"] == "gnn_fallback")

    print(f"  Total test: {len(test_db)}  Recommended: {len(results)}  "
          f"Evaluated: {len(evaluated)}")
    print(f"  Methods: regression={n_regression}  gnn_fallback={n_gnn}")

    if evaluated:
        gaps = [r["fidelity_gap"] for r in evaluated]
        n_sufficient = sum(1 for r in evaluated if r["sufficient"])
        print(f"  Sufficiency: {n_sufficient}/{len(evaluated)} "
              f"({100*n_sufficient/len(evaluated):.0f}%) reached target")
        print(f"  Fidelity gap (F_actual - F_target):")
        print(f"    mean={np.mean(gaps):+.4f}  median={np.median(gaps):+.4f}  "
              f"min={np.min(gaps):+.4f}  max={np.max(gaps):+.4f}")

        for r in evaluated:
            tag = "OK" if r["sufficient"] else "MISS"
            print(f"    [{tag}] [{r['method'][:3].upper()}] "
                  f"rec_shots={r['recommended_shots']}  "
                  f"pred_F={r['predicted_fidelity']:.4f}±{r['predicted_std']:.4f}  "
                  f"actual_F={r['actual_fidelity_at_rec']:.4f}  "
                  f"target={r['target']:.4f}  "
                  f"gap={r['fidelity_gap']:+.4f}")

    # ── Save evaluation summary JSON ──
    eval_summary = {
        "total_test": len(test_db),
        "successful": len(results),
        "evaluated": len(evaluated),
        "n_regression": n_regression,
        "n_gnn_fallback": n_gnn,
        "statistics": {},
        "per_circuit": [],
    }
    if evaluated:
        gaps = [r["fidelity_gap"] for r in evaluated]
        n_sufficient = sum(1 for r in evaluated if r["sufficient"])
        eval_summary["statistics"] = {
            "sufficiency_rate": n_sufficient / len(evaluated),
            "fidelity_gap_mean": float(np.mean(gaps)),
            "fidelity_gap_median": float(np.median(gaps)),
            "fidelity_gap_min": float(np.min(gaps)),
            "fidelity_gap_max": float(np.max(gaps)),
        }
    for r in results:
        entry = {
            "recommended_shots": r["recommended_shots"],
            "method": r["method"],
            "predicted_fidelity": r["predicted_fidelity"],
            "predicted_std": r["predicted_std"],
            "actual_fidelity_at_rec": r["actual_fidelity_at_rec"],
            "actual_fidelity_at_max": r["actual_fidelity_at_max"],
            "target": r["target"],
            "sufficient": r["sufficient"],
            "fidelity_gap": r["fidelity_gap"],
            "cluster_label": r["cluster_label"],
            "tier": r["tier"],
            "n_matched": r["n_matched"],
            "fit_F_inf": r["fit"].get("F_inf"),
            "fit_target": r["fit"].get("target"),
        }
        eval_summary["per_circuit"].append(entry)

    summary_path = os.path.join(out_dir, "eval_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(eval_summary, f, indent=2, ensure_ascii=False)
    print(f"\n[Data] Evaluation summary saved: {summary_path}")


# ============================================================
# 16) Circuit builders (for eval reconstruction)
# ============================================================

def build_qaoa_like(nq, reps, angle_scale, rng):
    qc = QuantumCircuit(nq)
    for _ in range(reps):
        for q in range(nq - 1):
            gamma = float(rng.uniform(-angle_scale, angle_scale))
            qc.cx(q, q + 1)
            qc.rz(gamma, q + 1)
            qc.cx(q, q + 1)
        for q in range(nq):
            beta = float(rng.uniform(-angle_scale, angle_scale))
            qc.rx(beta, q)
    return qc


# ============================================================
# 17) Python API — load once, query many
# ============================================================

class QshotRecommender:
    """High-level Python API for shot-count recommendation.

    Loads the reference database + HDBSCAN clusters + (optional) GNN
    fallback at construction time, then serves per-circuit queries
    through `.predict()`. Intended for workflow-platform integration
    where the recommender is a long-lived service.

    Construction is expensive (loads ~3k records, builds clusters);
    `.predict()` is cheap enough to call per request.
    """

    def __init__(
        self,
        dataset_dirs=None,
        gnn_ckpt=None,
        test_ratio=0.1,
        split_seed=42,
        restrict_nq=None,
        min_cluster_size=MIN_CLUSTER_SIZE,
        min_samples=MIN_SAMPLES,
        verbose=True,
    ):
        if dataset_dirs is None:
            if not DEFAULT_DATASET_DIRS:
                raise RuntimeError(
                    "No dataset_dirs provided and no default datasets were "
                    "auto-discovered next to recommend_shots_v4.py.")
            dataset_dirs = list(DEFAULT_DATASET_DIRS)
        dataset_dirs = [Path(d) for d in dataset_dirs]

        if gnn_ckpt is None and DEFAULT_GNN_CKPT is not None:
            gnn_ckpt = DEFAULT_GNN_CKPT

        self.dataset_dirs = dataset_dirs
        self.verbose = verbose
        self.circuit_feature_keys = CIRCUIT_FEATURE_KEYS
        self.noise_feature_keys = NOISE_FEATURE_KEYS

        if verbose:
            print(f"[QshotRecommender] Loading {len(dataset_dirs)} dataset dirs...")
        db_all, X_all = load_all_records(
            dataset_dirs, self.circuit_feature_keys, self.noise_feature_keys,
            restrict_nq=restrict_nq)

        train_db, X_train, _test_db, _X_test, _ = train_test_split(
            db_all, X_all, test_ratio=test_ratio, seed=split_seed)
        if verbose:
            print(f"[QshotRecommender] Train records: {len(train_db)}")

        if verbose:
            print(f"[QshotRecommender] Building HDBSCAN clusters...")
        labels, mu, sd, cluster_info, clusterer = build_clusters(
            train_db, X_train,
            min_cluster_size=min_cluster_size, min_samples=min_samples)
        if verbose:
            n_clusters = len(set(labels) - {-1})
            n_noise = int(np.sum(labels == -1))
            print(f"[QshotRecommender] HDBSCAN: {n_clusters} clusters, "
                  f"{n_noise} noise points")

        self.train_db = train_db
        self.X_train = X_train
        self.mu = mu
        self.sd = sd
        self.cluster_info = cluster_info
        self.clusterer = clusterer

        self.gnn_fallback = None
        if gnn_ckpt is not None:
            if verbose:
                print(f"[QshotRecommender] Loading GNN fallback: {gnn_ckpt}")
            self.gnn_fallback = GNNFallback(str(gnn_ckpt))

    def predict(
        self,
        circuit,
        noise_json,
        nq=None,
        alpha=ALPHA_DEFAULT,
        k_struct=K_STRUCT,
        k_pf=K_PF_MATCH,
        pilot_points=PILOT_POINTS,
        pilot_reps=PILOT_REPS,
        plot_prefix=None,
    ):
        """Recommend shots for one circuit under one noise condition.

        Args:
            circuit:  QuantumCircuit instance OR path to a .qpy file.
            noise_json: path to a noise JSON (str / Path) OR an already-loaded
                noise_json dict.
            nq: number of qubits. Inferred from circuit if not given.
            alpha: target fidelity fraction (default 0.95).
            plot_prefix: if given, saves a diagnostic PNG to
                f"{plot_prefix}_recommendation.png".

        Returns:
            Dict from `recommend_shots`, augmented with keys the caller
            usually wants surfaced: `recommended_shots`, `method`
            ("regression" or "gnn_fallback"), `predicted_fidelity`,
            `predicted_std`. Returns None if recommendation failed.
        """
        # Resolve circuit
        if isinstance(circuit, (str, Path)):
            with open(circuit, "rb") as f:
                base = qpy.load(f)[0]
        elif isinstance(circuit, QuantumCircuit):
            base = circuit
        else:
            raise TypeError(
                f"circuit must be QuantumCircuit or path to .qpy, got {type(circuit)}")

        if nq is None:
            nq = base.num_qubits

        # Resolve noise JSON
        if isinstance(noise_json, (str, Path)):
            nj = load_noise_json(Path(noise_json))
        elif isinstance(noise_json, dict):
            nj = noise_json
        else:
            raise TypeError(
                f"noise_json must be path or dict, got {type(noise_json)}")

        sim = build_sim_from_noise_json(nj)
        nf_q = noise_features_from_json(nj)

        return recommend_shots(
            train_db=self.train_db, X_train=self.X_train,
            mu=self.mu, sd=self.sd,
            cluster_info=self.cluster_info, clusterer=self.clusterer,
            base=base, nq=nq,
            sim=sim, noise_features_q=nf_q,
            circuit_feature_keys=self.circuit_feature_keys,
            noise_feature_keys=self.noise_feature_keys,
            alpha=alpha,
            k_struct=k_struct, k_pf=k_pf,
            pilot_points=pilot_points, pilot_reps=pilot_reps,
            plot_prefix=plot_prefix,
            gnn_fallback=self.gnn_fallback,
            noise_json=nj,
        )


def predict_shots(circuit, noise_json, nq=None, alpha=ALPHA_DEFAULT,
                  dataset_dirs=None, gnn_ckpt=None, **kwargs):
    """One-shot convenience wrapper: builds a QshotRecommender and calls predict().

    Construction is expensive (~30-60s for ~3k records). If you plan to make
    more than one call, instantiate QshotRecommender once and reuse it.
    """
    r = QshotRecommender(
        dataset_dirs=dataset_dirs, gnn_ckpt=gnn_ckpt,
        verbose=kwargs.pop("verbose", True))
    return r.predict(circuit, noise_json, nq=nq, alpha=alpha, **kwargs)


# ============================================================
# 18) CLI
# ============================================================

def main():
    p = argparse.ArgumentParser(
        description="Shots recommender v4: noise-aware, QAOA, multi-DB.")

    p.add_argument("--dataset-dirs", type=str, nargs="+", default=None,
                   help="One or more dataset directories to load. "
                        "If omitted, uses auto-discovered default paths "
                        "(research repo layout or handover package layout).")
    p.add_argument("--noise-json", type=str, default=None,
                   help="Noise JSON for the target circuit (single mode)")
    p.add_argument("--mode", type=str, default="eval",
                   choices=["eval", "single"])

    # Single-circuit params
    p.add_argument("--circuit-qpy", type=str, default=None,
                   help="QPY file of the circuit to recommend for")
    p.add_argument("--nq", type=int, default=5)

    # General
    p.add_argument("--alpha", type=float, default=ALPHA_DEFAULT)
    p.add_argument("--test-ratio", type=float, default=0.1)
    p.add_argument("--split-seed", type=int, default=42)
    p.add_argument("--restrict-nq", type=int, nargs="*", default=None)

    # HDBSCAN
    p.add_argument("--min-cluster-size", type=int, default=MIN_CLUSTER_SIZE)
    p.add_argument("--min-samples", type=int, default=MIN_SAMPLES)

    # kNN
    p.add_argument("--k-struct", type=int, default=K_STRUCT)
    p.add_argument("--k-pf", type=int, default=K_PF_MATCH)
    p.add_argument("--pilot-points", type=int, default=PILOT_POINTS)
    p.add_argument("--pilot-reps", type=int, default=PILOT_REPS)

    # GNN fallback
    p.add_argument("--gnn-ckpt", type=str, default=None,
                   help="Path to DualGraphFidelityNet checkpoint (best_model.pt). "
                        "When provided, outlier circuits use GNN prediction. "
                        "If omitted, auto-discovers a bundled checkpoint if present.")

    args = p.parse_args()

    circuit_fk = CIRCUIT_FEATURE_KEYS
    noise_fk = NOISE_FEATURE_KEYS

    # --- Load all DBs ---
    if args.dataset_dirs:
        dataset_dirs = [Path(d) for d in args.dataset_dirs]
    elif DEFAULT_DATASET_DIRS:
        dataset_dirs = list(DEFAULT_DATASET_DIRS)
        print(f"[INFO] --dataset-dirs not given; using auto-discovered "
              f"default ({dataset_dirs[0].parent}/)")
    else:
        raise SystemExit(
            "[ERROR] --dataset-dirs not given and no default datasets were "
            "auto-discovered next to recommend_shots_v4.py.")
    print(f"[INFO] Loading from {len(dataset_dirs)} directories")

    db_all, X_all = load_all_records(
        dataset_dirs, circuit_fk, noise_fk,
        restrict_nq=args.restrict_nq,
    )

    # --- Train/Test split ---
    train_db, X_train, test_db, X_test, _ = train_test_split(
        db_all, X_all, test_ratio=args.test_ratio, seed=args.split_seed)
    print(f"[INFO] Train: {len(train_db)}  Test: {len(test_db)}")

    # --- Clustering ---
    labels, mu, sd, cluster_info, clusterer = build_clusters(
        train_db, X_train,
        min_cluster_size=args.min_cluster_size,
        min_samples=args.min_samples,
    )
    n_clusters = len(set(labels) - {-1})
    n_noise = int(np.sum(labels == -1))
    print(f"[INFO] HDBSCAN: {n_clusters} clusters, {n_noise} noise points")
    for label, info in cluster_info.items():
        print(f"  Cluster {label}: {len(info['indices'])} records  "
              f"tiers={[f'{b:.0f}' for b in info['tier_bounds']]}")

    # --- Build noise JSON map for eval (sim + features per noise file) ---
    noise_json_map = {}
    noise_files_seen = set()
    for rec in db_all:
        if rec.noise_file and rec.noise_file not in noise_files_seen:
            noise_files_seen.add(rec.noise_file)
            # Try to find the noise JSON next to the dataset dirs.
            # Search both <dir>.parent/ and <dir>.parent/noise_json/ so we
            # work for both the research repo layout and the handover layout.
            found = None
            for d in dataset_dirs:
                for base in (d.parent, d.parent / "noise_json"):
                    candidate = base / rec.noise_file
                    if candidate.exists():
                        found = candidate
                        break
                if found:
                    break
            if found:
                nj = load_noise_json(found)
                noise_json_map[rec.noise_file] = {
                    "sim": build_sim_from_noise_json(nj),
                    "noise_features": noise_features_from_json(nj),
                    "json": nj,
                }

    # --- Load GNN fallback if checkpoint provided (or auto-discovered) ---
    gnn_fallback = None
    gnn_ckpt_path = args.gnn_ckpt or (str(DEFAULT_GNN_CKPT) if DEFAULT_GNN_CKPT else None)
    if gnn_ckpt_path:
        if args.gnn_ckpt is None:
            print(f"[INFO] --gnn-ckpt not given; using auto-discovered {gnn_ckpt_path}")
        gnn_fallback = GNNFallback(gnn_ckpt_path)

    if args.mode == "eval":
        evaluate_test_set(
            train_db, X_train, mu, sd, cluster_info,
            clusterer,
            test_db, circuit_fk, noise_fk,
            noise_json_map, alpha=args.alpha,
            gnn_fallback=gnn_fallback,
        )

    elif args.mode == "single":
        if not args.noise_json:
            print("[ERROR] --noise-json required for single mode")
            return
        if not args.circuit_qpy:
            print("[ERROR] --circuit-qpy required for single mode")
            return

        nj = load_noise_json(Path(args.noise_json))
        sim = build_sim_from_noise_json(nj)
        nf_q = noise_features_from_json(nj)

        with open(args.circuit_qpy, "rb") as f:
            base = qpy.load(f)[0]

        out_dir = "plots_v4"
        os.makedirs(out_dir, exist_ok=True)
        plot_prefix = os.path.join(out_dir, f"single_{args.nq}q")

        recommend_shots(
            train_db=train_db, X_train=X_train, mu=mu, sd=sd,
            cluster_info=cluster_info, clusterer=clusterer,
            base=base, nq=args.nq,
            sim=sim, noise_features_q=nf_q,
            circuit_feature_keys=circuit_fk,
            noise_feature_keys=noise_fk,
            alpha=args.alpha,
            k_struct=args.k_struct, k_pf=args.k_pf,
            pilot_points=args.pilot_points, pilot_reps=args.pilot_reps,
            plot_prefix=plot_prefix,
            gnn_fallback=gnn_fallback,
            noise_json=nj,
        )


if __name__ == "__main__":
    import sys, traceback
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stdout)
        sys.exit(1)