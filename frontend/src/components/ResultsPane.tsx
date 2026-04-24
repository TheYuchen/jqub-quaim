import { useApp } from "../lib/store";
import type { StepResult } from "../lib/api";
import { NODE_BY_KIND, type NodeKind } from "../lib/nodeCatalog";
import { AlertCircle, Check, ChevronRight, CircleDot, Clock } from "lucide-react";

export function ResultsPane({ onCollapse }: { onCollapse?: () => void } = {}) {
  const run = useApp((s) => s.run);
  const running = useApp((s) => s.running);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-12 shrink-0 border-b border-edge px-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink truncate">Results</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {run?.from_cache && (
            <span
              className="chip !border-accent/40 !text-accent"
              title="Served from a precomputed cache (this circuit + pipeline combo was run ahead of time). Swap in your own circuit or tweak the graph to trigger a fresh run."
            >
              cached
            </span>
          )}
          {run && (
            <span className="chip">
              {run.steps.length} step{run.steps.length === 1 ? "" : "s"}
            </span>
          )}
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="text-mute hover:text-ink rounded hover:bg-surfaceAlt p-0.5"
              title="Collapse results pane"
              aria-label="Collapse results pane"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
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
        result card here: noise bounds, fidelity, compression stats, transpiled depth.
      </p>
      <p className="mt-2 text-[11px]">
        Default pipelines on the built-in samples hit a precomputed cache and
        return instantly. A cold <span className="text-ink">QuBound</span> run
        trains an LSTM on the shared HF CPU and can take about 2&nbsp;minutes;
        every other block finishes within seconds.
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
        Most runs finish within a few seconds. A cold{" "}
        <span className="text-ink">QuBound</span> run can take up to about
        2&nbsp;minutes on HF's shared CPU — please don't close the tab.
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
      {step.status === "ok" && step.summary && Object.keys(step.summary).length > 0 && (
        <StepBody step={step} />
      )}
    </div>
  );
}

/** Dispatch the step summary to a node-type-specific card; fall back to generic rows. */
function StepBody({ step }: { step: StepResult }) {
  const s = step.summary;
  switch (step.node_type) {
    case "qubound":
      return <QuBoundCard s={s} />;
    case "qucad":
      return <QuCADCard s={s} />;
    case "compvqc":
      return <CompressVQCCard s={s} />;
    case "fidelity":
      return <FidelityCard s={s} />;
    case "output":
      return <OutputCard s={s} />;
    case "input_circuit":
      return <InputCircuitCard s={s} />;
    case "fake_backend":
    case "ibm_backend":
      return <BackendCard s={s} />;
    default:
      return <GenericSummary s={s} />;
  }
}

/* ========================================================================== */
/*                        Per-algorithm result cards                           */
/* ========================================================================== */

/** QuBound — predicted error bound in [0, 1] + lay explanation. */
function QuBoundCard({ s }: { s: Record<string, unknown> }) {
  const raw = s["predicted_error_bound"];
  const value = typeof raw === "number" ? raw : undefined;
  const source = String(s["source"] ?? "");

  return (
    <div className="mt-2 space-y-2">
      <Caption>
        <span className="text-ink font-medium">What QuBound did:</span>{" "}
        trained an LSTM on 14 days of chip calibration, then predicted how much
        error today's noise would add to your circuit. Lower is better.
      </Caption>
      {value !== undefined && (
        <div className="flex items-center gap-3">
          <Gauge value={value} />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-mute">
              predicted error bound
            </div>
            <div className="font-mono text-ink text-lg">{value.toFixed(4)}</div>
            <div className="text-[10px] text-mute">
              {value < 0.05
                ? "very low: noise should barely matter"
                : value < 0.15
                  ? "moderate: noise will visibly affect outputs"
                  : "high: this circuit is likely noise-dominated on today's chip"}
            </div>
          </div>
        </div>
      )}
      <details className="text-[11px] text-mute">
        <summary className="cursor-pointer hover:text-ink">
          run details ({source || "cached"})
        </summary>
        <div className="mt-1 pl-2 border-l border-edge space-y-0.5">
          {Object.entries(s).map(([k, v]) => (
            <KvRow key={k} k={k} v={v} />
          ))}
        </div>
      </details>
    </div>
  );
}

/** QuCAD — parameter sparsification. Show kept/total + sparsity trace. */
function QuCADCard({ s }: { s: Record<string, unknown> }) {
  const original = numOr(s["original_parameters"], 0);
  const kept = numOr(s["kept_parameters"], 0);
  const trace = Array.isArray(s["sparsity_trace"])
    ? (s["sparsity_trace"] as number[])
    : [];
  const removed = original - kept;
  const pct = original > 0 ? (removed / original) * 100 : 0;

  return (
    <div className="mt-2 space-y-2">
      <Caption>
        <span className="text-ink font-medium">What QuCAD did:</span>{" "}
        sparsified the variational circuit, zeroing out parameters that hurt
        fidelity under the chip's noise. Fewer parameters means fewer gates
        to execute, which often means lower total error.
      </Caption>
      {original > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="kept" value={`${kept}`} sub={`of ${original}`} />
          <Stat label="removed" value={`${removed}`} sub={`${pct.toFixed(0)}%`} />
          <Stat
            label="final loss"
            value={numOr(s["final_loss"], NaN).toFixed(4)}
          />
        </div>
      )}
      {trace.length > 1 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-mute mb-1">
            sparsity per ADMM iteration (lower = more sparse)
          </div>
          <Sparkline data={trace} height={40} />
        </div>
      )}
      <details className="text-[11px] text-mute">
        <summary className="cursor-pointer hover:text-ink">raw summary</summary>
        <div className="mt-1 pl-2 border-l border-edge space-y-0.5">
          {Object.entries(s).map(([k, v]) => (
            <KvRow key={k} k={k} v={v} />
          ))}
        </div>
      </details>
    </div>
  );
}

/** CompressVQC — depth before vs after, gates removed. */
function CompressVQCCard({ s }: { s: Record<string, unknown> }) {
  const before = numOr(s["original_depth"], 0);
  const after = numOr(s["compressed_depth"], before);
  const removed = numOr(s["gates_removed"], 0);
  const shrinkPct = before > 0 ? ((before - after) / before) * 100 : 0;

  return (
    <div className="mt-2 space-y-2">
      <Caption>
        <span className="text-ink font-medium">What CompressVQC did:</span>{" "}
        folded redundant parametric rotations using a QAOA-optimized lookup
        table. A shorter circuit runs faster and picks up less decoherence.
      </Caption>
      {before > 0 && (
        <DepthCompare before={before} after={after} />
      )}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="gates removed" value={`${removed}`} />
        <Stat label="depth reduction" value={`${shrinkPct.toFixed(0)}%`} />
      </div>
      <details className="text-[11px] text-mute">
        <summary className="cursor-pointer hover:text-ink">raw summary</summary>
        <div className="mt-1 pl-2 border-l border-edge space-y-0.5">
          {Object.entries(s).map(([k, v]) => (
            <KvRow key={k} k={k} v={v} />
          ))}
        </div>
      </details>
    </div>
  );
}

/** Fidelity — 0-1, higher is better. */
function FidelityCard({ s }: { s: Record<string, unknown> }) {
  const f = numOr(s["fidelity"], NaN);
  const good = f >= 0.95;
  const mid = f >= 0.8 && f < 0.95;
  const tone = good ? "text-ok" : mid ? "text-warn" : "text-danger";

  return (
    <div className="mt-2 space-y-2">
      <Caption>
        <span className="text-ink font-medium">What this measures:</span>{" "}
        how close the noisy circuit's output distribution is to the ideal
        (noiseless) one. 1.0 is perfect; 0 is unrelated.
      </Caption>
      {Number.isFinite(f) && (
        <div className="flex items-center gap-3">
          <Gauge value={f} inverted />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-mute">
              estimated fidelity
            </div>
            <div className={`font-mono text-lg ${tone}`}>
              {(f * 100).toFixed(2)}%
            </div>
            <div className="text-[10px] text-mute">
              {good
                ? "very close to ideal"
                : mid
                  ? "noticeable noise, but usable"
                  : "heavily degraded by noise"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Output — depth, size, ops, diagram, transpiled stats. */
function OutputCard({ s }: { s: Record<string, unknown> }) {
  const ops = (s["ops"] as Record<string, number> | undefined) ?? {};
  const opEntries = Object.entries(ops).sort((a, b) => b[1] - a[1]);
  const maxOp = opEntries.length > 0 ? opEntries[0][1] : 0;
  const depth = numOr(s["depth"], 0);
  const size = numOr(s["size"], 0);
  const transpiled = numOr(s["transpiled_depth"], NaN);
  const diagram = typeof s["diagram_text"] === "string" ? (s["diagram_text"] as string) : "";

  return (
    <div className="mt-2 space-y-2">
      <Caption>
        <span className="text-ink font-medium">Final circuit:</span> what
        actually runs after every upstream block has had its say.
      </Caption>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="depth" value={`${depth}`} />
        <Stat label="size" value={`${size}`} sub="total gates" />
        <Stat
          label="transpiled depth"
          value={Number.isFinite(transpiled) ? `${transpiled}` : "—"}
          sub="on target chip"
        />
      </div>
      {opEntries.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-mute mb-1">
            gate breakdown
          </div>
          <div className="space-y-0.5">
            {opEntries.slice(0, 8).map(([name, count]) => (
              <OpBar key={name} name={name} count={count} max={maxOp} />
            ))}
          </div>
        </div>
      )}
      {diagram && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-mute hover:text-ink">
            ASCII circuit diagram
          </summary>
          <pre className="mt-1 font-mono text-[10px] leading-tight p-2 bg-canvas/60 border border-edge rounded overflow-x-auto text-ink">
            {diagram}
          </pre>
        </details>
      )}
    </div>
  );
}

/** Input circuit summary (diagram + counts). */
function InputCircuitCard({ s }: { s: Record<string, unknown> }) {
  return (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="qubits" value={`${numOr(s["num_qubits"], 0)}`} />
        <Stat label="depth" value={`${numOr(s["depth"], 0)}`} />
        <Stat label="params" value={`${numOr(s["num_parameters"], 0)}`} />
      </div>
      {typeof s["diagram_text"] === "string" && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-mute hover:text-ink">
            ASCII circuit diagram
          </summary>
          <pre className="mt-1 font-mono text-[10px] leading-tight p-2 bg-canvas/60 border border-edge rounded overflow-x-auto text-ink">
            {s["diagram_text"] as string}
          </pre>
        </details>
      )}
    </div>
  );
}

/** Backend card — minimal info. */
function BackendCard({ s }: { s: Record<string, unknown> }) {
  const name = String(s["backend_name"] ?? "");
  return (
    <div className="mt-2 text-[11px] text-mute">
      {name && (
        <div>
          backend: <span className="font-mono text-ink">{name}</span>
        </div>
      )}
      {s["live"] === true && (
        <div className="text-warn">live IBM calibration</div>
      )}
      {s["fallback"] != null && (
        <div>
          fallback: <span className="font-mono text-ink">{String(s["fallback"])}</span>
        </div>
      )}
    </div>
  );
}

/** Generic fallback — the previous flat k/v list. */
function GenericSummary({ s }: { s: Record<string, unknown> }) {
  return (
    <div className="mt-2 space-y-1">
      {Object.entries(s).map(([k, v]) => (
        <KvRow key={k} k={k} v={v} />
      ))}
    </div>
  );
}

/* ========================================================================== */
/*                         Shared viz primitives                               */
/* ========================================================================== */

/** A big-number stat tile used in the per-algorithm cards. */
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel px-2 py-1.5 text-center">
      <div className="text-[10px] uppercase tracking-wider text-mute">{label}</div>
      <div className="font-mono text-ink text-sm leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-mute leading-tight">{sub}</div>}
    </div>
  );
}

/** Plain-language caption sitting above the numbers. */
function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-mute leading-relaxed">{children}</p>
  );
}

/**
 * A horizontal meter from 0 to 1.
 *
 * - default (`inverted=false`): low values are green ("low error is good"
 *   for QuBound), high values are red.
 * - `inverted`: high values are green ("high fidelity is good").
 */
function Gauge({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  const pct = v * 100;
  // Color bands.
  const good = inverted ? v >= 0.95 : v < 0.05;
  const mid = inverted ? v >= 0.8 && v < 0.95 : v >= 0.05 && v < 0.15;
  const color = good
    ? "var(--color-ok, #2dd4bf)"
    : mid
      ? "var(--color-warn, #f4a261)"
      : "var(--color-danger, #f72585)";
  return (
    <div className="w-32 shrink-0">
      <div className="relative h-2.5 w-full rounded-full bg-canvas border border-edge overflow-hidden">
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-mute mt-0.5 font-mono">
        <span>0</span>
        <span>1</span>
      </div>
    </div>
  );
}

/** Compact comparison of two integer values as side-by-side proportional bars. */
function DepthCompare({ before, after }: { before: number; after: number }) {
  const max = Math.max(before, after, 1);
  return (
    <div className="space-y-1">
      <CompareBar label="before" value={before} max={max} tone="mute" />
      <CompareBar label="after" value={after} max={max} tone="ok" />
    </div>
  );
}

function CompareBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "ok" | "mute";
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const bg =
    tone === "ok"
      ? "bg-ok/70"
      : "bg-mute/40";
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className="w-14 text-mute shrink-0">{label}</div>
      <div className="flex-1 h-3 rounded bg-canvas border border-edge overflow-hidden relative">
        <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-10 text-right font-mono text-ink">{value}</div>
    </div>
  );
}

/** Horizontal bar for a single gate count. */
function OpBar({ name, count, max }: { name: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className="w-14 text-mute font-mono truncate shrink-0">{name}</div>
      <div className="flex-1 h-2 rounded bg-canvas border border-edge overflow-hidden">
        <div className="h-full bg-accent/50" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 text-right font-mono text-ink">{count}</div>
    </div>
  );
}

/** Tiny SVG sparkline. Data assumed to be non-negative integers. */
function Sparkline({ data, height = 32 }: { data: number[]; height?: number }) {
  if (data.length < 2) return null;
  const w = 200;
  const h = height;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (w - 4) + 2;
      const y = h - 2 - ((v - min) / range) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-auto"
      preserveAspectRatio="none"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-accent2"
      />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * (w - 4) + 2;
        const y = h - 2 - ((v - min) / range) * (h - 4);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2}
            fill="currentColor"
            className="text-accent2"
          />
        );
      })}
    </svg>
  );
}

/* ========================================================================== */
/*                         Generic row helpers                                 */
/* ========================================================================== */

function KvRow({ k, v }: { k: string; v: unknown }) {
  if (k === "diagram_text" && typeof v === "string") {
    return null; // handled by dedicated card
  }
  if (Array.isArray(v)) {
    return (
      <div className="flex justify-between items-center gap-2 text-[11px]">
        <span className="text-mute">{k}</span>
        <span className="font-mono text-ink truncate max-w-[60%] text-right">
          [{v.slice(0, 6).map(String).join(", ")}
          {v.length > 6 ? ", …" : ""}]
        </span>
      </div>
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

function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/* ========================================================================== */
/*                              Final metrics                                   */
/* ========================================================================== */

function FinalMetrics({ metrics }: { metrics: Record<string, unknown> }) {
  const items: { key: string; label: string; help: string; big: string; tone?: string }[] = [];

  if (typeof metrics["qubound_error_bound"] === "number") {
    const v = metrics["qubound_error_bound"] as number;
    items.push({
      key: "qubound_error_bound",
      label: "predicted error bound",
      help: "How much error QuBound expects today's noise to add. Lower is better.",
      big: v.toFixed(4),
      tone: v < 0.05 ? "text-ok" : v < 0.15 ? "text-warn" : "text-danger",
    });
  }
  if (typeof metrics["fidelity"] === "number") {
    const v = metrics["fidelity"] as number;
    items.push({
      key: "fidelity",
      label: "fidelity",
      help: "Similarity between noisy and ideal output. Higher is better.",
      big: `${(v * 100).toFixed(2)}%`,
      tone: v >= 0.95 ? "text-ok" : v >= 0.8 ? "text-warn" : "text-danger",
    });
  }
  if (typeof metrics["transpiled_depth"] === "number") {
    items.push({
      key: "transpiled_depth",
      label: "transpiled depth",
      help: "Circuit depth after compiling for the target chip's gate set.",
      big: String(metrics["transpiled_depth"]),
    });
  }
  if (typeof metrics["gates_removed"] === "number") {
    items.push({
      key: "gates_removed",
      label: "gates removed",
      help: "How many redundant rotations CompressVQC folded away.",
      big: String(metrics["gates_removed"]),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="panel p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-mute mb-2">
        Key metrics
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((m) => (
          <div key={m.key} className="panel-alt p-2">
            <div className="text-[10px] text-mute uppercase">{m.label}</div>
            <div className={`font-mono text-lg ${m.tone ?? "text-ink"}`}>
              {m.big}
            </div>
            <div className="text-[10px] text-mute leading-snug mt-0.5">
              {m.help}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
