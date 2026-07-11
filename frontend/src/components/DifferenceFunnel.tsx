// Difference funnel (marker: difference-funnel) — sequential A/B
// evidence steering, the third funnel scale.
//
// The system already speaks "funnel" at two scales: WITHIN one run
// (the Evidence Theater: a Wilson interval narrowing over shot
// batches) and ACROSS runs of one configuration (the lineage /
// multiverse pooled bands: replicates pooling to a 1/√N-tighter
// interval). This view adds the BETWEEN-configuration scale: the 95%
// interval of the DIFFERENCE Δ(B−A) narrowing as replicates of both
// configurations accumulate chronologically.
//
// Why it exists: comparing two configurations honestly means watching
// the confidence interval of the difference — not eyeballing two
// separate CIs. Overlap of two single-config intervals is only a
// conservative screen (the Compare view has said so since Wave J);
// the difference interval is the actual inferential object. Plotting
// it against total shots consumed turns the Compare tab from a
// display into a sequential-inference instrument: it shows what the
// current verdict is, what it cost, and — crucially — whether an
// early "significant" excursion survived further evidence.
//
// Encoding rationale (each choice justified by the comparison task):
//   * X = CUMULATIVE SHOTS CONSUMED BY BOTH SIDES, linear from 0 —
//     the same "evidence bought" axis philosophy as the theater.
//     Certainty about a difference is purchased with shots on both
//     sides at once, so the honest x-quantity is their sum.
//   * Y = Δ fidelity (B − A) in percentage points, auto-fit to the
//     trace ± padding but ALWAYS including 0: the zero line is the
//     question ("no difference"), so it must never be croppable.
//   * Per-step vertical Newcombe intervals + shaded convergence
//     envelope + point path — the theater's funnel grammar verbatim,
//     in accent, so a reader who has seen one funnel reads this one.
//   * The zero line is a prominent dashed neutral rule labeled in
//     task language ("no difference").
//   * The first step whose interval excludes 0 gets a vertical
//     annotation; it is only GREEN if the exclusion survives through
//     the last step. If a later step re-includes 0, that step gets a
//     warn annotation ("not sustained — treat as inconclusive"):
//     honesty over drama. MULTIPLE-LOOKS CAVEAT: re-checking a 95%
//     interval at every accumulation step inflates type-I error,
//     the same limitation family as the theater's optional stopping
//     (M2 disclosure in docs/EVIDENCE_WORKBENCH.md); the "not
//     sustained" wording and the glossary's `established` entry
//     carry that caveat into the UI.
//   * Never-excluded traces get a plain end-state readout
//     ("difference not established after N shots") — a null result
//     stated as a result, not an apology.
//   * Source data: ALL archived ok runs of EACH side's config_hash —
//     the two selected runs merely name the configurations. Pinned
//     replays are deduped (same root seed = bit-identical draw; see
//     stats.dedupeDraws) so the same evidence is never pooled twice.
//   * CROSS-CIRCUIT GATE: fidelity is defined per circuit, so when
//     the two named configurations executed DIFFERENT circuits the
//     assembly refuses (status "different-circuit") and the view
//     renders an honest one-liner instead of a plot — Δ between two
//     different quantities is not an inferential object at all.
//
// The chart is ONE <svg> subtree (svgPaper conventions: colors via
// rgb(var(--color-*)) resolved at export time, real <text> nodes), so
// both export paths work: the Evidence-pane camera captures it inside
// the hybrid Compare-tab figure, and its own camera takes the
// true-SVG path. Contributing run ids are published to the store so
// evidence-compare provenance names every run the funnel pooled.

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/store";
import { listRunsByConfig, type RunRecord } from "../lib/runStore";
import {
  dedupeDraws,
  differenceTrace,
  differenceVerdict,
  runEvidence,
  type DatedEvidence,
  type DifferenceStep,
  type DifferenceVerdict,
} from "../lib/stats";
import { hashHue, hueCss } from "../lib/hues";
import { GLOSSARY } from "../lib/glossary";
import { estimateTextW } from "../lib/svgPaper";
import { FigureExportButton } from "./FigureExportButton";
import { TipIcon } from "./TipIcon";

// ---------------------------------------------------------------------------
// data assembly
// ---------------------------------------------------------------------------

interface SideMeta {
  configHash: string;
  /** Unique draws pooled (post replay-dedup). */
  nDraws: number;
  shots: number;
  successes: number;
}

export type DifferenceData =
  /** Loading, or no pair staged. */
  | null
  /** Same configuration on both sides — Δ of a config against itself
   *  is vacuous; that pair's instrument is the theater overlay. */
  | { status: "same-config" }
  /** Different CIRCUITS on the two sides — fidelity is defined per
   *  circuit, so an interval on Δ(B−A) would compare two different
   *  quantities. Trace assembly refuses before pooling anything;
   *  regression tripwire in scripts/check_difference_funnel.test.ts. */
  | { status: "different-circuit"; a: string; b: string }
  /** Configs differ but a side lacks replicates for a trace. */
  | { status: "insufficient"; nA: number; nB: number }
  | {
      status: "ready";
      steps: DifferenceStep[];
      verdict: DifferenceVerdict;
      a: SideMeta;
      b: SideMeta;
      /** Every archived run whose counts the trace pooled. */
      runIds: string[];
    };

type DatedRunEvidence = DatedEvidence & { run_id: string };

/** Gather each side's full config group from the archive and reduce
 *  it to the difference trace. Exposed as a hook (rather than fetched
 *  inside the component) so CompareView can defer its verdict wording
 *  to the funnel exactly when the funnel will actually render. */
export function useDifferenceEvidence(
  a: RunRecord | null,
  b: RunRecord | null,
): DifferenceData {
  // Deleting an archived run must recompute the trace (same reason
  // CompareView re-looks-up its pair on historyVersion bumps).
  const historyVersion = useApp((s) => s.historyVersion);
  const [data, setData] = useState<DifferenceData>(null);
  const aId = a?.run_id ?? null;
  const bId = b?.run_id ?? null;
  const aHash = a?.config_hash ?? null;
  const bHash = b?.config_hash ?? null;
  // Circuit identity — the computeConfigHash circuitTag convention
  // (lib/runStore.ts), so this gate can never disagree with config
  // identity. Human-readable labels ride along for the refusal line.
  const aCircuitId = a ? a.sample_key ?? `upload:${a.circuit_name ?? "?"}` : null;
  const bCircuitId = b ? b.sample_key ?? `upload:${b.circuit_name ?? "?"}` : null;
  const aCircuitLabel = a ? a.sample_key ?? a.circuit_name ?? "uploaded circuit" : null;
  const bCircuitLabel = b ? b.sample_key ?? b.circuit_name ?? "uploaded circuit" : null;
  useEffect(() => {
    if (aHash == null || bHash == null) {
      setData(null);
      return;
    }
    if (aHash === bHash) {
      setData({ status: "same-config" });
      return;
    }
    if (aCircuitId !== bCircuitId) {
      // Cross-circuit gate: refuse to assemble a difference trace at
      // all. Plotting Δ fidelity across two different circuits would
      // be statistically meaningless; an honest instrument says so
      // instead of drawing something.
      setData({
        status: "different-circuit",
        a: aCircuitLabel ?? "?",
        b: bCircuitLabel ?? "?",
      });
      return;
    }
    let cancelled = false;
    Promise.all([listRunsByConfig(aHash), listRunsByConfig(bHash)])
      .then(([runsA, runsB]) => {
        if (cancelled) return;
        const prep = (runs: RunRecord[]): DatedRunEvidence[] =>
          dedupeDraws(
            runs.flatMap((r) => {
              if (!r.ok) return [];
              const ev = runEvidence(r.response);
              return ev
                ? [
                    {
                      run_id: r.run_id,
                      created_at: r.created_at,
                      root_seed: r.root_seed,
                      successes: ev.successes,
                      shots: ev.shots,
                    },
                  ]
                : [];
            }),
          );
        const A = prep(runsA);
        const B = prep(runsB);
        if (A.length < 2 || B.length < 2) {
          setData({ status: "insufficient", nA: A.length, nB: B.length });
          return;
        }
        const steps = differenceTrace(A, B);
        const verdict = differenceVerdict(steps);
        if (!verdict) {
          setData({ status: "insufficient", nA: A.length, nB: B.length });
          return;
        }
        const meta = (
          hash: string,
          side: DatedRunEvidence[],
        ): SideMeta => ({
          configHash: hash,
          nDraws: side.length,
          shots: side.reduce((s, r) => s + r.shots, 0),
          successes: side.reduce((s, r) => s + r.successes, 0),
        });
        setData({
          status: "ready",
          steps,
          verdict,
          a: meta(aHash, A),
          b: meta(bHash, B),
          runIds: [...A, ...B].map((r) => r.run_id),
        });
      })
      .catch(() => setData(null));
    return () => {
      cancelled = true;
    };
  }, [
    aId,
    bId,
    aHash,
    bHash,
    aCircuitId,
    bCircuitId,
    aCircuitLabel,
    bCircuitLabel,
    historyVersion,
  ]);
  return data;
}

// ---------------------------------------------------------------------------
// formatting + scales
// ---------------------------------------------------------------------------

const fmtShots = (n: number) => Math.round(n).toLocaleString("en-US");
/** Abbreviated shot ticks: 2500 → "2.5k", 5000 → "5k". */
const fmtK = (n: number) =>
  n >= 1000
    ? n % 1000 === 0
      ? `${n / 1000}k`
      : `${(n / 1000).toFixed(1)}k`
    : `${n}`;
/** Signed Δ in percentage points: +3.9pp. */
const fmtDpp = (v: number, dp = 1) =>
  `${v > 0 ? "+" : ""}${(v * 100).toFixed(dp)}pp`;

/** Round-valued shot ticks, ≤ ~7 over the span. */
function shotTickStep(span: number): number {
  for (const s of [100, 200, 500, 1000, 2000, 2500, 5000, 10000, 25000, 50000])
    if (span / s <= 6.5) return s;
  return 100000;
}

/** Δ-axis tick step (fractions), 3–7 gridlines over the span. */
function ppTickStep(span: number): number {
  for (const s of [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2])
    if (span / s <= 6.5) return s;
  return 0.25;
}

// ---------------------------------------------------------------------------
// the chart
// ---------------------------------------------------------------------------

/** Export-path viewBox width — the documented F8 figure geometry.
 *  The pane render passes a container-derived width instead (two-tier,
 *  audit S2) so labels keep ≥9px effective size in narrow panes. */
const EXPORT_W = 760;
const H = 312;
const M = { l: 58, r: 168, t: 62, b: 56 };

function Chart({
  data,
  w = EXPORT_W,
}: {
  data: Extract<NonNullable<DifferenceData>, { status: "ready" }>;
  /** viewBox width. Pane renders derive it from the container; the
   *  hidden export twin keeps the documented EXPORT_W geometry. */
  w?: number;
}) {
  const { steps, verdict, a, b } = data;
  const plotW = w - M.l - M.r;
  const plotH = H - M.t - M.b;
  const axisY = M.t + plotH;
  const final = verdict.final;

  // X: 0 → total shots consumed (evidence bought, both sides).
  const maxShots = final.shots;
  const x = (shots: number) => M.l + (shots / Math.max(1, maxShots)) * plotW;

  // Y: auto-fit to the trace ± padding, ALWAYS including 0.
  let dLo = 0;
  let dHi = 0;
  for (const s of steps) {
    dLo = Math.min(dLo, s.lo);
    dHi = Math.max(dHi, s.hi);
  }
  const pad = (dHi - dLo) * 0.08 || 0.01;
  dLo -= pad;
  dHi += pad;
  const y = (v: number) => M.t + (1 - (v - dLo) / (dHi - dLo)) * plotH;

  // gridlines: Δ axis on round pp values (index-based, no float drift)
  const yStep = ppTickStep(dHi - dLo);
  const gridVals: number[] = [];
  for (let i = Math.ceil(dLo / yStep); i * yStep <= dHi + 1e-12; i++)
    gridVals.push(i * yStep);
  const xStep = shotTickStep(maxShots);
  const xTicks: number[] = [];
  for (let v = xStep; v <= maxShots + 1e-9; v += xStep) xTicks.push(v);

  const env =
    steps.map((s) => `${x(s.shots)},${y(s.hi)}`).join(" ") +
    " " +
    [...steps]
      .reverse()
      .map((s) => `${x(s.shots)},${y(s.lo)}`)
      .join(" ");

  const est = verdict.establishedAt;
  const lost = verdict.lostAt;
  const estColor = verdict.sustained
    ? "rgb(var(--color-ok))"
    : "rgb(var(--color-warn))";
  // Flip the established label to the left of its line when the text
  // would run into the right readout column (same flip rule as the
  // theater's stop annotation).
  const EST_TEXT_W = 340;
  const estFlip = est != null && x(est.shots) + 8 + EST_TEXT_W > w - M.r;
  const LOST_TEXT_W = 350;
  const lostFlip = lost != null && x(lost.shots) - 8 - LOST_TEXT_W < M.l;

  // Right-margin readout: one block, clamped into the plot band.
  const finalHalf = (final.hi - final.lo) / 2;
  const readoutY = Math.max(M.t + 14, Math.min(y(final.d) + 3, axisY - 30));
  const readout: { head: string; headFill: string; lines: string[] } =
    verdict.sustained && est != null
      ? {
          head: `established: Δ${fmtDpp(final.d, 2)}`,
          headFill: "rgb(var(--color-ok))",
          lines: [
            `[${fmtDpp(final.lo, 2)}, ${fmtDpp(final.hi, 2)}] excludes 0`,
            `over ${fmtShots(final.shots)} shots`,
          ],
        }
      : est != null
        ? {
            head: "inconclusive",
            headFill: "rgb(var(--color-warn))",
            lines: [
              `final Δ${fmtDpp(final.d, 2)} ±${(finalHalf * 100).toFixed(2)}pp`,
              `[${fmtDpp(final.lo, 2)}, ${fmtDpp(final.hi, 2)}] includes 0`,
            ],
          }
        : {
            head: "not established",
            headFill: "rgb(var(--color-mute))",
            lines: [
              `after ${fmtShots(final.shots)} shots`,
              `Δ${fmtDpp(final.d, 2)} ±${(finalHalf * 100).toFixed(2)}pp`,
            ],
          };

  const legendSide = (key: "A" | "B", m: SideMeta) =>
    `${key} ${m.nDraws} draws · ${fmtShots(m.shots)} shots · cfg ${m.configHash}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${H}`}
      width="100%"
      style={{ maxWidth: 900, display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
      data-marker="difference-funnel"
      role="img"
      aria-label={`difference funnel: 95% interval of the fidelity difference between configuration B (${b.nDraws} runs) and configuration A (${a.nDraws} runs) over ${fmtShots(final.shots)} accumulated shots — ${readout.head}`}
    >
      {/* context strip (inside the svg so exports self-identify) */}
      <text x={M.l} y={18} fontSize={12.5} fontWeight={600} fill="rgb(var(--color-ink))">
        Δ(B−A) fidelity, all archived replicates
        <title>{GLOSSARY.differenceInterval}</title>
      </text>
      {(() => {
        const la = legendSide("A", a);
        const lb = legendSide("B", b);
        // One line only when both sides fit the current width (the
        // estimate budgets the export font bump); otherwise stack —
        // at pane-tier widths a single line clipped B entirely.
        const oneLine =
          estimateTextW(la.length + lb.length + 6, 10.5) + 24 <=
          w - M.l - 8;
        return oneLine ? (
          <text x={M.l} y={36} fontSize={10.5} fontFamily="ui-monospace, monospace">
            <tspan fill={hueCss(hashHue(a.configHash), 0.95)}>●</tspan>
            <tspan dx={4} fill="rgb(var(--color-mute))">{la}</tspan>
            <tspan dx={16} fill={hueCss(hashHue(b.configHash), 0.95)}>●</tspan>
            <tspan dx={4} fill="rgb(var(--color-mute))">{lb}</tspan>
            <title>{GLOSSARY.configuration}</title>
          </text>
        ) : (
          <>
            <text x={M.l} y={34} fontSize={10.5} fontFamily="ui-monospace, monospace">
              <tspan fill={hueCss(hashHue(a.configHash), 0.95)}>●</tspan>
              <tspan dx={4} fill="rgb(var(--color-mute))">{la}</tspan>
              <title>{GLOSSARY.configuration}</title>
            </text>
            <text x={M.l} y={47} fontSize={10.5} fontFamily="ui-monospace, monospace">
              <tspan fill={hueCss(hashHue(b.configHash), 0.95)}>●</tspan>
              <tspan dx={4} fill="rgb(var(--color-mute))">{lb}</tspan>
              <title>{GLOSSARY.configuration}</title>
            </text>
          </>
        );
      })()}

      {/* Δ gridlines */}
      {gridVals.map((v) => (
        <g key={v}>
          <line
            x1={M.l}
            x2={M.l + plotW}
            y1={y(v)}
            y2={y(v)}
            stroke="rgb(var(--color-edge))"
            strokeWidth={1}
            opacity={Math.abs(v) < 1e-12 ? 0 : 0.6}
          />
          <text x={M.l - 7} y={y(v) + 3} fontSize={10} textAnchor="end" fill="rgb(var(--color-mute))">
            {Math.abs(v) < 1e-12 ? "0" : fmtDpp(v, yStep < 0.01 ? 1 : 0)}
          </text>
        </g>
      ))}
      <text
        transform={`translate(${M.l - 44} ${M.t + plotH / 2}) rotate(-90)`}
        fontSize={11}
        textAnchor="middle"
        fill="rgb(var(--color-mute))"
      >
        Δ fidelity (B − A)
        <title>{GLOSSARY.differenceInterval}</title>
      </text>

      {/* THE ZERO LINE — the question itself, always in frame */}
      <line
        x1={M.l}
        x2={M.l + plotW}
        y1={y(0)}
        y2={y(0)}
        stroke="rgb(var(--color-ink))"
        strokeWidth={1.4}
        strokeDasharray="7 4"
        opacity={0.55}
      />
      <text
        x={M.l + plotW - 4}
        y={y(0) - 5}
        fontSize={10}
        textAnchor="end"
        fill="rgb(var(--color-ink))"
        opacity={0.75}
      >
        no difference
        <title>{GLOSSARY.differenceInterval}</title>
      </text>

      {/* convergence envelope + per-step Newcombe intervals + points
          (theater funnel grammar, accent hue) */}
      {steps.length > 1 && (
        <polygon points={env} fill="rgb(var(--color-accent))" opacity={0.1} />
      )}
      {steps.map((s, i) => (
        <line
          key={s.step}
          x1={x(s.shots)}
          x2={x(s.shots)}
          y1={y(s.hi)}
          y2={y(s.lo)}
          stroke="rgb(var(--color-accent))"
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.35 + (0.55 * (i + 1)) / steps.length}
        >
          <title>
            {`step ${s.step} — A: ${s.nRunsA} run${s.nRunsA === 1 ? "" : "s"}, ${fmtShots(s.successesA)}/${fmtShots(s.shotsA)} · B: ${s.nRunsB} run${s.nRunsB === 1 ? "" : "s"}, ${fmtShots(s.successesB)}/${fmtShots(s.shotsB)} · Δ(B−A) ${fmtDpp(s.d, 2)}, 95% CI [${fmtDpp(s.lo, 2)}, ${fmtDpp(s.hi, 2)}] (Newcombe) — ${s.established ? "excludes 0" : "includes 0"}`}
          </title>
        </line>
      ))}
      {steps.length > 1 && (
        <polyline
          points={steps.map((s) => `${x(s.shots)},${y(s.d)}`).join(" ")}
          fill="none"
          stroke="rgb(var(--color-ink))"
          strokeWidth={1}
          opacity={0.55}
        />
      )}
      {steps.map((s, i) => (
        <circle
          key={s.step}
          cx={x(s.shots)}
          cy={y(s.d)}
          r={i === steps.length - 1 ? 3.5 : 2.2}
          fill="rgb(var(--color-accent))"
        />
      ))}

      {/* first exclusion of zero — green ONLY if it survived */}
      {est != null && (
        <g>
          <line
            x1={x(est.shots)}
            x2={x(est.shots)}
            y1={M.t - 4}
            y2={axisY}
            stroke={estColor}
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          <text
            x={estFlip ? x(est.shots) - 8 : x(est.shots) + 8}
            textAnchor={estFlip ? "end" : "start"}
            y={M.t + 12}
            fontSize={10.5}
            fontWeight={600}
            fill={estColor}
          >
            difference established at {fmtShots(est.shots)} shots — Δ{fmtDpp(est.d, 1)} [{fmtDpp(est.lo, 1)}, {fmtDpp(est.hi, 1)}]
            <title>{GLOSSARY.established}</title>
          </text>
        </g>
      )}
      {/* ...and the step that took it back (multiple-looks honesty) */}
      {lost != null && (
        <g>
          <line
            x1={x(lost.shots)}
            x2={x(lost.shots)}
            y1={M.t - 4}
            y2={axisY}
            stroke="rgb(var(--color-warn))"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          <text
            x={lostFlip ? x(lost.shots) + 8 : x(lost.shots) - 8}
            textAnchor={lostFlip ? "start" : "end"}
            y={M.t + 28}
            fontSize={10.5}
            fontWeight={600}
            fill="rgb(var(--color-warn))"
          >
            re-includes 0 at {fmtShots(lost.shots)} shots — not sustained, treat as inconclusive
            <title>{GLOSSARY.established}</title>
          </text>
        </g>
      )}

      {/* final readout, right margin */}
      <text x={w - M.r + 10} y={readoutY} fontSize={11} fontWeight={600} fill={readout.headFill}>
        <tspan x={w - M.r + 10}>{readout.head}</tspan>
        {readout.lines.map((l, i) => (
          <tspan key={i} x={w - M.r + 10} dy={13} fontWeight={400} fill="rgb(var(--color-mute))">
            {l}
          </tspan>
        ))}
        <title>{GLOSSARY.established}</title>
      </text>

      {/* x axis: round shot ticks (abbreviated) */}
      <line x1={M.l} x2={M.l + plotW} y1={axisY} y2={axisY} stroke="rgb(var(--color-mute))" strokeWidth={1} />
      {xTicks.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={axisY} y2={axisY + 4} stroke="rgb(var(--color-mute))" strokeWidth={1} />
          <text x={x(v)} y={axisY + 15} fontSize={9.5} textAnchor="middle" fill="rgb(var(--color-mute))">
            {fmtK(v)}
          </text>
        </g>
      ))}
      <text x={M.l + plotW / 2} y={axisY + 30} fontSize={11} textAnchor="middle" fill="rgb(var(--color-mute))">
        shots consumed by both configurations (evidence bought) →
        <title>{GLOSSARY.shots}</title>
      </text>
      <text x={M.l} y={axisY + 46} fontSize={10.5} fontWeight={600} fill="rgb(var(--color-ink))">
        evidence consumed: {fmtShots(final.shots)} shots across {a.nDraws + b.nDraws} runs
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// host block (chrome + empty states)
// ---------------------------------------------------------------------------

export function DifferenceFunnel({ data }: { data: DifferenceData }) {
  const setDifferenceRunIds = useApp((s) => s.setDifferenceRunIds);
  const svgHost = useRef<HTMLDivElement | null>(null);
  const exportHost = useRef<HTMLDivElement | null>(null);
  // Pane tier of the two-tier viewBox width (audit S2): track the host
  // width so the visible chart's viewBox ≈ container width and its
  // 9.5-12.5px labels render at (near-)native size instead of being
  // scaled to ~5px in a narrow Evidence pane.
  const [hostW, setHostW] = useState<number | null>(null);
  const ready = data != null && data.status === "ready" ? data : null;
  const runIdsKey = ready ? ready.runIds.join(",") : null;

  // Publish the contributing runs for figure-export provenance while
  // (and only while) the funnel is actually on screen.
  useEffect(() => {
    setDifferenceRunIds(runIdsKey ? runIdsKey.split(",") : null);
    return () => setDifferenceRunIds(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runIdsKey]);

  const insufficient = useMemo(
    () => (data != null && data.status === "insufficient" ? data : null),
    [data],
  );

  const hasChart = ready != null;
  useEffect(() => {
    const el = svgHost.current;
    if (!hasChart || el == null || typeof ResizeObserver === "undefined")
      return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) setHostW(Math.round(cw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasChart]);

  if (data == null || data.status === "same-config") return null;

  if (data.status === "different-circuit") {
    return (
      <div
        data-marker="different-circuits-gate"
        className="text-[10px] border border-warn/40 rounded p-2 space-y-0.5"
      >
        <div className="flex items-center gap-1 text-mute">
          <span className="uppercase tracking-wider">difference funnel</span>
          <TipIcon hint={GLOSSARY.differenceInterval} />
        </div>
        <div className="text-warn">
          different circuits — fidelity differences are not comparable
        </div>
        <div className="text-mute">
          A ran {data.a}, B ran {data.b}. Fidelity is defined per circuit, so
          an interval on Δ(B−A) would compare two different quantities. Select
          two configurations of the same circuit to accumulate an A/B verdict
          here.
        </div>
      </div>
    );
  }

  if (insufficient) {
    return (
      <div className="text-[10px] text-mute border border-edge/60 rounded p-2 space-y-0.5">
        <div className="flex items-center gap-1">
          <span className="uppercase tracking-wider">difference funnel</span>
          <TipIcon hint={GLOSSARY.differenceInterval} />
        </div>
        <div>
          Needs at least 2 archived replicates of each configuration to put an
          interval on the difference — A has {insufficient.nA}, B has{" "}
          {insufficient.nB} (exact replays count once). Run each configuration
          a few more times and the honest A-vs-B verdict will accumulate here.
        </div>
      </div>
    );
  }

  if (!ready) return null;
  // Pane tier: viewBox ≈ container (floored at 420 so the readout
  // column can't crush the plot); export tier stays EXPORT_W.
  const chartW =
    hostW == null ? EXPORT_W : Math.min(EXPORT_W, Math.max(420, hostW));
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-mute">
          difference funnel
        </span>
        <TipIcon hint={GLOSSARY.differenceInterval} />
        <span className="ml-auto">
          <FigureExportButton
            getTarget={() =>
              exportHost.current?.querySelector("svg") as SVGSVGElement | null
            }
            name="difference-funnel"
            view="evidence-compare"
          />
        </span>
      </div>
      <div ref={svgHost}>
        <Chart data={ready} w={chartW} />
      </div>
      {/* Hidden export twin at the documented EXPORT_W geometry (audit
          S2: pane scaling must not change exported figures). Offscreen
          but rendered, so computed styles resolve for the true-SVG
          serializer; data-export-strip keeps it out of whole-pane
          exports (the funnel's own export button above targets it
          directly). */}
      <div
        ref={exportHost}
        data-export-strip
        aria-hidden
        style={{
          position: "absolute",
          left: -99999,
          top: 0,
          width: EXPORT_W,
          pointerEvents: "none",
        }}
      >
        <Chart data={ready} />
      </div>
      {/* legend line (HTML so it stays legible at pane scale) */}
      <div className="text-[10px] text-mute flex items-center gap-1 flex-wrap">
        <span>
          bars = 95% interval of Δ(B−A) per accumulation step (Newcombe) ·
          band = convergence envelope · dashed = no difference
        </span>
        <TipIcon hint={GLOSSARY.established} />
      </div>
    </div>
  );
}
