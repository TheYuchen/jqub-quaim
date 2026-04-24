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
import { Loader2, Play, Trash2 } from "lucide-react";
import { NODE_BY_KIND, type NodeKind } from "../lib/nodeCatalog";
import {
  DEFAULT_PRESET_KEY,
  PRESET_BY_KEY,
  buildPresetGraph,
} from "../lib/presets";
import { useApp } from "../lib/store";
import { api } from "../lib/api";
import { readHashPayload, type SharePayload } from "../lib/share";
import { QNode, type QNodeData } from "./QNode";
import { PresetPicker } from "./PresetPicker";
import { ShareButton } from "./ShareButton";
import { EmptyCanvas } from "./EmptyCanvas";

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
  const [error, setError] = useState<string | null>(null);
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
          <ShareButton nodes={nodes} edges={edges} sampleKey={sampleKey} />
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

