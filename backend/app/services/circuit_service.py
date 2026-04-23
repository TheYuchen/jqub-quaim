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

def discover_samples(sample_dir: Path = SAMPLE_CIRCUITS_DIR) -> list[SampleCircuit]:
    """Look up built-in demo circuits shipped in backend/sample_circuits/."""
    if not sample_dir.exists():
        return []
    samples: list[SampleCircuit] = []
    for path in sorted(sample_dir.glob("*.qpy")):
        try:
            qc = load_qpy_bytes(path.read_bytes())
        except Exception:
            continue
        samples.append(
            SampleCircuit(
                key=path.stem,
                display_name=qc.name or path.stem,
                description=f"{qc.num_qubits}-qubit circuit, depth {qc.depth()}",
                num_qubits=qc.num_qubits,
                source="qpy",
            )
        )
    return samples


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
