// Evidence theater — the steering view, promoted to protagonist.
//
// Diagnosis this view fixes: anytime evidence steering (streaming CI
// narrowing + optional stopping, Wave I) is the system's most novel
// contribution, yet it lived as a thin strip inside a side-panel card
// while ordinary views owned the screen. The theater gives steering a
// dedicated, large, self-explanatory stage: it auto-opens the moment a
// sampled step starts streaming (first step_progress frame), overlays
// the center column (same overlay pattern as the Multiverse board),
// and is the view a paper teaser figure / demo video opens with
// (?scenario=F0 boots straight into it).
//
// Encoding rationale (each choice justified by the steering task):
//   * X = shots executed, 0 → shots_requested, LINEAR. Shots are the
//     costly resource being spent; a linear shot axis makes "evidence
//     bought" read as horizontal distance, and an early stop leaves
//     visibly UNSPENT axis — the whole point of steering. (A batch-
//     index axis would hide cost; a log axis would flatter the early
//     narrowing and hide that precision gets ever more expensive.)
//   * Y = fidelity-estimate scale, auto-zoomed to the first batch's
//     point ± 3× its half-width (clamped to [0,1], then extended to
//     cover every interval, the target band and the archive band).
//     The fixed 0-1 scale the cards use is right for cross-run
//     comparison but wrong for the protagonist view: at 0-1 scale a
//     ±2pp target is 4 pixels tall. Anchoring the zoom on the FIRST
//     interval keeps the axis stable while frames stream (no
//     re-zooming under the viewer's eyes) and makes the funnel's
//     3:1-ish convergence fill the panel by construction.
//   * Each batch draws its Wilson CI as a vertical interval at its
//     cumulative-shots x; a shaded envelope (the funnel silhouette)
//     connects them; a thin line links the point estimates. Live runs
//     grow the drawing frame by frame as events arrive; archived /
//     replayed runs render the identical drawing instantly from the
//     persisted distribution.trace — the trace IS provenance, so the
//     figure never depends on having watched the run.
//   * Target band = two dashed warn-colored lines at point ± target
//     ("the corridor the interval must fit inside"), with the early
//     stop annotated as a vertical line at the stop x plus the
//     unspent-shots region lightly shaded (a 5%-opacity wash — audit
//     S3: this comment used to promise a hatch that was never drawn)
//     — the reward for steering, stated in the cost currency (shots
//     not spent).
//   * Cost axis: a secondary tick row under the X axis with the
//     wall-clock gap between consecutive batch arrivals, plus a total
//     "evidence spent: N shots · T s". CAVEAT: per-batch times are
//     CLIENT-SIDE ARRIVAL timestamps (Date.now() when the SSE frame
//     landed) — server compute + network jitter, honest enough to
//     show that shots cost time, not a benchmark. The total prefers
//     the server's own step duration once the step completes. The
//     first batch gets no "+Δs" label (its arrival gap includes
//     worker spin-up and noise-model fetch, not marginal batch cost).
//   * Context strip: which node/config/seed this is, plus the pooled
//     Wilson interval this configuration has ALREADY accumulated in
//     the archive (faint band + "archive: pooled ±Xpp over N shots
//     from k runs") — the streaming run visibly adds to a body of
//     evidence rather than starting from zero. Pooling is valid
//     within one configuration (see lib/stats.ts); the band is only
//     drawn on single-sampled-node runs because runEvidence pools a
//     whole run's counts (a per-node split would be dishonest for
//     multi-node pipelines).
//   * Color: accent (blue) = this run's evidence; warn (amber,
//     DASHED) = the stopping rule; accent4 (green, FILLED band) =
//     archived evidence. Three hues that survive deuteranopia checks,
//     and each hue is doubled by a mark-type difference (solid
//     interval / dashed line / filled band) so hue is never the only
//     channel.
//   * Multiple sampled nodes stack as small multiples (~230px each,
//     scroll past 3) — same vocabulary, one panel per node.
//   * Trace scrubbing (filmstrip support): once the trace is fully
//     known (replayed/archived runs — never while streaming), a
//     "batch k of B" scrubber appears in the chrome and truncates
//     every series to its first k batches. The chart then shows the
//     run AS OF batch k — intervals 1..k, truncated envelope,
//     "so far: N shots · point ±w" — and the ⏹ stop annotation only
//     once the stop batch itself is reached. The derivation is pure
//     (same persisted trace + same k ⇒ same SVG), so a figure export
//     in a scrubbed state is bit-reproducible; it embeds
//     trace_position: k in its provenance and suffixes filenames with
//     _batchK. Filmstrip recipe for F0 in lib/scenarios.ts.
//
// The chart is ONE <svg> (context header included) so the figure
// export takes the TRUE-SVG path: vector output with the provenance
// <metadata> embedded, correct under the forced-light paper transform.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { StepResult } from "../lib/api";
import {
  setTheaterAutoOpenEnabled,
  theaterAutoOpenEnabled,
  useApp,
  type TheaterFrame,
} from "../lib/store";
import { getRun, listRunsByConfig, type RunRecord } from "../lib/runStore";
import {
  poolEvidence,
  runEvidence,
  dedupeDraws,
  type DatedEvidence,
  type PooledEvidence,
} from "../lib/stats";
import { hashHue, hueCss } from "../lib/hues";
import { costAnchor } from "../lib/costModel";
import { estimateTextW } from "../lib/svgPaper";
import { GLOSSARY } from "../lib/glossary";
import { FigureExportButton } from "./FigureExportButton";
import { TipIcon } from "./TipIcon";

// ---------------------------------------------------------------------------
// data assembly
// ---------------------------------------------------------------------------

interface Frame {
  shots: number;
  point: number;
  lo: number;
  hi: number;
  /** Client arrival time (ms epoch) — null for frames reconstructed
   *  from a persisted trace (archived/replayed runs carry no timing). */
  at: number | null;
}

interface Series {
  nodeId: string;
  label: string;
  frames: Frame[];
  shotsRequested: number;
  nBatches: number;
  precisionTarget: number | null;
  stoppedEarly: boolean;
  /** StepResult landed (vs still streaming). */
  done: boolean;
  /** Server-authoritative step duration in seconds, once done. */
  serverSeconds: number | null;
  seedUsed: number | null;
  successes: number | null;
  shotsExecuted: number | null;
  /** Series truncated to its first k batches by the trace scrubber. */
  scrubbed?: boolean;
}

interface TraceDist {
  kind?: string;
  shots?: number;
  successes?: number;
  shots_requested?: number;
  stopped_early?: boolean;
  precision_target?: number;
  n_batches?: number;
  trace?: Array<{ shots_done: number; point: number; ci95: [number, number] }>;
}

/** Merge a completed step's persisted trace with the live frames'
 *  client timestamps (matched by cumulative shots — bit-identical by
 *  the Wave-I stream-vs-eager guarantee, so a mismatch means the
 *  trace belongs to a different run and gets no timing). */
function seriesFromStep(
  step: StepResult,
  live: TheaterFrame[] | undefined,
  timesTrusted: boolean,
): Series | null {
  const d = step.distribution as TraceDist | null | undefined;
  if (d?.kind !== "binomial" || !Array.isArray(d.trace) || d.trace.length === 0)
    return null;
  const byShots = new Map<number, number>();
  if (timesTrusted && live) live.forEach((f) => byShots.set(f.shots_done, f.at));
  return {
    nodeId: step.node_id,
    label: step.label || "sampled fidelity",
    frames: d.trace.map((t) => ({
      shots: t.shots_done,
      point: t.point,
      lo: t.ci95[0],
      hi: t.ci95[1],
      at: byShots.get(t.shots_done) ?? null,
    })),
    shotsRequested: d.shots_requested ?? d.shots ?? 0,
    nBatches: d.n_batches ?? d.trace.length,
    precisionTarget: d.precision_target ?? null,
    stoppedEarly: d.stopped_early === true,
    done: true,
    serverSeconds:
      Number.isFinite(step.finished_at) && Number.isFinite(step.started_at)
        ? Math.max(0, step.finished_at - step.started_at)
        : null,
    seedUsed: step.seed_used ?? null,
    successes: d.successes ?? null,
    shotsExecuted: d.shots ?? null,
  };
}

/** A node that is streaming RIGHT NOW but has no StepResult yet:
 *  build the series straight from the live frames. shots_requested is
 *  estimated from equal-batch arithmetic until the server states it. */
function seriesFromLive(
  nodeId: string,
  frames: TheaterFrame[],
  target: number | null,
): Series | null {
  if (frames.length === 0) return null;
  const last = frames[frames.length - 1];
  const est =
    last.batch_i > 0
      ? Math.round((last.shots_done / last.batch_i) * last.n_batches)
      : last.shots_done;
  return {
    nodeId,
    label: "sampled fidelity",
    frames: frames.map((f) => ({
      shots: f.shots_done,
      point: f.point,
      lo: f.ci95[0],
      hi: f.ci95[1],
      at: f.at,
    })),
    shotsRequested: est,
    nBatches: last.n_batches,
    precisionTarget: target,
    stoppedEarly: false,
    done: false,
    serverSeconds: null,
    seedUsed: null,
    successes: last.successes,
    shotsExecuted: last.shots_done,
  };
}

/** Truncate a fully-known (replayed/archived) series to its first k
 *  batches: the chart then shows exactly what the live view showed at
 *  batch k. done/stoppedEarly are cleared so the Panel renders the
 *  mid-run vocabulary ("so far" readouts, no ⏹ stop annotation until
 *  the stop batch is reached); successes is recovered from the batch
 *  point (exact — the trace point IS successes/shots); server total
 *  time is unknowable mid-run, so the cost line falls back to the
 *  truncated client-arrival span when timing is trusted. */
function scrubSeries(s: Series, k: number): Series {
  const kk = Math.max(1, Math.min(k, s.frames.length));
  if (kk >= s.frames.length) return s; // final state = the archived run
  const frames = s.frames.slice(0, kk);
  const last = frames[kk - 1];
  return {
    ...s,
    frames,
    scrubbed: true,
    done: false,
    stoppedEarly: false,
    serverSeconds: null,
    successes: Math.round(last.point * last.shots),
    shotsExecuted: last.shots,
  };
}

/** First sampled-with-trace series of an archived record — the
 *  overlay comparison stages ONE funnel per run. Multi-sampled-node
 *  pipelines overlay their first sampled step only (paired panels
 *  would be the honest extension if a case study ever needs it). */
function firstSampledSeries(rec: RunRecord): Series | null {
  for (const step of rec.response.steps) {
    const sr = seriesFromStep(step, undefined, false);
    if (sr) return sr;
  }
  return null;
}

// ---------------------------------------------------------------------------
// formatting + scales
// ---------------------------------------------------------------------------

const fmtShots = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtPct = (v: number, dp = 1) => `${(v * 100).toFixed(dp)}%`;
const fmtPp = (v: number, dp = 1) => `${(v * 100).toFixed(dp)}pp`;

/** Y domain: first-interval anchor (point ± 3× half-width) extended
 *  to cover everything drawn, padded, clamped to [0,1]. Anchoring on
 *  the FIRST batch keeps the axis stable while later frames stream. */
function yDomain(
  frames: Frame[],
  target: number | null,
  pool: PooledEvidence | null,
): [number, number] {
  const f0 = frames[0];
  const half0 = Math.max((f0.hi - f0.lo) / 2, 0.002);
  let lo = f0.point - 3 * half0;
  let hi = f0.point + 3 * half0;
  for (const f of frames) {
    lo = Math.min(lo, f.lo);
    hi = Math.max(hi, f.hi);
  }
  // f0, NOT the newest frame (audit S3): re-anchoring the target band
  // on every streamed frame re-zoomed the axis mid-run. The domain
  // still extends monotonically (loop above) whenever data escapes it.
  const anchor = f0.point;
  if (target != null) {
    lo = Math.min(lo, anchor - target * 1.6);
    hi = Math.max(hi, anchor + target * 1.6);
  }
  if (pool) {
    lo = Math.min(lo, pool.ci95[0] - half0 * 0.3);
    hi = Math.max(hi, pool.ci95[1] + half0 * 0.3);
  }
  const pad = (hi - lo) * 0.06;
  return [Math.max(0, lo - pad), Math.min(1, hi + pad)];
}

/** Percent-tick step giving 3–7 gridlines over the domain. */
function tickStep(span: number): number {
  for (const s of [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2])
    if (span / s <= 7) return s;
  return 0.25;
}

// ---------------------------------------------------------------------------
// one funnel panel (pure SVG subtree)
// ---------------------------------------------------------------------------

const W = 1000;
const M = { l: 66, r: 208, t: 40, b: 80 };

/** Vertical label dodging for the right-margin readouts.
 *
 *  `blocks` are text blocks anchored at data-driven baselines
 *  (`anchor` = first-line baseline y, `h` = block height in px).
 *  Sort by anchor, then a top→bottom pass pushes each block below the
 *  previous one (tops at least max(12, upper.h + 2) apart) and a
 *  bottom→top pass pulls the pile back inside [lo, hi]. Pure and
 *  order-preserving: returns the adjusted anchor for each input index.
 */
function dodgeMarginLabels(
  blocks: Array<{ anchor: number; h: number }>,
  lo: number,
  hi: number,
): number[] {
  const order = blocks
    .map((b, i) => ({ top: b.anchor, h: b.h, i }))
    .sort((a, b) => a.top - b.top);
  let minTop = lo;
  for (const b of order) {
    b.top = Math.max(b.top, minTop);
    minTop = b.top + Math.max(12, b.h + 2);
  }
  if (order.length > 0) {
    const lastB = order[order.length - 1];
    lastB.top = Math.min(lastB.top, hi - lastB.h);
    for (let k = order.length - 2; k >= 0; k--) {
      order[k].top = Math.min(
        order[k].top,
        order[k + 1].top - Math.max(12, order[k].h + 2),
      );
    }
  }
  const out = new Array<number>(blocks.length).fill(0);
  for (const b of order) out[b.i] = b.top;
  return out;
}

function Panel({
  s,
  pool,
  poolRuns,
  top,
  height,
}: {
  s: Series;
  pool: PooledEvidence | null;
  poolRuns: number;
  top: number;
  height: number;
}) {
  const plotW = W - M.l - M.r;
  const plotH = height - M.t - M.b;
  const [dLo, dHi] = yDomain(s.frames, s.precisionTarget, pool);
  const x = (shots: number) =>
    M.l + (Math.min(shots, s.shotsRequested) / Math.max(1, s.shotsRequested)) * plotW;
  const y = (v: number) => M.t + (1 - (v - dLo) / (dHi - dLo)) * plotH;
  const axisY = M.t + plotH;
  const last = s.frames[s.frames.length - 1];
  const first = s.frames[0];
  const lastHalf = (last.hi - last.lo) / 2;

  // y gridlines on round percent values
  const step = tickStep(dHi - dLo);
  const gridVals: number[] = [];
  for (let v = Math.ceil(dLo / step) * step; v <= dHi + 1e-9; v += step)
    gridVals.push(v);

  const env =
    s.frames.map((f) => `${x(f.shots)},${y(f.hi)}`).join(" ") +
    " " +
    [...s.frames].reverse().map((f) => `${x(f.shots)},${y(f.lo)}`).join(" ");

  // Cost row: Δt between consecutive CLIENT arrivals (see module
  // comment for the caveat); first batch intentionally unlabeled.
  const gaps: Array<{ xPos: number; label: string }> = [];
  for (let i = 1; i < s.frames.length; i++) {
    const a = s.frames[i - 1].at;
    const b = s.frames[i].at;
    if (a != null && b != null)
      gaps.push({
        xPos: x(s.frames[i].shots),
        label: `+${((b - a) / 1000).toFixed(1)}s`,
      });
  }
  const clientSpan =
    first.at != null && last.at != null && s.frames.length > 1
      ? (last.at - first.at) / 1000
      : null;
  const totalSeconds = s.serverSeconds ?? clientSpan;
  const anchor = costAnchor(totalSeconds);

  const stopX = s.stoppedEarly && s.shotsExecuted != null ? x(s.shotsExecuted) : null;
  const shotsSaved =
    s.stoppedEarly && s.shotsExecuted != null
      ? s.shotsRequested - s.shotsExecuted
      : 0;

  // Which side of the stop line the "⏹ stopped here" label sits on.
  // stopTextW is the label's EXPORT width — estimateTextW folds in the
  // ×1.25 PAPER_FONT_BUMP the export pipeline applies to font sizes
  // while positions stay fixed, so the flip/intrude decisions below
  // must budget the bumped text or exported SVGs clip/collide (audit
  // S2; the old hardcoded 330 was the unbumped width). A stop late in
  // the budget would run the text past the 1000px viewBox and clip it
  // — flip to the left of the line when the right side would clip
  // (a stop at the FINAL batch puts the line at the plot's right edge
  // → always flipped). A non-flipped label can still legitimately
  // extend past the plot edge into the right-margin readout column;
  // that overlap is resolved VERTICALLY by stopIntrudes below, not by
  // flipping earlier — the label reads best pointing into the unspent
  // region it annotates.
  const stopLabel = `⏹ stopped here — target reached at ${fmtShots(
    s.shotsExecuted ?? 0,
  )} of ${fmtShots(s.shotsRequested)} shots`;
  const stopTextW = estimateTextW(stopLabel.length, 11);
  const stopLabelFlip = stopX != null && stopX + 8 + stopTextW > W - 4;

  // Right-margin readout placement — the panel's LAYOUT CONTRACT:
  //
  //   * The right margin (x = W - M.r + 10) is ONE readout column with
  //     up to three blocks: the blue final/so-far readout (2 lines),
  //     the amber "target ±" tag (1 line), the green archive-pool tag
  //     (2 lines). In EVERY layout — the single-panel hero view and
  //     the multi-node small multiples alike — the blocks go through
  //     dodgeMarginLabels: sorted by data-driven anchor y, tops pushed
  //     ≥ max(12, blockHeight + 2) px apart (2-line blocks reserve
  //     ~28 px), then clamped back into the plot band. Universality
  //     matters most in the DEFAULT single-panel view: a run that
  //     stops at its precision target has final half-width ≈ target,
  //     so y(point) and y(point + target) nearly coincide and the
  //     final + target labels overprint without the pass. (An older
  //     rule dodged only multi-node panels to keep recorded F0
  //     exports bit-exact — wrong call, the exports are provenance-
  //     backed and regenerable — and its single-panel stand-in, a
  //     "nudge final up 24 px when the pool label is near" rule,
  //     shoved final EXACTLY onto the target tag in the target-stop
  //     case (24 px ≈ the corridor offset at typical zoom). The dodge
  //     subsumes that nudge: pool close to final ⇒ pool is pushed
  //     below final instead.)
  //   * In-plot annotations never enter the column by construction:
  //     the no-target ghost hint is textAnchor=end at the plot's
  //     right edge, and the ⏹ stop label — the one annotation whose
  //     x-range CAN reach the column — owns the top band instead
  //     (stopIntrudes lowers the column's top clamp below it).
  //   * Degradation on short panels: the dodge is two linear sweeps
  //     (push down, pull back inside) — it terminates unconditionally,
  //     and on a band shorter than the pile it lets the pile rise
  //     above the band top while KEEPING the separations, so labels
  //     never overprint and never loop. Multi-node panels (plotH ≈
  //     130 px) fit the worst-case ~68 px pile with room to spare;
  //     no target ⇒ 2 blocks; no archive pool ⇒ ≤ 2 blocks; both
  //     absent ⇒ the final readout alone, clamp-only.
  //
  // The stop text occupies two lines with baselines M.t+12 / M.t+26;
  // when it intrudes into the column's x-range (not flipped, ending
  // past the column start) the band top drops below it so a
  // top-clamped readout can never overprint the stop annotation.
  const stopIntrudes =
    stopX != null && !stopLabelFlip && stopX + 8 + stopTextW > W - M.r + 6;
  const bandTop = M.t + (stopIntrudes ? 38 : 8);
  const blocks: Array<{ anchor: number; h: number }> = [
    // final/so-far readout: value line + successes line
    { anchor: y(last.point) + 3, h: 26 },
  ];
  if (s.precisionTarget != null)
    // Natural anchor = the UPPER corridor line. (If the corridor falls
    // outside the clamped y-domain its lines are skipped below, but
    // the tag still renders — y() extrapolates and the dodge clamps it
    // back into the band; the RULE is worth stating even when its
    // lines are off-scale.)
    blocks.push({ anchor: y(last.point + s.precisionTarget) + 3, h: 10 });
  if (pool) blocks.push({ anchor: y(pool.point) + 3, h: 24 });
  const dodged = dodgeMarginLabels(blocks, bandTop, axisY - 2);
  const finalLabelY = dodged[0];
  let bi = 1;
  const targetLabelY = s.precisionTarget != null ? dodged[bi++] : 0;
  const poolLabelY = pool ? dodged[bi] : 0;

  const titleBits = s.scrubbed
    ? `replay @ batch ${s.frames.length} of ${s.nBatches} — so far: ${fmtShots(last.shots)} shots · point ${fmtPct(last.point, 2)} ± ${fmtPp(lastHalf, 2)}`
    : s.done
      ? `${s.successes ?? "?"}/${fmtShots(s.shotsExecuted ?? 0)} hit the ideal outcome · point ${fmtPct(last.point, 2)} ± ${fmtPp(lastHalf, 2)}`
      : `streaming — batch ${s.frames.length} of ${s.nBatches} · interval ± ${fmtPp(lastHalf, 2)} so far`;

  return (
    <g
      transform={`translate(0 ${top})`}
      role="img"
      aria-label={`evidence funnel for ${s.label}: ${s.frames.length} shot batches, interval ± ${fmtPp((first.hi - first.lo) / 2, 1)} narrowing to ± ${fmtPp(lastHalf, 1)}${s.stoppedEarly ? `, stopped early at ${fmtShots(s.shotsExecuted ?? 0)} of ${fmtShots(s.shotsRequested)} shots` : ""}`}
    >
      {/* panel title */}
      <text x={M.l} y={22} fontSize={14} fontWeight={600} fill="rgb(var(--color-ink))">
        {s.label}
        <title>{GLOSSARY.fidelity}</title>
      </text>
      {/* dx budgets the EXPORT width of the 14px title to its left —
          estimateTextW folds in PAPER_FONT_BUMP so the bumped title
          can't overprint this subtitle in figures (audit S2). */}
      <text x={M.l} y={22} dx={estimateTextW(s.label.length, 14) + 14} fontSize={11} fill="rgb(var(--color-mute))">
        {titleBits}
      </text>

      {/* archived-evidence band (green + FILLED = different hue AND
          mark than this run's blue solid intervals) */}
      {pool && (
        <g>
          <rect
            x={M.l}
            y={y(pool.ci95[1])}
            width={plotW}
            height={Math.max(1, y(pool.ci95[0]) - y(pool.ci95[1]))}
            fill="rgb(var(--color-accent4))"
            opacity={0.09}
          />
          <line x1={M.l} x2={M.l + plotW} y1={y(pool.ci95[1])} y2={y(pool.ci95[1])} stroke="rgb(var(--color-accent4))" strokeWidth={1} strokeDasharray="2 4" opacity={0.55} />
          <line x1={M.l} x2={M.l + plotW} y1={y(pool.ci95[0])} y2={y(pool.ci95[0])} stroke="rgb(var(--color-accent4))" strokeWidth={1} strokeDasharray="2 4" opacity={0.55} />
          <text x={W - M.r + 10} y={poolLabelY} fontSize={10} fill="rgb(var(--color-accent4))">
            <tspan x={W - M.r + 10}>archive: pooled ±{fmtPp(pool.halfWidth, 1)}</tspan>
            <tspan x={W - M.r + 10} dy={12}>
              over {fmtShots(pool.shots)} shots from {poolRuns} run{poolRuns === 1 ? "" : "s"}
            </tspan>
            <title>Evidence this exact configuration already accumulated in your run archive (pooled Wilson interval over all archived shots — valid because replicates of one configuration share the same underlying probability). Exact replays are counted once; scenario-boot runs are excluded. The streaming run adds to this.</title>
          </text>
        </g>
      )}

      {/* y grid + labels */}
      {gridVals.map((v) => (
        <g key={v}>
          <line x1={M.l} x2={M.l + plotW} y1={y(v)} y2={y(v)} stroke="rgb(var(--color-edge))" strokeWidth={1} opacity={0.6} />
          <text x={M.l - 8} y={y(v) + 3} fontSize={10} textAnchor="end" fill="rgb(var(--color-mute))">
            {fmtPct(v, step < 0.01 ? 1 : 0)}
          </text>
        </g>
      ))}
      <text
        transform={`translate(${M.l - 46} ${M.t + plotH / 2}) rotate(-90)`}
        fontSize={11}
        textAnchor="middle"
        fill="rgb(var(--color-mute))"
      >
        fidelity estimate
        <title>{GLOSSARY.fidelity}</title>
      </text>

      {/* unspent budget: the visual reward for stopping early */}
      {stopX != null && (
        <g>
          <rect x={stopX} y={M.t} width={M.l + plotW - stopX} height={plotH} fill="rgb(var(--color-mute))" opacity={0.05} />
          <line x1={stopX} x2={stopX} y1={M.t - 4} y2={axisY} stroke="rgb(var(--color-warn))" strokeWidth={1.5} strokeDasharray="5 3" />
          <text x={stopLabelFlip ? stopX - 8 : stopX + 8} textAnchor={stopLabelFlip ? "end" : "start"} y={M.t + 12} fontSize={11} fontWeight={600} fill="rgb(var(--color-warn))">
            {stopLabel}
            <title>{GLOSSARY.precisionTarget}</title>
          </text>
          <text x={stopLabelFlip ? stopX - 8 : stopX + 8} textAnchor={stopLabelFlip ? "end" : "start"} y={M.t + 26} fontSize={10} fill="rgb(var(--color-mute))">
            {fmtShots(shotsSaved)} shots not spent
          </text>
        </g>
      )}

      {/* optional-stopping target corridor (amber + DASHED) */}
      {s.precisionTarget != null ? (
        <g>
          {/* yDomain extends to point ± 1.6×target but clamps to [0,1];
              with a point near the scale ends a corridor value can fall
              outside the domain, and y() extrapolates — the line used
              to escape the plot into the title area. Skip those. */}
          {[last.point - s.precisionTarget, last.point + s.precisionTarget]
            .filter((v) => v >= dLo && v <= dHi)
            .map((v, i) => (
              <line key={i} x1={M.l} x2={M.l + plotW} y1={y(v)} y2={y(v)} stroke="rgb(var(--color-warn))" strokeWidth={1.2} strokeDasharray="7 4" opacity={0.9} />
            ))}
          <text x={W - M.r + 10} y={targetLabelY} fontSize={10} fill="rgb(var(--color-warn))">
            target ±{fmtPp(s.precisionTarget, 1)}
            <title>{GLOSSARY.precisionTarget}</title>
          </text>
        </g>
      ) : (
        /* ghost affordance: the stopping rule exists even when unused */
        <text x={M.l + plotW - 6} y={M.t + 14} fontSize={10} fontStyle="italic" textAnchor="end" fill="rgb(var(--color-mute))" opacity={0.85}>
          no stopping target — set “target ±pp” in the toolbar and the run stops itself once the interval is this tight
          <title>{GLOSSARY.precisionTarget}</title>
        </text>
      )}

      {/* convergence envelope: the funnel silhouette */}
      {s.frames.length > 1 && (
        <polygon points={env} fill="rgb(var(--color-accent))" opacity={0.1} />
      )}

      {/* per-batch Wilson intervals (vertical), opacity ramps toward now */}
      {/* Composite keys (audit S3): shots_done can repeat across
          frames (a zero-progress batch at an early stop) and duplicate
          React keys drop marks silently. */}
      {s.frames.map((f, i) => (
        <g key={`${i}-${f.shots}`}>
          <line
            x1={x(f.shots)}
            x2={x(f.shots)}
            y1={y(f.hi)}
            y2={y(f.lo)}
            stroke="rgb(var(--color-accent))"
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.35 + (0.55 * (i + 1)) / s.frames.length}
          >
            <title>
              {`batch ${i + 1}: after ${fmtShots(f.shots)} shots — point ${fmtPct(f.point, 2)}, 95% CI ${fmtPct(f.lo, 2)}–${fmtPct(f.hi, 2)} (±${fmtPp((f.hi - f.lo) / 2, 2)})`}
            </title>
          </line>
        </g>
      ))}

      {/* point-estimate path */}
      {s.frames.length > 1 && (
        <polyline
          points={s.frames.map((f) => `${x(f.shots)},${y(f.point)}`).join(" ")}
          fill="none"
          stroke="rgb(var(--color-ink))"
          strokeWidth={1}
          opacity={0.55}
        />
      )}
      {s.frames.map((f, i) => (
        <circle
          key={`${i}-${f.shots}`}
          cx={x(f.shots)}
          cy={y(f.point)}
          r={i === s.frames.length - 1 ? 3.5 : 2.2}
          fill="rgb(var(--color-accent))"
        />
      ))}

      {/* final-interval readout in the right margin */}
      <text x={W - M.r + 10} y={finalLabelY} fontSize={11} fontWeight={600} fill="rgb(var(--color-accent))">
        <tspan x={W - M.r + 10}>{s.done ? "final" : "so far"}: {fmtPct(last.point, 2)} ±{fmtPp(lastHalf, 2)}</tspan>
        <tspan x={W - M.r + 10} dy={13} fontWeight={400} fill="rgb(var(--color-mute))">
          {s.successes != null ? `${fmtShots(s.successes)}/${fmtShots(s.shotsExecuted ?? last.shots)} ideal` : ""}
        </tspan>
        <title>{GLOSSARY.ci}</title>
      </text>

      {/* x axis: shot ticks per batch + the full requested budget */}
      <line x1={M.l} x2={M.l + plotW} y1={axisY} y2={axisY} stroke="rgb(var(--color-mute))" strokeWidth={1} />
      {s.frames.map((f, i) => (
        <g key={`${i}-${f.shots}`}>
          <line x1={x(f.shots)} x2={x(f.shots)} y1={axisY} y2={axisY + 4} stroke="rgb(var(--color-mute))" strokeWidth={1} />
          <text x={x(f.shots)} y={axisY + 15} fontSize={9.5} textAnchor="middle" fill="rgb(var(--color-mute))">
            {fmtShots(f.shots)}
          </text>
        </g>
      ))}
      {last.shots < s.shotsRequested && (
        <g>
          <line x1={x(s.shotsRequested)} x2={x(s.shotsRequested)} y1={axisY} y2={axisY + 4} stroke="rgb(var(--color-mute))" strokeWidth={1} opacity={0.6} />
          <text x={x(s.shotsRequested)} y={axisY + 15} fontSize={9.5} textAnchor="middle" fill="rgb(var(--color-mute))" opacity={0.7}>
            {fmtShots(s.shotsRequested)}
          </text>
        </g>
      )}
      <text x={M.l + plotW / 2} y={axisY + 30} fontSize={11} textAnchor="middle" fill="rgb(var(--color-mute))">
        shots executed (evidence bought) →<title>{GLOSSARY.shots}</title>
      </text>

      {/* cost row: client-arrival Δt per batch (caveat in module doc) */}
      {gaps.length > 0 && (
        <g>
          {gaps.map((g2, i) => (
            <text key={i} x={g2.xPos} y={axisY + 45} fontSize={9} textAnchor="middle" fill="rgb(var(--color-mute))" opacity={0.85}>
              {g2.label}
            </text>
          ))}
          <text x={M.l - 8} y={axisY + 45} fontSize={9} textAnchor="end" fill="rgb(var(--color-mute))" opacity={0.85}>
            wall time
            <title>Gap between consecutive batch arrivals in this browser — server compute plus network, measured client-side. Shots cost time; this row is the price tag, not a benchmark.</title>
          </text>
        </g>
      )}
      <text x={M.l} y={axisY + (gaps.length > 0 ? 60 : 45)} fontSize={10.5} fontWeight={600} fill="rgb(var(--color-ink))">
        evidence spent: {fmtShots(s.shotsExecuted ?? last.shots)}
        {s.shotsRequested > (s.shotsExecuted ?? last.shots) ? ` of ${fmtShots(s.shotsRequested)}` : ""} shots
        {totalSeconds != null ? ` · ${totalSeconds.toFixed(1)} s` : ""}
      </text>

      {/* cost-anchor (marker: cost-anchor): the same duration in the
          field's hard cost numbers — IBM Pay-As-You-Go $1.60/s and
          the Open Plan's 10 min/28d grant (constants + source in
          lib/costModel.ts; grounding: doc §1.2, T2). Honesty label
          inline: the duration is SIMULATOR wall-time, a coarse proxy
          — hardware timing differs. Rendered only when a duration is
          actually known, so archived traces without timing show no
          made-up price. */}
      {anchor != null &&
        (() => {
          const l1 = `on IBM pay-as-you-go this evidence ≈ ${anchor.usd} (est. at $1.60/s hardware time)`;
          const l2 = `· ≈${anchor.freeTierPct} of a free-tier month (10 min/28d) — simulator wall-time as proxy; hardware timing differs`;
          const oneLine = `${l1} ${l2}`;
          // Split into two tspans when the EXPORT-bumped width would
          // run past the panel edge (audit S2: the single line clipped
          // in exported SVGs once PAPER_FONT_BUMP grew it ×1.25).
          const split = estimateTextW(oneLine.length, 9) > W - M.l - 8;
          return (
            <text
              data-marker="cost-anchor"
              x={M.l}
              y={axisY + (gaps.length > 0 ? 73 : 58)}
              fontSize={9}
              fill="rgb(var(--color-mute))"
              opacity={0.9}
            >
              {split ? (
                <>
                  <tspan x={M.l}>{l1}</tspan>
                  <tspan x={M.l} dy={11}>
                    {l2}
                  </tspan>
                </>
              ) : (
                oneLine
              )}
            </text>
          );
        })()}
    </g>
  );
}

// ---------------------------------------------------------------------------
// overlay comparison panel (marker: theater-overlay)
// ---------------------------------------------------------------------------
//
// Two archived runs of ONE configuration on a single axis pair — the
// visual argument that the stopping RULE is deterministic while the
// DRAWS are not: both funnels narrow on the same 1/√n schedule, land
// inside each other's intervals (or visibly don't), and any early
// stop is that run's own draw meeting the shared rule.
//
// Encoding deltas vs the single-run Panel (everything else reuses its
// vocabulary — same axes, same interval/envelope/point marks):
//   * run A = accent/blue, run B = warn/amber; hue is doubled by the
//     A/B legend and per-mark tooltips, and the two series never rely
//     on hue alone (they are also x-dodged, see next).
//   * both runs share the batch grid (same configuration ⇒ same batch
//     plan), so coincident intervals would overprint; each series is
//     x-dodged by a constant ∓3.5 px — sub-batch-width, identical for
//     every batch, so shapes and convergence rates compare honestly.
//   * envelopes drop to opacity .07 (two overlapping .1 fills would
//     read as a third hue).
//   * shared y domain = union of both runs' single-run domains — the
//     overlay never zooms tighter than either run would alone.
//   * target corridor only when BOTH runs executed the SAME rule,
//     anchored at the midpoint of the two final points (the corridor
//     states the rule's width; per-run anchoring would draw two
//     nearly-coincident dashed pairs and imply two rules).
//   * stop annotations dodge into stacked top-band rows (A above B)
//     instead of the single-run flip logic.
function OverlayPanel({
  a,
  b,
  top,
  height,
}: {
  a: Series;
  b: Series;
  top: number;
  height: number;
}) {
  const plotW = W - M.l - M.r;
  const plotH = height - M.t - M.b;
  const shotsRequested = Math.max(a.shotsRequested, b.shotsRequested);
  const sharedTarget =
    a.precisionTarget != null && a.precisionTarget === b.precisionTarget
      ? a.precisionTarget
      : null;
  const [aLo, aHi] = yDomain(a.frames, sharedTarget, null);
  const [bLo, bHi] = yDomain(b.frames, sharedTarget, null);
  const dLo = Math.min(aLo, bLo);
  const dHi = Math.max(aHi, bHi);
  const x = (shots: number) =>
    M.l + (Math.min(shots, shotsRequested) / Math.max(1, shotsRequested)) * plotW;
  const y = (v: number) => M.t + (1 - (v - dLo) / (dHi - dLo)) * plotH;
  const axisY = M.t + plotH;
  const lastA = a.frames[a.frames.length - 1];
  const lastB = b.frames[b.frames.length - 1];

  const step = tickStep(dHi - dLo);
  const gridVals: number[] = [];
  for (let v = Math.ceil(dLo / step) * step; v <= dHi + 1e-9; v += step)
    gridVals.push(v);

  const COLORS = {
    A: "rgb(var(--color-accent))",
    B: "rgb(var(--color-warn))",
  } as const;

  // Right-margin readout column: A final, B final, shared-target tag —
  // same dodge contract as the single-run Panel.
  const midFinal = (lastA.point + lastB.point) / 2;
  const anyStop = a.stoppedEarly || b.stoppedEarly;
  const bandTop = M.t + (anyStop ? 66 : 8);
  const blocks: Array<{ anchor: number; h: number }> = [
    { anchor: y(lastA.point) + 3, h: 26 },
    { anchor: y(lastB.point) + 3, h: 26 },
  ];
  if (sharedTarget != null)
    blocks.push({ anchor: y(midFinal + sharedTarget) + 3, h: 10 });
  const dodged = dodgeMarginLabels(blocks, bandTop, axisY - 2);

  // Union of both runs' batch ticks (identical grids collapse; an
  // early-stopped run simply contributes a prefix).
  const tickShots = [
    ...new Set([...a.frames, ...b.frames].map((f) => f.shots)),
  ].sort((p2, q) => p2 - q);
  const maxShown = Math.max(lastA.shots, lastB.shots);

  const seriesMarks = (s2: Series, key: "A" | "B", dx: number) => {
    const color = COLORS[key];
    const env2 =
      s2.frames.map((f) => `${x(f.shots) + dx},${y(f.hi)}`).join(" ") +
      " " +
      [...s2.frames]
        .reverse()
        .map((f) => `${x(f.shots) + dx},${y(f.lo)}`)
        .join(" ");
    return (
      <g>
        {s2.frames.length > 1 && (
          <polygon points={env2} fill={color} opacity={0.07} />
        )}
        {s2.frames.map((f, i) => (
          <line
            key={`${i}-${f.shots}`}
            x1={x(f.shots) + dx}
            x2={x(f.shots) + dx}
            y1={y(f.hi)}
            y2={y(f.lo)}
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.35 + (0.55 * (i + 1)) / s2.frames.length}
          >
            <title>
              {`run ${key}, batch ${i + 1}: after ${fmtShots(f.shots)} shots — point ${fmtPct(f.point, 2)}, 95% CI ${fmtPct(f.lo, 2)}–${fmtPct(f.hi, 2)} (±${fmtPp((f.hi - f.lo) / 2, 2)})`}
            </title>
          </line>
        ))}
        {s2.frames.length > 1 && (
          <polyline
            points={s2.frames
              .map((f) => `${x(f.shots) + dx},${y(f.point)}`)
              .join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={1}
            opacity={0.6}
          />
        )}
        {s2.frames.map((f, i) => (
          <circle
            key={`${i}-${f.shots}`}
            cx={x(f.shots) + dx}
            cy={y(f.point)}
            r={i === s2.frames.length - 1 ? 3.5 : 2.2}
            fill={color}
          />
        ))}
      </g>
    );
  };

  const stopAnnotation = (s2: Series, key: "A" | "B", row: number) => {
    if (!s2.stoppedEarly || s2.shotsExecuted == null) return null;
    const sx = x(s2.shotsExecuted);
    const ty = M.t + 12 + row * 30;
    // Flip to the right of the line when the default left side would
    // run off the plot (audit S3: the overlay's stop label never
    // flipped — an early stop clipped at the left edge). Same shared
    // estimator as the single view's flip.
    const label = `⏹ ${key} stopped at ${fmtShots(s2.shotsExecuted)} of ${fmtShots(s2.shotsRequested)} shots`;
    const flip = sx - 8 - estimateTextW(label.length, 11) < M.l;
    return (
      <g>
        <line
          x1={sx}
          x2={sx}
          y1={M.t - 4}
          y2={axisY}
          stroke={COLORS[key]}
          strokeWidth={1.5}
          strokeDasharray="5 3"
        />
        <text
          x={flip ? sx + 8 : sx - 8}
          textAnchor={flip ? "start" : "end"}
          y={ty}
          fontSize={11}
          fontWeight={600}
          fill={COLORS[key]}
        >
          {label}
          <title>{GLOSSARY.precisionTarget}</title>
        </text>
      </g>
    );
  };

  const readout = (s2: Series, key: "A" | "B", labelY: number) => {
    const last2 = s2.frames[s2.frames.length - 1];
    const half2 = (last2.hi - last2.lo) / 2;
    return (
      <text x={W - M.r + 10} y={labelY} fontSize={11} fontWeight={600} fill={COLORS[key]}>
        <tspan x={W - M.r + 10}>
          {key} {s2.done ? "final" : "so far"}: {fmtPct(last2.point, 2)} ±{fmtPp(half2, 2)}
        </tspan>
        <tspan x={W - M.r + 10} dy={13} fontWeight={400} fill="rgb(var(--color-mute))">
          {s2.successes != null
            ? `${fmtShots(s2.successes)}/${fmtShots(s2.shotsExecuted ?? last2.shots)} ideal`
            : ""}
        </tspan>
        <title>{GLOSSARY.ci}</title>
      </text>
    );
  };

  const spent = (s2: Series) =>
    `${fmtShots(s2.shotsExecuted ?? s2.frames[s2.frames.length - 1].shots)}${
      s2.shotsRequested > (s2.shotsExecuted ?? 0) && s2.stoppedEarly
        ? ` of ${fmtShots(s2.shotsRequested)}`
        : ""
    } shots${s2.serverSeconds != null ? ` · ${s2.serverSeconds.toFixed(1)} s` : ""}`;

  return (
    <g
      transform={`translate(0 ${top})`}
      role="img"
      data-marker="theater-overlay"
      aria-label={`overlaid evidence funnels of two runs of one configuration: run A ${fmtPct(lastA.point, 2)}, run B ${fmtPct(lastB.point, 2)}`}
    >
      <text x={M.l} y={22} fontSize={14} fontWeight={600} fill="rgb(var(--color-ink))">
        {a.label}
        <title>{GLOSSARY.fidelity}</title>
      </text>
      <text x={M.l} y={22} dx={estimateTextW(a.label.length, 14) + 14} fontSize={11} fill="rgb(var(--color-mute))">
        overlay — A {fmtPct(lastA.point, 2)} ±{fmtPp((lastA.hi - lastA.lo) / 2, 2)} · B {fmtPct(lastB.point, 2)} ±{fmtPp((lastB.hi - lastB.lo) / 2, 2)}
      </text>

      {/* y grid + labels */}
      {gridVals.map((v) => (
        <g key={v}>
          <line x1={M.l} x2={M.l + plotW} y1={y(v)} y2={y(v)} stroke="rgb(var(--color-edge))" strokeWidth={1} opacity={0.6} />
          <text x={M.l - 8} y={y(v) + 3} fontSize={10} textAnchor="end" fill="rgb(var(--color-mute))">
            {fmtPct(v, step < 0.01 ? 1 : 0)}
          </text>
        </g>
      ))}
      <text
        transform={`translate(${M.l - 46} ${M.t + plotH / 2}) rotate(-90)`}
        fontSize={11}
        textAnchor="middle"
        fill="rgb(var(--color-mute))"
      >
        fidelity estimate
        <title>{GLOSSARY.fidelity}</title>
      </text>

      {/* shared target corridor: only when both runs executed the SAME rule */}
      {sharedTarget != null && (
        <g>
          {[midFinal - sharedTarget, midFinal + sharedTarget]
            .filter((v) => v >= dLo && v <= dHi)
            .map((v, i) => (
              <line key={i} x1={M.l} x2={M.l + plotW} y1={y(v)} y2={y(v)} stroke="rgb(var(--color-ink))" strokeWidth={1.2} strokeDasharray="7 4" opacity={0.45} />
            ))}
          <text x={W - M.r + 10} y={dodged[2]} fontSize={10} fill="rgb(var(--color-ink))" opacity={0.8}>
            target ±{fmtPp(sharedTarget, 1)} (both runs)
            <title>{GLOSSARY.precisionTarget}</title>
          </text>
        </g>
      )}

      {/* the two funnels, constant ∓3.5px x-dodge (see module comment) */}
      {seriesMarks(a, "A", -3.5)}
      {seriesMarks(b, "B", 3.5)}
      {stopAnnotation(a, "A", 0)}
      {stopAnnotation(b, "B", a.stoppedEarly ? 1 : 0)}

      {/* final readouts, dodged into the right-margin column */}
      {readout(a, "A", dodged[0])}
      {readout(b, "B", dodged[1])}

      {/* x axis */}
      <line x1={M.l} x2={M.l + plotW} y1={axisY} y2={axisY} stroke="rgb(var(--color-mute))" strokeWidth={1} />
      {tickShots.map((sh) => (
        <g key={sh}>
          <line x1={x(sh)} x2={x(sh)} y1={axisY} y2={axisY + 4} stroke="rgb(var(--color-mute))" strokeWidth={1} />
          <text x={x(sh)} y={axisY + 15} fontSize={9.5} textAnchor="middle" fill="rgb(var(--color-mute))">
            {fmtShots(sh)}
          </text>
        </g>
      ))}
      {maxShown < shotsRequested && (
        <g>
          <line x1={x(shotsRequested)} x2={x(shotsRequested)} y1={axisY} y2={axisY + 4} stroke="rgb(var(--color-mute))" strokeWidth={1} opacity={0.6} />
          <text x={x(shotsRequested)} y={axisY + 15} fontSize={9.5} textAnchor="middle" fill="rgb(var(--color-mute))" opacity={0.7}>
            {fmtShots(shotsRequested)}
          </text>
        </g>
      )}
      <text x={M.l + plotW / 2} y={axisY + 30} fontSize={11} textAnchor="middle" fill="rgb(var(--color-mute))">
        shots executed (evidence bought) →<title>{GLOSSARY.shots}</title>
      </text>
      <text x={M.l} y={axisY + 45} fontSize={10.5} fontWeight={600} fill="rgb(var(--color-ink))">
        evidence spent — A: {spent(a)} · B: {spent(b)}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// the theater
// ---------------------------------------------------------------------------

export function EvidenceTheater() {
  const run = useApp((st) => st.run);
  const running = useApp((st) => st.running);
  const theaterTraces = useApp((st) => st.theaterTraces);
  const theaterRun = useApp((st) => st.theaterRun);
  const storeTarget = useApp((st) => st.precisionTarget);
  const circuit = useApp((st) => st.circuit);
  const sampleKey = useApp((st) => st.sampleKey);
  const setTheaterOpen = useApp((st) => st.setTheaterOpen);
  const overlayIds = useApp((st) => st.theaterOverlayIds);
  const setTheaterOverlay = useApp((st) => st.setTheaterOverlay);
  // Archive changes (a run archived elsewhere, a record deleted from
  // History) must refresh the pooled prior-evidence band below — the
  // created_at < startedAt cutoff keeps the streaming run's own
  // replicates out either way, so re-running the query is idempotent.
  const historyVersion = useApp((st) => st.historyVersion);
  const svgRef = useRef<SVGSVGElement>(null);
  const [autoOpenPref, setAutoOpenPref] = useState(theaterAutoOpenEnabled());

  // Do the displayed run and the retained traces describe the same
  // run? While streaming the partial RunResponse has no run_id yet —
  // that is the ONLY case an id-less run is trustworthy; once finished
  // it must match the run_meta the stream announced. A restored or
  // cache-served run without an id must NOT inherit the previous run's
  // seed / config chips / wall-times.
  const timesTrusted =
    theaterRun != null &&
    (run?.run_id == null ? running : run.run_id === theaterRun.runId);

  const series = useMemo(() => {
    const out: Series[] = [];
    const seen = new Set<string>();
    for (const step of run?.steps ?? []) {
      const s = seriesFromStep(step, theaterTraces[step.node_id], timesTrusted);
      if (s) {
        out.push(s);
        seen.add(s.nodeId);
      }
    }
    // Nodes streaming right now (no StepResult yet).
    if (running) {
      for (const [nodeId, frames] of Object.entries(theaterTraces)) {
        if (seen.has(nodeId) || frames.length === 0) continue;
        const s = seriesFromLive(nodeId, frames, storeTarget);
        if (s) out.push(s);
      }
    }
    return out;
  }, [run, running, theaterTraces, storeTarget, timesTrusted]);

  // Overlay comparison mode (marker: theater-overlay): two archived
  // runs of one configuration, loaded fresh from the archive on every
  // historyVersion bump (either record can be deleted mid-view — the
  // overlay then exits instead of rendering a stale pair).
  const [overlayRecs, setOverlayRecs] = useState<
    [RunRecord, RunRecord] | null
  >(null);
  useEffect(() => {
    if (!overlayIds) {
      setOverlayRecs(null);
      return;
    }
    let cancelled = false;
    Promise.all([getRun(overlayIds[0]), getRun(overlayIds[1])])
      .then(([ra, rb]) => {
        if (cancelled) return;
        if (ra && rb) setOverlayRecs([ra, rb]);
        else setTheaterOverlay(null);
      })
      .catch(() => {
        if (!cancelled) setTheaterOverlay(null);
      });
    return () => {
      cancelled = true;
    };
  }, [overlayIds, historyVersion, setTheaterOverlay]);
  const overlayActive = overlayIds != null;
  const overlayPair = useMemo(() => {
    if (!overlayRecs) return null;
    const a = firstSampledSeries(overlayRecs[0]);
    const b = firstSampledSeries(overlayRecs[1]);
    return a && b ? { a, b } : null;
  }, [overlayRecs]);

  // Trace scrubbing (filmstrip support). Only when the trace is fully
  // known — every series done, nothing streaming — so the live-run
  // path is untouched. null = final state. In overlay mode the traces
  // are archived by construction, and one scrub position drives BOTH
  // series in lockstep (scrubSeries clamps per series, so a pair with
  // different executed-batch counts stays valid at every k).
  const [scrub, setScrub] = useState<number | null>(null);
  const canScrub = overlayActive
    ? overlayPair != null
    : !running && series.length > 0 && series.every((sr) => sr.done);
  const maxB = overlayActive
    ? Math.max(
        overlayPair?.a.frames.length ?? 0,
        overlayPair?.b.frames.length ?? 0,
      )
    : series.reduce((m, sr) => Math.max(m, sr.frames.length), 0);
  const cur = scrub == null ? maxB : Math.min(scrub, maxB);
  useEffect(() => {
    // A new run, a restore (setRun(null) changes run_id), a run
    // finishing (`running` edge) or a newly staged overlay pair each
    // reset to the final, unscrubbed state; closing the theater
    // unmounts it (App gates on theaterOpen), so REOPENING is fresh
    // by construction (audit S3: verified, and the previous draft of
    // this dep list accidentally referenced window.open).
    setScrub(null);
  }, [run?.run_id, running, overlayIds]);
  const shown = useMemo(
    () =>
      canScrub && scrub != null && !overlayActive
        ? series.map((sr) => scrubSeries(sr, scrub))
        : series,
    [series, scrub, canScrub, overlayActive],
  );
  const shownOverlay = useMemo(
    () =>
      overlayPair && scrub != null
        ? {
            a: scrubSeries(overlayPair.a, scrub),
            b: scrubSeries(overlayPair.b, scrub),
          }
        : overlayPair,
    [overlayPair, scrub],
  );

  // Pooled archive evidence for this configuration, restricted to
  // runs archived BEFORE this run started (the band is "prior
  // evidence"; the new run's own record must not pool with itself).
  const [pool, setPool] = useState<{ p: PooledEvidence; n: number } | null>(null);
  useEffect(() => {
    const ch = timesTrusted ? theaterRun?.configHash : null;
    if (!ch) {
      setPool(null);
      return;
    }
    let cancelled = false;
    listRunsByConfig(ch)
      .then((rs) => {
        if (cancelled) return;
        // Honest pool: scenario-boot records are scripted figure
        // states and guided-lesson runs (scenario "L1"…"L4",
        // lib/lessons.ts) are teaching artifacts — neither is prior
        // evidence — and exact replays are counted once (dedupeDraws
        // — the same rule the difference funnel applies).
        const evs = dedupeDraws(
          rs
            .filter(
              (r) =>
                r.ok &&
                r.scenario == null &&
                r.created_at < (theaterRun?.startedAt ?? 0) &&
                r.run_id !== theaterRun?.runId,
            )
            .map((r): DatedEvidence | null => {
              const ev = runEvidence(r.response);
              return ev
                ? { ...ev, created_at: r.created_at, root_seed: r.root_seed }
                : null;
            })
            .filter((e): e is DatedEvidence => e != null),
        );
        const p = evs.length > 0 ? poolEvidence(evs) : null;
        setPool(p ? { p, n: evs.length } : null);
      })
      .catch(() => setPool(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theaterRun?.configHash, theaterRun?.startedAt, theaterRun?.runId, timesTrusted, historyVersion]);

  const configHash = overlayActive
    ? overlayRecs?.[0].config_hash ?? null
    : timesTrusted
      ? theaterRun?.configHash ?? null
      : null;
  const rootSeed = overlayActive
    ? null // overlay legend names both seeds per run instead
    : timesTrusted
      ? theaterRun?.rootSeed ?? run?.root_seed ?? null
      : run?.root_seed ?? null;

  const panelH = overlayActive ? 460 : series.length > 1 ? 250 : 460;
  // Overlay header carries a second line (the per-run A/B legend).
  const headH = overlayActive ? 52 : 34;
  // +14 bottom pad: a split cost-anchor line (see FunnelPanel) adds an
  // 11px second line below the last panel's baseline — without the pad
  // it would clip at the svg edge in the last panel.
  const svgH =
    headH + (overlayActive ? 1 : Math.max(1, series.length)) * panelH + 14;
  const circuitLabel = overlayActive
    ? overlayRecs?.[0].sample_key ?? overlayRecs?.[0].circuit_name ?? "circuit"
    : sampleKey ?? circuit?.name ?? "circuit";
  const hasContent = overlayActive ? shownOverlay != null : series.length > 0;

  return (
    <div
      className="evidence-theater h-full flex flex-col min-h-0"
      data-marker="evidence-theater"
    >
      {/* chrome (never exported: buttons/inputs are stripped, and the
          export target is the <svg> below anyway) */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-edge shrink-0">
        <span className="text-sm font-semibold text-ink">Evidence theater</span>
        <TipIcon
          size={13}
          position="below"
          hint="Watch evidence accumulate while you pay for it: each shot batch tightens the 95% interval; an optional precision target stops the run the moment the interval is tight enough. The trace is recorded per batch server-side, so archived and replayed runs draw the identical picture."
        />
        {running && (
          <span className="chip !border-accent/50 !text-accent animate-pulse">
            streaming
          </span>
        )}
        {overlayActive && (
          <span
            className="chip !border-warn/50 !text-warn"
            title="Comparing two archived replays of one configuration, overlaid on one axis pair. Close the theater (or start a new run) to exit."
          >
            overlay comparison
          </span>
        )}
        <div className="flex-1" />
        <label
          className="flex items-center gap-1.5 text-[11px] text-mute cursor-pointer select-none"
          title="When enabled, this view opens by itself the moment a run with a sampled step starts streaming shot batches."
        >
          <input
            type="checkbox"
            checked={autoOpenPref}
            onChange={(e) => {
              setAutoOpenPref(e.target.checked);
              setTheaterAutoOpenEnabled(e.target.checked);
            }}
          />
          auto-open on streaming runs
        </label>
        <FigureExportButton
          getTarget={() => svgRef.current}
          name={overlayActive ? "evidence-theater-overlay" : "evidence-theater"}
          view="evidence-theater"
          getTracePosition={() =>
            canScrub && scrub != null && cur < maxB ? cur : null
          }
        />
        <button
          type="button"
          className="btn"
          onClick={() => setTheaterOpen(false)}
          aria-label="Close evidence theater"
          title="Close (the toolbar’s theater button reopens it)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* trace scrubber — replayed/archived runs only (trace fully
          known; the live-streaming path never shows this). Chrome, not
          content: the export target is the <svg>, so the scrubber
          itself can never leak into a figure. */}
      {canScrub && maxB > 1 && (
        <div
          className="flex items-center gap-2 px-4 py-1.5 border-b border-edge shrink-0 text-[11px] text-mute"
          data-marker="trace-scrub"
        >
          <span
            title="Replay the archived per-batch trace: the chart renders the run AS OF the selected batch — exactly what the live view showed at that moment. A figure exported while scrubbed captures that state bit-exactly and records trace_position in its provenance (that's how the paper's filmstrip sequences are made)."
            className="select-none"
          >
            trace replay
          </span>
          <button
            type="button"
            className="btn !px-1.5"
            aria-label="Step back one batch"
            disabled={cur <= 1}
            onClick={() => setScrub(Math.max(1, cur - 1))}
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <input
            type="range"
            min={1}
            max={maxB}
            step={1}
            value={cur}
            aria-label="Rendered batch index"
            className="w-40 accent-[rgb(var(--color-accent))]"
            onChange={(e) => {
              const v = Number(e.target.value);
              setScrub(v >= maxB ? null : v);
            }}
          />
          <button
            type="button"
            className="btn !px-1.5"
            aria-label="Step forward one batch"
            disabled={cur >= maxB}
            onClick={() => {
              const v = cur + 1;
              setScrub(v >= maxB ? null : v);
            }}
          >
            <ChevronRight className="w-3 h-3" />
          </button>
          <span className="tabular-nums text-ink select-none">
            batch {cur} of {maxB}
          </span>
          {scrub != null && cur < maxB ? (
            <button
              type="button"
              className="btn"
              onClick={() => setScrub(null)}
              title="Jump back to the final (fully drawn) state"
            >
              final
            </button>
          ) : (
            <span className="opacity-60 select-none">(final state)</span>
          )}
        </div>
      )}

      {!hasContent ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-2">
            <div className="text-sm text-ink font-medium">
              {overlayActive
                ? overlayRecs == null
                  ? "Loading the two runs…"
                  : "These runs carry no sampled per-batch trace to overlay"
                : running
                  ? "Waiting for the first shot batch…"
                  : "No sampled evidence to stage yet"}
            </div>
            {overlayActive ? (
              overlayRecs != null && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setTheaterOverlay(null)}
                >
                  exit overlay
                </button>
              )
            ) : (
              <div className="text-xs text-mute">
                Run a pipeline with a <em>sampled</em> fidelity step and every
                shot batch will land here as it happens — the 95% interval
                narrows live, and a precision target (toolbar: “target ±pp”)
                lets the run stop itself once the evidence is tight enough.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1">
          {/* ONE svg = true-SVG figure export path. maxHeight keeps
              ≤3 small multiples visible; the container scrolls. */}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${svgH}`}
            width="100%"
            style={{ maxWidth: 1400, display: "block", margin: "0 auto" }}
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Evidence theater: streaming confidence-interval funnel"
          >
            {/* context strip (inside the svg so exports carry it) */}
            <g>
              <text x={M.l} y={20} fontSize={12} fill="rgb(var(--color-ink))">
                <tspan fontWeight={600}>{circuitLabel}</tspan>
                <tspan fill="rgb(var(--color-mute))">
                  {overlayActive
                    ? " · two replays of one configuration — same rule, different draws"
                    : " · anytime evidence — every shot batch redraws the 95% interval"}
                </tspan>
              </text>
              {overlayActive && overlayRecs && (
                /* per-run legend: hue keyed to the funnels below; run ids
                   + seeds make the figure self-identifying (which two
                   draws, replayable from which seeds) */
                <text x={M.l} y={40} fontSize={11} fontFamily="ui-monospace, monospace">
                  <tspan fill="rgb(var(--color-accent))" fontWeight={600}>
                    ● A {overlayRecs[0].run_id}
                    {overlayRecs[0].root_seed != null ? ` · seed ${overlayRecs[0].root_seed}` : ""}
                  </tspan>
                  <tspan dx={20} fill="rgb(var(--color-warn))" fontWeight={600}>
                    ● B {overlayRecs[1].run_id}
                    {overlayRecs[1].root_seed != null ? ` · seed ${overlayRecs[1].root_seed}` : ""}
                  </tspan>
                </text>
              )}
              {configHash && (
                <g>
                  <circle cx={W - M.r + 16} cy={16} r={4} fill={hueCss(hashHue(configHash), 0.9)}>
                    <title>{GLOSSARY.configuration}</title>
                  </circle>
                  <text x={W - M.r + 26} y={20} fontSize={11} fill="rgb(var(--color-mute))" fontFamily="ui-monospace, monospace">
                    {configHash}
                    <title>{GLOSSARY.configuration}</title>
                  </text>
                </g>
              )}
              {rootSeed != null && (
                <text x={W - M.r + 110} y={20} fontSize={11} fill="rgb(var(--color-mute))" fontFamily="ui-monospace, monospace">
                  seed {rootSeed}
                  <title>{GLOSSARY.seed}</title>
                </text>
              )}
            </g>
            {overlayActive
              ? shownOverlay && (
                  <OverlayPanel
                    a={shownOverlay.a}
                    b={shownOverlay.b}
                    top={headH}
                    height={panelH}
                  />
                )
              : shown.map((s, i) => (
                  <Panel
                    key={s.nodeId}
                    s={s}
                    pool={shown.length === 1 && pool ? pool.p : null}
                    poolRuns={pool?.n ?? 0}
                    top={headH + i * panelH}
                    height={panelH}
                  />
                ))}
          </svg>
        </div>
      )}
    </div>
  );
}
