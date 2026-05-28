import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Play, X } from "lucide-react";
import type { Node, Edge } from "@xyflow/react";
import { api, type SweepRunResult } from "../lib/api";
import {
  NODE_BY_KIND,
  type NodeParamSpec,
} from "../lib/nodeCatalog";
import type { QNodeData } from "./QNode";
import { useApp } from "../lib/store";

/**
 * Parameter-sweep dialog.
 *
 * Lets the user pick a numeric parameter on one of the canvas blocks,
 * specify a range + step count, and run the pipeline once per value.
 * Results render as a side-by-side comparison chart (param value on
 * X, a chosen output metric on Y).
 *
 * Heavy use of the backend's per-node intermediate cache: steps
 * upstream of the swept block are computed once and reused across all
 * sweep iterations. So an N-value sweep on the LAST block's parameter
 * runs in roughly N × (that block's cost) rather than N × (whole
 * pipeline's cost).
 */

interface SweepTarget {
  node: Node;
  spec: NodeParamSpec & { type: "number" | "int" };
}

/** Extract a runnable metric out of a SweepRunResult (the final
 *  scalar that varies with the swept parameter). Picks the most
 *  informative one based on what blocks ran. */
function pickMetric(run: SweepRunResult): { label: string; value: number } | null {
  // Walk steps in reverse (last step's summary usually has aggregate metrics)
  for (let i = run.steps.length - 1; i >= 0; i--) {
    const s = run.steps[i];
    if (s.status !== "ok" || !s.summary) continue;
    const sm = s.summary as Record<string, unknown>;
    if (typeof sm.predicted_fidelity === "number")
      return { label: "Predicted fidelity (Qshot)", value: sm.predicted_fidelity };
    if (typeof sm.fidelity === "number")
      return { label: "Fidelity", value: sm.fidelity };
    if (typeof sm.qubound_error_bound === "number")
      return { label: "QuBound error bound", value: sm.qubound_error_bound };
    if (typeof sm.predicted_error_bound === "number")
      return { label: "QuBound error bound", value: sm.predicted_error_bound };
    if (typeof sm.kept_parameters === "number")
      return { label: "Kept parameters (QuCAD)", value: sm.kept_parameters };
    if (typeof sm.recommended_shots === "number")
      return { label: "Recommended shots (Qshot)", value: sm.recommended_shots };
  }
  return null;
}

export function SweepDialog({
  open,
  onClose,
  nodes,
  edges,
}: {
  open: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
}) {
  const circuit = useApp((s) => s.circuit);
  const useLiveIbm = useApp((s) => s.useLiveIbm);

  // Discover all sweepable (numeric) params across canvas nodes.
  const targets = useMemo<SweepTarget[]>(() => {
    const out: SweepTarget[] = [];
    for (const n of nodes) {
      const kind = (n.data as QNodeData).kind;
      const spec = NODE_BY_KIND[kind];
      if (!spec?.params) continue;
      for (const p of spec.params) {
        if (p.type === "number" || p.type === "int") {
          out.push({ node: n, spec: p });
        }
      }
    }
    return out;
  }, [nodes]);

  // Selection state.
  const [targetIdx, setTargetIdx] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [steps, setSteps] = useState(5);

  // Reset selection when canvas changes.
  useEffect(() => {
    if (!open) return;
    if (targets.length === 0) return;
    const t = targets[Math.min(targetIdx, targets.length - 1)];
    const min = t.spec.min ?? 0;
    const max = t.spec.max ?? 1;
    setStart(min);
    setEnd(max);
    setSteps(5);
  }, [open, targets.length, targetIdx]);

  // Run state.
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SweepRunResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  // Generate the values array based on start/end/steps.
  const target = targets[targetIdx];
  const values = useMemo(() => {
    if (!target) return [];
    if (steps < 2) return [start];
    const stepSize = (end - start) / (steps - 1);
    const out: number[] = [];
    for (let i = 0; i < steps; i++) {
      const v = start + i * stepSize;
      out.push(target.spec.type === "int" ? Math.round(v) : v);
    }
    // Dedupe for int sweeps where step size is sub-1.
    return Array.from(new Set(out));
  }, [start, end, steps, target]);

  const runSweep = () => {
    if (!circuit || !target) return;
    setRunning(true);
    setResults([]);
    setError(null);
    cancelRef.current = false;

    api.sweepStream(
      {
        circuit_id: circuit.circuit_id,
        nodes: nodes.map((n) => ({
          id: n.id,
          type: (n.data as QNodeData).kind,
          data: (n.data as QNodeData).params ?? {},
        })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        use_live_ibm: useLiveIbm,
        sweep: {
          node_id: target.node.id,
          param_key: target.spec.key,
          values,
        },
      },
      (run) => {
        if (cancelRef.current) return;
        setResults((prev) => [...prev, run]);
      },
      () => {
        setRunning(false);
      },
      (err) => {
        setError(err.message);
        setRunning(false);
      },
    );
  };

  if (!open) return null;

  // Chart data
  const chartData = results
    .map((r) => {
      const metric = pickMetric(r);
      return metric
        ? { x: Number(r.param_value), y: metric.value, label: metric.label }
        : null;
    })
    .filter((d): d is { x: number; y: number; label: string } => d !== null);

  const metricLabel = chartData[0]?.label ?? "Metric";
  const xMin = Math.min(...values.map(Number));
  const xMax = Math.max(...values.map(Number));
  const yVals = chartData.map((d) => d.y);
  const yMin = yVals.length ? Math.min(...yVals) : 0;
  const yMax = yVals.length ? Math.max(...yVals) : 1;
  const yRange = yMax - yMin || 1;

  return (
    <div
      className="fixed inset-0 z-50 bg-canvas/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Parameter sweep"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-edge rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-ink">Parameter sweep</div>
            <div className="text-[11px] text-mute">
              Run the pipeline across a range of values for one parameter.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-mute hover:text-ink p-1 rounded"
            aria-label="Close sweep dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {targets.length === 0 ? (
            <div className="text-sm text-mute py-8 text-center">
              No tunable numeric parameters on the canvas. Add a block with
              numeric params (QuCAD, Qshot, …) first.
            </div>
          ) : (
            <>
              {/* Target picker */}
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-mute">
                  Sweep target
                </label>
                <select
                  value={targetIdx}
                  onChange={(e) => setTargetIdx(Number(e.target.value))}
                  disabled={running}
                  className="w-full bg-surfaceAlt border border-edge rounded-md px-2 py-1.5 text-sm text-ink focus:outline-none focus:border-accent/60"
                >
                  {targets.map((t, i) => {
                    const blockLabel =
                      NODE_BY_KIND[(t.node.data as QNodeData).kind].label;
                    return (
                      <option key={`${t.node.id}-${t.spec.key}`} value={i}>
                        {blockLabel} → {t.spec.label} (
                        {t.spec.min ?? "?"}–{t.spec.max ?? "?"})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Range controls */}
              <div className="grid grid-cols-3 gap-3">
                <label className="text-[11px] text-mute">
                  Start
                  <input
                    type="number"
                    value={start}
                    onChange={(e) => setStart(Number(e.target.value))}
                    disabled={running}
                    step={target?.spec.step ?? 0.01}
                    min={target?.spec.min}
                    max={target?.spec.max}
                    className="w-full mt-0.5 bg-surfaceAlt border border-edge rounded-md px-2 py-1 text-sm text-ink font-mono focus:outline-none focus:border-accent/60"
                  />
                </label>
                <label className="text-[11px] text-mute">
                  End
                  <input
                    type="number"
                    value={end}
                    onChange={(e) => setEnd(Number(e.target.value))}
                    disabled={running}
                    step={target?.spec.step ?? 0.01}
                    min={target?.spec.min}
                    max={target?.spec.max}
                    className="w-full mt-0.5 bg-surfaceAlt border border-edge rounded-md px-2 py-1 text-sm text-ink font-mono focus:outline-none focus:border-accent/60"
                  />
                </label>
                <label className="text-[11px] text-mute">
                  Steps
                  <input
                    type="number"
                    value={steps}
                    onChange={(e) =>
                      setSteps(Math.max(2, Math.min(20, Number(e.target.value))))
                    }
                    disabled={running}
                    min={2}
                    max={20}
                    className="w-full mt-0.5 bg-surfaceAlt border border-edge rounded-md px-2 py-1 text-sm text-ink font-mono focus:outline-none focus:border-accent/60"
                  />
                </label>
              </div>

              {/* Values preview */}
              <div className="text-[10px] text-mute font-mono">
                {values.length} values: [
                {values
                  .map((v) =>
                    typeof v === "number"
                      ? v.toFixed(target?.spec.displayPrecision ?? 3)
                      : String(v),
                  )
                  .join(", ")}
                ]
              </div>

              {/* Run button */}
              <button
                type="button"
                onClick={runSweep}
                disabled={running || !circuit || values.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-accent text-canvas text-sm font-medium hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sweep running… {results.length}/{values.length}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run sweep ({values.length} pipelines)
                  </>
                )}
              </button>

              {error && (
                <div className="text-[12px] text-danger panel-alt p-2 border-danger/40">
                  {error}
                </div>
              )}

              {/* Chart */}
              {chartData.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-mute">
                    Result: {metricLabel}
                  </div>
                  <svg
                    viewBox="0 0 600 240"
                    className="w-full"
                    aria-label="Sweep comparison chart"
                  >
                    {/* axes */}
                    <line x1="40" y1="200" x2="580" y2="200" stroke="rgb(var(--color-edge))" />
                    <line x1="40" y1="20" x2="40" y2="200" stroke="rgb(var(--color-edge))" />
                    {/* polyline */}
                    <polyline
                      fill="none"
                      stroke="rgb(var(--color-accent))"
                      strokeWidth="2"
                      points={chartData
                        .map((d) => {
                          const px = 40 + ((d.x - xMin) / (xMax - xMin || 1)) * 540;
                          const py = 200 - ((d.y - yMin) / yRange) * 180;
                          return `${px.toFixed(1)},${py.toFixed(1)}`;
                        })
                        .join(" ")}
                    />
                    {/* points */}
                    {chartData.map((d, i) => {
                      const px = 40 + ((d.x - xMin) / (xMax - xMin || 1)) * 540;
                      const py = 200 - ((d.y - yMin) / yRange) * 180;
                      return (
                        <g key={i}>
                          <circle
                            cx={px}
                            cy={py}
                            r="3.5"
                            fill="rgb(var(--color-accent))"
                          />
                          <text
                            x={px}
                            y={py - 8}
                            fontSize="9"
                            textAnchor="middle"
                            fill="rgb(var(--color-mute))"
                          >
                            {d.y.toFixed(3)}
                          </text>
                        </g>
                      );
                    })}
                    {/* x-axis labels */}
                    <text x="40" y="218" fontSize="10" fill="rgb(var(--color-mute))">
                      {xMin.toFixed(target?.spec.displayPrecision ?? 3)}
                    </text>
                    <text
                      x="580"
                      y="218"
                      fontSize="10"
                      textAnchor="end"
                      fill="rgb(var(--color-mute))"
                    >
                      {xMax.toFixed(target?.spec.displayPrecision ?? 3)}
                    </text>
                    <text
                      x="310"
                      y="234"
                      fontSize="10"
                      textAnchor="middle"
                      fill="rgb(var(--color-mute))"
                    >
                      {target?.spec.label}
                    </text>
                    {/* y-axis labels */}
                    <text x="36" y="24" fontSize="10" textAnchor="end" fill="rgb(var(--color-mute))">
                      {yMax.toFixed(3)}
                    </text>
                    <text
                      x="36"
                      y="200"
                      fontSize="10"
                      textAnchor="end"
                      fill="rgb(var(--color-mute))"
                    >
                      {yMin.toFixed(3)}
                    </text>
                  </svg>

                  {/* Data table */}
                  <div className="text-[11px] font-mono">
                    <div className="grid grid-cols-2 gap-2 px-2 py-1 text-mute border-b border-edge">
                      <span>{target?.spec.label}</span>
                      <span className="text-right">{metricLabel}</span>
                    </div>
                    {chartData.map((d, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-2 gap-2 px-2 py-0.5 hover:bg-surfaceAlt"
                      >
                        <span className="text-ink">
                          {d.x.toFixed(target?.spec.displayPrecision ?? 3)}
                        </span>
                        <span className="text-right text-ink">
                          {d.y.toFixed(6)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Show run-without-metric warning */}
              {results.length > 0 && chartData.length === 0 && !running && (
                <div className="text-[12px] text-mute panel-alt p-2">
                  Pipeline completed but no scalar metric was found in the
                  results. Add a Fidelity or QuBound block to the pipeline so
                  the sweep has something to compare.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
