// Gate-level circuit diff — per-qubit lanes, LCS-merged token order.
// Lives inside SignatureCard, collapsed behind a <details>: the
// channel strip answers "how much changed", this view answers
// "WHICH gates, on WHICH lanes" — the QuCAD-pruned / CompVQC-folded
// evidence a reader wants before believing a signature.
//
// Encoding (consistent with the delta strip's goal-anchored colors):
//   kept    — neutral dimmed chip (context, not the story)
//   removed — ok/green + strikethrough (pruning is the optimizer's
//             goal; decrease=ok everywhere in this vocabulary)
//   added   — warn/amber (growth is the thing to scrutinize)
// 2-qubit partners carry their role suffix (·c control / ·t target)
// so a cx shows up on BOTH lanes and reads correctly on each.
// Payload is capped server-side (12 qubits / 600 ops) — over the cap
// we show a one-line pointer back to the channel strip.

import type { TransformationPayload } from "./TransformationSignature";

interface GateDiffEntry {
  op: string;
  s: "kept" | "removed" | "added";
}

export interface GateDiffPayload {
  truncated: boolean;
  reason?: string;
  qubits?: Record<string, GateDiffEntry[]>;
  n_kept?: number;
  n_removed?: number;
  n_added?: number;
}

export function gateDiffOf(
  t: TransformationPayload | null | undefined,
): GateDiffPayload | null {
  const g = (t as unknown as Record<string, unknown> | null | undefined)
    ?.gate_diff;
  if (!g || typeof g !== "object") return null;
  return g as GateDiffPayload;
}

const CHIP: Record<GateDiffEntry["s"], { cls: string; title: string }> = {
  kept: {
    cls: "bg-surfaceAlt border-edge text-mute opacity-70",
    title: "unchanged by this step",
  },
  removed: {
    cls: "bg-ok/10 border-ok/40 text-ok line-through",
    title: "removed by this step",
  },
  added: {
    cls: "bg-warn/10 border-warn/40 text-warn",
    title: "added by this step",
  },
};

export default function CircuitDiff({ t }: { t: TransformationPayload }) {
  const g = gateDiffOf(t);
  if (!g) return null;
  if (g.truncated) {
    return (
      <div className="gate-diff text-[10px] text-mute" aria-label="gate-diff">
        circuit too large for gate-level diff (shown up to 12 qubits /
        600 gates) — see the channel strip above
      </div>
    );
  }
  const lanes = Object.entries(g.qubits ?? {}).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  );
  if (lanes.length === 0) return null;
  const nRemoved = g.n_removed ?? 0;
  const nAdded = g.n_added ?? 0;
  return (
    <details className="gate-diff group" aria-label="gate-diff">
      <summary className="cursor-pointer select-none text-[10px] text-mute hover:text-ink transition-colors">
        Gate-level diff · {nRemoved} removed · {nAdded} added
      </summary>
      <div className="mt-1.5 space-y-1">
        {lanes.map(([qi, ops]) => (
          <div key={qi} className="flex items-center gap-1.5 min-w-0">
            <span className="w-6 shrink-0 text-right font-mono text-[9px] text-mute">
              q{qi}
            </span>
            <div className="flex items-center gap-1 overflow-x-auto min-w-0 pb-0.5">
              {ops.map((e, i) => (
                <span
                  key={`${qi}-${i}`}
                  title={`${e.op} — ${CHIP[e.s].title}`}
                  className={`shrink-0 rounded border px-1 py-px font-mono text-[9px] leading-none whitespace-nowrap ${CHIP[e.s].cls}`}
                >
                  {e.op}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
