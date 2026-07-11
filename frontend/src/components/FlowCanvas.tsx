import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnConnect,
} from "@xyflow/react";
import {
  AlertCircle,
  AlertTriangle,
  Box,
  Check,
  LayoutGrid,
  Link2,
  Loader2,
  Play,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { copyToClipboard } from "../lib/clipboard";
import { generatePythonScript } from "../lib/exportPython";
import {
  NODE_BY_KIND,
  resolveNodeSpec,
  type NodeKind,
  type PluginNodeSpec,
} from "../lib/nodeCatalog";
import {
  DEFAULT_PRESET_KEY,
  PRESET_BY_KEY,
  buildPresetGraph,
} from "../lib/presets";
import { autoConnect } from "../lib/autoConnect";
import { useApp } from "../lib/store";
import { api } from "../lib/api";
import { getUserId } from "../lib/userId";
import { usePrefersReducedMotion } from "../lib/useMediaQuery";
import { runPreflight, type PreflightFinding } from "../lib/preflightChecks";
import {
  buildSharePayload,
  buildShareUrl,
  readHashPayload,
  type SharePayload,
} from "../lib/share";
import {
  buildRunRecord,
  computeConfigHash,
  listRuns,
  saveRun,
} from "../lib/runStore";
import { GLOSSARY } from "../lib/glossary";
import { hashHue, hueCss } from "../lib/hues";
import {
  costAnchor,
  estimatePipeline,
  formatSeconds,
  replicateExtraS,
  type PipelineEstimate,
} from "../lib/costModel";
import { QNode, type QNodeData } from "./QNode";
import { RibbonEdge } from "./RibbonEdge";
import { PresetPicker } from "./PresetPicker";
import { WorkspaceToggle } from "./WorkspaceToggle";
import { EmptyCanvas } from "./EmptyCanvas";
import { MoreMenu } from "./MoreMenu";
import { FigureExportButton } from "./FigureExportButton";

/** One-shot feedback surfaced as a toast at the bottom of the canvas.
 *
 *  - `tone: "danger"` is runner errors; stays until explicitly dismissed.
 *  - `tone: "warn"` / `"ok"` come from Auto-connect; auto-dismiss after a
 *    few seconds.
 *  - `detail`, when present, is rendered underneath `text` in the toast
 *    body (one warning per line), so long advisories no longer have to
 *    fit on a single truncated header line.
 */
type Notice = {
  text: string;
  tone: "danger" | "warn" | "ok";
  detail?: string;
} | null;

type RFNode = Node<QNodeData>;

const nodeTypes: NodeTypes = { qnode: QNode as unknown as NodeTypes[string] };

/** Custom edge registry. "ribbon" is the post-run circuit ribbon —
 *  see RibbonEdge.tsx for the encoding rationale. Hoisted to module
 *  scope so React Flow sees a stable identity across renders. */
const edgeTypes: EdgeTypes = {
  ribbon: RibbonEdge as unknown as EdgeTypes[string],
};

/**
 * Build the initial (nodes, edges) shown on the canvas.
 *
 * Order of precedence:
 *   1. A valid share payload in `#s=...` — lets the recipient of a shared
 *      link land directly on the author's pipeline. Includes any custom
 *      edits the author made on top of a preset (hand-moved nodes,
 *      parameter overrides, extra/removed blocks).
 *   2. The default preset — plain first-visit experience.
 *
 * We keep this pure (no side effects) and hoist the hash read into a
 * useMemo so the initial `useNodesState` / `useEdgesState` can take its
 * output as the seed value. Loading the linked sample circuit is handled
 * in a separate effect below, because that's async.
 */
function buildInitialGraph(): {
  nodes: Node<QNodeData>[];
  edges: Edge[];
  hashPayload: SharePayload | null;
} {
  const hashPayload = readHashPayload();
  if (hashPayload) {
    const nodes: Node<QNodeData>[] = hashPayload.n.map((pn) => ({
      id: pn.i,
      type: "qnode",
      position: { x: pn.x, y: pn.y },
      data: {
        kind: pn.k,
        // Merge kind defaults under the shared params so newer defaults
        // introduced after the link was made don't silently vanish.
        params: {
          ...(NODE_BY_KIND[pn.k]?.defaultData ?? {}),
          ...(pn.p ?? {}),
        },
      },
    }));
    const edges: Edge[] = hashPayload.e.map((pe, i) => ({
      id: `e${i + 1}`,
      source: pe.s,
      target: pe.t,
      animated: true,
    }));
    return { nodes, edges, hashPayload };
  }
  const preset = buildPresetGraph(PRESET_BY_KEY[DEFAULT_PRESET_KEY]);
  return { nodes: preset.nodes, edges: preset.edges, hashPayload: null };
}

export function FlowCanvas() {
  // Boot with either a shared-link graph or the default preset. The
  // picker in the header lets the user swap in any of the other presets
  // at any time; that replaces the whole graph (same semantics as the
  // old "Reset" button, just multi-option).
  const initial = useMemo(() => buildInitialGraph(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const circuit = useApp((s) => s.circuit);
  const sampleKey = useApp((s) => s.sampleKey);
  const setRun = useApp((s) => s.setRun);
  const running = useApp((s) => s.running);
  // Subscribe to the latest run so edge labels can pull per-step
  // circuit shape (see styledEdges memo below). Cheap re-render
  // when the user clicks Run.
  const run = useApp((s) => s.run);
  const setRunning = useApp((s) => s.setRunning);
  const useLiveIbm = useApp((s) => s.useLiveIbm);
  const pendingBlockKinds = useApp((s) => s.pendingBlockKinds);
  const clearPendingBlocks = useApp((s) => s.clearPendingBlocks);
  const pinnedSeed = useApp((s) => s.pinnedSeed);
  const setPinnedSeed = useApp((s) => s.setPinnedSeed);
  const replicateCount = useApp((s) => s.replicateCount);
  const setReplicateCount = useApp((s) => s.setReplicateCount);
  const precisionTarget = useApp((s) => s.precisionTarget);
  const setPrecisionTarget = useApp((s) => s.setPrecisionTarget);
  const pendingRestore = useApp((s) => s.pendingRestore);
  const editorContext = useApp((s) => s.editorContext);
  const [notice, setNotice] = useState<Notice>(null);
  // cost-estimate: per-kind medians from this browser's run archive,
  // recomputed when the canvas kind-set changes or a run is archived
  // (historyVersion bump). Purely client-side — see lib/costModel.ts.
  const historyVersion = useApp((s) => s.historyVersion);
  const [costEst, setCostEst] = useState<PipelineEstimate | null>(null);
  // Kind multiset key: dragging nodes around must not refetch, but
  // adding/removing/retyping a block must.
  const kindsKey = useMemo(
    () =>
      nodes
        .map((n) => (n.data as QNodeData).kind)
        .sort()
        .join("|"),
    [nodes],
  );
  useEffect(() => {
    let alive = true;
    if (nodes.length === 0) {
      setCostEst(null);
      return;
    }
    listRuns(100)
      .then((records) => {
        if (!alive) return;
        setCostEst(
          estimatePipeline(
            nodes.map((n) => ({ id: n.id, kind: (n.data as QNodeData).kind })),
            records,
          ),
        );
      })
      .catch(() => {
        if (alive) setCostEst(null); // archive unreadable → just no chip
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kindsKey stands in for nodes
  }, [kindsKey, historyVersion]);
  const costChip = useMemo(() => {
    if (!costEst || nodes.length === 0) return null;
    const unknownN = costEst.unknownKinds.length;
    // Nothing observed for ANY canvas kind → an "estimate" would be
    // pure fiction; show nothing until at least one run is archived.
    if (costEst.knownS <= 0 && unknownN > 0) return null;
    // Copy contract (toolbar row 2): replicates=1 -> "est ~35s";
    // N>1 -> "est ~35s each · ≈2m total". The ×N multiplier is NOT
    // repeated here — the replicate select one slot to the left
    // already states it (the old "… · ×5 ≈ 1m 59s" said ×5 twice in
    // adjacent controls). "each" ≈ the first full run; the tooltip
    // keeps the honest replicate approximation (cached prefix, only
    // stochastic blocks re-run) and the cost-anchor provenance.
    const showTotal = replicateCount > 1 && pinnedSeed == null;
    let text = `est ~${formatSeconds(costEst.knownS)}`;
    if (showTotal) text += " each";
    if (unknownN > 0) text += ` + ${unknownN} unknown`;
    let title =
      `Estimated from ${costEst.sampleRuns} archived run(s) in this ` +
      `browser's own run history — median duration per block kind, ` +
      `cache hits excluded.`;
    // cost-anchor, chip edition (shorter twin of the theater's line;
    // constants + source in lib/costModel.ts, grounding: doc §1.2 T2).
    const anchor = costAnchor(costEst.knownS);
    if (anchor) {
      title +=
        ` On IBM pay-as-you-go ≈ ${anchor.usd} (at $1.60/s) · ` +
        `≈${anchor.freeTierPct} of a free-tier month (10 min/28d); ` +
        `simulator wall-time as proxy — hardware timing differs.`;
    }
    if (unknownN > 0) {
      title += ` No history yet for: ${costEst.unknownKinds.join(", ")}.`;
    }
    if (showTotal) {
      const extra = replicateExtraS(
        costEst,
        nodes.map((n) => ({ id: n.id, kind: (n.data as QNodeData).kind })),
        replicateCount,
      );
      text += ` · ≈${formatSeconds(costEst.knownS + extra)} total`;
      title +=
        ` Replicate approximation: the deterministic prefix is served ` +
        `from cache after run 1; only stochastic blocks (sampled ` +
        `fidelity / QuBound / Qshot) re-run each time.`;
    }
    return { text, title };
  }, [costEst, nodes, replicateCount, pinnedSeed]);
  // Non-danger toasts auto-fade; success is quick, warnings linger a bit
  // longer so the user has time to read every bullet. Runner errors stay
  // put until the next action (Run, Clear, preset change) clears them —
  // losing a stack trace to a 6-second fade is a much worse UX than a
  // sticky notice you can dismiss with ×.
  useEffect(() => {
    if (!notice || notice.tone === "danger") return;
    const ms = notice.tone === "ok" ? 4000 : 8000;
    const t = window.setTimeout(() => setNotice(null), ms);
    return () => window.clearTimeout(t);
  }, [notice]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  // OS-level reduce-motion preference — drives whether new edges
  // get React Flow's animated stroke-dash loop.
  const prefersReducedMotion = usePrefersReducedMotion();

  // Watch the Zustand pendingBlockKinds queue: NodePalette pushes block
  // kinds here when the user checks tiles and clicks "Add to canvas" (or
  // clicks the single-add + icon). We create nodes, append them to the
  // canvas, and auto-connect the whole graph.
  useEffect(() => {
    if (pendingBlockKinds.length === 0) return;
    const kinds = pendingBlockKinds;
    clearPendingBlocks();

    // Position new nodes to the right of existing ones.
    const SPACING_X = 260;
    const Y = 120;
    const maxX = nodes.reduce(
      (mx, n) => Math.max(mx, (n.position?.x ?? 0) + 200),
      0,
    );
    const startX = nodes.length === 0 ? 80 : maxX + 60;

    const plugins = useApp.getState().plugins;
    const newNodes: RFNode[] = kinds.map((kind, i) => {
      const spec = resolveNodeSpec(kind, plugins);
      return {
        id: `n${Date.now().toString(36)}${i}`,
        type: "qnode",
        position: { x: startX + i * SPACING_X, y: Y },
        data: {
          kind,
          params: { ...((spec?.defaultData as Record<string, unknown>) ?? {}) },
        },
      };
    });

    // Append only — never touch existing nodes/edges inside the
    // updater. Side effects (setEdges/setNotice) are hoisted OUT of
    // the setNodes updater: StrictMode double-invokes updaters, so a
    // setEdges inside one fires twice.
    setNodes((ns) => [...ns, ...newNodes]);
    if (edges.length > 0) {
      // The canvas already has wiring (hand-drawn or restored).
      // Recomputing the whole edge set would silently destroy it —
      // leave the new blocks unwired and say so.
      setNotice({
        text: `Added ${kinds.length} block${kinds.length > 1 ? "s" : ""} — wire ${kinds.length > 1 ? "them" : "it"} in manually or press Auto-connect.`,
        tone: "ok",
      });
    } else {
      const result = autoConnect([...nodes, ...newNodes], [], plugins);
      if (result.connected) {
        setEdges(result.edges);
        setNotice(
          result.warnings.length > 0
            ? {
                text: `Added ${kinds.length} block${kinds.length > 1 ? "s" : ""} and auto-connected.`,
                tone: "warn",
                detail: result.warnings.join("\n"),
              }
            : {
                text: `Added ${kinds.length} block${kinds.length > 1 ? "s" : ""} and auto-connected.`,
                tone: "ok",
              },
        );
      }
    }

    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300, maxZoom: 1 }));
  }, [pendingBlockKinds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load a sample circuit on boot so the canvas has something to chew
  // on. Prefer the share-link's `sk` key if present; fall back to bell_state.
  useEffect(() => {
    if (circuit) return;
    const key = initial.hashPayload?.sk ?? "bell_state";
    api
      .loadSample(key)
      .then((c) => {
        // Drop a stale resolution: a scenario/restore load may have
        // set a different circuit while this default fetch was in
        // flight — clobbering it back would break scenario auto-runs.
        if (useApp.getState().circuit) return;
        useApp.getState().setCircuit(c);
        useApp.getState().setSampleKey(key);
      })
      .catch(() => {});
  }, [circuit, initial.hashPayload]);

  // Re-fit the canvas to the visible viewport on orientation change.
  // Without this, the React Flow internal viewBox is stale after a
  // portrait → landscape rotation and the pipeline can sit
  // half-off-screen until the user manually pans/zooms.
  useEffect(() => {
    const onChange = () => {
      // Debounce one frame so the new viewport dimensions are
      // computed before fitView measures.
      requestAnimationFrame(() => {
        fitView({ padding: 0.25, duration: 200, maxZoom: 1 });
      });
    };
    window.addEventListener("orientationchange", onChange);
    return () => window.removeEventListener("orientationchange", onChange);
  }, [fitView]);

  const onConnect: OnConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  );

  // Drag-to-insert: when the user drags a block from the palette and
  // the cursor passes over an existing edge, we mark that edge so it
  // can render with a "drop target" highlight. On drop, if the marked
  // edge is still set, we splice the block into it instead of just
  // landing it at the cursor position. Threshold below is in flow
  // coordinates, so it scales with zoom.
  const [dropTargetEdgeId, setDropTargetEdgeId] = useState<string | null>(null);
  const EDGE_HIT_RADIUS = 60;

  /** Distance from point (px,py) to the line segment (ax,ay)-(bx,by). */
  const pointToSegmentDistance = (
    px: number, py: number, ax: number, ay: number, bx: number, by: number,
  ): number => {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };

  /** Pick the edge whose source→target segment passes closest to the
   *  cursor, within EDGE_HIT_RADIUS. Falls back to null if no edge is
   *  near enough — caller treats that as "drop on empty canvas". */
  const findClosestEdge = useCallback(
    (clientX: number, clientY: number): string | null => {
      if (!edges.length) return null;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      // Default node footprint when React Flow hasn't measured yet.
      const FALLBACK_W = 200;
      const FALLBACK_H = 56;
      let best: { id: string; dist: number } | null = null;
      for (const edge of edges) {
        const src = nodes.find((n) => n.id === edge.source);
        const tgt = nodes.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;
        const sw = src.measured?.width ?? FALLBACK_W;
        const sh = src.measured?.height ?? FALLBACK_H;
        const th = tgt.measured?.height ?? FALLBACK_H;
        // Approximate the edge as the line from source-right-center
        // to target-left-center (matches the default smoothstep
        // routing closely enough for hit testing). Target width
        // isn't needed because we anchor on its left edge.
        const sx = src.position.x + sw;
        const sy = src.position.y + sh / 2;
        const tx = tgt.position.x;
        const ty = tgt.position.y + th / 2;
        const dist = pointToSegmentDistance(flowPos.x, flowPos.y, sx, sy, tx, ty);
        if (best === null || dist < best.dist) {
          best = { id: edge.id, dist };
        }
      }
      return best && best.dist < EDGE_HIT_RADIUS ? best.id : null;
    },
    [edges, nodes, screenToFlowPosition],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      // Only track edge-targeting during a palette drag (i.e. there's
      // actually a kind being dragged). The dataTransfer payload isn't
      // readable here (browser security), so we use the presence of
      // application/reactflow in types as a proxy.
      const types = e.dataTransfer.types;
      const isPaletteDrag =
        types && Array.from(types).includes("application/reactflow");
      if (!isPaletteDrag) return;
      const next = findClosestEdge(e.clientX, e.clientY);
      setDropTargetEdgeId((prev) => (prev === next ? prev : next));
    },
    [findClosestEdge],
  );

  // Clear the target highlight if the drag leaves the canvas without
  // a drop — otherwise the dashed edge stays lit after the user
  // abandons the drag outside the canvas.
  const onDragLeave = useCallback((e: React.DragEvent) => {
    // dragleave fires when crossing child element boundaries too;
    // only clear when leaving the canvas wrapper itself.
    if (e.currentTarget === e.target) {
      setDropTargetEdgeId(null);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/reactflow");
      // Capture and clear the target BEFORE early returns so a stray
      // highlight doesn't linger on a failed drop.
      const targetEdgeId = dropTargetEdgeId;
      setDropTargetEdgeId(null);
      if (!kind) return;
      const plugins = useApp.getState().plugins;
      const spec = resolveNodeSpec(kind, plugins);
      if (!spec) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = `n${Date.now().toString(36)}`;
      const node: RFNode = {
        id,
        type: "qnode",
        position,
        data: {
          kind: kind as NodeKind,
          params: { ...((spec.defaultData as Record<string, unknown>) ?? {}) },
        },
      };

      // Splice path: dropped near an existing edge. Remove the old
      // edge and insert two new edges through the freshly-added node.
      // We don't gate this on family compatibility — the user can
      // always re-arrange if the resulting graph is invalid, and
      // requiring strict family matching here would surprise users
      // who want to experiment.
      if (targetEdgeId) {
        const target = edges.find((edge) => edge.id === targetEdgeId);
        if (target) {
          setNodes((ns) => ns.concat(node));
          setEdges((es) => {
            const withoutOld = es.filter((edge) => edge.id !== targetEdgeId);
            return withoutOld.concat(
              { id: `e${id}-in`, source: target.source, target: id },
              { id: `e${id}-out`, source: id, target: target.target },
            );
          });
          return;
        }
      }

      // Default: drop at cursor with no splice.
      setNodes((ns) => ns.concat(node));
    },
    [screenToFlowPosition, setNodes, setEdges, edges, dropTargetEdgeId],
  );

  /** Style override for the targeted edge — animated dashed accent so
   *  it's visually obvious you're about to splice into it. */
  // Build a node_id → StepResult lookup so we can quickly answer
  // "what came out of this node's source?" when attaching edge
  // labels. Cheap to recompute; the run only changes after a run.
  const stepByNodeId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof run>["steps"][number]>();
    if (run) for (const s of run.steps) map.set(s.node_id, s);
    return map;
  }, [run]);

  // Pre-flight lint pass: rerun whenever the graph or the loaded
  // circuit changes. Cheap (O(nodes+edges)) and surfaces the findings
  // as a soft banner above the canvas.
  const preflightPlugins = useApp((s) => s.plugins);
  const preflight: PreflightFinding[] = useMemo(
    () =>
      runPreflight({
        // Pass kind + params (params are the only data fields the
        // preflight rules actually read). Stripping the rest keeps
        // the memo key small so unrelated UI churn doesn't re-fire.
        nodes: nodes.map((n) => ({
          ...n,
          data: {
            kind: n.data.kind,
            params: n.data.params,
          },
        })),
        edges,
        circuit,
        plugins: preflightPlugins,
      }),
    [nodes, edges, circuit, preflightPlugins],
  );

  const styledEdges = useMemo(() => {
    return edges.map((edge) => {
      const isTarget = edge.id === dropTargetEdgeId;
      // Data-flow label: when a successful run exists, each edge
      // shows the shape of what's flowing from source to target
      // (qubits · depth · gates). Reads from the source node's step.
      const srcStep = stepByNodeId.get(edge.source);
      const shape = srcStep?.circuit_shape ?? null;
      // Spelled out rather than `2q · d2 · 2g` — researchers and
      // newcomers both read this without needing a legend. Slightly
      // wider on canvas, but every edge gets the same width budget
      // since labels are bg-colored.
      const label = shape
        ? `${shape.num_qubits} qubits · depth ${shape.depth} · ${shape.size} ops`
        : undefined;
      let next = edge;

      // ---- Circuit ribbon upgrade (post-run) -----------------------
      // Circuit-FLOW edges become tapered ribbons once the run tells
      // us the circuit's shape at both ends (band thickness ∝ √gates;
      // see RibbonEdge.tsx). Two exclusions keep the encoding honest:
      //  * edges OUT of a backend node are auxiliary — they carry a
      //    noise profile, not a circuit — so they keep the thin
      //    (dashed, "noise profile") default rendering;
      //  * the splice-drop target keeps the default type so the
      //    dashed accent highlight reads the same pre- and post-run.
      // Before any run, `shape` is null and every edge falls through
      // to the classic thin bezier — both states look intentional.
      const srcNode = nodes.find((n) => n.id === edge.source);
      const srcFamily = srcNode
        ? resolveNodeSpec(srcNode.data.kind, preflightPlugins)?.family
        : undefined;
      const isAuxiliary = srcFamily === "backend";
      if (!isTarget && !isAuxiliary && shape) {
        const tgtStep = stepByNodeId.get(edge.target);
        const tgtShape = tgtStep?.circuit_shape ?? null;
        const tf = tgtStep?.transformation as
          | { delta?: { size?: number } }
          | null
          | undefined;
        const deltaSize =
          typeof tf?.delta?.size === "number" ? tf.delta.size : 0;
        return {
          ...next,
          type: "ribbon",
          // RibbonEdge renders its own on-ribbon label from data —
          // clearing the RF label avoids any double rendering.
          label: undefined,
          data: {
            ...(next.data ?? {}),
            srcSize: shape.size,
            tgtSize: tgtShape ? tgtShape.size : null,
            deltaSize,
            flowLabel: label,
          },
        } as Edge;
      }

      if (label) {
        next = {
          ...next,
          label,
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          labelStyle: {
            fill: "rgb(var(--color-ink))",
            fontSize: 9,
            fontFamily: "monospace",
            fontWeight: 500,
          },
          labelBgStyle: {
            fill: "rgb(var(--color-surface))",
            stroke: "rgb(var(--color-edge))",
            strokeWidth: 0.5,
            fillOpacity: 0.95,
          },
        };
      }
      if (isTarget) {
        next = {
          ...next,
          style: {
            ...(next.style ?? {}),
            stroke: "rgb(var(--color-accent2))",
            strokeWidth: 3,
            strokeDasharray: "8 4",
          },
          animated: true,
        };
      }
      return next;
    });
  }, [edges, dropTargetEdgeId, stepByNodeId, nodes, preflightPlugins]);

  // ---- Touch drag bridge (mobile drag-to-insert) ---------------------
  //
  // HTML5 drag-and-drop doesn't fire on touch devices, so PaletteTile
  // implements a parallel PointerEvent-based drag and publishes its
  // state through the Zustand store. Here:
  //   * touchDrag (non-null while a finger is dragging) drives the
  //     floating preview chip and the edge-highlight target.
  //   * pendingTouchDrop is set once on pointerup; we commit the
  //     drop (splice into the closest edge, or land at the cursor).
  const touchDrag = useApp((s) => s.touchDrag);
  const pendingTouchDrop = useApp((s) => s.pendingTouchDrop);
  const setPendingTouchDrop = useApp((s) => s.setPendingTouchDrop);

  // While a touch drag is active, mirror the cursor position into
  // dropTargetEdgeId so the same dashed-accent highlight that mouse
  // drag uses also lights up for the touch user.
  useEffect(() => {
    if (!touchDrag) return;
    const next = findClosestEdge(touchDrag.x, touchDrag.y);
    setDropTargetEdgeId((prev) => (prev === next ? prev : next));
  }, [touchDrag, findClosestEdge]);

  // Commit the drop once the finger lifts. Same splice-vs-land logic
  // as onDrop, just sourced from the store instead of a DragEvent.
  useEffect(() => {
    if (!pendingTouchDrop) return;
    const { kind, x, y } = pendingTouchDrop;
    setPendingTouchDrop(null);

    const targetEdgeId = dropTargetEdgeId;
    setDropTargetEdgeId(null);

    const plugins = useApp.getState().plugins;
    const spec = resolveNodeSpec(kind, plugins);
    if (!spec) return;

    // If the finger went up off-canvas (over the palette strip or a
    // pane resizer), abort. wrapperRef bounds drive this check.
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      return;
    }

    const position = screenToFlowPosition({ x, y });
    const id = `n${Date.now().toString(36)}`;
    const node: RFNode = {
      id,
      type: "qnode",
      position,
      data: {
        kind: kind as NodeKind,
        params: { ...((spec.defaultData as Record<string, unknown>) ?? {}) },
      },
    };

    if (targetEdgeId) {
      const target = edges.find((edge) => edge.id === targetEdgeId);
      if (target) {
        setNodes((ns) => ns.concat(node));
        setEdges((es) => {
          const withoutOld = es.filter((edge) => edge.id !== targetEdgeId);
          return withoutOld.concat(
            { id: `e${id}-in`, source: target.source, target: id },
            { id: `e${id}-out`, source: id, target: target.target },
          );
        });
        return;
      }
    }
    setNodes((ns) => ns.concat(node));
  }, [
    pendingTouchDrop,
    dropTargetEdgeId,
    edges,
    screenToFlowPosition,
    setNodes,
    setEdges,
    setPendingTouchDrop,
  ]);

  // Monotonic counter so we can tell stale `loadSample` resolutions
  // (from a prior preset click) from the most recent one. Without this,
  // a user who quickly toggles between two presets that pull different
  // default circuits could end up with preset A's graph but preset B's
  // sample, depending on which network call resolved last.
  const presetGenerationRef = useRef(0);

  const loadPreset = (key: string, sampleOverride?: string) => {
    const preset = PRESET_BY_KEY[key];
    if (!preset) return;
    const myGen = ++presetGenerationRef.current;
    const g = buildPresetGraph(preset);
    setNodes(g.nodes);
    setEdges(g.edges);
    setRun(null);
    setNotice(null);
    // Provenance hygiene: a preset is a NEW definition, not a fork of
    // whatever was restored before. Drop the restored parentage, the
    // pinned seed, the stopping rule and the editor framing, or the
    // next archived run would claim a false lineage / replay a stale
    // seed that has nothing to do with this graph.
    setPinnedSeed(null);
    setPrecisionTarget(null);
    useApp.getState().setRestoredFrom(null);
    useApp.getState().setEditorContext(null);
    // Sample selection: an explicit override beats the preset's
    // defaultCircuit, which beats keeping the current sample. Skip the network round-trip if we're already on
    // the requested sample.
    const targetSample = sampleOverride ?? preset.defaultCircuit;
    if (targetSample && targetSample !== sampleKey) {
      api
        .loadSample(targetSample)
        .then((c) => {
          // Drop the result if the user has clicked another preset in the
          // meantime — that newer click owns the sample state now.
          if (presetGenerationRef.current !== myGen) return;
          useApp.getState().setCircuit(c);
          useApp.getState().setSampleKey(targetSample);
        })
        .catch(() => {
          /* silent — leaves the previous circuit in place */
        });
    }
    // Different presets have different widths; re-fit the view so the user
    // sees the whole new chain instead of a zoomed-in slice.
    requestAnimationFrame(() => {
      fitView({ padding: 0.25, duration: 300, maxZoom: 1 });
    });
  };

  const clearGraph = () => {
    setNodes([]);
    setEdges([]);
    setRun(null);
    setNotice(null);
    // Same provenance hygiene as loadPreset: a cleared canvas is not a
    // fork of anything and carries no pinned seed / stopping rule /
    // card identity (mirrors the New-configuration bridge below).
    setPinnedSeed(null);
    setPrecisionTarget(null);
    useApp.getState().setRestoredFrom(null);
    useApp.getState().setEditorContext(null);
  };

  // Share flow for the toolbar's ⋯ menu (Share lives there at every
  // width since the authoring-vs-evidence cluster split). The menu
  // closes on click, so feedback surfaces as a canvas toast.
  const handleShareFromMenu = async () => {
    const payload = buildSharePayload(nodes, edges, sampleKey);
    const url = buildShareUrl(payload);
    const ok = await copyToClipboard(url);
    if (!ok) {
      setNotice({ text: "Could not copy link to clipboard.", tone: "warn" });
      return;
    }
    try {
      window.history.replaceState(null, "", url);
    } catch {
      /* some embedded iframes block this; ignore */
    }
    setNotice({ text: "Share link copied to clipboard.", tone: "ok" });
  };

  const exportPython = () => {
    if (nodes.length === 0) {
      setNotice({ text: "Nothing to export — add some blocks first.", tone: "warn" });
      return;
    }
    // Provenance of the most recent run rides along: header stamp
    // (run_id / seed_mode / root_seed / app_version) + per-node seed
    // derivation, so the exported script reproduces that run exactly.
    const lastRun = useApp.getState().run;
    // Server-authoritative stopping rule: the target the run actually
    // executed with is stamped into the sampled step's distribution
    // payload (never the toolbar's CURRENT selection, which the user
    // may have changed since the run finished).
    const lastTarget =
      lastRun?.steps
        ?.map(
          (s) =>
            (s.distribution as { precision_target?: number | null } | null | undefined)
              ?.precision_target,
        )
        .find((v): v is number => typeof v === "number") ?? null;
    const provenance =
      lastRun && (lastRun.run_id || lastRun.root_seed != null)
        ? {
            runId: lastRun.run_id ?? null,
            seedMode: lastRun.seed_mode ?? null,
            rootSeed: lastRun.root_seed ?? null,
            appVersion: lastRun.app_version ?? null,
            precisionTarget: lastTarget,
          }
        : null;
    const script = generatePythonScript(nodes, edges, sampleKey, provenance);
    // Download as .py file; run_id in the name links file <-> archive.
    const safeId = provenance?.runId
      ? provenance.runId.replace(/[^a-zA-Z0-9_-]/g, "")
      : null;
    const fname = safeId ? `pipeline_${safeId}.py` : "pipeline.py";
    const blob = new Blob([script], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
    setNotice({ text: `Python script downloaded as ${fname}`, tone: "ok" });
  };

  const runAutoConnect = () => {
    const result = autoConnect(nodes, edges, useApp.getState().plugins);
    if (!result.connected) {
      // Nothing to wire (empty/single/all-unknown canvas): just surface
      // the advisory without touching the edges.
      setNotice({ text: result.warnings[0] ?? "Nothing to connect.", tone: "warn" });
      return;
    }
    setEdges(result.edges);
    const blockCount = result.edges.length + 1;
    const base =
      result.replacedCount > 0
        ? `Replaced ${result.replacedCount} link${result.replacedCount > 1 ? "s" : ""}; connected ${blockCount} blocks.`
        : `Connected ${blockCount} blocks.`;
    if (result.warnings.length === 0) {
      setNotice({ text: base, tone: "ok" });
      return;
    }
    // Toast renders `detail` as a bulleted list under `text`, so we can
    // just hand the raw warnings through — no truncation, no hover hint.
    setNotice({
      text: base,
      tone: "warn",
      detail: result.warnings.join("\n"),
    });
  };

  // ---- Definition-view identity (marker: config-context) -------------
  // While the context bar is up (editor entered from the board), the
  // structural config hash of the CURRENT canvas is recomputed on
  // every graph/param/circuit change, debounced — the same
  // computeConfigHash archiving uses, so what the bar names is
  // exactly what the next Run would archive under. liveCount asks the
  // archive how many runs already carry that hash (re-asked when a
  // run archives), which is what turns "edited" into "will archive as
  // a NEW configuration" vs "matches an archived one".
  const [liveHash, setLiveHash] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  useEffect(() => {
    if (!editorContext) return;
    const t = window.setTimeout(() => {
      setLiveHash(
        nodes.length === 0
          ? null
          : computeConfigHash(
              sampleKey,
              circuit?.name ?? null,
              buildSharePayload(nodes, edges, sampleKey),
              useLiveIbm,
            ),
      );
    }, 250);
    return () => window.clearTimeout(t);
  }, [editorContext, nodes, edges, sampleKey, circuit, useLiveIbm]);
  useEffect(() => {
    if (!editorContext || liveHash == null) {
      setLiveCount(null);
      return;
    }
    let alive = true;
    listRuns(500)
      .then((rs) => {
        if (alive)
          setLiveCount(rs.filter((r) => r.config_hash === liveHash).length);
      })
      .catch(() => {
        /* archive unreadable — the bar just omits the count */
      });
    return () => {
      alive = false;
    };
  }, [editorContext, liveHash, historyVersion]);

  // ---- "New configuration" bridge (IA inversion) ----------------------
  // The board's New-configuration button clears the canvas so the
  // editor opens as a blank definition view: no leftover graph, no
  // stale pinned seed, no fork parentage to mis-thread into the next
  // archived run. (editorContext itself is set by requestNewConfig.)
  const newConfigRequest = useApp((s) => s.newConfigRequest);
  const lastNewConfigRef = useRef(0);
  useEffect(() => {
    if (
      newConfigRequest === 0 ||
      newConfigRequest === lastNewConfigRef.current
    )
      return;
    lastNewConfigRef.current = newConfigRequest;
    setNodes([]);
    setEdges([]);
    setRun(null);
    setPinnedSeed(null);
    setPrecisionTarget(null);
    useApp.getState().setRestoredFrom(null);
    setNotice({
      text: "New configuration — drag blocks from the strip above or pick a preset, then Run to archive its first evidence.",
      tone: "ok",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newConfigRequest]);

  // ---- Provenance restore bridge -------------------------------------
  // The timeline panel pushes an archived run into the store; we
  // rebuild the canvas from its SharePayload (same shape the share
  // links use), reload the sample circuit if we know it, and pin the
  // run's seed when the user asked for an exact replay. We do NOT
  // auto-run: racing a run against React state settling is fragile,
  // and an explicit "press Run" keeps the user in control.
  useEffect(() => {
    if (!pendingRestore) return;
    const {
      graph,
      sampleKey: sk,
      pinSeed,
      sourceRunId,
      precisionTarget: restoredTarget,
      autoRunAfter,
      replicateOnce,
      scenario,
    } = pendingRestore;
    useApp.getState().clearRestore();

    const plugins = useApp.getState().plugins;
    const restoredNodes: RFNode[] = graph.n.map((pn) => ({
      id: pn.i,
      type: "qnode",
      position: { x: pn.x, y: pn.y },
      // Transient acknowledgment: a restore (and a scenario boot, which
      // rides the same bridge) swaps the whole canvas behind whatever
      // panel the user clicked in — a silent mutation disorients ("did
      // anything happen? whose graph is this?"). Every restored node
      // pulses an accent ring once (~1.2s CSS animation, class defined
      // in index.css; the global prefers-reduced-motion rule collapses
      // it) alongside the textual notice.
      className: "restore-pulse",
      data: {
        kind: pn.k,
        params: {
          ...((resolveNodeSpec(pn.k, plugins)?.defaultData as Record<string, unknown>) ?? {}),
          ...(pn.p ?? {}),
        },
      },
    }));
    const restoredEdges: Edge[] = graph.e.map((pe, i) => ({
      id: `re${i}`,
      source: pe.s,
      target: pe.t,
      animated: true,
    }));
    setNodes(restoredNodes);
    setEdges(restoredEdges);
    // Re-fit to the restored graph: its coordinates come from whatever
    // screen it was authored on, and the boot-time fitView measured
    // the BOOT graph — without this, short viewports (~450px-tall
    // canvases) show the restored row half below the fold. Same rAF
    // pattern as loadPreset; maxZoom 1 = never past natural size.
    requestAnimationFrame(() => {
      fitView({ padding: 0.25, duration: 300, maxZoom: 1 });
    });
    // Strip the pulse class after the animation ends (functional update:
    // must not clobber a drag that happened inside the window) so the
    // NEXT restore re-triggers the animation on reused DOM nodes.
    window.setTimeout(() => {
      setNodes((ns) =>
        ns.map((n) =>
          n.className?.includes("restore-pulse")
            ? { ...n, className: undefined }
            : n,
        ),
      );
    }, 1400);
    setRun(null);
    useApp.getState().setRestoredFrom(sourceRunId);
    // Always write the pin — INCLUDING null: restoring a fresh-draw
    // run (board Open) must clear any stale pin left by an unrelated
    // earlier replay, or the next run silently replays the wrong seed.
    setPinnedSeed(pinSeed);
    // The optional-stopping target is part of the restored run's
    // configuration in BOTH modes: a pinned replay of an early-stopped
    // run must re-send it to reproduce the stopping point bit-exactly,
    // and a fresh restore should re-run "the same experiment" —
    // including when it stops. undefined (pre-Wave-I record) → null.
    setPrecisionTarget(restoredTarget ?? null);

    if (sk) {
      api
        .loadSample(sk)
        .then((ci) => {
          useApp.getState().setCircuit(ci);
          useApp.getState().setSampleKey(sk);
          if (autoRunAfter) {
            // Scenario boot: the graph is on the canvas and the right
            // circuit is loaded — NOW it is safe to request the auto
            // run (see the pendingAutoRun consumer below).
            useApp.getState().requestAutoRun(sk, {
              ...(replicateOnce != null ? { replicateOnce } : {}),
              ...(scenario != null ? { scenario } : {}),
            });
            return;
          }
          setNotice({
            text:
              pinSeed != null
                ? "Run restored with its seed pinned — press Run to replay the exact draw."
                : "Run restored — press Run to re-execute (fresh draw).",
            tone: "ok",
          });
        })
        .catch(() =>
          setNotice({
            text: "Graph restored, but the sample circuit failed to load — pick it manually on the left.",
            tone: "warn",
          }),
        );
    } else {
      setNotice({
        text: "Graph restored. This run used an uploaded circuit — re-upload it on the left to reproduce the numbers.",
        tone: "warn",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRestore]);

  const runPipeline = async (opts?: {
    replicateOnce?: number;
    scenario?: string;
  }) => {
    if (!circuit) {
      // Open the left pane so the user can see where to pick a circuit.
      useApp.getState().bumpHintExpandLeftPane();
      setNotice({
        text: "Pick a circuit first — see the Pipeline input pane that just opened on the left.",
        tone: "danger",
      });
      return;
    }
    if (nodes.length === 0) {
      setNotice({
        text: "Canvas is empty. Drag blocks from the strip above, click \"Add blocks\" for a multi-select list, or pick a preset.",
        tone: "danger",
      });
      return;
    }
    // A manual Run supersedes any still-pending scenario auto-run.
    // The auto-run consumer only DEFERS on `running`, so without this
    // a user who presses Run before the scenario's auto-run fires
    // would get a second, unasked-for run the moment this one ends.
    // (The scenario path itself is unaffected: its consumer clears
    // the flag before calling runPipeline.)
    if (useApp.getState().pendingAutoRun) useApp.getState().clearAutoRun();
    setRunning(true);
    setRun(null);
    setNotice(null);
    // Theater bookkeeping: drop the PREVIOUS run's retained traces
    // (they are kept after a run ends so the theater can keep showing
    // the last trace) and record the streaming run's configuration —
    // the theater's context strip + archive-pool band key off it.
    useApp.getState().beginTheaterRun(
      computeConfigHash(
        sampleKey,
        circuit.name ?? null,
        buildSharePayload(nodes, edges, sampleKey),
        useLiveIbm,
      ),
    );

    const makeBody = () => ({
      circuit_id: circuit.circuit_id,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.data as QNodeData).kind,
        data: (n.data as QNodeData).params ?? {},
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      use_live_ibm: useLiveIbm,
      user_id: getUserId(),
      // Pinned seed → exact replay of a specific draw. Absent → the
      // server draws fresh and reports the seed back either way.
      ...(pinnedSeed != null ? { seed: pinnedSeed } : {}),
      // Optional stopping: server stops a sampled step's batching
      // loop once the CI half-width reaches this (min 2 batches).
      ...(precisionTarget != null ? { precision_target: precisionTarget } : {}),
    });

    // Promise wrapper around one SSE run so replicates can execute
    // sequentially (kind to the shared HF CPU) with per-run archiving.
    const runOnce = (): Promise<import("../lib/api").RunResponse> =>
      new Promise((resolve, reject) => {
        api.runStream(
          makeBody(),
          (step) => {
            const prev = useApp.getState().run;
            const steps = [...(prev?.steps ?? []), step];
            setRun({
              circuit_id: circuit.circuit_id,
              ok: steps.every((s) => s.status !== "error"),
              from_cache: false,
              steps,
              final_metrics: prev?.final_metrics ?? {},
            });
          },
          (response) => resolve(response),
          (err) => reject(err),
          // Live evidence: each shot batch updates the node face's
          // narrowing CI bar. Kept in the store (not component state)
          // because QNode renders far from this callback.
          (progress) => useApp.getState().updateLiveProgress(progress),
          // Run identity (run_id / root_seed) arrives as the stream's
          // first event — the theater shows the seed chip live, long
          // before the RunResponse assembles.
          (meta) =>
            useApp.getState().setTheaterRunMeta({
              runId: meta.run_id ?? null,
              rootSeed: meta.root_seed ?? null,
            }),
        );
      });

    // Archive every completed run in the browser-side provenance
    // store. Failure to archive must never break the run UX — the
    // catch only logs.
    const archive = async (response: import("../lib/api").RunResponse) => {
      try {
        const record = buildRunRecord({
          response,
          graph: buildSharePayload(nodes, edges, sampleKey),
          sampleKey,
          circuitName: circuit.name ?? null,
          circuitId: circuit.circuit_id,
          useLiveIbm,
          forkedFrom: useApp.getState().restoredFrom,
          precisionTarget: useApp.getState().precisionTarget,
          // Scenario boots archive tagged: a scripted figure state
          // must never pool with (or be picked as) user evidence.
          scenario: opts?.scenario ?? null,
        });
        await saveRun(record);
        // forked_from is a one-shot claim: only the FIRST run archived
        // after a restore descends from the restored run. Consume it so
        // later runs of this canvas don't inherit a false lineage.
        if (useApp.getState().restoredFrom != null)
          useApp.getState().setRestoredFrom(null);
        useApp.getState().setLastConfigHash(record.config_hash);
        useApp.getState().bumpHistoryVersion();
      } catch (e) {
        console.warn("provenance archive failed:", e);
      }
    };

    // Replicates only make sense for fresh draws; under a pinned seed
    // every repeat would return the identical numbers.
    const count = pinnedSeed != null ? 1 : (opts?.replicateOnce ?? replicateCount);
    try {
      for (let i = 0; i < count; i++) {
        if (count > 1) {
          setNotice({ text: `Replicate ${i + 1}/${count}…`, tone: "ok" });
          setRun(null); // each replicate rebuilds the step list
        }
        const response = await runOnce();
        setRun(response);
        // Re-stamp the theater's run identity from the final response:
        // a cache-served run can complete without a run_meta stream
        // event, and the theater's context strip / archive-pool band
        // key on this matching the displayed run's id.
        useApp.getState().setTheaterRunMeta({
          runId: response.run_id ?? null,
          rootSeed: response.root_seed ?? null,
        });
        await archive(response);
        if (!response.ok) break; // don't burn replicates on a broken graph
      }
      if (count > 1) {
        setNotice({
          text: `Finished ${count} replicates — open a fidelity card to see the distribution build up.`,
          tone: "ok",
        });
      }
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : String(err),
        tone: "danger",
      });
    } finally {
      setRunning(false);
      useApp.getState().clearLiveProgress();
    }
  };

  // ---- Scenario auto-run bridge ---------------------------------------
  // Consumes store.pendingAutoRun (set by the restore consumer above
  // when a scenario asked for autoRunAfter). Fires runPipeline exactly
  // once, and only when the scenario's expected circuit is the one
  // actually loaded — the boot-time default-circuit load resolves on
  // its own schedule, and firing against the wrong circuit would
  // produce a non-reproducible figure. The ref guards double-fire
  // (StrictMode double-effects, rapid dep churn) even before the
  // store flag clears.
  const pendingAutoRun = useApp((s) => s.pendingAutoRun);
  const autoRunFiredRef = useRef(false);
  useEffect(() => {
    // Re-arm once a request is consumed/cleared: the board's quick
    // actions (replay latest / +3 replicates, marker card-expand)
    // issue REPEATED auto-run requests within one page life, unlike
    // the one-shot scenario boot this guard was built for. The ref
    // still swallows double-fires while one request is in flight
    // (StrictMode double-effects, rapid dep churn).
    if (!pendingAutoRun) {
      autoRunFiredRef.current = false;
      return;
    }
    if (running || autoRunFiredRef.current) return;
    if (!circuit || nodes.length === 0) return;
    if (
      pendingAutoRun.sampleKey != null &&
      sampleKey !== pendingAutoRun.sampleKey
    )
      return;
    autoRunFiredRef.current = true;
    const { replicateOnce, scenario } = pendingAutoRun;
    useApp.getState().clearAutoRun();
    void runPipeline({
      ...(replicateOnce != null ? { replicateOnce } : {}),
      ...(scenario != null ? { scenario } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runPipeline is stable-enough (reads live state via closures/store)
  }, [pendingAutoRun, circuit, sampleKey, nodes, running]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Definition-view context bar (marker: config-context) — IA
          inversion: rendered only when the editor was entered FROM
          the board (card Open / New configuration). It makes
          configuration identity — the thing replicates and
          comparisons key on — visible at authoring time. Scenario
          boots and plain mode toggles never set editorContext, so
          scripted figure states render pixel-identically without it. */}
      {editorContext && (
        <ConfigContextBar
          ctx={editorContext}
          liveHash={liveHash}
          liveCount={liveCount}
          circuitTag={sampleKey ?? circuit?.name ?? "no circuit"}
        />
      )}
      {/* ================== CANVAS TOOLBAR =========================
          An INTENTIONAL two-row toolbar at every width ≥ 768px —
          predictable beats adaptive raggedness. The old single
          flex-wrap row broke at an arbitrary, pane-width-dependent
          point: the evidence cluster dangled left on a ragged second
          line and its border-l + 9px "evidence" micro-label read as
          floating debris. Two fixed rows are identical at every
          width; on very wide screens they read as one clean header
          block, so nothing is lost at the top end either.

            Row 1 — workspace & authoring:  "what am I composing?"
            Row 2 — evidence & execution:   "what will the next run
                     measure, and what will it cost?"

          The ROW BOUNDARY itself now carries the grouping semantics
          the old divider + micro-label tried to carry — both are
          deleted; the word "evidence" survives in row 2's aria-label
          where it does its job without adding visual noise.

          Hierarchy: Run is the ONLY accent-colored control in the
          toolbar. Load preset — a secondary action — used to be an
          accent2 btn-secondary pill competing with Run for the eye;
          it is now a standard outline `btn` (see PresetPicker.tsx).

          Consistency sweep (toolbar only): every control is exactly
          h-8, one border tone (border-edge via .btn), one gap rhythm
          (gap-2), selects share .btn padding, and the mode toggle
          keeps its segmented style at the same h-8.

          Overflow: both rows stay overflow:visible — an overflow-x
          clip would force overflow-y:auto (CSS spec) and clip the
          dropdowns (PresetPicker, MoreMenu) that anchor below row 1.
          No wrap is needed by construction: row 2's worst case below
          a 900px viewport is ×20 select (~78px) + target select
          (~120px) + Run (~130px) + two gap-2 (16px) ≈ 345px, ≈380px
          with row padding, and a 768px viewport with the default
          left pane leaves the center column ~412px (768 − 320 left −
          4 resizer − 32 evidence strip). The est chip is the one
          purely advisory element, so it yields first: hidden below a
          900px VIEWPORT (min-[900px]:), where band centers get tight
          with the full ~480px row. Only a deliberate extreme
          left-pane drag (center at its 280px clamp floor, App.tsx)
          can still undercut row 2 — justify-end then spills leftward
          into the row's own empty half while Run stays pinned in the
          corner. Below md, row 1 sheds its md-gated buttons and row
          2 hides as a unit: the mobile Run-FAB flow is unchanged. */}
      <div className="shrink-0 border-b border-edge">
        {/* ---- Row 1: WORKSPACE & AUTHORING -------------------------
            Everything here describes or edits the COMPOSITION — mode
            toggle, block/link counters, preset, wiring, figure
            snapshot, clear, overflow menu — none of it changes what
            the next run MEASURES. Rarely-used authoring actions
            (Share, Export .py) live in the ⋯ menu at EVERY width:
            reachable, but two fewer buttons of permanent chrome.
            Counters are passive status (mute 11px) parked next to the
            toggle behind a subtle dot; the ml-auto gulf separates
            them from the action group — status left, verbs right, no
            interleaving. Full text on ≥sm; on <sm an icon pair (Box =
            "blocks", Link2 = "links") — a bare "5·4" was unreadable
            in user testing. */}
        <div className="h-10 px-3 sm:px-4 flex items-center gap-2 min-w-0">
          <WorkspaceToggle className="h-8" />
          <span
            className="hidden sm:inline text-[11px] text-edge select-none"
            aria-hidden="true"
          >
            ·
          </span>
          <span className="hidden sm:inline text-[11px] text-mute whitespace-nowrap">
            {nodes.length} blocks · {edges.length} links
          </span>
          <span
            className="sm:hidden flex items-center gap-1 text-[11px] text-mute"
            aria-label={`${nodes.length} blocks, ${edges.length} links`}
          >
            <Box className="w-3 h-3" aria-hidden="true" />
            <span className="tabular-nums">{nodes.length}</span>
            <span className="text-edge mx-0.5" aria-hidden="true">·</span>
            <Link2 className="w-3 h-3" aria-hidden="true" />
            <span className="tabular-nums">{edges.length}</span>
          </span>
          {/* Right-aligned authoring actions — all h-8 outline btns,
              labels lg-gated (icon-only through the band). Below md
              Auto-connect/Clear fold into the ⋯ menu (its rows are
              md:hidden-mirrored — exactly one reachable copy of each
              action at any width). */}
          <div className="ml-auto flex items-center gap-2">
            <PresetPicker onPick={loadPreset} />
            <button
              onClick={runAutoConnect}
              disabled={nodes.length < 2}
              className="btn h-8 hidden md:inline-flex disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                edges.length > 0
                  ? "Re-wire all blocks into a source→backend→algorithm→metric→sink chain (replaces existing links)"
                  : "Wire all blocks into a source→backend→algorithm→metric→sink chain"
              }
              aria-label="Auto-connect all blocks"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Auto-connect</span>
            </button>
            {/* Paper-figure export of the whole canvas (hybrid path:
                foreignObject SVG + hi-res PNG; provenance embedded). */}
            <FigureExportButton
              className="hidden md:inline-flex h-8"
              getTarget={() => wrapperRef.current}
              name="canvas"
              view="canvas"
              getGraph={() => buildSharePayload(nodes, edges, sampleKey)}
            />
            <button
              onClick={clearGraph}
              className="btn h-8 hidden md:inline-flex"
              title="Clear the canvas"
              aria-label="Clear canvas"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Clear</span>
            </button>
            {/* ⋯ overflow menu (ALL widths): Share + Export .py always
                live here; Auto-connect + Clear join below md. */}
            <MoreMenu
              canAutoConnect={nodes.length >= 2}
              hasEdgesToReplace={edges.length > 0}
              canClear={nodes.length > 0 || edges.length > 0}
              canExport={nodes.length > 0}
              onAutoConnect={runAutoConnect}
              onShare={handleShareFromMenu}
              onExport={exportPython}
              onClear={clearGraph}
            />
          </div>
        </div>
        {/* ---- Row 2: EVIDENCE & EXECUTION --------------------------
            Everything here shapes or prices the evidence the next Run
            buys: pinned seed, replicate count, optional-stopping
            target, cost estimate, then Run — one right-aligned group
            ending in the toolbar's single CTA, so the row reads
            left-to-right as "under these conditions, at this price →
            RUN", with Run in the bottom-right corner where the eye
            expects the trigger. Nothing floats on the left. Hidden
            below md as a unit (every control in it was individually
            md-gated before): the mobile Run FAB replaces it.
            border-edge/40 = an internal seam, quieter than the
            toolbar's outer border. */}
        <div
          role="group"
          aria-label="Evidence and execution — controls for the next run"
          className="hidden md:flex h-10 px-3 sm:px-4 border-t border-edge/40 items-center justify-end gap-2"
        >
          {/* Pinned-seed chip: visible whenever the next run will replay
              a specific draw instead of sampling fresh. The × clears the
              pin and returns to fresh sampling. */}
          {pinnedSeed != null && (
            <span
              className="chip !border-accent/50 !text-accent"
              title={`Next run replays root seed ${pinnedSeed} exactly. Click × to return to fresh draws.`}
            >
              seed {pinnedSeed}
              <button
                type="button"
                aria-label="Unpin seed"
                className="hover:text-ink"
                onClick={() => setPinnedSeed(null)}
              >
                ×
              </button>
            </span>
          )}
          {/* Replicate selector: run the same configuration N times with
              fresh seeds and archive each draw — the raw material for
              distribution views. Hidden while a seed is pinned (repeats
              of a pinned draw are all identical). */}
          {pinnedSeed == null && (
            <select
              value={replicateCount}
              onChange={(e) => setReplicateCount(Number(e.target.value))}
              disabled={running}
              className="btn h-8 cursor-pointer disabled:opacity-40"
              title={`${GLOSSARY.replicate} Distributions build up in the fidelity card and the run history. Fast after run 1: the unchanged deterministic prefix is served from cache, so replicates 2..N only re-run the stochastic steps.`}
              aria-label="Replicate count"
            >
              <option value={1}>×1</option>
              <option value={5}>×5</option>
              <option value={10}>×10</option>
              <option value={20}>×20</option>
            </select>
          )}
          {/* Anytime-evidence target: optional stopping for sampled
              steps. Unlike the replicate selector it stays visible
              under a pinned seed — the target is part of what gets
              replayed (an early-stopped run needs it to reproduce
              its stopping point). pp = percentage points of fidelity. */}
          <select
            data-marker="precision-target"
            value={precisionTarget ?? ""}
            onChange={(e) =>
              setPrecisionTarget(
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            disabled={running}
            className="btn h-8 cursor-pointer disabled:opacity-40"
            title={`${GLOSSARY.precisionTarget} Off = run every requested measurement. The target is archived with the run and restored on replay, so an early stop reproduces exactly.`}
            aria-label="Precision target"
          >
            <option value="">target: off</option>
            <option value={0.05}>±5pp</option>
            <option value={0.02}>±2pp</option>
            <option value={0.01}>±1pp</option>
          </select>
          {/* Evidence theater: NO toolbar button. The theater is the
              This-run tab's expanded mode (three-scales IA), so its
              reopen affordance lives on the funnel card itself
              (results/cards.tsx, marker open-theater); it still
              auto-opens when a sampled step starts streaming. */}
          {/* cost-estimate chip: what will pressing Run cost, judged
              from this browser's own archived step timings. Sits next
              to Run so the price tag is read together with the
              trigger. Mute styling on purpose — advisory, not a gate —
              which is also why IT is the element that yields below a
              900px viewport (see the width contract above): glanceable
              info, never load-bearing. */}
          {costChip && (
            <span
              data-marker="cost-estimate"
              className="chip hidden min-[900px]:inline-flex whitespace-nowrap"
              title={costChip.title}
            >
              {costChip.text}
            </span>
          )}
          {/* The toolbar's one accent-colored control. The whole row
              md-gates, so no hidden/md:flex here — on mobile the
              bottom-right Run FAB takes over. */}
          <button
            onClick={() => void runPipeline()}
            disabled={running || !circuit}
            className="btn-primary h-8 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={running ? "Running" : "Run pipeline"}
          >
            {running ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running…</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Run pipeline</span>
              </>
            )}
          </button>
        </div>
      </div>
      {preflight.length > 0 && <PreflightBanner findings={preflight} />}
      <div
        ref={wrapperRef}
        // qf-canvas-wrapper applies touch-action: none so iOS Safari
        // doesn't intercept two-finger pinches as page zoom before
        // React Flow sees them — without this class, canvas
        // pinch-zoom is broken on every iOS browser.
        className="flex-1 relative qf-canvas-wrapper"
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragLeave={onDragLeave}
      >
        <ReactFlow
          nodes={nodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          // Boot-fit contract (short-viewport clipping fix): fits cap
          // at 1:1 (nodes never render past natural size just to fill
          // a big canvas) and may zoom OUT to minZoom so the whole
          // graph is always in frame — 0.15 exists for exactly that (a
          // 4-block chain in a ~500px-wide center column fits at ~0.3;
          // the old 0.4 floor clipped it).
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
          minZoom={0.15}
          maxZoom={1.6}
          defaultEdgeOptions={{ animated: !prefersReducedMotion }}
          proOptions={{ hideAttribution: false }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="rgb(var(--color-edge))"
          />
          <Controls showInteractive={false} />
          {/* MiniMap is noisy + unusable on a 360px screen — hide
              when there's no room for it. The class targets React
              Flow's internal MiniMap wrapper via the parent class. */}
          <MiniMap
            pannable
            zoomable
            className="hidden md:block"
            nodeColor={(n) => {
              const kind = (n.data as QNodeData).kind;
              return colorForKind(kind);
            }}
            maskColor="rgb(var(--color-canvas) / 0.82)"
            maskStrokeColor="rgb(var(--color-edge))"
            maskStrokeWidth={1}
          />
        </ReactFlow>
        {nodes.length === 0 && <EmptyCanvas />}
        {run && nodes.length > 0 && <RibbonLegend />}
        {notice && (
          <CanvasToast notice={notice} onDismiss={() => setNotice(null)} />
        )}
        {/* Floating preview while a finger drags a palette tile. fixed
            positioning ignores the wrapper so it follows the finger
            even off-canvas; pointer-events:none means the touch keeps
            hitting whatever is underneath. */}
        {touchDrag && (
          <TouchDragPreview kind={touchDrag.kind} x={touchDrag.x} y={touchDrag.y} />
        )}
        {/* Mobile-only Run FAB. The Run button in the canvas toolbar
            sits ~108px from the top — well outside thumb arc on tall
            phones. This bottom-right FAB at sm:hidden is what mobile
            users actually reach for. It respects safe-area-inset-bottom
            so it stays clear of the iOS home indicator. */}
        <button
          type="button"
          onClick={() => void runPipeline()}
          disabled={running || !circuit}
          className="md:hidden absolute right-4 z-20 flex items-center gap-2 px-4 py-3 rounded-full bg-accent text-canvas shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm active:scale-95 transition-transform"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
          }}
          aria-label={running ? "Running" : "Run pipeline"}
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Running…</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Run</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** Definition-view context bar (marker: config-context).
 *
 *  The editor, framed: "you are defining ONE configuration". The chip
 *  colors derive from the same hash→hue mapping every other panel
 *  uses, so the identity the bar names is visually the same object as
 *  the board card / lineage dots. States:
 *    * card, unedited → "Defining configuration #hash — tag · runs
 *      archived: N"
 *    * card, edited (live hash diverged) → "edited: will archive as a
 *      new configuration #newhash" (or names the EXISTING
 *      configuration it now matches, with its run count)
 *    * new → "New configuration #hash — not yet run" until the first
 *      archive lands, then it becomes a normal "Defining…" line.
 */
type EditorCtx =
  | { source: "card"; hash: string; circuitTag: string; runCount: number }
  | { source: "new" };

function ConfigContextBar({
  ctx,
  liveHash,
  liveCount,
  circuitTag,
}: {
  ctx: EditorCtx;
  liveHash: string | null;
  liveCount: number | null;
  circuitTag: string;
}) {
  const setWorkspaceMode = useApp((s) => s.setWorkspaceMode);
  const setEditorContext = useApp((s) => s.setEditorContext);
  const chip = (hash: string) => (
    <span
      className="chip shrink-0"
      style={{
        color: hueCss(hashHue(hash), 0.95),
        borderColor: hueCss(hashHue(hash), 0.5),
      }}
      title={`configuration #${hash}`}
    >
      #{hash.slice(0, 6)}
    </span>
  );
  const matched = (liveCount ?? 0) > 0;
  return (
    <div
      data-marker="config-context"
      role="note"
      aria-label="Configuration context"
      className="shrink-0 border-b border-edge/60 bg-surfaceAlt/40 px-3 sm:px-4 py-1 flex items-center gap-1.5 text-[11px] text-mute min-w-0"
    >
      <span className="flex items-center gap-1.5 min-w-0 truncate">
        {ctx.source === "card" ? (
          liveHash == null ? (
            <>
              Configuration {chip(ctx.hash)} — canvas cleared
            </>
          ) : liveHash === ctx.hash ? (
            <>
              Defining configuration {chip(ctx.hash)} —{" "}
              <span className="text-ink truncate">{ctx.circuitTag}</span> ·
              runs archived: {liveCount ?? ctx.runCount}
            </>
          ) : (
            <>
              Configuration {chip(ctx.hash)} —{" "}
              <span className="text-warn">edited</span>: will archive as{" "}
              {matched ? (
                <>
                  configuration {chip(liveHash)} (runs archived: {liveCount})
                </>
              ) : (
                <>a new configuration {chip(liveHash)}</>
              )}
            </>
          )
        ) : liveHash == null ? (
          <>New configuration — empty canvas, not yet run</>
        ) : matched ? (
          <>
            Defining configuration {chip(liveHash)} —{" "}
            <span className="text-ink truncate">{circuitTag}</span> · runs
            archived: {liveCount}
          </>
        ) : (
          <>
            New configuration {chip(liveHash)} —{" "}
            <span className="text-ink truncate">{circuitTag}</span> · not yet
            run
          </>
        )}
      </span>
      <button
        type="button"
        className="ml-auto btn shrink-0"
        title="Back to the Evidence board (home)"
        onClick={() => setWorkspaceMode("multiverse")}
      >
        <LayoutGrid className="w-3 h-3" />
        <span className="hidden sm:inline">Back to board</span>
      </button>
      <button
        type="button"
        className="shrink-0 p-0.5 rounded text-mute hover:text-ink hover:bg-surfaceAlt"
        title="Dismiss (the bar returns next time you enter from the board)"
        aria-label="Dismiss configuration context bar"
        onClick={() => setEditorContext(null)}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

/** Floating chip following the finger during a touch drag. Shows the
 *  block's family color + initials so the user sees what they're
 *  carrying. */
/** Soft banner above the canvas summarising pre-flight findings.
 *  Renders as a collapsed-by-default single line "N issues" chip;
 *  expands on click into a per-finding list. The Run button stays
 *  enabled (we don't block on warnings); errors get a danger-tone
 *  treatment but still don't disable Run since the user might want
 *  to try anyway. */
function PreflightBanner({ findings }: { findings: PreflightFinding[] }) {
  const [open, setOpen] = useState(false);
  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");
  const dominantTone = errors.length > 0 ? "danger" : "warn";
  const toneClass =
    dominantTone === "danger"
      ? "border-danger/40 text-danger bg-danger/5"
      : "border-warn/40 text-warn bg-warn/5";
  const headline = errors.length
    ? `${errors.length} issue${errors.length === 1 ? "" : "s"} likely to break the run`
    : `${warns.length} pipeline note${warns.length === 1 ? "" : "s"}`;
  return (
    <div className={`shrink-0 border-b ${toneClass}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px]"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="font-medium">{headline}</span>
        <span className="text-mute/80">— click to {open ? "hide" : "see details"}</span>
      </button>
      {open && (
        <ul className="px-3 pb-2 space-y-1 text-[11px]">
          {findings.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span
                className={`mt-0.5 inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                  f.severity === "error" ? "bg-danger" : "bg-warn"
                }`}
                aria-hidden
              />
              <span>{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TouchDragPreview({
  kind,
  x,
  y,
}: {
  kind: NodeKind;
  x: number;
  y: number;
}) {
  const plugins = useApp((s) => s.plugins);
  const spec = resolveNodeSpec(kind, plugins);
  if (!spec) return null;
  const isPlugin = "isPlugin" in spec && spec.isPlugin;
  const Icon = spec.icon;
  return (
    <div
      className="fixed z-50 pointer-events-none flex items-center gap-1.5 px-2 py-1 rounded-md border border-accent2 bg-surface shadow-lg text-[11px] font-medium text-ink"
      style={{
        left: x + 8,
        top: y + 8,
        // Slight rotation to look "held" and lifted.
        transform: "rotate(-2deg)",
      }}
      aria-hidden
    >
      {isPlugin ? (
        <span
          className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white"
          style={{ backgroundColor: (spec as PluginNodeSpec).pluginColor }}
        >
          {(spec as PluginNodeSpec).initials}
        </span>
      ) : (
        <Icon className={`w-3.5 h-3.5 ${spec.accent}`} />
      )}
      <span>{spec.label}</span>
    </div>
  );
}

/**
 * Absolute-positioned toast pinned to the bottom-center of the canvas.
 * Handles Auto-connect summaries, Auto-connect warnings (multi-line via
 * `notice.detail`), and runner errors. Sits above React Flow's controls
 * AND above the center-column overlays (Multiverse z-20, Theater z-30):
 * the theater auto-opens on streaming runs, and a run error surfaced
 * here must not be occluded by it — hence z-40 (mobile drawers, fixed
 * z-40/50 later in the DOM, still cover it). Caps at a readable width
 * regardless of canvas size.
 */
function CanvasToast({
  notice,
  onDismiss,
}: {
  notice: NonNullable<Notice>;
  onDismiss: () => void;
}) {
  const palette = {
    ok: {
      border: "border-ok/40",
      bg: "bg-ok/10",
      icon: <Check className="w-4 h-4 text-ok" />,
    },
    warn: {
      border: "border-warn/40",
      bg: "bg-warn/10",
      icon: <AlertTriangle className="w-4 h-4 text-warn" />,
    },
    danger: {
      border: "border-danger/40",
      bg: "bg-danger/10",
      icon: <AlertCircle className="w-4 h-4 text-danger" />,
    },
  }[notice.tone];
  const warnings = notice.detail ? notice.detail.split("\n") : [];

  return (
    <div
      role={notice.tone === "danger" ? "alert" : "status"}
      aria-live={notice.tone === "danger" ? "assertive" : "polite"}
      // Sit above the safe-area bottom (iOS home indicator) AND above
      // the mobile Run FAB. The FAB is at ~3.5rem (1rem from safe-area +
      // ~2.5rem button height); we leave that clearance so the toast
      // doesn't overlap.
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)",
      }}
      className={`absolute left-1/2 -translate-x-1/2 z-40 w-[min(36rem,calc(100%-2rem))] rounded-lg border ${palette.border} ${palette.bg} bg-surface/95 backdrop-blur-sm shadow-xl px-4 py-3 flex items-start gap-3 md:!bottom-4`}
    >
      <div className="shrink-0 mt-0.5">{palette.icon}</div>
      <div className="flex-1 min-w-0 text-sm text-ink">
        <div className="leading-snug">{notice.text}</div>
        {warnings.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 text-xs text-mute list-disc pl-4 leading-relaxed">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-mute hover:text-ink transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// MiniMap node colors — hardcoded vivid hex values so they stay punchy
// regardless of which theme is active and don't get washed out by the
// MiniMap's semi-transparent mask layer.
function colorForKind(kind: NodeKind): string {
  const map: Record<NodeKind, string> = {
    input_circuit: "#0284c7",   // sky-600
    fake_backend: "#0369a1",    // sky-700
    ibm_backend: "#d97706",     // amber-600
    qucad: "#7c3aed",           // violet-600
    qubound: "#db2777",         // pink-600
    compvqc: "#059669",         // emerald-600
    qshot: "#ea580c",           // orange-600
    fidelity: "#0d9488",        // teal-600
    output: "#1e293b",          // slate-800
  };
  return map[kind] ?? "#94a3b8";
}


const LEGEND_LS_KEY = "quda.ribbonLegendDismissed";

/** Canvas encoding key — a small dismissible chip anchored to the
 *  bottom-left of the canvas (right of the React Flow zoom controls).
 *  Three lines, one per post-run encoding, each drawn with a mini
 *  replica of the real mark so the key teaches by resemblance rather
 *  than by prose. Dismissal persists in localStorage: figure-makers
 *  keep it for screenshots, daily users clear it once and never see
 *  it again. */
function RibbonLegend() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LEGEND_LS_KEY) === "1";
    } catch {
      return false;
    }
  });
  // Visual-calm contract: the key teaches, then leaves. It only mounts
  // after the session's FIRST run (the parent gates on `run`, which is
  // in-memory store state — a fresh session starts without it), fades
  // out on its own after 20 s and unmounts a second later so it stops
  // occluding the canvas. The timer is mount-scoped, so later runs in
  // the same session don't resurrect it. The × dismissal stays the
  // only PERSISTED state — an auto-faded key returns next session
  // until explicitly dismissed.
  const [fading, setFading] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 20_000);
    const t2 = setTimeout(() => setExpired(true), 21_000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  if (dismissed || expired) return null;
  return (
    <div
      className={`absolute left-16 z-10 panel-alt px-2.5 py-2 text-[10px] leading-relaxed text-mute shadow-md max-w-[250px] space-y-1 transition-opacity duration-1000 ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      role="note"
      aria-label="Canvas encoding key"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden className="shrink-0">
              <polygon
                points="0,0 26,3 26,7 0,10"
                fill="rgb(var(--color-accent))"
                fillOpacity="0.35"
              />
            </svg>
            <span>
              {/* "(clamped)" disclosure: RibbonEdge clamps thickness to
                  [3px, 18px], so extreme circuits compress at the ends
                  of the scale — the legend must say the encoding is
                  not linear all the way out (audit MINOR). */}
              <span className="text-ink">ribbon width</span> = circuit size (√gates, clamped)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden className="shrink-0">
              <polygon
                points="0,1 26,3.5 26,6.5 0,9"
                fill="rgb(var(--color-accent))"
                fillOpacity="0.3"
              />
              <polygon
                points="13,2.2 26,3.5 26,6.5 13,7.8"
                fill="rgb(var(--color-ok))"
                fillOpacity="0.45"
              />
            </svg>
            <span>
              <span className="text-ok">green</span> taper = step shrank it ·{" "}
              <span className="text-warn">amber</span> = grew
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden className="shrink-0">
              <line x1="13" y1="0.5" x2="13" y2="9.5" stroke="rgb(var(--color-mute))" strokeWidth="1" opacity="0.5" />
              <rect x="5" y="1" width="8" height="1.6" fill="rgb(var(--color-ok))" />
              <rect x="7" y="3.4" width="6" height="1.6" fill="rgb(var(--color-ok))" />
              <rect x="13" y="5.8" width="4" height="1.6" fill="rgb(var(--color-warn))" />
              <rect x="12.5" y="8.2" width="1" height="1.6" fill="rgb(var(--color-mute))" opacity="0.6" />
            </svg>
            <span>
              <span className="text-ink">strip</span> = Δ depth/gates/params/qubits
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss canvas key"
          title="Dismiss (remembered on this device)"
          className="shrink-0 text-mute hover:text-ink transition-colors"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(LEGEND_LS_KEY, "1");
            } catch {
              /* private mode etc. — chip just reappears next visit */
            }
          }}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
