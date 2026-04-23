"""Circuit lifecycle: parse uploads, cache by id, look up samples."""

from __future__ import annotations

import io
import uuid
from pathlib import Path
from threading import Lock
from typing import Iterable

from qiskit import QuantumCircuit, qasm2, qasm3, qpy

from app.config import SAMPLE_CIRCUITS_DIR
from app.schemas import CircuitInfo, SampleCircuit


class CircuitNotFoundError(KeyError):
    """Raised when a caller references a circuit_id the server doesn't know."""


class CircuitStore:
    """In-memory store of circuits keyed by short random ids.

    Process-local only; fine for a single-container HF Space demo.
    """

    def __init__(self) -> None:
        self._circuits: dict[str, QuantumCircuit] = {}
        self._lock = Lock()

    def put(self, qc: QuantumCircuit) -> str:
        circuit_id = uuid.uuid4().hex[:12]
        with self._lock:
            self._circuits[circuit_id] = qc
        return circuit_id

    def get(self, circuit_id: str) -> QuantumCircuit:
        with self._lock:
            qc = self._circuits.get(circuit_id)
        if qc is None:
            raise CircuitNotFoundError(circuit_id)
        return qc


# ---------- Parsing ----------

def load_qpy_bytes(data: bytes) -> QuantumCircuit:
    programs = qpy.load(io.BytesIO(data))
    if not programs:
        raise ValueError("QPY file contained no circuits")
    return programs[0]


def load_qasm_text(text: str) -> QuantumCircuit:
    """Try OpenQASM 3 first, fall back to OpenQASM 2."""
    first_line = text.lstrip().splitlines()[0] if text.strip() else ""
    if first_line.strip().upper().startswith("OPENQASM 3"):
        return qasm3.loads(text)
    try:
        return qasm2.loads(text)
    except Exception:
        # Last-ditch: let qasm3 try even without the header
        return qasm3.loads(text)


def parse_uploaded(filename: str, data: bytes) -> QuantumCircuit:
    """Dispatch an upload to the right Qiskit loader by suffix."""
    suffix = Path(filename).suffix.lower()
    if suffix == ".qpy":
        return load_qpy_bytes(data)
    if suffix in {".qasm", ".qasm2", ".qasm3"}:
        return load_qasm_text(data.decode("utf-8"))
    # Best-effort: try qpy then qasm
    try:
        return load_qpy_bytes(data)
    except Exception:
        return load_qasm_text(data.decode("utf-8", errors="replace"))


# ---------- Metadata ----------

def summarize(qc: QuantumCircuit, circuit_id: str) -> CircuitInfo:
    return CircuitInfo(
        circuit_id=circuit_id,
        name=qc.name,
        num_qubits=qc.num_qubits,
        num_clbits=qc.num_clbits,
        depth=qc.depth(),
        size=qc.size(),
        num_parameters=qc.num_parameters,
        ops={name: int(count) for name, count in qc.count_ops().items()},
        diagram_text=str(qc.draw(output="text", fold=120)),
    )


# ---------- Sample circuits ----------

# Hand-written one-liners aimed at both beginners (what it's for) and
# experts (what the structure is). Shown in the left-panel circuit picker.
# Keep under ~90 chars so the sample button doesn't wrap into three lines.
SAMPLE_DESCRIPTIONS: dict[str, str] = {
    "bell_state": "The simplest entangled state: two qubits in a Bell pair.",
    "ghz_3q": "Three qubits fully entangled (a GHZ state).",
    "vqc_2q_small": "A tiny trainable quantum circuit with 2 tunable angles.",
    "efficient_su2_4q": "A 4-qubit EfficientSU2 ansatz, a classic quantum-ML building block.",
    "qaoa_maxcut_4": "QAOA solving Max-Cut on a 4-node ring graph.",
    # Batch 2 circuits:
    "w_state_3q": "Another way to entangle 3 qubits: a W state.",
    "qft_3q": "3-qubit Quantum Fourier Transform, a core building block of many algorithms.",
    "ry_chain_6q": "A 6-qubit parameterized RY chain with 12 tunable angles.",
    "hardware_efficient_4q": "4-qubit hardware-efficient ansatz (3 layers of RY+RZ+CX).",
}


# Display order for the circuit picker. Chosen pedagogically: smallest and
# most familiar circuits first, bigger parameterized ansatze last. Anything
# not listed falls back to the alphabetical tail.
SAMPLE_ORDER: list[str] = [
    "bell_state",
    "ghz_3q",
    "w_state_3q",
    "vqc_2q_small",
    "qft_3q",
    "qaoa_maxcut_4",
    "efficient_su2_4q",
    "hardware_efficient_4q",
    "ry_chain_6q",
]


def _describe(qc: QuantumCircuit, key: str) -> str:
    """Curated one-liner if we have one, else a brief auto-generated fallback."""
    if key in SAMPLE_DESCRIPTIONS:
        return SAMPLE_DESCRIPTIONS[key]
    return f"{qc.num_qubits}-qubit circuit, depth {qc.depth()}."


def discover_samples(sample_dir: Path = SAMPLE_CIRCUITS_DIR) -> list[SampleCircuit]:
    """Look up built-in demo circuits shipped in backend/sample_circuits/.

    Returns them in the pedagogical order defined by SAMPLE_ORDER (smallest
    first); anything not in the list is appended alphabetically at the end.
    """
    if not sample_dir.exists():
        return []
    by_key: dict[str, SampleCircuit] = {}
    for path in sorted(sample_dir.glob("*.qpy")):
        try:
            qc = load_qpy_bytes(path.read_bytes())
        except Exception:
            continue
        by_key[path.stem] = SampleCircuit(
            key=path.stem,
            display_name=qc.name or path.stem,
            description=_describe(qc, path.stem),
            num_qubits=qc.num_qubits,
            source="qpy",
        )
    ordered: list[SampleCircuit] = []
    for key in SAMPLE_ORDER:
        if key in by_key:
            ordered.append(by_key.pop(key))
    # Any unknowns keep alphabetical order at the tail.
    for key in sorted(by_key):
        ordered.append(by_key[key])
    return ordered


def load_sample(key: str, sample_dir: Path = SAMPLE_CIRCUITS_DIR) -> QuantumCircuit:
    path = sample_dir / f"{key}.qpy"
    if not path.exists():
        raise FileNotFoundError(f"No sample circuit named {key!r}")
    return load_qpy_bytes(path.read_bytes())


# Module-level singleton store (imported by routes).
circuit_store = CircuitStore()


__all__: Iterable[str] = (
    "CircuitStore",
    "CircuitNotFoundError",
    "circuit_store",
    "parse_uploaded",
    "summarize",
    "discover_samples",
    "load_sample",
)
