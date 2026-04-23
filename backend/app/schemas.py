"""Pydantic request/response schemas shared across routes."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# ---------- Circuits ----------

class CircuitInfo(BaseModel):
    """Summary of a parsed quantum circuit (returned on upload)."""

    circuit_id: str = Field(..., description="Server-assigned handle for subsequent calls.")
    name: str | None = None
    num_qubits: int
    num_clbits: int
    depth: int
    size: int
    num_parameters: int
    ops: dict[str, int] = Field(default_factory=dict, description="Gate counts by name.")
    diagram_text: str = Field(..., description="Plain-text ASCII circuit diagram.")


class SampleCircuit(BaseModel):
    """Metadata for a built-in demo circuit."""

    key: str
    display_name: str
    description: str
    num_qubits: int
    depth: int = 0
    size: int = 0
    num_parameters: int = 0
    diagram_text: str = ""
    source: Literal["qpy", "builtin"] = "qpy"


# ---------- Workflow ----------

NodeType = Literal[
    "input_circuit",
    "ibm_backend",
    "fake_backend",
    "qucad",
    "qubound",
    "compvqc",
    "fidelity",
    "output",
]


class FlowNode(BaseModel):
    """A node in the user-built pipeline graph."""

    id: str
    type: NodeType
    data: dict[str, Any] = Field(default_factory=dict)


class FlowEdge(BaseModel):
    source: str
    target: str


class RunRequest(BaseModel):
    """Payload sent by the React Flow frontend when the user hits Run."""

    circuit_id: str
    nodes: list[FlowNode]
    edges: list[FlowEdge]
    use_live_ibm: bool = False
    backend_name: str = "FakeFez"


class StepResult(BaseModel):
    """One stage of the pipeline's output (rendered as a panel in the UI)."""

    node_id: str
    node_type: NodeType
    label: str
    status: Literal["ok", "skipped", "error"]
    started_at: float
    finished_at: float
    summary: dict[str, Any] = Field(default_factory=dict)
    message: str | None = None


class RunResponse(BaseModel):
    circuit_id: str
    ok: bool
    from_cache: bool = False
    steps: list[StepResult] = Field(default_factory=list)
    final_metrics: dict[str, Any] = Field(default_factory=dict)


# ---------- Backends ----------

class BackendInfo(BaseModel):
    name: str
    kind: Literal["fake", "ibm"]
    num_qubits: int
    description: str


# ---------- Health ----------

class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
    qiskit_version: str
    torch_version: str
    ibm_token_configured: bool
    live_ibm_allowed: bool
