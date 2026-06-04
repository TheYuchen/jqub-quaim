// Per-node-kind logic for "what's the one headline number to show on
// the canvas tile after a successful run?".
//
// The result card in the right pane shows the full summary table;
// this helper picks the single most representative scalar so the
// canvas itself becomes a glanceable dashboard. Returning null means
// "no headline — render nothing", which is the fallback for kinds
// whose summary doesn't expose a clean scalar.
//
// Kept as a per-kind table rather than baked into a server-side
// "primary_metric" field because the canvas display logic (number
// format, unit suffix, accent tone) is presentational and belongs
// near the rendering.

import type { StepResult } from "./api";
import type { NodeKind } from "./nodeCatalog";

export type Headline = {
  /** Short label shown above the number. */
  label: string;
  /** Pre-formatted value string. */
  value: string;
  /** Optional accent class for the number (Tailwind, e.g. text-ok). */
  tone?: string;
};

/** Format a number with up to 4 significant digits, dropping trailing
 *  zeros. NaN/null returns "—". */
function fmt(n: unknown, digits = 4): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  return n
    .toPrecision(digits)
    .replace(/\.?0+(?=e|$)/, "")
    .replace(/(\.\d*?)0+(?=$)/, "$1");
}

function pct(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Per-kind dispatcher. Returns null when the kind has no
 *  meaningful headline (e.g. fake_backend just configures the next
 *  step), so the caller can skip rendering the strip entirely. */
export function headlineFor(
  kind: NodeKind | string,
  step: StepResult,
): Headline | null {
  const s = step.summary;
  switch (kind) {
    case "input_circuit":
      return null; // shape already shown via the circuit info block
    case "fake_backend":
    case "ibm_backend":
      return null; // no scalar output to surface
    case "qucad": {
      // The QuCAD card surfaces "sparsity" / "params_pruned".
      const sp = asNumber(s.sparsity ?? s.pruned_fraction);
      if (sp !== null) return { label: "Pruned", value: pct(sp), tone: "text-ok" };
      const kept = asNumber(s.params_kept);
      const total = asNumber(s.params_total);
      if (kept !== null && total !== null && total > 0) {
        return {
          label: "Kept",
          value: `${kept}/${total}`,
          tone: "text-ink",
        };
      }
      return null;
    }
    case "qubound": {
      const eb = asNumber(s.predicted_error_bound ?? s.qubound_value);
      if (eb === null) return null;
      // When the user set a threshold, render pass/fail. Otherwise
      // just show the predicted number.
      const passes = s.passes_threshold;
      const threshold = asNumber(s.threshold);
      if (typeof passes === "boolean" && threshold !== null) {
        return {
          label: passes ? "Below threshold" : "Above threshold",
          value: `${fmt(eb)} / ${fmt(threshold)}`,
          tone: passes ? "text-ok" : "text-danger",
        };
      }
      return { label: "Error bound", value: `≤ ${fmt(eb)}`, tone: "text-accent" };
    }
    case "compvqc": {
      const folded = asNumber(s.rotations_folded ?? s.compressed);
      const original = asNumber(s.rotations_original);
      if (folded !== null && original !== null && original > 0) {
        return {
          label: "Folded",
          value: `${original}→${original - folded}`,
          tone: "text-ok",
        };
      }
      return null;
    }
    case "qshot": {
      const shots = asNumber(s.recommended_shots ?? s.shots);
      if (shots !== null) {
        return { label: "Shots", value: fmt(shots), tone: "text-accent" };
      }
      return null;
    }
    case "fidelity": {
      const f = asNumber(s.fidelity);
      if (f === null) return null;
      // Tag the headline with the method so the reader knows whether
      // this is noiseless (statevector) or backend-noise (sampled).
      const method = typeof s.method === "string" ? s.method : null;
      const label =
        method === "sampled"
          ? "Fidelity (sampled)"
          : method === "statevector"
            ? "Fidelity (noiseless)"
            : "Fidelity";
      return {
        label,
        value: fmt(f),
        tone: f >= 0.9 ? "text-ok" : f >= 0.7 ? "text-warn" : "text-danger",
      };
    }
    case "output": {
      const f = asNumber(s.fidelity);
      if (f !== null) {
        return { label: "Final fidelity", value: fmt(f), tone: "text-ok" };
      }
      return null;
    }
    default: {
      // User plugin: prefer "scalars" they wrote, then look for any
      // single numeric in summary.
      const summaryDict = s as Record<string, unknown>;
      for (const k of ["fidelity", "score", "metric", "value"]) {
        const v = asNumber(summaryDict[k]);
        if (v !== null) return { label: k, value: fmt(v), tone: "text-accent" };
      }
      // First scalar in summary.
      for (const [k, v] of Object.entries(summaryDict)) {
        const n = asNumber(v);
        if (n !== null) return { label: k, value: fmt(n), tone: "text-mute" };
      }
      return null;
    }
  }
}

/** Classify run duration into a tint tone for the node card border /
 *  background. The thresholds are picked from typical run profiles:
 *  built-in QuCAD / CompressVQC are sub-second; QuBound LSTM training
 *  and Qshot HDBSCAN warmup land in the 30s-3min range; anything past
 *  that is a stand-out outlier worth flagging. */
export function durationTone(duration_s: number):
  | "fast"
  | "medium"
  | "slow"
  | "very-slow" {
  if (duration_s < 1) return "fast";
  if (duration_s < 10) return "medium";
  if (duration_s < 60) return "slow";
  return "very-slow";
}
