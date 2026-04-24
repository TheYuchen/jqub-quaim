import argparse
import json
import math
import random
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Set

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset
from torch_geometric.data import Batch

try:
    from .dual_gnn_model import DualGraphFidelityNet
    from .show_dag import qasm_to_graph_data
except ImportError:
    from dual_gnn_model import DualGraphFidelityNet
    from show_dag import qasm_to_graph_data


def _geo_seq(start, ratio, max_shots):
    """Generate a geometric shots sequence."""
    seq = []
    v = float(start)
    while v <= max_shots:
        r = round(v)
        if not seq or r > seq[-1]:
            seq.append(r)
        v *= ratio
    return seq


SHOTS_SEQUENCE_DEFAULT = _geo_seq(50, 1.25, 5000)


BACKEND_FEATURE_KEYS = [
    "n_qubits",
    "num_qubit_entries",
    "num_sx_edges",
    "num_twoq_edges",
    "T1_mean",
    "T1_std",
    "T2_mean",
    "T2_std",
    "prob_meas0_prep1_mean",
    "prob_meas1_prep0_mean",
    "sx_gate_error_mean",
    "twoq_gate_error_mean",
    "T1_inv_mean",
    "T2_inv_mean",
    "noise_score",
    "norm_T1_inv_mean",
    "norm_T2_inv_mean",
    "norm_prob_meas0_prep1_mean",
    "norm_prob_meas1_prep0_mean",
    "norm_sx_gate_error_mean",
    "norm_twoq_gate_error_mean",
    "twoq_gate_is_cz",
    "twoq_gate_is_cx",
    "twoq_gate_is_ecr",
]

CIRCUIT_FEATURE_KEYS = [
    "depth",
    "size",
    "num_2q",
    "swap",
    "unique_2q_edges",
    "max_2q_edge_mult",
    "cx",
    "ecr",
    "cz",
    "rz",
    "ry",
    "rx",
    "sx",
    "h",
    "optimization_level",
    "converged",
    "converged_shots",
    "real_curve_len",
    "sample_reps",
]


def seed_everything(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def yes_no_to_bool(x: str) -> bool:
    x = x.strip().lower()
    if x == "yes":
        return True
    if x == "no":
        return False
    raise argparse.ArgumentTypeError("Value must be 'yes' or 'no'")


def tensor_stats(tensors: Sequence[torch.Tensor]) -> Dict[str, List[float]]:
    stacked = torch.stack([t.float() for t in tensors], dim=0)
    mean = stacked.mean(dim=0)
    std = stacked.std(dim=0, unbiased=False)
    std = torch.where(std < 1e-6, torch.ones_like(std), std)
    return {"mean": mean.tolist(), "std": std.tolist()}


def normalize_tensor(x: torch.Tensor, stats: Dict[str, List[float]]) -> torch.Tensor:
    mean = torch.tensor(stats["mean"], dtype=torch.float32)
    std = torch.tensor(stats["std"], dtype=torch.float32)
    return (x.float() - mean) / std


class CircuitCache(object):
    def __init__(self, circuit_id, circuit_dir, pre_graph, post_graph, backend_feat, circuit_feat, graph_attr_feat, noise_json):
        self.circuit_id = circuit_id
        self.circuit_dir = circuit_dir
        self.pre_graph = pre_graph
        self.post_graph = post_graph
        self.backend_feat = backend_feat
        self.circuit_feat = circuit_feat
        self.graph_attr_feat = graph_attr_feat
        self.noise_json = noise_json


class SampleRecord(object):
    def __init__(self, circuit_id, shots, target, target_std):
        self.circuit_id = circuit_id
        self.shots = shots
        self.target = target
        self.target_std = target_std


class QAOADualGraphDataset(Dataset):
    def __init__(
        self,
        root: Path,
        allowed_circuit_ids: Optional[Set[str]] = None,
        exclude_qaoa: bool = False,
        forward_fill: bool = False,
        forward_fill_sequence: Optional[List[int]] = None,
    ):
        self.root = Path(root)
        self.allowed_circuit_ids = allowed_circuit_ids
        self.exclude_qaoa = exclude_qaoa
        self.forward_fill = forward_fill
        self.forward_fill_sequence = forward_fill_sequence or SHOTS_SEQUENCE_DEFAULT
        self.feature_stats = None

        self.circuits: Dict[str, CircuitCache] = {}
        self.samples: List[SampleRecord] = []
        self._build()

        if not self.samples:
            raise RuntimeError(f"No valid samples found under {self.root}")

        first = next(iter(self.circuits.values()))
        self.node_dim = first.pre_graph.x.size(-1)
        self.edge_dim = first.pre_graph.edge_attr.size(-1)
        self.shot_dim = 2
        self.backend_dim = first.backend_feat.numel()
        self.circuit_dim = first.circuit_feat.numel()
        self.graph_attr_dim = first.graph_attr_feat.numel()

    def _load_noise_features(self, record: Dict) -> torch.Tensor:
        noise_summary = record.get("noise_source", {}).get("noise_summary", {})
        norm_vec = noise_summary.get("normalized_feature_vector", {})
        twoq_type = str(record.get("noise_source", {}).get("twoq_gate_type", "")).lower()

        if not twoq_type:
            num_cz = float(record.get("features", {}).get("cz", 0.0))
            num_cx = float(record.get("features", {}).get("cx", 0.0))
            num_ecr = float(record.get("features", {}).get("ecr", 0.0))
            if num_cz > 0:
                twoq_type = "cz"
            elif num_cx > 0:
                twoq_type = "cx"
            elif num_ecr > 0:
                twoq_type = "ecr"

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
        return torch.tensor([feat_map[key] for key in BACKEND_FEATURE_KEYS], dtype=torch.float32)

    def _load_circuit_features(self, record: Dict) -> torch.Tensor:
        feat_src = dict(record.get("features", {}))
        feat_src["optimization_level"] = float(record.get("transpile", {}).get("optimization_level", 0.0))
        feat_src["converged"] = 1.0 if record.get("convergence", {}).get("converged", False) else 0.0
        feat_src["converged_shots"] = float(record.get("convergence", {}).get("converged_shots", 0.0) or 0.0)
        feat_src["real_curve_len"] = float(len(record.get("real_fidelity_curve", {}).get("shots_sequence", [])))
        feat_src["sample_reps"] = float(record.get("real_fidelity_curve", {}).get("sample_reps", 0.0))
        return torch.tensor([float(feat_src.get(key, 0.0)) for key in CIRCUIT_FEATURE_KEYS], dtype=torch.float32)

    def _build(self):
        n_skipped_qaoa = 0
        n_filled = 0
        circuit_dirs = sorted(p for p in self.root.iterdir() if p.is_dir())
        for cdir in circuit_dirs:
            circuit_id = cdir.name
            if self.allowed_circuit_ids is not None and circuit_id not in self.allowed_circuit_ids:
                continue

            base_qasm = cdir / "base.qasm"
            transpiled_qasm = cdir / "transpiled.qasm"
            record_path = cdir / "record.json"
            if not (base_qasm.exists() and transpiled_qasm.exists() and record_path.exists()):
                continue

            record = json.loads(record_path.read_text(encoding="utf-8"))

            # --- Filter out QAOA circuits if requested ---
            if self.exclude_qaoa:
                family = ""
                base_spec = record.get("base_spec", {})
                if base_spec:
                    family = str(base_spec.get("family", "")).lower()
                if not family:
                    # Resolve symlink and check original path for "qaoa"
                    real_path = str(cdir.resolve()).lower()
                    if "qaoa" in real_path:
                        family = "qaoa_like"
                if "qaoa" in family:
                    n_skipped_qaoa += 1
                    continue

            pre_graph, pre_attr = qasm_to_graph_data(base_qasm)
            post_graph, post_attr = qasm_to_graph_data(transpiled_qasm)
            backend_feat = self._load_noise_features(record)
            circuit_feat = self._load_circuit_features(record)
            graph_attr_feat = torch.cat([pre_attr, post_attr, post_attr - pre_attr], dim=0)

            self.circuits[circuit_id] = CircuitCache(
                circuit_id=circuit_id,
                circuit_dir=cdir,
                pre_graph=pre_graph,
                post_graph=post_graph,
                backend_feat=backend_feat,
                circuit_feat=circuit_feat,
                graph_attr_feat=graph_attr_feat,
                noise_json=str(record.get("noise_source", {}).get("json_file", "")).strip(),
            )

            summary = record.get("real_fidelity_curve", {}).get("summary", {})

            # Add existing data points
            existing_shots = {}
            for shots_key, stats in summary.items():
                shots_int = int(shots_key)
                fid_mean = float(stats.get("mean", 0.0))
                fid_std = float(stats.get("std", 0.0))
                existing_shots[shots_int] = (fid_mean, fid_std)
                self.samples.append(
                    SampleRecord(
                        circuit_id=circuit_id,
                        shots=shots_int,
                        target=fid_mean,
                        target_std=fid_std,
                    )
                )

            # --- Forward-fill beyond last observed point ---
            if self.forward_fill and existing_shots:
                last_shots = max(existing_shots.keys())
                last_fid, last_std = existing_shots[last_shots]

                # Estimate variance constant c from last point: std = c / sqrt(s)
                c_est = last_std * math.sqrt(last_shots) if last_std > 0 else 0.0

                for s in self.forward_fill_sequence:
                    if s > last_shots and s not in existing_shots:
                        fill_std = c_est / math.sqrt(s) if c_est > 0 else 0.0
                        self.samples.append(
                            SampleRecord(
                                circuit_id=circuit_id,
                                shots=s,
                                target=last_fid,
                                target_std=fill_std,
                            )
                        )
                        n_filled += 1

        if n_skipped_qaoa > 0:
            print(f"[Dataset] Skipped {n_skipped_qaoa} QAOA circuits")
        if n_filled > 0:
            print(f"[Dataset] Forward-filled {n_filled} samples")

    def fit_normalizers(self, train_indices: Sequence[int]):
        train_circuit_ids = sorted({self.samples[idx].circuit_id for idx in train_indices})
        shot_tensors = []
        backend_tensors = []
        circuit_tensors = []
        graph_attr_tensors = []

        for idx in train_indices:
            sample = self.samples[idx]
            shot_tensors.append(self.raw_shot_feature(sample.shots))

        for circuit_id in train_circuit_ids:
            cache = self.circuits[circuit_id]
            backend_tensors.append(cache.backend_feat)
            circuit_tensors.append(cache.circuit_feat)
            graph_attr_tensors.append(cache.graph_attr_feat)

        self.feature_stats = {
            "shot": tensor_stats(shot_tensors),
            "backend": tensor_stats(backend_tensors),
            "circuit": tensor_stats(circuit_tensors),
            "graph_attr": tensor_stats(graph_attr_tensors),
        }

    def set_feature_stats(self, stats):
        self.feature_stats = stats

    def raw_shot_feature(self, shots: int) -> torch.Tensor:
        return torch.tensor(
            [math.log10(float(shots)), 1.0 / math.sqrt(float(shots))],
            dtype=torch.float32,
        )

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx: int):
        if self.feature_stats is None:
            raise RuntimeError("Call fit_normalizers() or set_feature_stats() before loading samples.")

        sample = self.samples[idx]
        cache = self.circuits[sample.circuit_id]

        pre_graph = cache.pre_graph.clone()
        post_graph = cache.post_graph.clone()
        shot_feat = normalize_tensor(self.raw_shot_feature(sample.shots), self.feature_stats["shot"])
        backend_feat = normalize_tensor(cache.backend_feat, self.feature_stats["backend"])
        circuit_feat = normalize_tensor(cache.circuit_feat, self.feature_stats["circuit"])
        graph_attr_feat = normalize_tensor(cache.graph_attr_feat, self.feature_stats["graph_attr"])
        target = torch.tensor(sample.target, dtype=torch.float32)

        meta = {
            "circuit_id": sample.circuit_id,
            "circuit_dir": str(cache.circuit_dir),
            "shots": sample.shots,
            "target_std": sample.target_std,
            "noise_json": cache.noise_json,
        }
        return pre_graph, post_graph, shot_feat, backend_feat, circuit_feat, graph_attr_feat, target, meta


def collate_fn(batch):
    pre_list, post_list, shot_list, backend_list, circuit_list, graph_attr_list, target_list, meta_list = zip(*batch)
    return (
        Batch.from_data_list(list(pre_list)),
        Batch.from_data_list(list(post_list)),
        torch.stack(shot_list, dim=0),
        torch.stack(backend_list, dim=0),
        torch.stack(circuit_list, dim=0),
        torch.stack(graph_attr_list, dim=0),
        torch.stack(target_list, dim=0),
        list(meta_list),
    )


def gaussian_nll_loss(mean, logvar, target):
    inv_var = torch.exp(-logvar)
    return (0.5 * (logvar + (target - mean) ** 2 * inv_var)).mean()


def rmse(pred, target):
    return torch.sqrt(torch.mean((pred - target) ** 2)).item()


def mae(pred, target):
    return torch.mean(torch.abs(pred - target)).item()


def r2_score_torch(pred, target):
    target_mean = torch.mean(target)
    ss_res = torch.sum((target - pred) ** 2)
    ss_tot = torch.sum((target - target_mean) ** 2)
    return (1 - ss_res / (ss_tot + 1e-12)).item()


def train_one_epoch(model, loader, optimizer, device, predict_uncertainty: bool):
    model.train()
    total_loss = 0.0
    preds_all = []
    targets_all = []

    for pre_batch, post_batch, shot_batch, backend_batch, circuit_batch, graph_attr_batch, y_batch, _ in loader:
        pre_batch = pre_batch.to(device)
        post_batch = post_batch.to(device)
        shot_batch = shot_batch.to(device)
        backend_batch = backend_batch.to(device)
        circuit_batch = circuit_batch.to(device)
        graph_attr_batch = graph_attr_batch.to(device)
        y_batch = y_batch.to(device)

        optimizer.zero_grad()
        if predict_uncertainty:
            mean, logvar = model(pre_batch, post_batch, shot_batch, backend_batch, circuit_batch, graph_attr_batch)
            loss = gaussian_nll_loss(mean, logvar, y_batch)
            pred = mean
        else:
            pred = model(pre_batch, post_batch, shot_batch, backend_batch, circuit_batch, graph_attr_batch)
            loss = nn.functional.mse_loss(pred, y_batch)

        loss.backward()
        optimizer.step()

        total_loss += loss.item() * y_batch.size(0)
        preds_all.append(pred.detach().cpu())
        targets_all.append(y_batch.detach().cpu())

    preds_all = torch.cat(preds_all)
    targets_all = torch.cat(targets_all)
    return {
        "loss": total_loss / len(loader.dataset),
        "rmse": rmse(preds_all, targets_all),
        "mae": mae(preds_all, targets_all),
        "r2": r2_score_torch(preds_all, targets_all),
    }


@torch.no_grad()
def eval_one_epoch(model, loader, device, predict_uncertainty: bool):
    model.eval()
    total_loss = 0.0
    preds_all = []
    targets_all = []

    for pre_batch, post_batch, shot_batch, backend_batch, circuit_batch, graph_attr_batch, y_batch, _ in loader:
        pre_batch = pre_batch.to(device)
        post_batch = post_batch.to(device)
        shot_batch = shot_batch.to(device)
        backend_batch = backend_batch.to(device)
        circuit_batch = circuit_batch.to(device)
        graph_attr_batch = graph_attr_batch.to(device)
        y_batch = y_batch.to(device)

        if predict_uncertainty:
            mean, logvar = model(pre_batch, post_batch, shot_batch, backend_batch, circuit_batch, graph_attr_batch)
            loss = gaussian_nll_loss(mean, logvar, y_batch)
            pred = mean
        else:
            pred = model(pre_batch, post_batch, shot_batch, backend_batch, circuit_batch, graph_attr_batch)
            loss = nn.functional.mse_loss(pred, y_batch)

        total_loss += loss.item() * y_batch.size(0)
        preds_all.append(pred.detach().cpu())
        targets_all.append(y_batch.detach().cpu())

    preds_all = torch.cat(preds_all)
    targets_all = torch.cat(targets_all)
    return {
        "loss": total_loss / len(loader.dataset),
        "rmse": rmse(preds_all, targets_all),
        "mae": mae(preds_all, targets_all),
        "r2": r2_score_torch(preds_all, targets_all),
    }


def split_dataset_by_circuit(dataset: QAOADualGraphDataset, train_ratio: float = 0.8, seed: int = 42):
    circuit_ids = sorted(dataset.circuits.keys())
    rng = random.Random(seed)
    rng.shuffle(circuit_ids)

    n_train = max(1, int(round(len(circuit_ids) * train_ratio)))
    n_train = min(n_train, max(len(circuit_ids) - 1, 1)) if len(circuit_ids) > 1 else 1

    train_circuits = sorted(circuit_ids[:n_train])
    val_circuits = sorted(circuit_ids[n_train:]) if len(circuit_ids) > 1 else sorted(circuit_ids)

    train_idx = [i for i, s in enumerate(dataset.samples) if s.circuit_id in train_circuits]
    val_idx = [i for i, s in enumerate(dataset.samples) if s.circuit_id in val_circuits]
    return train_idx, val_idx, train_circuits, val_circuits


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, required=True, help="Directory like TongLi/QAOA_circuits")
    parser.add_argument("--save-dir", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=200)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--weight-decay", type=float, default=1e-5)
    parser.add_argument("--hidden-dim", type=int, default=128)
    parser.add_argument("--gnn-layers", type=int, default=4)
    parser.add_argument("--dropout", type=float, default=0.1)
    parser.add_argument("--train-ratio", type=float, default=0.8)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--predict-uncertainty", type=yes_no_to_bool, default="yes")
    parser.add_argument("--exclude-qaoa", type=yes_no_to_bool, default="no",
                        help="Exclude QAOA-family circuits from training")
    parser.add_argument("--forward-fill", type=yes_no_to_bool, default="no",
                        help="Forward-fill fidelity beyond convergence point")
    args = parser.parse_args()

    seed_everything(args.seed)
    args.save_dir.mkdir(parents=True, exist_ok=True)

    dataset = QAOADualGraphDataset(
        args.data_root,
        exclude_qaoa=args.exclude_qaoa,
        forward_fill=args.forward_fill,
    )
    train_idx, val_idx, train_circuits, val_circuits = split_dataset_by_circuit(
        dataset,
        train_ratio=args.train_ratio,
        seed=args.seed,
    )
    dataset.fit_normalizers(train_idx)

    train_ds = torch.utils.data.Subset(dataset, train_idx)
    val_ds = torch.utils.data.Subset(dataset, val_idx)

    train_loader = torch.utils.data.DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=collate_fn,
        num_workers=0,
    )
    val_loader = torch.utils.data.DataLoader(
        val_ds,
        batch_size=args.batch_size,
        shuffle=False,
        collate_fn=collate_fn,
        num_workers=0,
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = DualGraphFidelityNet(
        node_dim=dataset.node_dim,
        edge_dim=dataset.edge_dim,
        shot_dim=dataset.shot_dim,
        backend_dim=dataset.backend_dim,
        circuit_dim=dataset.circuit_dim,
        graph_attr_dim=dataset.graph_attr_dim,
        hidden_dim=args.hidden_dim,
        gnn_layers=args.gnn_layers,
        dropout=args.dropout,
        predict_uncertainty=args.predict_uncertainty,
    ).to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)

    split_info = {
        "train_circuits": train_circuits,
        "val_circuits": val_circuits,
    }
    (args.save_dir / "split.json").write_text(json.dumps(split_info, indent=2), encoding="utf-8")

    best_val_rmse = float("inf")
    best_ckpt = args.save_dir / "best_model.pt"
    history = []

    for epoch in range(1, args.epochs + 1):
        train_metrics = train_one_epoch(model, train_loader, optimizer, device, args.predict_uncertainty)
        val_metrics = eval_one_epoch(model, val_loader, device, args.predict_uncertainty)

        print(
            f"Epoch {epoch:03d} | "
            f"train loss={train_metrics['loss']:.6f}, rmse={train_metrics['rmse']:.6f}, mae={train_metrics['mae']:.6f}, r2={train_metrics['r2']:.6f} | "
            f"val loss={val_metrics['loss']:.6f}, rmse={val_metrics['rmse']:.6f}, mae={val_metrics['mae']:.6f}, r2={val_metrics['r2']:.6f}"
        )

        history.append({"epoch": epoch, "train": train_metrics, "val": val_metrics})

        if val_metrics["rmse"] < best_val_rmse:
            best_val_rmse = val_metrics["rmse"]
            torch.save(
                {
                    "model_state": model.state_dict(),
                    "node_dim": dataset.node_dim,
                    "edge_dim": dataset.edge_dim,
                    "shot_dim": dataset.shot_dim,
                    "backend_dim": dataset.backend_dim,
                    "circuit_dim": dataset.circuit_dim,
                    "graph_attr_dim": dataset.graph_attr_dim,
                    "hidden_dim": args.hidden_dim,
                    "gnn_layers": args.gnn_layers,
                    "dropout": args.dropout,
                    "predict_uncertainty": args.predict_uncertainty,
                    "feature_stats": dataset.feature_stats,
                    "backend_feature_keys": BACKEND_FEATURE_KEYS,
                    "circuit_feature_keys": CIRCUIT_FEATURE_KEYS,
                    "split_info": split_info,
                    "exclude_qaoa": args.exclude_qaoa,
                    "forward_fill": args.forward_fill,
                },
                best_ckpt,
            )
            print(f"[BEST] saved to {best_ckpt}")

    (args.save_dir / "train_history.json").write_text(json.dumps(history, indent=2), encoding="utf-8")
    summary = {
        "best_val_rmse": best_val_rmse,
        "num_samples": len(dataset),
        "num_circuits": len(dataset.circuits),
        "num_train_samples": len(train_idx),
        "num_val_samples": len(val_idx),
        "num_train_circuits": len(train_circuits),
        "num_val_circuits": len(val_circuits),
    }
    (args.save_dir / "train_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Done. Best val RMSE = {best_val_rmse:.6f}")


if __name__ == "__main__":
    main()


#python train_dual_gnn.py   --data-root QAOA_circuits   --save-dir dual_gnn_ckpt   --epochs 20   --batch-size 16   --lr 1e-3   --hidden-dim 128   --gnn-layers 6   --dropout 0.1   --train-ratio 0.8   --predict-uncertainty yes