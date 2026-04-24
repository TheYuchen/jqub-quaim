import argparse
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import matplotlib.pyplot as plt
import networkx as nx
import numpy as np
import torch
from torch_geometric.data import Data

from qiskit.converters import circuit_to_dag
from qiskit.dagcircuit import DAGOpNode
from qiskit.qasm2 import load as load_qasm2
from qiskit.qasm3 import load as load_qasm3


OP_FAMILIES = [
    "id",
    "x",
    "y",
    "z",
    "h",
    "s",
    "sdg",
    "t",
    "tdg",
    "sx",
    "sxdg",
    "rx",
    "ry",
    "rz",
    "cx",
    "cz",
    "swap",
    "ecr",
    "crx",
    "cry",
    "crz",
    "cp",
    "measure",
    "barrier",
    "reset",
    "other",
]


def str2bool_yesno(x: str) -> bool:
    x = x.strip().lower()
    if x == "yes":
        return True
    if x == "no":
        return False
    raise ValueError(f"Expected yes/no, got: {x}")


def load_circuit_from_qasm(qasm_path: Path):
    header = qasm_path.read_text(encoding="utf-8", errors="ignore").lstrip()
    if header.startswith("OPENQASM 3"):
        return load_qasm3(qasm_path)
    return load_qasm2(qasm_path)


def _bit_index(bit) -> str:
    try:
        return str(bit._index)
    except Exception:
        try:
            return str(bit.index)
        except Exception:
            return str(bit)


def _bit_index_int(bit) -> int:
    try:
        return int(bit._index)
    except Exception:
        try:
            return int(bit.index)
        except Exception:
            return 0


def _safe_float(value) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def _one_hot(name: str, vocab: Iterable[str]) -> List[float]:
    vocab = list(vocab)
    out = [0.0] * len(vocab)
    idx = vocab.index(name) if name in vocab else len(vocab) - 1
    out[idx] = 1.0
    return out


def _op_family(op_name: str) -> str:
    op_name = str(op_name).lower()
    for fam in OP_FAMILIES[:-1]:
        if op_name == fam:
            return fam
    return "other"


def compact_op_label(name: str, qargs: List[str], cargs: List[str]) -> str:
    parts = []
    if qargs:
        parts.append(f"q[{','.join(qargs)}]")
    if cargs:
        parts.append(f"c[{','.join(cargs)}]")
    if not parts:
        return name
    return f"{name}\n{' '.join(parts)}"


def enrich_edges_by_wire_order(dag, G: nx.DiGraph, op_id_map: Dict[object, str]) -> nx.DiGraph:
    op_nodes = list(dag.topological_op_nodes())

    for q in dag.qubits:
        ops_on_wire = []
        for node in op_nodes:
            if q in getattr(node, "qargs", []):
                ops_on_wire.append(node)
        for i in range(len(ops_on_wire) - 1):
            u = op_id_map[ops_on_wire[i]]
            v = op_id_map[ops_on_wire[i + 1]]
            if u != v:
                G.add_edge(u, v)

    for c in dag.clbits:
        ops_on_wire = []
        for node in op_nodes:
            if c in getattr(node, "cargs", []):
                ops_on_wire.append(node)
        for i in range(len(ops_on_wire) - 1):
            u = op_id_map[ops_on_wire[i]]
            v = op_id_map[ops_on_wire[i + 1]]
            if u != v:
                G.add_edge(u, v)

    return G


def dag_to_nx_graph(dag, mode: str = "op_only") -> Tuple[nx.DiGraph, Dict[str, str]]:
    G = nx.DiGraph()
    labels = {}

    if mode not in {"op_only", "full"}:
        raise ValueError(f"Unsupported mode: {mode}")

    if mode == "full":
        node_id_map = {}
        all_nodes = list(dag.topological_nodes())

        for idx, node in enumerate(all_nodes):
            nid = f"n{idx}"
            node_id_map[node] = nid

            node_type = type(node).__name__
            label = node_type

            if hasattr(node, "name") and node.name is not None:
                label += f"\n{node.name}"

            qargs = [_bit_index(q) for q in getattr(node, "qargs", []) or []]
            cargs = [_bit_index(c) for c in getattr(node, "cargs", []) or []]

            if qargs:
                label += f"\nq[{','.join(qargs)}]"
            if cargs:
                label += f"\nc[{','.join(cargs)}]"

            G.add_node(
                nid,
                kind=node_type,
                opname=getattr(node, "name", ""),
                qargs=qargs,
                cargs=cargs,
            )
            labels[nid] = label

        for edge in dag.edges():
            if len(edge) >= 2:
                u, v = edge[0], edge[1]
                if u in node_id_map and v in node_id_map:
                    G.add_edge(node_id_map[u], node_id_map[v])

        return G, labels

    op_nodes = list(dag.topological_op_nodes())
    op_id_map = {}

    for idx, node in enumerate(op_nodes):
        nid = f"op{idx}"

        qargs = [_bit_index(q) for q in getattr(node, "qargs", [])]
        cargs = [_bit_index(c) for c in getattr(node, "cargs", [])]
        label = compact_op_label(node.name, qargs, cargs)

        G.add_node(
            nid,
            kind="op",
            opname=node.name,
            qargs=qargs,
            cargs=cargs,
        )
        labels[nid] = label
        op_id_map[node] = nid

    for node_a in op_nodes:
        src = op_id_map[node_a]
        try:
            for s in dag.successors(node_a):
                if s in op_id_map:
                    dst = op_id_map[s]
                    if src != dst:
                        G.add_edge(src, dst)
        except Exception:
            pass

    G = enrich_edges_by_wire_order(dag, G, op_id_map)
    return G, labels


def _build_op_node_feature(node: DAGOpNode, topo_idx: int, total_ops: int, num_qubits: int) -> List[float]:
    qargs = [_bit_index_int(q) for q in getattr(node, "qargs", [])]
    cargs = [_bit_index_int(c) for c in getattr(node, "cargs", [])]
    params = [_safe_float(p) for p in getattr(node.op, "params", []) or []]
    op_name = str(node.name).lower()
    op_family = _op_family(op_name)

    qarg_mean = float(np.mean(qargs)) if qargs else 0.0
    qarg_span = float(max(qargs) - min(qargs)) if len(qargs) >= 2 else 0.0
    q_scale = max(float(num_qubits - 1), 1.0)
    topo_frac = float(topo_idx) / max(float(total_ops - 1), 1.0)

    feat = []
    feat += _one_hot(op_family, OP_FAMILIES)
    feat += [
        float(len(qargs)),
        float(len(cargs)),
        float(len(params)),
        float(np.mean(np.abs(params))) if params else 0.0,
        1.0 if op_family == "measure" else 0.0,
        1.0 if op_family == "barrier" else 0.0,
        1.0 if op_family == "reset" else 0.0,
        1.0 if len(qargs) == 1 else 0.0,
        1.0 if len(qargs) == 2 else 0.0,
        1.0 if len(qargs) >= 3 else 0.0,
        qarg_mean / q_scale,
        qarg_span / q_scale,
        topo_frac,
    ]
    return feat


def _op_only_graph_data(dag, qc) -> Tuple[Data, torch.Tensor]:
    op_nodes = list(dag.topological_op_nodes())
    if not op_nodes:
        x = torch.zeros((1, len(OP_FAMILIES) + 13), dtype=torch.float32)
        edge_index = torch.zeros((2, 0), dtype=torch.long)
        edge_attr = torch.zeros((0, 6), dtype=torch.float32)
        graph_attr = torch.tensor(
            [0.0, 0.0, float(qc.num_qubits), float(qc.num_clbits), float(qc.depth() or 0), float(len(qc.data)), 0.0, 0.0, 0.0, 0.0],
            dtype=torch.float32,
        )
        return Data(x=x, edge_index=edge_index, edge_attr=edge_attr), graph_attr

    op_id_map = {node: idx for idx, node in enumerate(op_nodes)}
    x_list = [
        _build_op_node_feature(node, topo_idx=idx, total_ops=len(op_nodes), num_qubits=qc.num_qubits)
        for idx, node in enumerate(op_nodes)
    ]

    edge_feat_map: Dict[Tuple[int, int], List[float]] = defaultdict(lambda: [0.0] * 6)
    topo_order = {idx: idx for idx in range(len(op_nodes))}

    for src_node in op_nodes:
        src_idx = op_id_map[src_node]
        try:
            for succ in dag.successors(src_node):
                if succ in op_id_map:
                    dst_idx = op_id_map[succ]
                    feat = edge_feat_map[(src_idx, dst_idx)]
                    feat[4] = 1.0
                    feat[5] = max(feat[5], float(topo_order[dst_idx] - topo_order[src_idx]))
        except Exception:
            pass

    for q in dag.qubits:
        ops = [node for node in op_nodes if q in getattr(node, "qargs", [])]
        for i in range(len(ops) - 1):
            src_idx = op_id_map[ops[i]]
            dst_idx = op_id_map[ops[i + 1]]
            feat = edge_feat_map[(src_idx, dst_idx)]
            feat[0] = 1.0
            feat[2] += 1.0
            feat[5] = max(feat[5], float(topo_order[dst_idx] - topo_order[src_idx]))

    for c in dag.clbits:
        ops = [node for node in op_nodes if c in getattr(node, "cargs", [])]
        for i in range(len(ops) - 1):
            src_idx = op_id_map[ops[i]]
            dst_idx = op_id_map[ops[i + 1]]
            feat = edge_feat_map[(src_idx, dst_idx)]
            feat[1] = 1.0
            feat[3] += 1.0
            feat[5] = max(feat[5], float(topo_order[dst_idx] - topo_order[src_idx]))

    if edge_feat_map:
        edges = sorted(edge_feat_map.items())
        edge_index = torch.tensor([[u, v] for (u, v), _ in edges], dtype=torch.long).t().contiguous()
        edge_attr = torch.tensor([feat for _, feat in edges], dtype=torch.float32)
        edge_attr[:, 5] = edge_attr[:, 5] / max(float(len(op_nodes) - 1), 1.0)
    else:
        edge_index = torch.zeros((2, 0), dtype=torch.long)
        edge_attr = torch.zeros((0, 6), dtype=torch.float32)

    x = torch.tensor(np.asarray(x_list, dtype=np.float32), dtype=torch.float32)

    num_1q = sum(1 for node in op_nodes if len(getattr(node, "qargs", []) or []) == 1)
    num_2q = sum(1 for node in op_nodes if len(getattr(node, "qargs", []) or []) == 2)
    num_meas = sum(1 for node in op_nodes if str(node.name).lower() == "measure")
    all_params = []
    for node in op_nodes:
        all_params.extend([_safe_float(p) for p in getattr(node.op, "params", []) or []])

    graph_attr = torch.tensor(
        [
            float(len(op_nodes)),
            float(edge_index.size(1)),
            float(qc.num_qubits),
            float(qc.num_clbits),
            float(qc.depth() or 0),
            float(len(qc.data)),
            float(num_1q),
            float(num_2q),
            float(num_meas),
            float(np.mean(np.abs(all_params))) if all_params else 0.0,
        ],
        dtype=torch.float32,
    )
    return Data(x=x, edge_index=edge_index, edge_attr=edge_attr), graph_attr


def qasm_to_graph_data(qasm_path: Path) -> Tuple[Data, torch.Tensor]:
    qc = load_circuit_from_qasm(qasm_path)
    dag = circuit_to_dag(qc)
    return _op_only_graph_data(dag, qc)


def layered_layout(G: nx.DiGraph, x_gap: float = 1.6, y_gap: float = 1.1):
    if len(G.nodes) == 0:
        return {}

    if nx.is_directed_acyclic_graph(G):
        generations = list(nx.topological_generations(G))
    else:
        generations = [list(G.nodes())]

    pos = {}
    for layer_idx, layer_nodes in enumerate(generations):
        n = len(layer_nodes)
        y0 = (n - 1) * y_gap / 2.0
        for i, node in enumerate(layer_nodes):
            x = layer_idx * x_gap
            y = y0 - i * y_gap
            pos[node] = (x, y)
    return pos


def build_node_colors(G: nx.DiGraph):
    colors = []
    for _, data in G.nodes(data=True):
        kind = str(data.get("kind", ""))
        opname = data.get("opname", "")
        kind_low = kind.lower()

        if "in" in kind_low and "node" in kind_low:
            colors.append("lightgreen")
        elif "out" in kind_low and "node" in kind_low:
            colors.append("salmon")
        elif opname in {"cx", "cz", "swap", "ecr", "crx", "cry", "crz", "cp"}:
            colors.append("lightcoral")
        elif opname in {"measure"}:
            colors.append("khaki")
        elif opname in {"barrier"}:
            colors.append("silver")
        elif opname:
            colors.append("lightblue")
        else:
            colors.append("lightgray")
    return colors


def draw_and_save_graph(
    G: nx.DiGraph,
    labels: Dict[str, str],
    out_png: Path,
):
    out_png.parent.mkdir(parents=True, exist_ok=True)
    out_eps = out_png.with_suffix(".eps")

    pos = layered_layout(G, x_gap=1.70, y_gap=1.34)
    node_colors = build_node_colors(G)

    xs = [xy[0] for xy in pos.values()] or [0.0]
    ys = [xy[1] for xy in pos.values()] or [0.0]
    width_span = max(xs) - min(xs)
    height_span = max(ys) - min(ys)

    width = max(2.4, min(5.6, 1.0 + width_span * 0.40))
    height = max(1.5, min(3.6, 0.88 + height_span * 0.34))

    fig, ax = plt.subplots(figsize=(width, height))
    nx.draw_networkx_nodes(
        G,
        pos,
        ax=ax,
        node_color=node_colors,
        node_size=500,
        linewidths=0.80,
        edgecolors="black",
    )
    nx.draw_networkx_edges(
        G,
        pos,
        ax=ax,
        arrows=True,
        arrowstyle="-|>",
        arrowsize=13,
        width=1.35,
        min_source_margin=7,
        min_target_margin=7,
        connectionstyle="arc3,rad=0.02",
    )
    nx.draw_networkx_labels(
        G,
        pos,
        ax=ax,
        labels=labels,
        font_size=6.9,
        font_family="DejaVu Sans",
        font_weight="medium",
    )

    ax.set_axis_off()
    ax.margins(x=0.16, y=0.18)
    fig.tight_layout(pad=0.02)
    fig.savefig(out_png, dpi=500, bbox_inches="tight", pad_inches=0.01)
    fig.savefig(out_eps, bbox_inches="tight", pad_inches=0.01)
    plt.close(fig)


def get_qasm_paths(circuit_dir: Path) -> List[Tuple[str, Path, Path]]:
    specs = [
        ("base", circuit_dir / "base.qasm", circuit_dir / "base_dag.png"),
        ("transpiled", circuit_dir / "transpiled.qasm", circuit_dir / "transpiled_dag.png"),
    ]

    missing = [str(src) for _, src, _ in specs if not src.exists()]
    if missing:
        raise FileNotFoundError("Missing qasm file(s):\n" + "\n".join(missing))

    return specs


def process_qasm_file(
    name: str,
    qasm_path: Path,
    out_png: Path,
    mode: str,
    rerun: bool,
):
    if out_png.exists() and (not rerun):
        print(f"[SKIP] {out_png} already exists")
        return

    qc = load_circuit_from_qasm(qasm_path)
    dag = circuit_to_dag(qc)
    G, labels = dag_to_nx_graph(dag, mode=mode)
    draw_and_save_graph(G, labels, out_png)
    print(f"[OK] {name}: {qasm_path} -> {out_png}")


def main():
    parser = argparse.ArgumentParser(
        description="Read base.qasm and transpiled.qasm from a QAOA circuit directory and draw two DAGs."
    )
    parser.add_argument(
        "--circuit-dir",
        type=str,
        required=True,
        help="Directory containing base.qasm and transpiled.qasm.",
    )
    parser.add_argument(
        "--mode",
        type=str,
        default="op_only",
        choices=["op_only", "full"],
        help="DAG display mode.",
    )
    parser.add_argument(
        "--rerun",
        type=str,
        default="no",
        choices=["yes", "no"],
        help="Whether to overwrite existing DAG figures.",
    )

    args = parser.parse_args()

    circuit_dir = Path(args.circuit_dir).expanduser().resolve()
    rerun = str2bool_yesno(args.rerun)

    if not circuit_dir.exists():
        raise FileNotFoundError(f"Circuit directory does not exist: {circuit_dir}")

    print(f"Circuit dir: {circuit_dir}")
    print(f"Mode       : {args.mode}")
    print(f"Rerun      : {args.rerun}")

    for name, qasm_path, out_png in get_qasm_paths(circuit_dir):
        process_qasm_file(
            name=name,
            qasm_path=qasm_path,
            out_png=out_png,
            mode=args.mode,
            rerun=rerun,
        )

    print("\nDone.")


if __name__ == "__main__":
    main()
