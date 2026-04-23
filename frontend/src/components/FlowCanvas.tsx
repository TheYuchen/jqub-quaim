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
import { ChevronDown, Loader2, Play, Trash2 } from "lucide-react";
import { NODE_BY_KIND, NODE_CATALOG, type NodeKind } from "../lib/nodeCatalog";
import {
  DEFAULT_PRESET_KEY,
  PIPELINE_PRESETS,
  PRESET_BY_KEY,
  buildPresetGraph,
} from "../lib/presets";
import { useApp } from "../lib/store";
import { api } from "../lib/api";
import { QNode, type QNodeData } from "./QNode";

type RFNode = Node<QNodeData>;

const nodeTypes: NodeTypes = { qnode: QNode as unknown as NodeTypes[string] };

export function FlowCanvas() {
  // Boot with the default preset. The picker in the header lets the user
  // swap in any of the other presets at any time; that replaces the whole
  // graph (same semantics as the old "Reset" button, just multi-option).
  const initial = useMemo(
    () => buildPresetGraph(PRESET_BY_KEY[DEFAULT_PRESET_KEY]),
    [],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const circuit = useApp((s) => s.circuit);
  const setRun = useApp((s) => s.setRun);
  const running = useApp((s) => s.running);
  const setRunning = useApp((s) => s.setRunning);
  const useLiveIbm = useApp((s) => s.useLiveIbm);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Auto-load the first sample on boot so the canvas has something to chew on.
  useEffect(() => {
    if (circuit) return;
    api.loadSample("bell_state").then((c) => useApp.getState().setCircuit(c)).catch(() => {});
  }, [circuit]);

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
    setError(null);
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
    setError(null);
  };

  const runPipeline = async () => {
    if (!circuit) {
      setError("Please pick or upload a circuit first.");
      return;
    }
    if (nodes.length === 0) {
      setError("Canvas is empty. Drag some blocks in.");
      return;
    }
    setRunning(true);
    setError(null);
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
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-12 shrink-0 border-b border-edge px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-mute">
          <span>{nodes.length} blocks</span>
          <span className="text-edge">·</span>
          <span>{edges.length} links</span>
          {error && <span className="text-danger ml-3">{error}</span>}
        </div>
        <div className="flex items-center gap-2">
          <PresetPicker onPick={loadPreset} />
          <button onClick={clearGraph} className="btn" title="Clear the canvas">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
          <button
            onClick={runPipeline}
            disabled={running || !circuit}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Run pipeline
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
      </div>
    </div>
  );
}

/**
 * "Load preset" button that opens a small popover listing the named
 * pipelines from the preset registry. Dismissed on outside-click or
 * Escape. Picking a preset replaces the whole graph.
 */
function PresetPicker({ onPick }: { onPick: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as globalThis.Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary"
        title="Load a preset pipeline onto the canvas"
      >
        Load preset <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 rounded-lg border border-edge bg-surface shadow-xl z-20 p-1.5 flex flex-col gap-0.5 w-64"
        >
          {PIPELINE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="menuitem"
              onClick={() => {
                onPick(p.key);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-surfaceAlt transition-colors border border-transparent hover:border-edge/60"
            >
              <div className="text-sm text-ink font-medium">{p.label}</div>
              <div className="text-[11px] text-mute leading-snug mt-0.5">
                {p.tagline}
              </div>
            </button>
          ))}
        </div>
      )}
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

function EmptyCanvas() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div className="panel px-6 py-5 pointer-events-auto text-center max-w-sm">
        <div className="text-ink font-medium mb-1">Canvas is empty</div>
        <div className="text-sm text-mute mb-3">
          Drag blocks from the strip above, or pick a preset from{" "}
          <span className="kbd">Load preset</span>.
        </div>
        <div className="flex flex-wrap gap-1 justify-center">
          {NODE_CATALOG.slice(0, 6).map((n) => (
            <span key={n.kind} className="chip">
              {n.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
