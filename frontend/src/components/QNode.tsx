import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { AlertTriangle, FileText, X } from "lucide-react";
import { NODE_BY_KIND, type NodeKind } from "../lib/nodeCatalog";
import { NodeParamEditor } from "./NodeParamEditor";
import { useApp } from "../lib/store";

export interface QNodeData extends Record<string, unknown> {
  kind: NodeKind;
  params?: Record<string, unknown>;
}

/**
 * Visual representation of a pipeline step on the canvas.
 *
 * We deliberately keep each node simple (icon + label + 1-2 param hints) — the
 * full parameter editor / results viewer lives in the ResultsPane on the
 * right. Noisy per-node inline editors make the graph hard to read.
 *
 * A small × button appears on hover so users can delete a node without
 * knowing the Backspace shortcut.
 */
export function QNode({ id, data, selected }: NodeProps) {
  const d = data as QNodeData;
  const spec = NODE_BY_KIND[d.kind];
  const flow = useReactFlow();
  const { deleteElements } = flow;
  // Subscribe to the active circuit so source/algorithm blocks can
  // surface circuit-relevant context (e.g. Input shows the loaded
  // sample's qubit count; Qshot warns if the circuit is outside its
  // 5–8 qubit training range). Hooks must run unconditionally, so we
  // pull these even when the node kind doesn't use them — Zustand's
  // shallow comparison keeps the cost cheap.
  const circuit = useApp((s) => s.circuit);
  const sampleKey = useApp((s) => s.sampleKey);
  if (!spec) return null;
  const Icon = spec.icon;

  /** Patch this node's `data.params` and propagate to React Flow state. */
  const patchParams = (patch: Record<string, unknown>) => {
    flow.updateNodeData(id, {
      ...d,
      params: { ...(d.params ?? {}), ...patch },
    });
  };

  const hasInput = spec.family !== "source";
  const hasOutput = spec.family !== "sink";

  return (
    <div
      className={`node-card group relative transition-colors ${
        selected ? "shadow-glow !border-accent/60" : ""
      } ${spec.accentRing}`}
    >
      <button
        type="button"
        aria-label="Delete this block"
        title="Delete this block"
        className="nodrag absolute -top-2 -right-2 w-5 h-5 rounded-full bg-surface border border-edge text-mute hover:text-danger hover:border-danger/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => {
          e.stopPropagation();
          deleteElements({ nodes: [{ id }] });
        }}
      >
        <X className="w-3 h-3" strokeWidth={2.5} />
      </button>
      {spec.paper && (
        <a
          href={spec.paper.url}
          target="_blank"
          rel="noopener noreferrer"
          className="nodrag absolute -top-2 -left-2 w-5 h-5 rounded-full bg-accent/20 border border-accent/70 text-accent hover:bg-accent/40 hover:border-accent hover:text-ink flex items-center justify-center shadow-sm transition-colors z-10"
          onClick={(e) => e.stopPropagation()}
          title={`Paper: ${spec.paper.title} (${spec.paper.venue})`}
          aria-label={`Open paper: ${spec.paper.title}`}
        >
          <FileText className="w-3 h-3" strokeWidth={2} />
        </a>
      )}
      <div className="flex items-center gap-2">
        <span
          className={`w-7 h-7 rounded-md border ${spec.accentRing} bg-surface flex items-center justify-center ${spec.accent} shrink-0`}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-ink text-sm">{spec.label}</div>
          <div className="text-[10px] text-mute uppercase tracking-wider">
            {spec.family}
          </div>
        </div>
      </div>
      <div
        className="mt-1.5 text-[10px] text-mute leading-snug line-clamp-2"
        title={spec.description}
      >
        {spec.tagline}
      </div>

      {/* Circuit-aware context — only kinds that actually depend on the
          loaded circuit render anything here. */}
      {d.kind === "input_circuit" && circuit && (
        <div className="mt-1.5 pt-1.5 border-t border-edge/40 text-[10px] text-mute leading-snug">
          <div className="flex items-baseline gap-1.5">
            <span>Loaded</span>
            <span className="font-mono text-ink truncate">
              {sampleKey ?? "uploaded"}
            </span>
          </div>
          <div className="font-mono text-mute/90 mt-0.5">
            {circuit.num_qubits}q · depth {circuit.depth}
            {circuit.num_parameters > 0 && (
              <> · {circuit.num_parameters} params</>
            )}
          </div>
        </div>
      )}

      {d.kind === "qshot" && circuit && (
        <QshotFitChip nq={circuit.num_qubits} />
      )}

      {/* Editable params (schema-driven) take priority. Otherwise fall
          back to the static read-out of any leftover defaultData. */}
      {spec.params && spec.params.length > 0 ? (
        <NodeParamEditor
          spec={spec.params}
          values={d.params ?? {}}
          onChange={patchParams}
        />
      ) : (
        d.params &&
        Object.keys(d.params).length > 0 && (
          <div className="mt-2 pt-2 border-t border-edge/60 space-y-0.5">
            {Object.entries(d.params).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 text-[11px]">
                <span className="text-mute">{k}</span>
                <span className="font-mono text-ink truncate max-w-[120px]">
                  {String(v)}
                </span>
              </div>
            ))}
          </div>
        )
      )}
      {hasInput && (
        <Handle type="target" position={Position.Left} isConnectable={true} />
      )}
      {hasOutput && (
        <Handle type="source" position={Position.Right} isConnectable={true} />
      )}
    </div>
  );
}

/** Tiny in-block status pill for the Qshot node: shows whether the
 *  loaded circuit's qubit count is inside the 5-8q training range or
 *  will trip the GNN-fallback path. Saves the user from learning the
 *  hard way after a 60-second pilot run that the recommendation came
 *  from the extrapolation path. */
function QshotFitChip({ nq }: { nq: number }) {
  const inRange = nq >= 5 && nq <= 8;
  if (inRange) {
    return (
      <div className="mt-1.5 pt-1.5 border-t border-edge/40 text-[10px] text-ok leading-snug font-mono">
        in training range · {nq}q
      </div>
    );
  }
  return (
    <div className="mt-1.5 pt-1.5 border-t border-warn/40 text-[10px] text-warn leading-snug">
      <div className="flex items-center gap-1">
        <AlertTriangle className="w-3 h-3 shrink-0" strokeWidth={2.2} />
        <span className="font-mono">{nq}q · outside 5–8q range</span>
      </div>
      <div className="text-warn/80 mt-0.5">
        will trigger GNN fallback
      </div>
    </div>
  );
}

