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

# Permissive alias so RunRequest.nodes[i].type accepts plugin kinds
# too. The canonical built-in set lives in
# plugin_service.RESERVED_KINDS; real validation happens in
# workflow_service when dispatching a node to its handler.
NodeType = str


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
    # Anonymous browser-side UUID for per-user plugin lookup. None when
    # the request uses only built-in blocks.
    user_id: str | None = None
    # Root seed for stochastic steps. None (default) → the server draws
    # a fresh root seed and reports it back in the RunResponse, so ANY
    # run can be replayed later by pinning that seed. Set → "pinned"
    # replay mode: every stochastic step derives its per-node seed from
    # this value and the run becomes exactly reproducible.
    seed: int | None = Field(default=None, ge=0, lt=2**31)
    # Anytime evidence / optional stopping: target 95%-CI half-width
    # for sampled-fidelity steps, in absolute fidelity units (0.02 =
    # "stop at +/-2pp"). None = run every requested shot. Bounded to
    # (0, 0.5]: a half-width of 0.5 is the vacuous full-scale interval
    # and anything above it can never bind. This is part of the run's
    # provenance — replays must re-send it to reproduce an early stop.
    precision_target: float | None = Field(default=None, gt=0, le=0.5)




class CircuitShape(BaseModel):
    """Post-step circuit shape, attached to each StepResult so the
    frontend can render data-flow labels on the edges leaving this
    node (e.g. "5q · d8 · 17 gates"). None means "this step didn't
    touch the circuit" (most metric / sink blocks) and the frontend
    falls back to the upstream shape."""

    num_qubits: int
    depth: int
    size: int  # total gate count
    num_parameters: int


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
    from_step_cache: bool = False
    # Rich figures emitted by user plugins (validated + sanitised in
    # plugin_runner._scrub_figures). Each figure is a typed dict —
    # markdown / table / bar / svg / image — that the frontend's
    # PluginFigures component renders inline below the step's summary
    # table. None means "no figures" (the common case for built-ins).
    figures: list[dict[str, Any]] | None = None
    # Snapshot of the circuit's shape AFTER this step ran. Used by
    # the canvas to render data-flow labels on outgoing edges. None
    # for steps that ran in a context with no circuit (e.g. a source
    # plugin executed with no upstream) or that errored before the
    # circuit was computable.
    circuit_shape: CircuitShape | None = None
    # True when this step's result is intentionally nondeterministic
    # (e.g. sampled fidelity, where the user wants a fresh shot
    # distribution every run). The streaming executor uses this flag
    # to disable the in-memory step cache from this step onward —
    # caching a single sampled draw and replaying it would be a
    # silent scientific bug. The frontend can also surface it as a
    # "Live each run" chip so users know what to expect.
    nondeterministic: bool = False
    # Seed actually consumed by this step's stochastic computation.
    # None for deterministic steps. Recording it even in "fresh" seed
    # mode is what makes every historical run replayable.
    seed_used: int | None = None
    # Structured uncertainty payload for stochastic results. None for
    # deterministic steps (the scalar in ``summary`` is the whole
    # truth). Always carries "kind" and "point"; sampled fidelity emits
    # {"kind": "binomial", "shots", "successes", "point", "ci95",
    # "counts_top", "distinct_outcomes"}.
    distribution: dict[str, Any] | None = None
    # What this step DID to the circuit, in a representation that is
    # uniform across every block type (built-ins and plugins alike):
    # before/after snapshots (shape + gate-count-by-op), the shape
    # delta, and the per-op count delta. Captured centrally by the
    # executor — handlers never build this themselves, which is what
    # keeps the vocabulary consistent. None when the step ran without
    # a circuit in scope; changed=False marks pass-through steps
    # (metrics, sinks) that read the circuit but left it alone.
    transformation: dict[str, Any] | None = None


class RunResponse(BaseModel):
    circuit_id: str
    ok: bool
    from_cache: bool = False
    steps: list[StepResult] = Field(default_factory=list)
    final_metrics: dict[str, Any] = Field(default_factory=dict)
    # ---- Provenance envelope. run_id is a server-generated opaque
    # handle; seed_mode/root_seed let the client replay this exact run
    # later; app_version stamps which build produced the numbers.
    run_id: str | None = None
    seed_mode: Literal["fresh", "pinned"] | None = None
    root_seed: int | None = None
    app_version: str | None = None


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
