/** cost-estimate — a tiny cost model derived from the browser's OWN
 *  run archive (IndexedDB), no server involvement.
 *
 *  The paper frames pipelines as *stochastic, costly experiments*;
 *  this module makes the "costly" half visible before the user clicks
 *  Run. Every archived RunRecord's `response.steps` carries
 *  `started_at` / `finished_at` (server-side epoch seconds), so we can
 *  learn a per-block-kind duration profile from history:
 *
 *    estimate(kind) = median over all archived OK steps of that kind
 *
 *  Median, not mean: first-hit steps pay one-off warmups (Qshot's
 *  ~30-40s HDBSCAN singleton build, lazy torch import) that would
 *  wreck a mean; the median tracks the steady-state cost.
 *
 *  Steps served from the step cache (`from_step_cache`) are EXCLUDED
 *  from the samples — they measure a dictionary lookup, not the
 *  computation, and would drag the median toward zero. The estimate
 *  answers "what does this block cost when it actually runs?".
 */

import type { RunRecord } from "./runStore";

export interface PipelineEstimate {
  /** Whole-pipeline estimate in seconds. null when at least one canvas
   *  kind has no observed history — `knownS` + `unknownKinds` then
   *  carry the honest partial answer. */
  totalS: number | null;
  /** Sum of estimates over the kinds we DO have data for (seconds). */
  knownS: number;
  /** Median observed duration (seconds) per node kind. */
  perKind: Record<string, number>;
  /** Distinct canvas kinds with zero archived observations. */
  unknownKinds: string[];
  /** How many archived runs contributed samples (tooltip honesty). */
  sampleRuns: number;
}

/** Kinds whose handlers are seed-dependent (nondeterministic in fresh
 *  mode). Mirrors the backend audit: sampled fidelity, QuBound's LSTM
 *  training, Qshot's pilot measurements. Used by the replicate
 *  approximation below. */
export const STOCHASTIC_KINDS: ReadonlySet<string> = new Set([
  "fidelity",
  "qubound",
  "qshot",
]);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Estimate the wall-clock cost of running `nodes` once, from the
 *  durations observed in `records` (this browser's archive). */
export function estimatePipeline(
  nodes: { id: string; kind: string }[],
  records: RunRecord[],
): PipelineEstimate {
  const samples = new Map<string, number[]>();
  const runsWithSamples = new Set<string>();

  for (const rec of records) {
    const steps = rec.response?.steps;
    if (!Array.isArray(steps)) continue;
    for (const step of steps) {
      if (step.status !== "ok" || step.from_step_cache) continue;
      const dur = step.finished_at - step.started_at;
      if (!Number.isFinite(dur) || dur < 0) continue;
      const kind = step.node_type;
      if (!samples.has(kind)) samples.set(kind, []);
      samples.get(kind)!.push(dur);
      runsWithSamples.add(rec.run_id);
    }
  }

  const perKind: Record<string, number> = {};
  for (const [kind, xs] of samples) perKind[kind] = median(xs);

  let knownS = 0;
  const unknown = new Set<string>();
  for (const n of nodes) {
    const est = perKind[n.kind];
    if (est === undefined) unknown.add(n.kind);
    else knownS += est; // per NODE: two fidelity blocks cost twice
  }

  return {
    totalS: unknown.size === 0 ? knownS : null,
    knownS,
    perKind,
    unknownKinds: [...unknown],
    sampleRuns: runsWithSamples.size,
  };
}

/** Extra seconds that replicates 2..n add on top of one full run.
 *
 *  Approximation (deliberately simple): after replicate 1 the
 *  deterministic prefix sits in the server's step cache, so replicates
 *  2..n only pay for the seed-dependent blocks — we charge
 *  (n-1) x Σ estimate(stochastic nodes on canvas). This UNDERSTATES
 *  when a deterministic block sits downstream of a stochastic one
 *  (cache is disabled for the whole suffix, so e.g. `output` re-runs
 *  too — cheap in practice), and it charges nothing for stochastic
 *  kinds with no history (they are already surfaced as unknown). */
export function replicateExtraS(
  est: PipelineEstimate,
  nodes: { id: string; kind: string }[],
  n: number,
): number {
  if (n <= 1) return 0;
  let stochasticS = 0;
  for (const node of nodes) {
    if (!STOCHASTIC_KINDS.has(node.kind)) continue;
    stochasticS += est.perKind[node.kind] ?? 0;
  }
  return (n - 1) * stochasticS;
}

/** "12s" / "3.4s" / "2m 05s" — compact duration for the toolbar chip. */
export function formatSeconds(s: number): string {
  if (s >= 90) {
    const m = Math.floor(s / 60);
    const rem = Math.round(s % 60);
    return `${m}m ${String(rem).padStart(2, "0")}s`;
  }
  return s >= 10 ? `${Math.round(s)}s` : `${s.toFixed(1)}s`;
}
