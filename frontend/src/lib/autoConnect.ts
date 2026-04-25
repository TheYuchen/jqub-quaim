// One-click pipeline wiring: turn a pile of dropped blocks into a
// sensible main chain without the user having to know which family
// connects to which.
//
// Strategy
// --------
// Every node kind carries a `family` tag in nodeCatalog.ts: one of
// `source`, `backend`, `algorithm`, `metric`, `sink`. The research
// workflow these blocks mirror is always the same canonical sequence:
//
//     source → backend → algorithm(s) → metric(s) → sink
//
// `autoConnect` groups the nodes on the canvas by that family, sorts
// each group by x-position (so the user can hint at intra-family order
// by dragging blocks left-to-right), flattens the groups in canonical
// order, and strings the result into a single main chain.
//
// Deliberate design choices:
//
// * **The result completely replaces the existing edges.** Calling
//   Auto-connect is "I want sensible wiring", not "patch my wiring".
//   Users with hand-drawn edges they want to keep simply don't press
//   the button.
// * **Edge semantics are just execution order.** The backend runs Kahn
//   topological sort over the graph and shares state via a single ctx
//   dict; there's no such thing as a "data" vs "side-channel" edge.
//   So a single flat chain is sufficient — no need to model
//   "backend → algorithm" as a separate noise-profile branch.
// * **We never produce a cycle.** Family order is a strict total
//   order, so edges always point down the order and the graph stays a
//   DAG.
// * **Warnings are advisory.** We still return a chain even if, say,
//   there's no Input circuit — the user can inspect what we'd link
//   and fix up from there.

import type { Edge, Node } from "@xyflow/react";
import type { QNodeData } from "../components/QNode";
import { NODE_BY_KIND, type NodeKind, type NodeSpec } from "./nodeCatalog";

type Family = NodeSpec["family"];

// Canonical execution order of the pipeline families. Keep this list
// stable: the Auto-connect algorithm and the visual left-to-right layout
// in `buildPresetGraph` both assume this ordering.
const FAMILY_ORDER: Family[] = [
  "source",
  "backend",
  "algorithm",
  "metric",
  "sink",
];

// Per-algorithm dependency on an upstream backend, derived from the
// runtime handlers in backend/app/services/workflow_service.py. Three
// possible relationships:
//
//   - "required":   handler hard-errors without ctx["backend"]
//                   (currently only QuCAD).
//   - "optional":   handler silently falls back to FakeFez when no
//                   backend is connected (QuBound, CompressVQC).
//   - "ignored":    handler is self-contained and ignores ctx["backend"]
//                   even if one is wired (Qshot — uses its own bundled
//                   noise snapshots).
//
// Keeping this here means Auto-connect's warnings can be specific
// instead of issuing a one-size-fits-all "algorithms that need a noise
// model will error" line that's wrong for everything except QuCAD.
const ALGO_BACKEND_DEPENDENCY: Record<NodeKind, "required" | "optional" | "ignored" | undefined> = {
  qucad: "required",
  qubound: "optional",
  compvqc: "optional",
  qshot: "ignored",
  // Non-algorithm kinds: undefined (irrelevant to backend dependency).
  input_circuit: undefined,
  ibm_backend: undefined,
  fake_backend: undefined,
  fidelity: undefined,
  output: undefined,
};

export interface AutoConnectResult {
  /** New edge array to replace the current one (empty if nothing to do). */
  edges: Edge[];
  /** Human-readable advisory messages (missing/duplicate families). */
  warnings: string[];
  /** `true` when at least one edge was produced. */
  connected: boolean;
  /** Number of pre-existing edges that this result would replace. */
  replacedCount: number;
}

/**
 * Compute the auto-connected edge set for the current canvas.
 *
 * Pure function: does not mutate the inputs and has no side effects.
 * Callers typically do `setEdges(result.edges)` on `result.connected`.
 */
export function autoConnect(
  nodes: Node<QNodeData>[],
  existingEdges: Edge[],
): AutoConnectResult {
  const warnings: string[] = [];
  const replacedCount = existingEdges.length;

  // ---- degenerate inputs ----
  if (nodes.length === 0) {
    return {
      edges: [],
      warnings: ["Drop some blocks on the canvas first."],
      connected: false,
      replacedCount,
    };
  }
  if (nodes.length === 1) {
    return {
      edges: [],
      warnings: ["Only one block on the canvas — nothing to connect."],
      connected: false,
      replacedCount,
    };
  }

  // ---- bucket by family ----
  const buckets: Record<Family, Node<QNodeData>[]> = {
    source: [],
    backend: [],
    algorithm: [],
    metric: [],
    sink: [],
  };
  const unknown: Node<QNodeData>[] = [];
  for (const n of nodes) {
    const spec = NODE_BY_KIND[n.data.kind];
    if (!spec) {
      // Forward-compat: unrecognised kinds (e.g. a node kind added in a
      // newer build loaded via a stale share link) are preserved on the
      // canvas but left out of the chain rather than silently dropped.
      unknown.push(n);
      continue;
    }
    buckets[spec.family].push(n);
  }
  if (unknown.length > 0) {
    warnings.push(
      `${unknown.length} block${unknown.length > 1 ? "s" : ""} with unknown kind were skipped.`,
    );
  }

  // ---- sort each bucket left-to-right, id as deterministic tiebreaker ----
  for (const fam of FAMILY_ORDER) {
    buckets[fam].sort((a, b) => {
      const dx = (a.position?.x ?? 0) - (b.position?.x ?? 0);
      if (dx !== 0) return dx;
      return a.id.localeCompare(b.id);
    });
  }

  // ---- advisory warnings about the composition ----
  //
  // Semantics rest on three facts about the runner in workflow_service.py:
  //   (1) Every backend handler writes `ctx["backend"] = backend`, so a
  //       later backend node wipes an earlier one — "last wins".
  //   (2) Input-circuit handlers only emit a summary step, they don't
  //       replace `ctx["circuit"]`. So extra Input nodes are merely
  //       redundant (duplicate summary rows), not actively wrong.
  //   (3) Algorithms differ on whether they need a backend — see
  //       ALGO_BACKEND_DEPENDENCY above. Auto-connect warns specifically
  //       per algorithm rather than issuing a blanket "no backend" line.
  if (buckets.source.length === 0) {
    warnings.push("No Input circuit — pipeline has no clear starting point.");
  } else if (buckets.source.length > 1) {
    warnings.push(
      `${buckets.source.length} Input circuits — extras produce duplicate summary rows.`,
    );
  }

  // Backend-dependency warnings, one per offending algorithm. We split
  // them so the user sees concrete consequences ("QuCAD will error",
  // "QuBound will fall back to FakeFez") instead of a single vague
  // bullet.
  const hasBackend = buckets.backend.length > 0;
  const algoKinds = buckets.algorithm.map((n) => n.data.kind);
  if (!hasBackend) {
    const requiredKinds = algoKinds.filter(
      (k) => ALGO_BACKEND_DEPENDENCY[k] === "required",
    );
    const optionalKinds = algoKinds.filter(
      (k) => ALGO_BACKEND_DEPENDENCY[k] === "optional",
    );
    for (const k of requiredKinds) {
      warnings.push(
        `${NODE_BY_KIND[k].label} requires a backend node upstream and will error at run time.`,
      );
    }
    if (optionalKinds.length > 0) {
      const labels = optionalKinds
        .map((k) => NODE_BY_KIND[k].label)
        .join(" and ");
      warnings.push(
        `${labels} will fall back to FakeFez since no backend is connected.`,
      );
    }
  } else if (buckets.backend.length > 1) {
    warnings.push(
      `${buckets.backend.length} backends linked in series — only the rightmost one is used downstream.`,
    );
  }

  // Self-contained algorithms (Qshot) ignore upstream backends. If the
  // user wired a backend in front of a chain that contains only
  // self-contained algorithms, that backend node is dead weight —
  // worth flagging so the user doesn't expect it to influence the
  // result.
  if (
    hasBackend &&
    algoKinds.length > 0 &&
    algoKinds.every((k) => ALGO_BACKEND_DEPENDENCY[k] === "ignored")
  ) {
    const ignoredLabels = Array.from(new Set(algoKinds))
      .map((k) => NODE_BY_KIND[k].label)
      .join(" / ");
    warnings.push(
      `${ignoredLabels} is self-contained — the backend node will be ignored at run time.`,
    );
  }

  if (buckets.sink.length === 0) {
    warnings.push("No Output block — final metrics will not be aggregated.");
  }

  // ---- flatten in family order ----
  const chain: Node<QNodeData>[] = [];
  for (const fam of FAMILY_ORDER) chain.push(...buckets[fam]);

  // Shouldn't happen given len >= 2 and at most a handful of unknowns,
  // but defensively: if the chain collapses to fewer than 2 eligible
  // nodes, there's nothing to wire.
  if (chain.length < 2) {
    return {
      edges: [],
      warnings: warnings.length > 0 ? warnings : ["Nothing eligible to connect."],
      connected: false,
      replacedCount,
    };
  }

  // ---- string into a single main chain ----
  //
  // Most edges represent the actual data flow (circuit / metrics moving
  // downstream). The one exception is backend → algorithm: the backend
  // node doesn't hand a circuit to the algorithm, it seeds `ctx["backend"]`
  // so the algorithm can read the noise model. That's a side-channel, not
  // a pipeline step. Mark it visually with a dashed stroke + small label
  // so readers of the graph can tell "this block feeds calibration data,
  // not a transformed circuit" at a glance.
  //
  // Exception: Qshot (kind === "qshot") is self-contained and ignores
  // ctx["backend"] entirely. Putting a "noise profile" label on a
  // backend → qshot edge would be a lie. We still draw the edge so the
  // chain stays visually connected (and Auto-connect emits the "Qshot
  // is self-contained" warning above), but with a plain undashed style.
  const edges: Edge[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const src = chain[i];
    const dst = chain[i + 1];
    const srcFamily = NODE_BY_KIND[src.data.kind]?.family;
    const dstFamily = NODE_BY_KIND[dst.data.kind]?.family;
    const isNoiseSidechain =
      srcFamily === "backend" &&
      dstFamily === "algorithm" &&
      ALGO_BACKEND_DEPENDENCY[dst.data.kind] !== "ignored";
    edges.push({
      id: `auto-${src.id}-${dst.id}`,
      source: src.id,
      target: dst.id,
      animated: true,
      ...(isNoiseSidechain && {
        label: "noise profile",
        // SVG `fill` accepts `rgb(var(--name))` so the label + background
        // follow the active theme (dark / light / GMU) automatically.
        labelStyle: { fontSize: 10, fill: "rgb(var(--color-mute))" },
        labelBgStyle: {
          fill: "rgb(var(--color-surface))",
          fillOpacity: 0.92,
        },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 3,
        style: { strokeDasharray: "4 3" },
      }),
    });
  }

  return { edges, warnings, connected: true, replacedCount };
}
