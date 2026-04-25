import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { FileText, X } from "lucide-react";
import { NODE_BY_KIND, type NodeKind } from "../lib/nodeCatalog";
import {
  DEFAULT_SNAPSHOT_KEY,
  NOISE_SNAPSHOTS,
  SNAPSHOT_BY_KEY,
} from "../lib/qshotSnapshots";

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
      {d.kind === "qshot" ? (
        <QshotParamEditor
          params={d.params ?? {}}
          onChange={patchParams}
        />
      ) : (
        d.params && Object.keys(d.params).length > 0 && (
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

/**
 * Inline parameter editor for the Qshot block.
 *
 * Two user-facing knobs the author exposes through `predict()`:
 *   - `noise_snapshot`: which IBM calibration snapshot to score against.
 *     Six bundled options; defaults to `pittsburgh_1`.
 *   - `alpha`: target fidelity fraction (Qshot finds the smallest shot
 *     count where predicted F ≥ α × F_converged). Default 0.95, clamped
 *     to [0.50, 0.99] to match the backend's safety clamp.
 *
 * Everything else in `predict()` (k_struct, k_pf, pilot_points,
 * pilot_reps) is a model hyperparameter the author tuned during
 * training; we deliberately don't expose those — fiddling with them
 * would invalidate the bundled clusters.
 *
 * The `nodrag` class on the wrapper is critical: without it, dragging
 * the dropdown to make a selection would be intercepted by React Flow
 * as a node-move gesture.
 */
function QshotParamEditor({
  params,
  onChange,
}: {
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const snapshotKey = String(params.noise_snapshot ?? DEFAULT_SNAPSHOT_KEY);
  const alpha =
    typeof params.alpha === "number"
      ? params.alpha
      : parseFloat(String(params.alpha ?? "0.95"));
  const safeAlpha = Number.isFinite(alpha) ? alpha : 0.95;
  // If the stored key isn't recognised, surface that in the label so the
  // user can see why their chosen snapshot isn't taking effect; the
  // backend's resolve_noise_snapshot() will fall back to default anyway.
  const knownSnapshot = SNAPSHOT_BY_KEY[snapshotKey];

  return (
    <div className="nodrag mt-2 pt-2 border-t border-edge/60 space-y-1.5">
      <label className="block text-[10px] text-mute">
        <span className="block mb-0.5">Noise snapshot</span>
        <select
          value={knownSnapshot ? snapshotKey : ""}
          onChange={(e) => onChange({ noise_snapshot: e.target.value })}
          className="w-full text-[11px] bg-surface border border-edge rounded px-1.5 py-0.5 text-ink focus:outline-none focus:border-accent/60"
        >
          {!knownSnapshot && (
            <option value="" disabled>
              {snapshotKey} (unknown)
            </option>
          )}
          {NOISE_SNAPSHOTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[10px] text-mute">
        <span className="flex items-baseline justify-between mb-0.5">
          <span>Target fidelity α</span>
          <span className="font-mono text-ink">{safeAlpha.toFixed(2)}</span>
        </span>
        <input
          type="number"
          min={0.5}
          max={0.99}
          step={0.01}
          value={safeAlpha}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isFinite(v)) return;
            // Clamp on the way in so the UI never persists an out-of-range
            // value the backend would silently reject.
            const clamped = Math.max(0.5, Math.min(0.99, v));
            onChange({ alpha: clamped });
          }}
          className="w-full text-[11px] bg-surface border border-edge rounded px-1.5 py-0.5 text-ink font-mono focus:outline-none focus:border-accent/60"
        />
      </label>
    </div>
  );
}
