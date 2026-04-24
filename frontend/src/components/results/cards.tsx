// Per-algorithm result cards.
//
// `StepBody` is the dispatcher that ResultsPane calls to render the body
// of a step card — it picks the right view by node type. Each view
// knows what fields to pull out of the step's `summary` dict and how to
// visualise them using the primitives from `./viz`.

import type { StepResult } from "../../lib/api";
import {
  Caption,
  DepthCompare,
  Gauge,
  KvRow,
  OpBar,
  Sparkline,
  Stat,
  numOr,
} from "./viz";

/** Dispatch the step summary to a node-type-specific card; fall back to generic rows. */
export function StepBody({ step }: { step: StepResult }) {
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
      {before > 0 && <DepthCompare before={before} after={after} />}
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
      {s["live"] === true && <div className="text-warn">live IBM calibration</div>}
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
