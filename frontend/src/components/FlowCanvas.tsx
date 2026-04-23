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
import { Loader2, Play, RotateCcw, Trash2 } from "lucide-react";
import { NODE_BY_KIND, NODE_CATALOG, type NodeKind } from "../lib/nodeCatalog";
import { useApp } from "../lib/store";
import { api } from "../lib/api";
import { QNode, type QNodeData } from "./QNode";

type RFNode = Node<QNodeData>;

const nodeTypes: NodeTypes = { qnode: QNode as unknown as NodeTypes[string] };

/** Initial pipeline when the app first loads — a sensible demo. */
function makeInitialGraph(): { nodes: RFNode[]; edges: Edge[] } {
  let y = 40;
  const positions: Record<NodeKind, { x: number; y: number }> = {
    input_circuit: { x: 80, y: (y += 0) },
    fake_backend: { x: 380, y: y },
    qubound: { x: 680, y: y },
    output: { x: 980, y: y },
    ibm_backend: { x: 0, y: 0 },
    qucad: { x: 0, y: 0 },
    compvqc: { x: 0, y: 0 },
    fidelity: { x: 0, y: 0 },
  };
  const want: NodeKind[] = ["input_circuit", "fake_backend", "qubound", "output"];
  const nodes: RFNode[] = want.map((kind, idx) => ({
    id: `n${idx + 1}`,
    type: "qnode",
    position: positions[kind],
    data: { kind, params: { ...(NODE_BY_KIND[kind].defaultData ?? {}) } },
  }));
  const edges: Edge[] = [
    { id: "e1", source: "n1", target: "n2" },
    { id: "e2", source: "n2", target: "n3" },
    { id: "e3", source: "n3", target: "n4" },
  ];
  return { nodes, edges };
}

export function FlowCanvas() {
  const initial = useMemo(() => makeInitialGraph(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const circuit = useApp((s) => s.circuit);
  const setRun = useApp((s) => s.setRun);
  const running = useApp((s) => s.running);
  const setRunning = useApp((s) => s.setRunning);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

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

  const resetGraph = () => {
    const g = makeInitialGraph();
    setNodes(g.nodes);
    setEdges(g.edges);
    setRun(null);
    setError(null);
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
      setError("Canvas is empty — drag some blocks in.");
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
          <button onClick={resetGraph} className="btn" title="Reset to default demo pipeline">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
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
            color="#1f2a4a"
          />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => {
              const kind = (n.data as QNodeData).kind;
              return colorForKind(kind);
            }}
            maskColor="rgba(11, 16, 32, 0.65)"
          />
        </ReactFlow>
        {nodes.length === 0 && <EmptyCanvas />}
      </div>
    </div>
  );
}

function colorForKind(kind: NodeKind): string {
  const map: Record<NodeKind, string> = {
    input_circuit: "#4cc9f0",
    fake_backend: "#4cc9f0",
    ibm_backend: "#f4a261",
    qucad: "#7b5cff",
    qubound: "#f72585",
    compvqc: "#06d6a0",
    fidelity: "#2dd4bf",
    output: "#e6ebff",
  };
  return map[kind] ?? "#8492c7";
}

function EmptyCanvas() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div className="panel px-6 py-5 pointer-events-auto text-center max-w-sm">
        <div className="text-ink font-medium mb-1">Canvas is empty</div>
        <div className="text-sm text-mute mb-3">
          Drag blocks from the left panel, or hit <span className="kbd">Reset</span> to
          load the default demo.
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
