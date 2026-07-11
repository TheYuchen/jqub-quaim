// Frontend statistics for pooled replicate evidence (Wave J).
//
// Pooling rationale: a config_hash group holds replicates of the SAME
// configuration — same circuit, same backend snapshot, same graph
// params (that is precisely what the structural hash canonicalizes) —
// so every run's sampled-fidelity step draws from the same underlying
// success probability p. Independent binomial draws with a common p
// pool losslessly: summed successes over summed shots is the
// sufficient statistic, and ONE Wilson interval over the pooled counts
// is the tightest honest cross-run summary. Averaging per-run points
// would throw away the shot counts (a 512-shot draw would outvote its
// evidence); averaging per-run intervals is simply wrong.

import type { RunResponse } from "./api";

/** 95% Wilson score interval for a binomial proportion.
 *
 * Port of backend/app/services/stats.py::wilson_interval (same z,
 * same [0,1] clamping); the backend additionally carries a pinned
 * duplicate in qlib/qiskit_utils.py::wilson_interval_95 — see the
 * layering note there (qlib must not import app.*). Wilson over the
 * naive normal approximation because sampled fidelities routinely sit
 * near 0 or 1, where the normal interval collapses to zero width or
 * escapes [0, 1].
 *
 * Unit anchors (match the backend's live regression numbers):
 *   wilson95(238, 512) → [0.4221, 0.5081]  point 0.4648, half ±0.0430
 *   wilson95(256, 512) → half-width ≈ 0.0431 (widest case, p = 0.5)
 *   wilson95(0, 0)     → [0, 1]            no evidence = full unknown
 */
export function wilson95(successes: number, n: number): [number, number] {
  const z = 1.959963984540054;
  if (n <= 0) return [0, 1];
  const k = Math.max(0, Math.min(Math.round(successes), Math.round(n)));
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Binomial evidence carried by one run: raw pooled counts. */
export interface Evidence {
  successes: number;
  shots: number;
}

/** Total binomial evidence a run actually EXECUTED: successes/shots
 *  summed over every step carrying a binomial distribution payload.
 *  null when the run has none (deterministic pipeline, error before
 *  the sampled step, pre-provenance record). `distribution.shots` is
 *  shots executed — not requested — so an early-stopped run weighs
 *  exactly the evidence it paid for. */
export function runEvidence(
  response: RunResponse | null | undefined,
): Evidence | null {
  if (!response?.steps) return null;
  let shots = 0;
  let successes = 0;
  let found = false;
  for (const step of response.steps) {
    const d = step.distribution as
      | { kind?: unknown; shots?: unknown; successes?: unknown }
      | null
      | undefined;
    if (
      d?.kind === "binomial" &&
      typeof d.shots === "number" &&
      Number.isFinite(d.shots) &&
      d.shots > 0 &&
      typeof d.successes === "number" &&
      Number.isFinite(d.successes)
    ) {
      shots += d.shots;
      successes += d.successes;
      found = true;
    }
  }
  return found ? { successes, shots } : null;
}

export interface PooledEvidence extends Evidence {
  /** How many runs contributed counts. */
  nRuns: number;
  /** Pooled point estimate: Σsuccesses / Σshots. */
  point: number;
  ci95: [number, number];
  /** (hi − lo) / 2. Defined from the interval, not z·SE, because
   *  Wilson is asymmetric near 0 and 1. */
  halfWidth: number;
}

/** Pool runs' binomial evidence (see module comment for why summing
 *  counts is valid within one configuration).
 *
 * Unit anchor: eight 512-shot runs at p ≈ 0.46 pool to 4096 shots
 * with half-width ≈ ±0.0153 — the 1/√N narrowing the lineage funnel
 * draws (√8 ≈ 2.8× tighter than one run's ±0.0430). */
export function poolEvidence(runs: Evidence[]): PooledEvidence | null {
  if (runs.length === 0) return null;
  let shots = 0;
  let successes = 0;
  for (const r of runs) {
    shots += r.shots;
    successes += r.successes;
  }
  if (shots <= 0) return null;
  const ci95 = wilson95(successes, shots);
  return {
    successes,
    shots,
    nRuns: runs.length,
    point: successes / shots,
    ci95,
    halfWidth: (ci95[1] - ci95[0]) / 2,
  };
}

/** Pooled-shots threshold below which a Δ-vs-baseline keeps the
 *  "(n small)" honesty suffix. Rationale: at 2048 shots the
 *  worst-case (p = 0.5) Wilson half-width is ±2.2pp, so once BOTH
 *  sides carry ≥2048 pooled shots a multi-pp Δ is signal, not shot
 *  noise; 2048 is also the app's default full shot budget — "at
 *  least one full run's worth of evidence on each side". */
export const POOLED_SMALL_N_SHOTS = 2048;

// ---------------------------------------------------------------------------
// Between-configuration difference (marker: difference-funnel)
// ---------------------------------------------------------------------------

/** 95% hybrid score interval for the difference of two independent
 *  binomial proportions, d = p1 − p2 — method 10 of Newcombe 1998
 *  ("Interval estimation for the difference between independent
 *  proportions: comparison of eleven methods", Statistics in
 *  Medicine 17:873–890).
 *
 *  Construction: take each side's WILSON interval (l, u) — the same
 *  interval every other surface here draws — and combine the
 *  one-sided score distances in quadrature:
 *
 *      d  = p1 − p2
 *      lo = d − √((p1 − l1)² + (u2 − p2)²)
 *      hi = d + √((u1 − p1)² + (p2 − l2)²)
 *
 *  Why not the naive Wald difference (d ± z·√(p1q1/n1 + p2q2/n2)):
 *  the same rationale as Wilson over Wald for one proportion, which
 *  is exactly the regime this app lives in — sampled fidelities sit
 *  near 0 or 1 and pooled counts are small early in an accumulation
 *  trace, where the Wald width collapses to zero at p̂ ∈ {0, 1} and
 *  its limits escape [−1, 1]. The hybrid score interval inherits
 *  Wilson's boundary-respecting behaviour on both sides.
 *
 *  Unit anchors (checked by scripts/check_difference_funnel.test.ts):
 *    newcombe95(56, 70, 48, 80) → [0.0524, 0.3339]   (worked example
 *      (a) of the Newcombe 1998 paper: 80% vs 60%, d = 0.20)
 *    newcombe95(k, n, k, n)     → symmetric about 0
 *    either n ≤ 0               → [−1, 1]  no evidence = full unknown
 */
export function newcombe95(
  k1: number,
  n1: number,
  k2: number,
  n2: number,
): [number, number] {
  if (n1 <= 0 || n2 <= 0) return [-1, 1];
  const p1 = Math.max(0, Math.min(Math.round(k1), Math.round(n1))) / n1;
  const p2 = Math.max(0, Math.min(Math.round(k2), Math.round(n2))) / n2;
  const [l1, u1] = wilson95(k1, n1);
  const [l2, u2] = wilson95(k2, n2);
  const d = p1 - p2;
  const lo = d - Math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2);
  const hi = d + Math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2);
  return [Math.max(-1, lo), Math.min(1, hi)];
}

/** Evidence plus the archive metadata the difference trace orders and
 *  dedupes by. */
export interface DatedEvidence extends Evidence {
  created_at: number;
  /** Root seed of the run, when known (see dedupeDraws). */
  root_seed?: number | null;
}

/** Sort chronologically and drop exact-replay duplicates.
 *
 *  A pinned replay reproduces its ancestor's draw bit-exactly — same
 *  root seed ⇒ same per-node seeds ⇒ same counts (the system's replay
 *  guarantee) — so within one configuration a second run with the
 *  same root seed is the SAME evidence recorded twice. A sequential
 *  inference over accumulated counts must not pool it twice (the
 *  bundled demo archive contains exactly this case: bell-512 run
 *  7e401b5270b9 replays f0cb7403bbae, seed 815033775, 247/512 twice).
 *  The dedupe key is (root_seed, shots, successes) — audit S3,
 *  approved: the replay guarantee only holds when the WHOLE draw
 *  repeats, and the same seed with a different stopping point (an
 *  early-stopped replay, a changed shot budget) executed different
 *  measurements — that is new evidence, not a recording of the old
 *  draw. Runs with unknown seeds are never deduped — there is no
 *  proof they repeat a draw. Since the 2026-07-10 audit wave, EVERY pooling
 *  surface applies this rule — difference funnel, theater archive
 *  band, multiverse pooled band/line, fidelity-card replicate strip,
 *  lineage certainty funnel — and their labels say "exact replays
 *  counted once" (uniform truth documented in
 *  docs/EVIDENCE_WORKBENCH.md). */
export function dedupeDraws<T extends DatedEvidence>(runs: T[]): T[] {
  const sorted = [...runs].sort((a, b) => a.created_at - b.created_at);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of sorted) {
    if (r.shots <= 0) continue;
    if (r.root_seed != null) {
      const key = `${r.root_seed}|${r.shots}|${r.successes}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(r);
  }
  return out;
}

/** One accumulation step of the difference funnel. */
export interface DifferenceStep {
  /** 1-based step index (t-th replicate of each side pooled in). */
  step: number;
  /** Runs pooled so far per side (≤ step once a side has run out). */
  nRunsA: number;
  nRunsB: number;
  shotsA: number;
  shotsB: number;
  /** Total shots consumed by BOTH sides — the x-axis quantity: what
   *  this much certainty about the difference actually cost. */
  shots: number;
  successesA: number;
  successesB: number;
  /** Δ(B − A) of the pooled points; positive = B measured higher.
   *  Sign convention matches the Compare view's "Δ(B−A)" readout. */
  d: number;
  lo: number;
  hi: number;
  /** The 95% interval of the difference excludes zero at this step. */
  established: boolean;
}

/** Chronological accumulation of the difference between two
 *  configurations' pooled evidence — the data behind the difference
 *  funnel (the third funnel scale: within-run theater, across-run
 *  pooling, and now between-configuration).
 *
 *  Semantics: each side is sorted by created_at (the order the
 *  evidence actually arrived) and replay-deduped (dedupeDraws); at
 *  step t side A pools its first min(t, |A|) runs and side B its
 *  first min(t, |B|) runs — unequal run counts are fine (the shorter
 *  side simply stops growing), and unequal shots-per-run are fine
 *  because pooling is on raw counts (a 512-shot side and a 2048-shot
 *  side each weigh exactly the shots they executed; see the module
 *  comment on why summed counts are the honest pool within one
 *  configuration). Each step gets a Newcombe interval on the pooled
 *  difference.
 *
 *  Multiple-looks caveat: `established` is re-evaluated at every
 *  step, and repeatedly checking a 95% interval as evidence
 *  accumulates inflates the type-I error rate — the same limitation
 *  family as the theater's optional stopping (the M2 disclosure in
 *  docs/EVIDENCE_WORKBENCH.md). Consumers must therefore treat an
 *  exclusion of zero that later re-includes zero as NOT sustained
 *  (differenceVerdict computes exactly that), and the funnel says so
 *  on the drawing instead of celebrating the transient exclusion. */
export function differenceTrace(
  runsA: DatedEvidence[],
  runsB: DatedEvidence[],
): DifferenceStep[] {
  const A = dedupeDraws(runsA);
  const B = dedupeDraws(runsB);
  if (A.length === 0 || B.length === 0) return [];
  const steps: DifferenceStep[] = [];
  const max = Math.max(A.length, B.length);
  let kA = 0;
  let nA = 0;
  let kB = 0;
  let nB = 0;
  let iA = 0;
  let iB = 0;
  for (let t = 1; t <= max; t++) {
    while (iA < Math.min(t, A.length)) {
      kA += A[iA].successes;
      nA += A[iA].shots;
      iA++;
    }
    while (iB < Math.min(t, B.length)) {
      kB += B[iB].successes;
      nB += B[iB].shots;
      iB++;
    }
    const d = kB / nB - kA / nA;
    // newcombe95 is (k1,n1,k2,n2) → p1 − p2; feed B first so the
    // interval is for Δ(B − A), same sign as d above.
    const [lo, hi] = newcombe95(kB, nB, kA, nA);
    steps.push({
      step: t,
      nRunsA: iA,
      nRunsB: iB,
      shotsA: nA,
      shotsB: nB,
      shots: nA + nB,
      successesA: kA,
      successesB: kB,
      d,
      lo,
      hi,
      established: lo > 0 || hi < 0,
    });
  }
  return steps;
}

/** Verdict over a difference trace — the honest summary the funnel
 *  annotates with (and the node lane pins for the demo archive). */
export interface DifferenceVerdict {
  final: DifferenceStep;
  /** First step whose interval excluded zero, if any ever did. */
  establishedAt: DifferenceStep | null;
  /** First LATER step that re-included zero (null = never lost). */
  lostAt: DifferenceStep | null;
  /** Established at some step AND at every step after it — the only
   *  state the funnel colors green; anything else is warn/mute. */
  sustained: boolean;
}

export function differenceVerdict(
  steps: DifferenceStep[],
): DifferenceVerdict | null {
  if (steps.length === 0) return null;
  const final = steps[steps.length - 1];
  const firstIdx = steps.findIndex((s) => s.established);
  if (firstIdx === -1)
    return { final, establishedAt: null, lostAt: null, sustained: false };
  let lostAt: DifferenceStep | null = null;
  for (let i = firstIdx + 1; i < steps.length; i++) {
    if (!steps[i].established) {
      lostAt = steps[i];
      break;
    }
  }
  return {
    final,
    establishedAt: steps[firstIdx],
    lostAt,
    sustained: lostAt === null,
  };
}
