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
  Link2,
  Loader2,
  Play,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { copyToClipboard } from "../lib/clipboard";
import { NODE_BY_KIND, type NodeKind } from "../lib/nodeCatalog";
import {
  DEFAULT_PRESET_KEY,
  PRESET_BY_KEY,
  buildPresetGraph,
} from "../lib/presets";
import { autoConnect } from "../lib/autoConnect";
import { useApp } from "../lib/store";
import { api } from "../lib/api";
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
  const setRunning = useApp((s) => s.setRunning);
  const useLiveIbm = useApp((s) => s.useLiveIbm);
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

  const onConnect: OnConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/reactflow") as NodeKind;
      if (!kind || !NODE_BY_KIND[kind]) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = `n${Date.now().toString(36)}`;
      const node: RFNode = {
        id,
        type: "qnode",
        position,
        data: { kind, params: { ...(NODE_BY_KIND[kind].defaultData ?? {}) } },
      };
      setNodes((ns) => ns.concat(node));
    },
    [screenToFlowPosition, setNodes],
  );

  const loadPreset = (key: string) => {
    const preset = PRESET_BY_KEY[key];
    if (!preset) return;
    const g = buildPresetGraph(preset);
    setNodes(g.nodes);
    setEdges(g.edges);
    setRun(null);
    setNotice(null);
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

  const runAutoConnect = () => {
    const result = autoConnect(nodes, edges);
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
      setNotice({ text: "Please pick or upload a circuit first.", tone: "danger" });
      return;
    }
    if (nodes.length === 0) {
      setNotice({ text: "Canvas is empty. Drag some blocks in.", tone: "danger" });
      return;
    }
    setRunning(true);
    setNotice(null);
    try {
      const body = {
        circuit_id: circuit.circuit_id,
        nodes: nodes.map((n) => ({
          id: n.id,
          type: (n.data as QNodeData).kind,
          data: (n.data as QNodeData).params ?? {},
        })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        use_live_ibm: useLiveIbm,
      };
      const res = await api.run(body);
      setRun(res);
    } catch (e) {
      setNotice({ text: (e as Error).message, tone: "danger" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-12 shrink-0 border-b border-edge px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4">
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
            onAutoConnect={runAutoConnect}
            onShare={handleShareFromMenu}
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
      <div ref={wrapperRef} className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.4}
          maxZoom={1.6}
          defaultEdgeOptions={{ animated: true }}
          proOptions={{ hideAttribution: false }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="rgb(var(--color-edge))"
          />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => {
              const kind = (n.data as QNodeData).kind;
              return colorForKind(kind);
            }}
            maskColor="rgb(var(--color-canvas) / 0.65)"
          />
        </ReactFlow>
        {nodes.length === 0 && <EmptyCanvas />}
        {notice && (
          <CanvasToast notice={notice} onDismiss={() => setNotice(null)} />
        )}
      </div>
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
      className={`absolute left-1/2 -translate-x-1/2 bottom-4 z-30 w-[min(36rem,calc(100%-2rem))] rounded-lg border ${palette.border} ${palette.bg} bg-surface/95 backdrop-blur-sm shadow-xl px-4 py-3 flex items-start gap-3`}
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

// MiniMap node colors keyed to theme variables so they shift alongside the
// rest of the palette instead of clashing in light or GMU themes.
function colorForKind(kind: NodeKind): string {
  const map: Record<NodeKind, string> = {
    input_circuit: "rgb(var(--color-accent))",
    fake_backend: "rgb(var(--color-accent))",
    ibm_backend: "rgb(var(--color-warn))",
    qucad: "rgb(var(--color-accent2))",
    qubound: "rgb(var(--color-accent3))",
    compvqc: "rgb(var(--color-accent4))",
    fidelity: "rgb(var(--color-ok))",
    output: "rgb(var(--color-ink))",
  };
  return map[kind] ?? "rgb(var(--color-mute))";
}

