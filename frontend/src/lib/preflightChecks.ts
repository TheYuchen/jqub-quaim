// Pre-flight lint checks for the user's pipeline graph.
//
// The "Run pipeline" button reads these and surfaces a soft banner
// above the canvas warning about common mistakes BEFORE the user
// hits Run — instead of the run itself failing 30 seconds in.
//
// Two severity tiers:
//   * `warn` — the run will probably work but the user is missing
//     something or getting a degraded path. (e.g. QuCAD will fall
//     back to a default backend).
//   * `error` — the run definitely won't produce useful output.
//     (e.g. dangling Output node, no Input upstream of an Algorithm.)
//
// Each finding can name a `node_id` so the canvas can highlight the
// offending node when the banner is hovered or clicked.

import type { Edge, Node } from "@xyflow/react";
import type { CircuitInfo } from "./api";
import { resolveNodeSpec, type NodeKind, type NodeSpec, type PluginNodeSpec } from "./nodeCatalog";
import type { PluginManifest } from "./api";

export type PreflightSeverity = "warn" | "error";

export type PreflightFinding = {
  severity: PreflightSeverity;
  /** Concise headline shown in the banner. */
  message: string;
  /** Optional canonical node this finding is about. */
  node_id?: string;
};

export type GraphNode = Node<{
  kind: NodeKind | string;
  /** Param values flat from the canvas node (the same shape stored
   *  under data.params on a React Flow node). Used by rules that
   *  branch on user choices (e.g. Fidelity method = sampled). */
  params?: Record<string, unknown>;
}>;

/** Build a lookup of each node's incoming edges. */
function incomingMap(edges: Edge[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of edges) {
    const list = m.get(e.target) ?? [];
    list.push(e.source);
    m.set(e.target, list);
  }
  return m;
}

/** Build a lookup of each node's outgoing edges. */
function outgoingMap(edges: Edge[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of edges) {
    const list = m.get(e.source) ?? [];
    list.push(e.target);
    m.set(e.source, list);
  }
  return m;
}

/** Walk upstream from `start` (inclusive) collecting nodes that match
 *  `predicate`. Used to answer "is there a backend somewhere upstream
 *  of this algorithm node?". Detects cycles defensively. */
function findUpstream(
  start: string,
  incoming: Map<string, string[]>,
  predicate: (id: string) => boolean,
): string | null {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (id !== start && predicate(id)) return id;
    for (const parent of incoming.get(id) ?? []) stack.push(parent);
  }
  return null;
}

export type PreflightInput = {
  nodes: GraphNode[];
  edges: Edge[];
  circuit: CircuitInfo | null;
  plugins: PluginManifest[];
};

export function runPreflight(input: PreflightInput): PreflightFinding[] {
  const { nodes, edges, circuit, plugins } = input;
  const findings: PreflightFinding[] = [];
  const incoming = incomingMap(edges);
  const outgoing = outgoingMap(edges);

  // Per-node spec lookup. Unknown plugin kinds skip family-based
  // rules so we don't yell about user plugins we can't classify.
  const specOf = (kind: string): NodeSpec | PluginNodeSpec | undefined =>
    resolveNodeSpec(kind, plugins);
  const familyOf = (id: string): NodeSpec["family"] | null => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return null;
    const s = specOf(n.data.kind);
    return s?.family ?? null;
  };

  // ---- Per-node checks ----

  let hasInput = false;
  let hasOutput = false;
  for (const n of nodes) {
    const kind = n.data.kind;
    const spec = specOf(kind);
    if (!spec) continue;

    if (spec.family === "source") hasInput = true;
    if (spec.family === "sink") hasOutput = true;

    // 1. Source node with upstream edges: someone hooked something
    //    INTO an Input block — that node's output gets discarded.
    if (spec.family === "source" && (incoming.get(n.id)?.length ?? 0) > 0) {
      findings.push({
        severity: "warn",
        message: `${spec.label} has an upstream connection — its input will be ignored.`,
        node_id: n.id,
      });
    }

    // 2. Sink node with downstream edges: dangling output past the
    //    sink. The runner just stops at the sink; let the user know.
    if (spec.family === "sink" && (outgoing.get(n.id)?.length ?? 0) > 0) {
      findings.push({
        severity: "warn",
        message: `${spec.label} has a downstream connection — nothing runs after a sink.`,
        node_id: n.id,
      });
    }

    // 3. QuCAD REQUIRES a backend upstream: the runtime handler
    //    (_handle_qucad) hard-errors without ctx["backend"] — the
    //    FakeFez soft-fallback exists only for QuBound/CompressVQC.
    //    Same truth autoConnect's warning tells ("requires a backend
    //    node upstream and will error at run time").
    if (kind === "qucad") {
      const backend = findUpstream(n.id, incoming, (pid) => familyOf(pid) === "backend");
      if (!backend) {
        findings.push({
          severity: "error",
          message: "QuCAD needs a backend node upstream — it will error at run time.",
          node_id: n.id,
        });
      }
    }

    // 3b. Fidelity in `sampled` mode needs a backend upstream because
    //     that's where the noise model + shots come from. Without one
    //     the sampled estimator falls back to noiseless AerSimulator
    //     and the result is effectively the same as `statevector` mode
    //     but slower — which defeats the user's choice.
    if (kind === "fidelity") {
      const method = n.data.params?.method;
      if (method === "sampled") {
        const backend = findUpstream(
          n.id, incoming, (pid) => familyOf(pid) === "backend",
        );
        if (!backend) {
          findings.push({
            severity: "warn",
            message:
              "Fidelity is in `sampled` mode but has no Backend block " +
              "upstream. It will fall back to a noiseless simulator — " +
              "switch to `statevector` mode or add a backend to take " +
              "advantage of sampled mode.",
            node_id: n.id,
          });
        }
      }
    }

    // 4. Algorithm + Metric + Sink nodes need SOMETHING upstream
    //    that produces a circuit. We approximate this as "upstream
    //    Input block exists".
    if (
      spec.family === "algorithm" ||
      spec.family === "metric" ||
      spec.family === "sink"
    ) {
      const upstreamSource = findUpstream(
        n.id,
        incoming,
        (pid) => familyOf(pid) === "source",
      );
      if (!upstreamSource) {
        findings.push({
          severity: "error",
          message: `${spec.label} has no Input block upstream — it has no circuit to work on.`,
          node_id: n.id,
        });
      }
    }
  }

  // ---- Graph-level checks ----

  // 5. No Input at all → nothing to run.
  if (!hasInput && nodes.length > 0) {
    findings.push({
      severity: "error",
      message: "Pipeline has no Input block. Add an `Input circuit` to feed the chain.",
    });
  }
  // 6. No Output → results aren't aggregated.
  if (!hasOutput && nodes.length > 0) {
    findings.push({
      severity: "warn",
      message: "Pipeline has no Output block. Add one to see final metrics.",
    });
  }

  // 7. QuBound out-of-range warning (LSTM trained on 5-8 qubits).
  if (circuit) {
    const usesQubound = nodes.some((n) => n.data.kind === "qubound");
    if (
      usesQubound &&
      (circuit.num_qubits < 5 || circuit.num_qubits > 8)
    ) {
      findings.push({
        severity: "warn",
        message: `QuBound was trained on 5-8 qubit circuits; yours has ${circuit.num_qubits}. The result may be less accurate.`,
      });
    }

    // 8. Qshot fallback warning.
    const usesQshot = nodes.some((n) => n.data.kind === "qshot");
    if (
      usesQshot &&
      (circuit.num_qubits < 5 || circuit.num_qubits > 8)
    ) {
      findings.push({
        severity: "warn",
        message: `Qshot's reference database is 5-8 qubits; yours has ${circuit.num_qubits}. It will fall back to a slower GNN.`,
      });
    }
  }

  return findings;
}
