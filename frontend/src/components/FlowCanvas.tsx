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
  type Node,
  type NodeTypes,
  type OnConnect,
} from "@xyflow/react";
import {
  AlertCircle,
  AlertTriangle,
  Box,
  Check,
  Code2,
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
import { QNode, type QNodeData } from "./QNode";
import { PresetPicker } from "./PresetPicker";
import { ShareButton } from "./ShareButton";
import { EmptyCanvas } from "./EmptyCanvas";
import { MoreMenu } from "./MoreMenu";

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
  const pendingQuickStart = useApp((s) => s.pendingQuickStart);
  const clearQuickStart = useApp((s) => s.clearQuickStart);
  const [notice, setNotice] = useState<Notice>(null);
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

    setNodes((ns) => {
      const merged = [...ns, ...newNodes];
      const result = autoConnect(merged, [], useApp.getState().plugins);
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
      return merged;
    });

    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
  }, [pendingBlockKinds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch the quick-start trigger from TrySlide. When set, load the
  // preset + sample combination, fit the view, and clear the trigger.
  useEffect(() => {
    if (!pendingQuickStart) return;
    const { presetKey, sampleKey: sk } = pendingQuickStart;
    clearQuickStart();
    loadPreset(presetKey, sk);
    setNotice({
      text: `Loaded ${presetKey} preset with ${sk}. Hit Run pipeline to try it.`,
      tone: "ok",
    });
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
  }, [pendingQuickStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load a sample circuit on boot so the canvas has something to chew
  // on. Prefer the share-link's `sk` key if present; fall back to bell_state.
  useEffect(() => {
    if (circuit) return;
    const key = initial.hashPayload?.sk ?? "bell_state";
    api
      .loadSample(key)
      .then((c) => {
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
        fitView({ padding: 0.25, duration: 200 });
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
        nodes: nodes.map((n) => ({ ...n, data: { kind: n.data.kind } })),
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
      const label = shape
        ? `${shape.num_qubits}q · d${shape.depth} · ${shape.size}g`
        : undefined;
      let next = edge;
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
  }, [edges, dropTargetEdgeId, stepByNodeId]);

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
    // Sample selection: explicit override (e.g. from tour quick-start)
    // beats the preset's defaultCircuit, which beats keeping the
    // current sample. Skip the network round-trip if we're already on
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
      fitView({ padding: 0.25, duration: 300 });
    });
  };

  const clearGraph = () => {
    setNodes([]);
    setEdges([]);
    setRun(null);
    setNotice(null);
  };

  // Share flow used by the mobile More menu. The desktop ShareButton owns
  // its own inline "Copied" tick; on mobile the menu closes on click, so
  // we surface the feedback as a canvas toast instead.
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
    const script = generatePythonScript(nodes, edges, sampleKey);
    // Download as .py file
    const blob = new Blob([script], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pipeline.py";
    a.click();
    URL.revokeObjectURL(url);
    setNotice({ text: "Python script downloaded as pipeline.py", tone: "ok" });
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

  const runPipeline = async () => {
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
    setRunning(true);
    setRun(null);
    setNotice(null);
    const body = {
      circuit_id: circuit.circuit_id,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.data as QNodeData).kind,
        data: (n.data as QNodeData).params ?? {},
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      use_live_ibm: useLiveIbm,
      user_id: getUserId(),
    };
    // Use the SSE streaming endpoint so the user sees each step
    // appear in the results pane as it completes.
    api.runStream(
      body,
      (step) => {
        // Incrementally build the run response as steps arrive.
        const prev = useApp.getState().run;
        const steps = [...(prev?.steps ?? []), step];
        setRun({
          circuit_id: body.circuit_id,
          ok: steps.every((s) => s.status !== "error"),
          from_cache: false,
          steps,
          final_metrics: prev?.final_metrics ?? {},
        });
      },
      (response) => {
        setRun(response);
        setRunning(false);
      },
      (err) => {
        setNotice({ text: err.message, tone: "danger" });
        setRunning(false);
      },
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-12 shrink-0 border-b border-edge px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4 overflow-x-auto">
        {/* Status counter. Full form on ≥sm. On <sm we swap in an icon
            pair (Box = "blocks", Link2 = "links") so the compact counter
            is still self-explanatory — a bare "5·4" turned out to be
            unreadable in user testing. */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-mute shrink-0">
          <span className="hidden sm:inline">{nodes.length} blocks</span>
          <span className="hidden sm:inline text-edge">·</span>
          <span className="hidden sm:inline">{edges.length} links</span>
          <span
            className="sm:hidden flex items-center gap-1"
            aria-label={`${nodes.length} blocks, ${edges.length} links`}
          >
            <Box className="w-3 h-3" aria-hidden="true" />
            <span className="tabular-nums">{nodes.length}</span>
            <span className="text-edge mx-0.5" aria-hidden="true">·</span>
            <Link2 className="w-3 h-3" aria-hidden="true" />
            <span className="tabular-nums">{edges.length}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <PresetPicker onPick={loadPreset} />

          {/* ≥ md: individual action buttons. Labels show at ≥ lg only —
              between md and lg the buttons collapse to icon-only so four
              items still fit comfortably alongside the preset button and
              Run pipeline. */}
          <button
            onClick={runAutoConnect}
            disabled={nodes.length < 2}
            className="btn hidden md:inline-flex disabled:opacity-40 disabled:cursor-not-allowed"
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
          <ShareButton
            nodes={nodes}
            edges={edges}
            sampleKey={sampleKey}
            className="hidden md:inline-flex"
            labelBreakpoint="lg"
          />
          <button
            onClick={exportPython}
            disabled={nodes.length === 0}
            className="btn hidden md:inline-flex disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export this pipeline as a runnable Python script"
            aria-label="Export Python script"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Export .py</span>
          </button>
          <button
            onClick={clearGraph}
            className="btn hidden md:inline-flex"
            title="Clear the canvas"
            aria-label="Clear canvas"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Clear</span>
          </button>

          {/* < md: everything but PresetPicker and Run folds into a single
              "More" menu. Keeps the toolbar to 3 visible controls on phones. */}
          <MoreMenu
            className="md:hidden"
            canAutoConnect={nodes.length >= 2}
            hasEdgesToReplace={edges.length > 0}
            canClear={nodes.length > 0 || edges.length > 0}
            canExport={nodes.length > 0}
            onAutoConnect={runAutoConnect}
            onShare={handleShareFromMenu}
            onExport={exportPython}
            onClear={clearGraph}
          />

          <button
            onClick={runPipeline}
            disabled={running || !circuit}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={running ? "Running" : "Run pipeline"}
          >
            {running ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Running…</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Run pipeline</span>
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
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.4}
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
          onClick={runPipeline}
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
 * (z-30) and caps at a readable width regardless of canvas size.
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
      className={`absolute left-1/2 -translate-x-1/2 z-30 w-[min(36rem,calc(100%-2rem))] rounded-lg border ${palette.border} ${palette.bg} bg-surface/95 backdrop-blur-sm shadow-xl px-4 py-3 flex items-start gap-3 md:!bottom-4`}
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

