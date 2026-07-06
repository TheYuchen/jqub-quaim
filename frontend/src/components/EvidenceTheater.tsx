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
//     unspent-shots region lightly hatched — the reward for steering,
//     stated in the cost currency (shots not spent).
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
import { listRunsByConfig } from "../lib/runStore";
import {
  poolEvidence,
  runEvidence,
  type Evidence,
  type PooledEvidence,
} from "../lib/stats";
import { hashHue, hueCss } from "../lib/hues";
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
  const anchor = frames[frames.length - 1].point;
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
const M = { l: 66, r: 208, t: 40, b: 66 };

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

  const stopX = s.stoppedEarly && s.shotsExecuted != null ? x(s.shotsExecuted) : null;
  const shotsSaved =
    s.stoppedEarly && s.shotsExecuted != null
      ? s.shotsRequested - s.shotsExecuted
      : 0;
  // Which side of the stop line the "⏹ stopped here" label sits on.
  // The label is ~330px at fontSize 11; a stop late in the budget
  // (e.g. batch 7 of 8 → stopX ≈ 700) used to run the text past the
  // 1000px viewBox and clip it. Flip to the left of the line only when
  // the right side would clip — the threshold keeps the verified F0
  // teaser (stop at 2,560 of 4,096 → stopX ≈ 520, text ends ≈ 858)
  // on its right side, bit-identical to the recorded figure.
  const stopLabelFlip = stopX != null && stopX + 8 + 330 > W - 4;

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
      <text x={M.l} y={22} dx={8 * s.label.length + 14} fontSize={11} fill="rgb(var(--color-mute))">
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
          <text x={W - M.r + 10} y={y(pool.point) + 3} fontSize={10} fill="rgb(var(--color-accent4))">
            <tspan x={W - M.r + 10}>archive: pooled ±{fmtPp(pool.halfWidth, 1)}</tspan>
            <tspan x={W - M.r + 10} dy={12}>
              over {fmtShots(pool.shots)} shots from {poolRuns} run{poolRuns === 1 ? "" : "s"}
            </tspan>
            <title>Evidence this exact configuration already accumulated in your run archive (pooled Wilson interval over all archived shots — valid because replicates of one configuration share the same underlying probability). The streaming run adds to this.</title>
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
            ⏹ stopped here — target reached at {fmtShots(s.shotsExecuted ?? 0)} of {fmtShots(s.shotsRequested)} shots
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
          <text x={W - M.r + 10} y={Math.max(M.t + 8, Math.min(axisY - 4, y(last.point + s.precisionTarget) + 3))} fontSize={10} fill="rgb(var(--color-warn))">
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
      {s.frames.map((f, i) => (
        <g key={f.shots}>
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
          key={f.shots}
          cx={x(f.shots)}
          cy={y(f.point)}
          r={i === s.frames.length - 1 ? 3.5 : 2.2}
          fill="rgb(var(--color-accent))"
        />
      ))}

      {/* final-interval readout in the right margin */}
      <text x={W - M.r + 10} y={y(last.point) - (pool && Math.abs(y(pool.point) - y(last.point)) < 30 ? 24 : 0) + 3} fontSize={11} fontWeight={600} fill="rgb(var(--color-accent))">
        <tspan x={W - M.r + 10}>{s.done ? "final" : "so far"}: {fmtPct(last.point, 2)} ±{fmtPp(lastHalf, 2)}</tspan>
        <tspan x={W - M.r + 10} dy={13} fontWeight={400} fill="rgb(var(--color-mute))">
          {s.successes != null ? `${fmtShots(s.successes)}/${fmtShots(s.shotsExecuted ?? last.shots)} ideal` : ""}
        </tspan>
        <title>{GLOSSARY.ci}</title>
      </text>

      {/* x axis: shot ticks per batch + the full requested budget */}
      <line x1={M.l} x2={M.l + plotW} y1={axisY} y2={axisY} stroke="rgb(var(--color-mute))" strokeWidth={1} />
      {s.frames.map((f) => (
        <g key={f.shots}>
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
  // Archive changes (a run archived elsewhere, a record deleted from
  // History) must refresh the pooled prior-evidence band below — the
  // created_at < startedAt cutoff keeps the streaming run's own
  // replicates out either way, so re-running the query is idempotent.
  const historyVersion = useApp((st) => st.historyVersion);
  const svgRef = useRef<SVGSVGElement>(null);
  const [autoOpenPref, setAutoOpenPref] = useState(theaterAutoOpenEnabled());

  // Do the displayed run and the retained traces describe the same
  // run? While streaming the partial RunResponse has no run_id yet;
  // once finished it must match the run_meta the stream announced.
  // A restored OLD run must not inherit another run's timings/pool.
  const timesTrusted =
    theaterRun != null && (run?.run_id == null || run.run_id === theaterRun.runId);

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

  // Trace scrubbing (filmstrip support). Only when the trace is fully
  // known — every series done, nothing streaming — so the live-run
  // path is untouched. null = final state.
  const [scrub, setScrub] = useState<number | null>(null);
  const canScrub =
    !running && series.length > 0 && series.every((sr) => sr.done);
  const maxB = series.reduce((m, sr) => Math.max(m, sr.frames.length), 0);
  const cur = scrub == null ? maxB : Math.min(scrub, maxB);
  useEffect(() => {
    // A new run (or a restored one) gets a fresh, unscrubbed theater.
    setScrub(null);
  }, [run?.run_id, running]);
  const shown = useMemo(
    () =>
      canScrub && scrub != null
        ? series.map((sr) => scrubSeries(sr, scrub))
        : series,
    [series, scrub, canScrub],
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
        const evs = rs
          .filter(
            (r) =>
              r.ok &&
              r.created_at < (theaterRun?.startedAt ?? 0) &&
              r.run_id !== theaterRun?.runId,
          )
          .map((r) => runEvidence(r.response))
          .filter((e): e is Evidence => e != null);
        const p = evs.length > 0 ? poolEvidence(evs) : null;
        setPool(p ? { p, n: evs.length } : null);
      })
      .catch(() => setPool(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theaterRun?.configHash, theaterRun?.startedAt, theaterRun?.runId, timesTrusted, historyVersion]);

  const configHash = timesTrusted ? theaterRun?.configHash ?? null : null;
  const rootSeed = timesTrusted
    ? theaterRun?.rootSeed ?? run?.root_seed ?? null
    : run?.root_seed ?? null;

  const panelH = series.length > 1 ? 250 : 460;
  const headH = 34;
  const svgH = headH + Math.max(1, series.length) * panelH;
  const circuitLabel = sampleKey ?? circuit?.name ?? "circuit";

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
          name="evidence-theater"
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

      {series.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-2">
            <div className="text-sm text-ink font-medium">
              {running
                ? "Waiting for the first shot batch…"
                : "No sampled evidence to stage yet"}
            </div>
            <div className="text-xs text-mute">
              Run a pipeline with a <em>sampled</em> fidelity step and every
              shot batch will land here as it happens — the 95% interval
              narrows live, and a precision target (toolbar: “target ±pp”)
              lets the run stop itself once the evidence is tight enough.
            </div>
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
                  {" · anytime evidence — every shot batch redraws the 95% interval"}
                </tspan>
              </text>
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
            {shown.map((s, i) => (
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
