import { useEffect, useRef, useState } from "react";
import { Eye, GraduationCap, RotateCcw, Target } from "lucide-react";
import { gloss } from "../../lib/glossary";
import { markLearnLabDone } from "../../lib/learnProgress";
import {
  applyCX,
  applyH2,
  applyReadoutNoise,
  measureOnce,
  mulberry32,
  zero2,
} from "../../lib/quantumToy";
import { wilson95 } from "../../lib/stats";
import { useApp } from "../../lib/store";
import { TipIcon } from "../TipIcon";

/**
 * Step 5 — "How many looks is enough?" Step 4's noisy Bell agreement
 * score (eps pinned at 6%) becomes the quantity under estimation, and
 * the display is a LIVE mini funnel in the Evidence Theater's exact
 * visual grammar — per-batch vertical 95% Wilson interval bars
 * (lib/stats.ts wilson95, THE system-wide interval), a shaded
 * convergence envelope, an ink point path, opacity ramping toward
 * now — at postcard size (460×200 viewBox), so when the learner meets
 * the real funnel it already reads as a known object. Fixed y-domain:
 * the axis never re-zooms under the viewer (same theater rule).
 *
 * "auto to ±2pp" is optional stopping made tactile: batches of 50
 * until the Wilson half-width ≤ 2pp (at the true score ≈ 88.4% that
 * lands near 1000 looks, comfortably inside the 2000-look budget),
 * then a stop line — the workbench's precision target, one step
 * early. Reduced motion: the auto run lands in one synchronous
 * update. Seeded rng → the whole trajectory replays exactly.
 *
 * The handoff footer (marker: learn-complete) closes the loop: mark
 * quda.learnLabDone, then either open the guided lessons directly on
 * L1 (store bridge pendingLessonKey) or just close the overlay.
 */
const SEED = 20260705;
const EPS = 0.06;
const BATCH = 50;
const BUDGET = 2000;
const TARGET_HALF = 0.02;
const BELL = applyCX(applyH2(zero2(), 0));

interface Frame {
  looks: number;
  point: number;
  lo: number;
  hi: number;
}

// funnel geometry — theater grammar at postcard size
const W = 460;
const H = 200;
const M = { l: 44, r: 12, t: 12, b: 26 };
const Y_LO = 0.7;
const Y_HI = 1.0;
const xOf = (looks: number) => M.l + (looks / BUDGET) * (W - M.l - M.r);
const yOf = (p: number) =>
  M.t +
  (1 - (Math.min(Y_HI, Math.max(Y_LO, p)) - Y_LO) / (Y_HI - Y_LO)) *
    (H - M.t - M.b);
const fmtPp = (half: number) => (half * 100).toFixed(1);

export function Step5Certainty() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [stopped, setStopped] = useState<{
    looks: number;
    reached: boolean;
  } | null>(null);
  const [auto, setAuto] = useState(false);
  const rng = useRef(mulberry32(SEED));
  const matchesRef = useRef(0);
  const looksRef = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const oneBatch = (): Frame => {
    for (let i = 0; i < BATCH; i++) {
      const ideal = measureOnce(BELL, rng.current);
      const shown = applyReadoutNoise(ideal, EPS, rng.current);
      if (shown === ideal) matchesRef.current += 1;
    }
    looksRef.current += BATCH;
    const [lo, hi] = wilson95(matchesRef.current, looksRef.current);
    return {
      looks: looksRef.current,
      point: matchesRef.current / looksRef.current,
      lo,
      hi,
    };
  };

  const spent = looksRef.current >= BUDGET;

  const look50 = () => {
    if (auto || spent) return;
    const fr = oneBatch();
    setFrames((f) => [...f, fr]);
  };

  const autoTo2pp = () => {
    if (auto || spent || stopped != null) return;
    const step = (): boolean => {
      const fr = oneBatch();
      setFrames((f) => [...f, fr]);
      const half = (fr.hi - fr.lo) / 2;
      if (half <= TARGET_HALF || fr.looks >= BUDGET) {
        setStopped({ looks: fr.looks, reached: half <= TARGET_HALF });
        return true;
      }
      return false;
    };
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // Sync path: the whole accumulation in one update.
      while (!step()) {
        /* batches until the target or the budget */
      }
      return;
    }
    setAuto(true);
    timer.current = setInterval(() => {
      if (step()) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setAuto(false);
      }
    }, 120);
  };

  const reset = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setAuto(false);
    setFrames([]);
    setStopped(null);
    rng.current = mulberry32(SEED);
    matchesRef.current = 0;
    looksRef.current = 0;
  };

  const handoff = (toLessons: boolean) => {
    markLearnLabDone();
    const app = useApp.getState();
    app.setLearnLabOpen(false);
    if (toLessons) {
      app.setPendingLessonKey("L1");
      app.setLessonsOpen(true);
    }
  };

  const last = frames.length > 0 ? frames[frames.length - 1] : null;
  const lastHalf = last ? (last.hi - last.lo) / 2 : null;
  const env =
    frames.length > 1
      ? frames.map((f) => `${xOf(f.looks)},${yOf(f.hi)}`).join(" ") +
        " " +
        [...frames]
          .reverse()
          .map((f) => `${xOf(f.looks)},${yOf(f.lo)}`)
          .join(" ")
      : "";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[460px]">
        <div className="text-[10px] uppercase tracking-wider text-mute mb-1 flex items-center gap-1">
          agreement score vs looks — noisy machine, 6% noise{" "}
          <TipIcon hint={gloss("ci")} size={10} />
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={
            last
              ? `evidence funnel: after ${last.looks} looks the agreement score is ${Math.round(last.point * 100)}% with a 95% interval of ± ${fmtPp(lastHalf ?? 0)} percentage points${stopped?.reached ? `, stopped at the ±2 point target` : ""}`
              : "empty evidence funnel — no looks bought yet"
          }
        >
          {/* y gridlines, fixed domain (the axis never re-zooms) */}
          {[0.7, 0.8, 0.9, 1.0].map((g) => (
            <g key={g}>
              <line
                x1={M.l}
                x2={W - M.r}
                y1={yOf(g)}
                y2={yOf(g)}
                stroke="rgb(var(--color-edge))"
                strokeWidth={1}
                opacity={0.55}
              />
              <text
                x={M.l - 5}
                y={yOf(g) + 3}
                textAnchor="end"
                fontSize={9}
                fill="rgb(var(--color-mute))"
              >
                {Math.round(g * 100)}%
              </text>
            </g>
          ))}
          {/* x axis: the looks budget */}
          <line
            x1={M.l}
            x2={W - M.r}
            y1={H - M.b}
            y2={H - M.b}
            stroke="rgb(var(--color-mute))"
            strokeWidth={1}
          />
          {[0, 500, 1000, 1500, 2000].map((t) => (
            <g key={t}>
              <line
                x1={xOf(t)}
                x2={xOf(t)}
                y1={H - M.b}
                y2={H - M.b + 4}
                stroke="rgb(var(--color-mute))"
                strokeWidth={1}
              />
              <text
                x={xOf(t)}
                y={H - M.b + 14}
                textAnchor="middle"
                fontSize={9}
                fill="rgb(var(--color-mute))"
              >
                {t === 0 ? "0 looks" : t}
              </text>
            </g>
          ))}
          {/* convergence envelope — the funnel silhouette */}
          {frames.length > 1 && (
            <polygon
              points={env}
              fill="rgb(var(--color-accent))"
              opacity={0.1}
            />
          )}
          {/* per-batch Wilson intervals, opacity ramping toward now */}
          {frames.map((f, i) => (
            <line
              key={f.looks}
              x1={xOf(f.looks)}
              x2={xOf(f.looks)}
              y1={yOf(f.hi)}
              y2={yOf(f.lo)}
              stroke="rgb(var(--color-accent))"
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0.35 + (0.55 * (i + 1)) / frames.length}
            >
              <title>{`after ${f.looks} looks: ${(f.point * 100).toFixed(1)}%, 95% interval ± ${fmtPp((f.hi - f.lo) / 2)}pp`}</title>
            </line>
          ))}
          {/* point path */}
          {frames.length > 1 && (
            <polyline
              points={frames
                .map((f) => `${xOf(f.looks)},${yOf(f.point)}`)
                .join(" ")}
              fill="none"
              stroke="rgb(var(--color-ink))"
              strokeWidth={1}
              opacity={0.55}
            />
          )}
          {frames.map((f, i) => (
            <circle
              key={f.looks}
              cx={xOf(f.looks)}
              cy={yOf(f.point)}
              r={i === frames.length - 1 ? 3.5 : 2.2}
              fill="rgb(var(--color-accent))"
            />
          ))}
          {/* the stop line — optional stopping made visible */}
          {stopped?.reached && (
            <g>
              <line
                x1={xOf(stopped.looks)}
                x2={xOf(stopped.looks)}
                y1={M.t}
                y2={H - M.b}
                stroke="rgb(var(--color-ok))"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <text
                x={xOf(stopped.looks) + 4}
                y={M.t + 9}
                fontSize={9}
                fill="rgb(var(--color-ok))"
              >
                stopped: ±2pp
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          className="btn-primary !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={auto || spent}
          onClick={look50}
        >
          <Eye className="w-3.5 h-3.5" /> look ×50
        </button>
        <button
          type="button"
          className="btn !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={auto || spent || stopped != null}
          onClick={autoTo2pp}
          title="Keep buying batches until the 95% interval is at most ±2 percentage points wide"
        >
          <Target className="w-3.5 h-3.5" /> auto to ±2pp
        </button>
        <button
          type="button"
          className="btn-ghost text-xs disabled:opacity-40"
          disabled={auto || frames.length === 0}
          onClick={reset}
          aria-label="Reset the funnel"
        >
          <RotateCcw className="w-3 h-3" /> reset
        </button>
      </div>

      <p
        className="text-[11px] text-mute text-center tabular-nums"
        aria-live="polite"
      >
        {last == null ? (
          <>no looks yet — every look costs, so buy them in batches of 50</>
        ) : stopped?.reached ? (
          <>
            stopped: ±2pp reached after{" "}
            <span className="text-ink font-mono">{stopped.looks}</span> looks —
            the rest of the budget is yours to keep
          </>
        ) : stopped != null ? (
          <>
            budget spent at {stopped.looks} looks before ±2pp — sometimes
            certainty costs more than you have
          </>
        ) : (
          <>
            after <span className="text-ink font-mono">{last.looks}</span>{" "}
            looks: <span className="text-ink font-mono">
              {Math.round(last.point * 100)}%
            </span>{" "}
            ± <span className="text-ink font-mono">{fmtPp(lastHalf ?? 0)}</span>
            pp — still narrowing
          </>
        )}
      </p>

      {/* handoff — the whole track lands here (marker: learn-complete) */}
      <div
        data-marker="learn-complete"
        className="w-full border-t border-edge/60 pt-3 mt-1 flex flex-col items-center gap-2"
      >
        <p className="text-[11px] text-mute text-center">
          That is the whole workbench:{" "}
          <span className="text-ink">
            real pipelines, honest intervals, evidence you can replay.
          </span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            className="btn-primary !px-2.5 !py-1 text-xs"
            onClick={() => handoff(true)}
          >
            <GraduationCap className="w-3.5 h-3.5" /> Try it on a real
            pipeline — Guided experiments
          </button>
          <button
            type="button"
            className="btn !px-2.5 !py-1 text-xs"
            onClick={() => handoff(false)}
          >
            Explore on my own
          </button>
        </div>
      </div>
    </div>
  );
}
