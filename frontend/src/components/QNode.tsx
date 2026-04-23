import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_BY_KIND, type NodeKind } from "../lib/nodeCatalog";

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
 */
export function QNode({ data, selected }: NodeProps) {
  const d = data as QNodeData;
  const spec = NODE_BY_KIND[d.kind];
  if (!spec) return null;
  const Icon = spec.icon;

  const hasInput = spec.family !== "source";
  const hasOutput = spec.family !== "sink";

  return (
    <div
      className={`node-card transition-colors ${
        selected ? "shadow-glow !border-accent/60" : ""
      } ${spec.accentRing}`}
    >
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
      {d.params && Object.keys(d.params).length > 0 && (
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
