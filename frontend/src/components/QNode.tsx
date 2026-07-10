import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  resolveNodeSpec,
  type NodeKind,
  type NodeParamSpec,
  type PluginNodeSpec,
} from "../lib/nodeCatalog";
import { NodeParamEditor } from "./NodeParamEditor";
import { RunStatusChips } from "./RunStatusChips";
import { SignatureTile } from "./TransformationSignature";
import { ANON } from "../lib/anon";
import { TipIcon } from "./TipIcon";
import { useApp } from "../lib/store";
import { FAMILY_HINTS } from "../lib/familyHints";
import { durationTone, headlineFor } from "../lib/headlineMetric";

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
  const plugins = useApp((s) => s.plugins);
  // After-run state: subscribe to the latest run so each node can
  // surface its own headline metric + duration badge. Cheap because
  // run only changes once per Run click.
  const run = useApp((s) => s.run);
  const step = run?.steps.find((s) => s.node_id === id);
  // Anytime evidence: while a run streams, sampled steps report each
  // shot batch here BEFORE their StepResult exists — the node face
  // renders a live-narrowing CI from these frames.
  const liveProgress = useApp((s) => s.liveProgress?.[id]);
  const stepDurationS =
    step && step.status === "ok"
      ? step.finished_at - step.started_at
      : null;
  // Spec resolution — built-in OR user plugin. Hook order requires
  // this stay above any early return.
  const spec = resolveNodeSpec(d.kind, plugins);
  // Per-instance disclosure state for the param editor. Default to
  // collapsed so the canvas stays scannable; users click the chevron
  // to reveal the controls. State lives in component-local React
  // state, not in node-data, because it's UI affordance only — we
  // don't want it serialised into share-links or auto-connect graphs.
  const [paramsOpen, setParamsOpen] = useState(false);
  if (!spec) {
    // Plugin was deleted (or never installed in this browser) while a
    // node referencing its kind is still on the canvas — show a
    // tombstone so the user knows what happened instead of an
    // invisible-but-runnable block.
    return (
      <div className="node-card group relative border-danger/40 bg-danger/5">
        <button
          type="button"
          aria-label="Delete this block"
          title="Delete this orphaned block"
          className="nodrag absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface border border-edge text-mute hover:text-danger hover:border-danger/60 flex items-center justify-center opacity-70 hover:opacity-100 focus:opacity-100 transition-opacity z-10"
          onClick={(e) => {
            e.stopPropagation();
            deleteElements({ nodes: [{ id }] });
          }}
        >
          <X className="w-3 h-3" strokeWidth={2.5} />
        </button>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white bg-danger/60 shrink-0">
            ?
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-ink text-sm truncate">
              {d.kind}
            </div>
            <div className="text-[10px] text-danger uppercase tracking-wider">
              plugin not installed
            </div>
          </div>
        </div>
        <div className="mt-1.5 text-[10px] text-mute leading-snug">
          This browser doesn't have the plugin installed — add it via
          the plugin API (see PLUGIN_SDK.md), or hover and click × to
          remove the block.
        </div>
      </div>
    );
  }
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
        className="nodrag absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface border border-edge text-mute hover:text-danger hover:border-danger/60 flex items-center justify-center opacity-70 hover:opacity-100 focus:opacity-100 transition-opacity z-10"
        onClick={(e) => {
          e.stopPropagation();
          deleteElements({ nodes: [{ id }] });
        }}
      >
        <X className="w-3 h-3" strokeWidth={2.5} />
      </button>
      {spec.paper && !ANON && (
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
        {"isPlugin" in spec && spec.isPlugin ? (
          // Plugin badge: filled square in plugin's chosen color +
          // first-letter(s) so users can distinguish multiple plugins
          // at a glance.
          <span
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
            style={{ backgroundColor: (spec as PluginNodeSpec).pluginColor }}
            title={`User plugin (${spec.kind})`}
          >
            {(spec as PluginNodeSpec).initials}
          </span>
        ) : (
          <span
            className={`w-7 h-7 rounded-md border ${spec.accentRing} bg-surface flex items-center justify-center ${spec.accent} shrink-0`}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-ink text-sm flex items-center gap-1">
            <span className="truncate">{spec.label}</span>
            {"isPlugin" in spec && spec.isPlugin && (
              <span
                className="text-[9px] px-1 py-0.5 rounded border border-edge text-mute/70 shrink-0"
                title="User-uploaded plugin"
              >
                plugin
              </span>
            )}
          </div>
          <div className="text-[10px] text-mute uppercase tracking-wider flex items-center gap-1">
            <span>{spec.family}</span>
            <TipIcon hint={FAMILY_HINTS[spec.family]} size={10} />
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

      {/* Editable params (schema-driven) start collapsed so the block
          stays compact on a busy canvas. Header row is a chip-like
          button so it reads as obviously clickable: SlidersHorizontal
          icon + uppercase "PARAMS" label, current-value summary on
          the right, ChevronDown that rotates on toggle. The whole row
          gets a hover background + border so newcomers see the
          affordance without needing to hover over the chevron. Other
          node kinds fall back to the static read-out. */}
      {spec.params && spec.params.length > 0 ? (
        <div className="mt-2 pt-2 border-t border-edge/60">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setParamsOpen((v) => !v);
            }}
            aria-expanded={paramsOpen}
            aria-label={
              paramsOpen ? "Hide parameters" : "Show parameters"
            }
            className={`nodrag w-full flex items-center gap-1.5 px-1.5 py-1 -mx-0.5 rounded-md border text-[10px] transition-colors ${
              paramsOpen
                ? "border-edge bg-surfaceAlt text-ink"
                : "border-transparent text-mute hover:text-ink hover:border-edge/60 hover:bg-surfaceAlt"
            }`}
          >
            <SlidersHorizontal
              className={`w-3 h-3 shrink-0 ${
                paramsOpen ? "text-accent" : ""
              }`}
              strokeWidth={2.2}
            />
            <span className="shrink-0 uppercase tracking-wider font-medium">
              params
            </span>
            <span className="font-mono text-ink truncate flex-1 text-right">
              {!paramsOpen && summariseParams(spec.params, d.params ?? {})}
            </span>
            <ChevronDown
              className={`w-3 h-3 shrink-0 transition-transform ${
                paramsOpen ? "rotate-180" : "rotate-0"
              }`}
              strokeWidth={2.5}
            />
          </button>
          {paramsOpen && (
            <NodeParamEditor
              spec={spec.params}
              values={d.params ?? {}}
              onChange={patchParams}
            />
          )}
        </div>
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
      {!step && liveProgress && (
        <LiveEvidenceStrip progress={liveProgress} />
      )}
      {step && step.status === "ok" && (
        <RunResultStrip
          kind={d.kind}
          step={step}
          durationS={stepDurationS}
        />
      )}
      {step && step.status === "error" && (
        <div className="mt-2 pt-2 border-t border-danger/30 text-[10px] text-danger flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span className="truncate" title={step.message ?? ""}>
            {step.message ?? "Failed"}
          </span>
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

/** Live evidence strip: rendered while a sampled step is still
 *  accumulating shot batches (i.e. before its StepResult exists).
 *  Same 0-1 fixed-scale encoding as the post-run micro CI bar so the
 *  live band morphs seamlessly into the final one; the CSS
 *  left/width transition is what makes the narrowing READ as motion
 *  instead of flicker. The counter states the evidence honestly in
 *  shots, not percent-done — the whole point of anytime steering is
 *  that "done" is the user's call, not the progress bar's. */
function LiveEvidenceStrip({
  progress,
}: {
  progress: import("../lib/api").StepProgress;
}) {
  const [lo, hi] = progress.ci95;
  return (
    <div className="mt-2 pt-1.5 border-t border-edge/40">
      <div className="flex items-baseline justify-between gap-2 text-[9px] text-mute">
        <span className="font-mono text-accent">
          {(progress.point * 100).toFixed(1)}%
        </span>
        <span className="font-mono">
          {progress.shots_done} shots · batch {progress.batch_i}/
          {progress.n_batches}
        </span>
      </div>
      <div
        className="relative h-[3px] rounded-full bg-surfaceAlt overflow-hidden mt-1"
        title={`Evidence so far: ${(progress.point * 100).toFixed(1)}% · 95% CI ${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}% after ${progress.shots_done} shots`}
        role="img"
        aria-label={`live uncertainty after ${progress.shots_done} shots: point ${(progress.point * 100).toFixed(1)} percent, interval ${(lo * 100).toFixed(1)} to ${(hi * 100).toFixed(1)} percent`}
      >
        <div
          className="absolute inset-y-0 bg-accent/25 transition-[left,width] duration-300 ease-out"
          style={{
            left: `${lo * 100}%`,
            width: `${Math.max(1, (hi - lo) * 100)}%`,
          }}
        />
        <div
          className="absolute inset-y-0 w-[2px] bg-accent transition-[left] duration-300 ease-out"
          style={{ left: `calc(${progress.point * 100}% - 1px)` }}
        />
      </div>
    </div>
  );
}

/** After-run strip at the bottom of the node tile: headline metric +
 *  duration chip + cache indicator. None of these are interactive,
 *  but they make the canvas itself a glanceable dashboard once a run
 *  has happened.
 *
 *  Layout contract (visual-calm audit, 2026-07-10): the strip is at
 *  most the stretched glyph + TWO further rows — (1) headline+chips,
 *  (2) the 3px micro-CI bar — at ANY tile width. The chips row cannot
 *  wrap: it is flex-nowrap, the headline block is min-w-0 + truncate
 *  (it gives way first), the chips are shrink-0, and at most three
 *  small chips can coexist (⏹ shots · one cached/live chip —
 *  RunStatusChips renders at most one — · duration). Worst case
 *  ≈130px of chips against the 180px min tile width, so the headline
 *  truncates rather than the row wrapping. If a chip is ever added
 *  here, re-audit against that budget. */
function RunResultStrip({
  kind,
  step,
  durationS,
}: {
  kind: NodeKind;
  step: import("../lib/api").StepResult;
  durationS: number | null;
}) {
  const headline = headlineFor(kind, step);
  const tone = durationS !== null ? durationTone(durationS) : null;
  const durBadgeClass = {
    fast: "border-edge/60 text-mute/80",
    medium: "border-accent/40 text-accent/90",
    slow: "border-warn/50 text-warn",
    "very-slow": "border-danger/50 text-danger",
  }[tone ?? "fast"];
  const durFormatted =
    durationS === null
      ? ""
      : durationS < 1
        ? `${Math.round(durationS * 1000)}ms`
        : `${durationS.toFixed(durationS < 10 ? 2 : 1)}s`;
  // Micro CI bar: the same 0-1-scale encoding as the results card's
  // uncertainty block (interval band + point tick), shrunk to 3px so
  // a stochastic node face answers "how sure are we" without opening
  // any panel. Only steps that emit a binomial distribution payload
  // (sampled fidelity today, plugins tomorrow) render it.
  const dist = step.distribution as
    | {
        kind?: string;
        point?: number;
        ci95?: [number, number];
        shots?: number;
        shots_requested?: number;
        stopped_early?: boolean;
        precision_target?: number;
      }
    | null
    | undefined;
  const ci =
    dist?.kind === "binomial" && Array.isArray(dist.ci95) ? dist.ci95 : null;
  const rawPoint =
    typeof dist?.point === "number"
      ? dist.point
      : Number((step.summary as Record<string, unknown>)["fidelity"]);
  const ciPoint = ci && Number.isFinite(rawPoint) ? rawPoint : null;
  return (
    <div className="mt-2 pt-1.5 border-t border-edge/40">
      <SignatureTile step={step} stretch />
      <div className="flex items-baseline justify-between gap-2">
      {headline ? (
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-wider text-mute/70 truncate">
            {headline.label}
          </div>
          <div
            className={`text-[12px] font-mono font-semibold leading-tight truncate ${
              headline.tone ?? "text-ink"
            }`}
            title={`${headline.label}: ${headline.value}`}
          >
            {headline.value}
          </div>
        </div>
      ) : (
        <div className="flex-1 text-[10px] text-ok/80">✓ ran</div>
      )}
      <div className="flex items-center gap-1 shrink-0">
        {dist?.stopped_early && (
          <span
            className="text-[9px] px-1 py-0.5 rounded border border-accent/50 text-accent font-mono"
            title={`Optional stopping: target ±${((dist.precision_target ?? 0) * 100).toFixed(0)}pp reached after ${dist.shots} of ${dist.shots_requested} shots — the remaining shots were not paid for.`}
          >
            ⏹ {dist.shots}
          </span>
        )}
        <RunStatusChips step={step} variant="tile" />
        {durationS !== null && (
          <span
            className={`text-[9px] px-1 py-0.5 rounded border font-mono ${durBadgeClass}`}
            title={
              tone === "very-slow"
                ? "Took over 1 minute — likely the pipeline's bottleneck"
                : tone === "slow"
                  ? "Took over 10 seconds"
                  : tone === "medium"
                    ? "Took 1-10 seconds"
                    : "Sub-second"
            }
          >
            {durFormatted}
          </span>
        )}
      </div>
      </div>
      {ci && ciPoint !== null && (
        <div
          className="relative h-[3px] rounded-full bg-surfaceAlt overflow-hidden mt-1.5"
          title={`Sampled estimate ${(ciPoint * 100).toFixed(1)}% · 95% CI ${(
            ci[0] * 100
          ).toFixed(1)}–${(ci[1] * 100).toFixed(1)}% (fixed 0–100% scale)`}
          role="img"
          aria-label={`uncertainty: point ${(ciPoint * 100).toFixed(
            1,
          )} percent, 95 percent interval ${(ci[0] * 100).toFixed(1)} to ${(
            ci[1] * 100
          ).toFixed(1)} percent`}
        >
          <div
            className="absolute inset-y-0 bg-accent/25 transition-[left,width] duration-300 ease-out"
            style={{
              left: `${ci[0] * 100}%`,
              width: `${Math.max(1, (ci[1] - ci[0]) * 100)}%`,
            }}
          />
          <div
            className="absolute inset-y-0 w-[2px] bg-accent"
            style={{ left: `calc(${ciPoint * 100}% - 1px)` }}
          />
        </div>
      )}
    </div>
  );
}

/** Build a one-line "param₁ · param₂ · …" summary for the collapsed
 *  state of the param editor. Selects use the raw value (short keys
 *  like "pittsburgh_1") rather than the long display label so the
 *  whole summary stays under ~30 characters; numbers respect the
 *  spec's `displayPrecision`. Result is meant to be a glanceable
 *  cue — not a full read-out — so order in the schema matters. */
function summariseParams(
  spec: NodeParamSpec[],
  values: Record<string, unknown>,
): string {
  const parts: string[] = [];
  for (const p of spec) {
    const raw = values[p.key];
    if (raw === undefined || raw === null || raw === "") continue;
    if (p.type === "select") {
      parts.push(String(raw));
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      const precision = p.displayPrecision ?? (p.type === "int" ? 0 : 2);
      parts.push(n.toFixed(precision));
    }
  }
  return parts.join(" · ");
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

