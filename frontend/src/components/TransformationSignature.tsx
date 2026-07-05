// Uniform transformation signature — the same visual vocabulary for
// what ANY step did to the circuit, whether it's QuCAD pruning,
// CompVQC folding, a transpile, or a user plugin. The executor
// captures before/after structural snapshots centrally; this
// component renders them in two densities:
//
//   variant="tile"  — ultra-compact delta chips on the canvas node,
//                     nonzero channels only (Q qubits / D depth /
//                     G gates / P params);
//   variant="card"  — full before → after readout in the results
//                     pane, plus the per-op gate-count diff.
//
// Color semantics: for depth/gates/params a DECREASE is the goal of
// every optimizer in the catalog, so decreases render green (ok) and
// increases amber (warn). Qubit-count changes are neutral — width is
// a property, not a cost, at these scales.

import type { StepResult } from "../lib/api";

export interface TransformationPayload {
  before: {
    num_qubits: number;
    depth: number;
    size: number;
    num_parameters: number;
    ops: Record<string, number>;
  } | null;
  after: TransformationPayload["before"];
  delta: {
    num_qubits: number;
    depth: number;
    size: number;
    num_parameters: number;
  };
  ops_delta: Record<string, number>;
  changed: boolean;
}

export function transformationOf(
  step: StepResult | undefined | null,
): TransformationPayload | null {
  const t = step?.transformation;
  if (!t || typeof t !== "object") return null;
  return t as unknown as TransformationPayload;
}

const CHANNELS: Array<{
  key: keyof TransformationPayload["delta"];
  short: string;
  label: string;
  neutral?: boolean;
}> = [
  { key: "num_qubits", short: "Q", label: "qubits", neutral: true },
  { key: "depth", short: "D", label: "depth" },
  { key: "size", short: "G", label: "gates" },
  { key: "num_parameters", short: "P", label: "params" },
];

function deltaTone(v: number, neutral?: boolean): string {
  if (v === 0) return "text-mute";
  if (neutral) return "text-accent";
  return v < 0 ? "text-ok" : "text-warn";
}

function fmtDelta(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

/** Compact canvas-tile form: nonzero channels only. Renders nothing
 *  for pass-through steps — an unchanged circuit needs no ink. */
export function SignatureTile({ step }: { step: StepResult }) {
  const t = transformationOf(step);
  if (!t || !t.changed) return null;
  const parts = CHANNELS.filter((c) => t.delta[c.key] !== 0);
  if (parts.length === 0) return null;
  return (
    <div
      className="mt-1 flex items-center gap-1.5 text-[9px] font-mono leading-none"
      title={`Circuit transformation:\n${CHANNELS.map(
        (c) => `${c.label}: ${fmtDelta(t.delta[c.key])}`,
      ).join("\n")}`}
    >
      {parts.map((c) => (
        <span key={c.key} className={deltaTone(t.delta[c.key], c.neutral)}>
          {c.short}
          {fmtDelta(t.delta[c.key])}
        </span>
      ))}
    </div>
  );
}

/** Full results-card form: before → after per channel + gate-count
 *  diff by op. Pass-through steps get an explicit one-liner so the
 *  reader can tell "read the circuit, left it alone" from "no
 *  circuit in scope at all" (which renders nothing). */
export function SignatureCard({ step }: { step: StepResult }) {
  const t = transformationOf(step);
  if (!t) return null;
  if (!t.changed) {
    return (
      <div className="text-[10px] text-mute mt-1">
        Circuit pass-through — this step read the circuit but did not
        modify it.
      </div>
    );
  }
  const b = t.before;
  const a = t.after;
  const opEntries = Object.entries(t.ops_delta).sort(
    (x, y) => Math.abs(y[1]) - Math.abs(x[1]),
  );
  return (
    <div className="panel-alt p-2 mt-1 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-mute">
        circuit transformation
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {CHANNELS.map((c) => {
          const d = t.delta[c.key];
          return (
            <div key={c.key} className="text-[10px]">
              <div className="text-mute">{c.label}</div>
              <div className="font-mono">
                {b ? b[c.key] : 0}
                <span className="text-mute"> → </span>
                {a ? a[c.key] : 0}
                {d !== 0 && (
                  <span className={`ml-1 ${deltaTone(d, c.neutral)}`}>
                    {fmtDelta(d)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {opEntries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {opEntries.map(([op, d]) => (
            <span
              key={op}
              className={`chip font-mono !text-[9px] ${d < 0 ? "!border-ok/40" : "!border-warn/40"}`}
              title={`${op}: ${d < 0 ? d : `+${d}`} gates`}
            >
              {op} {fmtDelta(d)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
