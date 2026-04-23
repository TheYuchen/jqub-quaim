import { useApp } from "../lib/store";
import type { StepResult } from "../lib/api";
import { NODE_BY_KIND, type NodeKind } from "../lib/nodeCatalog";
import { AlertCircle, Check, CircleDot, Clock } from "lucide-react";

export function ResultsPane() {
  const run = useApp((s) => s.run);
  const running = useApp((s) => s.running);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-12 shrink-0 border-b border-edge px-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Results</h3>
        {run && (
          <span className="chip">
            {run.steps.length} step{run.steps.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {!run && !running && <EmptyHint />}
        {running && <RunningHint />}
        {run && run.steps.map((s) => <StepCard key={s.node_id} step={s} />)}
        {run && run.final_metrics && <FinalMetrics metrics={run.final_metrics} />}
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="panel-alt p-4 text-sm text-mute leading-relaxed">
      <p className="text-ink font-medium mb-1.5">Ready when you are.</p>
      <p>
        Pick a circuit on the left, arrange your pipeline, and hit{" "}
        <span className="kbd">Run pipeline</span>. Each block you traverse will render a
        result card here — noise bounds, fidelity, compression stats, transpiled depth.
      </p>
      <p className="mt-2">
        QuBound takes ~60&nbsp;s on CPU (training an LSTM over 14 days of real IBM Fez
        calibration data). Other blocks are near-instant.
      </p>
    </div>
  );
}

function RunningHint() {
  return (
    <div className="panel-alt p-4 text-sm text-mute">
      <div className="flex items-center gap-2">
        <CircleDot className="w-3.5 h-3.5 text-accent animate-pulse" />
        Executing pipeline…
      </div>
      <div className="mt-2 text-[11px] leading-relaxed">
        QuBound training can take up to a minute — the server is processing synchronously.
      </div>
    </div>
  );
}

function StepCard({ step }: { step: StepResult }) {
  const spec = NODE_BY_KIND[step.node_type as NodeKind];
  const Icon = spec?.icon ?? CircleDot;
  const dur = step.finished_at - step.started_at;

  const statusIcon = {
    ok: <Check className="w-3 h-3" />,
    skipped: <Clock className="w-3 h-3" />,
    error: <AlertCircle className="w-3 h-3" />,
  }[step.status];
  const statusClass = {
    ok: "!border-ok/40 !text-ok",
    skipped: "!border-mute/40 !text-mute",
    error: "!border-danger/40 !text-danger",
  }[step.status];

  return (
    <div className="panel-alt p-3">
      <div className="flex items-center gap-2">
        <span
          className={`w-7 h-7 rounded-md border bg-surface flex items-center justify-center shrink-0 ${
            spec?.accent ?? "text-mute"
          } ${spec?.accentRing ?? "border-edge"}`}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink text-sm">{step.label}</span>
            <span className={`chip ${statusClass}`}>
              {statusIcon} {step.status}
            </span>
          </div>
          <div className="text-[11px] text-mute">
            {dur.toFixed(2)}s · node <span className="font-mono">{step.node_id}</span>
          </div>
        </div>
      </div>
      {step.message && (
        <div className="mt-2 text-[11px] text-mute leading-relaxed border-l border-edge pl-2">
          {step.message}
        </div>
      )}
      {step.summary && Object.keys(step.summary).length > 0 && (
        <div className="mt-2 space-y-1">
          {Object.entries(step.summary).map(([k, v]) => (
            <SummaryRow key={k} k={k} v={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: unknown }) {
  // Special-case the giant diagram text so it doesn't blow up the pane.
  if (k === "diagram_text" && typeof v === "string") {
    return (
      <details className="text-[11px]">
        <summary className="cursor-pointer text-mute hover:text-ink">
          circuit diagram
        </summary>
        <pre className="mt-1 font-mono text-[10px] leading-tight p-2 bg-canvas/60 border border-edge rounded overflow-x-auto text-ink">
          {v}
        </pre>
      </details>
    );
  }
  if (typeof v === "object" && v !== null) {
    return (
      <div className="text-[11px]">
        <div className="text-mute">{k}</div>
        <div className="font-mono text-ink text-[11px] pl-2">
          {Object.entries(v as Record<string, unknown>).map(([kk, vv]) => (
            <div key={kk} className="flex gap-2">
              <span className="text-mute">{kk}</span>
              <span>{String(vv)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-between items-center gap-2 text-[11px]">
      <span className="text-mute">{k}</span>
      <span className="font-mono text-ink truncate max-w-[60%] text-right">
        {fmt(v)}
      </span>
    </div>
  );
}

function fmt(v: unknown): string {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return String(v);
    if (Math.abs(v) < 1e-3 && v !== 0) return v.toExponential(3);
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(4);
  }
  return String(v);
}

function FinalMetrics({ metrics }: { metrics: Record<string, unknown> }) {
  const highlightKeys = [
    "qubound_error_bound",
    "fidelity",
    "transpiled_depth",
    "gates_removed",
  ];
  const highlights = highlightKeys.filter((k) => k in metrics);
  if (highlights.length === 0) return null;
  return (
    <div className="panel p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-mute mb-2">
        Key metrics
      </div>
      <div className="grid grid-cols-2 gap-2">
        {highlights.map((k) => (
          <div key={k} className="panel-alt p-2">
            <div className="text-[10px] text-mute uppercase">{k.replace(/_/g, " ")}</div>
            <div className="font-mono text-ink text-base">{fmt(metrics[k])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
