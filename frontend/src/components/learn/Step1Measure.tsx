import { useEffect, useRef, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { gloss } from "../../lib/glossary";
import { leanState, measureOnce, mulberry32 } from "../../lib/quantumToy";
import { TipIcon } from "../TipIcon";
import { Dial } from "./Dial";
import { Tally } from "./Tally";

/**
 * Step 1 — "Looking collapses the lean." The step-0 dial (same lifted
 * lean) plus a measure button: each look samples 0/1 by the lean via
 * quantumToy, the needle SNAPS to the outcome (fast transition, warn-
 * colored tip), the tally grows bar by bar.
 *
 * THIS IS THE SYSTEM'S WHOLE PREMISE, planted in lesson one: you never
 * observe the underlying quantity, only 0s and 1s drawn with its odds.
 * Every apparatus upstairs — Wilson intervals, evidence funnels,
 * replicates, pooled bands — exists because runs return tallies, not
 * truths. The readout line ("71% landed on 1 — the lean was 70%") is
 * the entire estimation problem in one sentence.
 *
 * Batches animate at ~30ms/draw so the histogram visibly accumulates;
 * under prefers-reduced-motion the batch lands in one update instead.
 */
const SEED = 20260712;

export function Step1Measure({
  lean,
  setLean,
}: {
  lean: number;
  setLean: (p: number) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({ "0": 0, "1": 0 });
  const [snapped, setSnapped] = useState<0 | 1 | null>(null);
  const [running, setRunning] = useState(false);
  const rng = useRef(mulberry32(SEED));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsnap = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      if (unsnap.current) clearTimeout(unsnap.current);
    },
    [],
  );

  const drawOne = (): 0 | 1 => {
    const bit = measureOnce(leanState(lean), rng.current) === "1" ? 1 : 0;
    const k = String(bit);
    setCounts((c) => ({ ...c, [k]: (c[k] ?? 0) + 1 }));
    return bit;
  };

  const settle = () => {
    if (unsnap.current) clearTimeout(unsnap.current);
    unsnap.current = setTimeout(() => setSnapped(null), 380);
  };

  const measure = (n: number) => {
    if (running) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (n === 1) {
      setSnapped(drawOne());
      settle();
      return;
    }
    if (reduced) {
      // One synchronous batch — no stagger for reduced-motion users.
      let last: 0 | 1 = 0;
      const add: Record<string, number> = { "0": 0, "1": 0 };
      for (let i = 0; i < n; i++) {
        const bit = measureOnce(leanState(lean), rng.current) === "1" ? 1 : 0;
        add[String(bit)] += 1;
        last = bit;
      }
      setCounts((c) => ({ "0": c["0"] + add["0"], "1": c["1"] + add["1"] }));
      setSnapped(last);
      settle();
      return;
    }
    setRunning(true);
    let i = 0;
    timer.current = setInterval(() => {
      setSnapped(drawOne());
      if (++i >= n) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setRunning(false);
        settle();
      }
    }, 30);
  };

  const reset = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRunning(false);
    setSnapped(null);
    setCounts({ "0": 0, "1": 0 });
    rng.current = mulberry32(SEED);
  };

  const total = (counts["0"] ?? 0) + (counts["1"] ?? 0);
  const pct1 = total > 0 ? Math.round(((counts["1"] ?? 0) / total) * 100) : 0;
  const leanPct = Math.round(lean * 100);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* The dial is locked during a batch so the readout's "the lean
          was N%" compares against one fixed lean, not a moving one. */}
      <Dial
        value={lean}
        onChange={running ? undefined : setLean}
        snapped={snapped}
        size={210}
      />
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          className="btn-primary !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={running}
          onClick={() => measure(1)}
        >
          <Eye className="w-3.5 h-3.5" /> measure ×1
        </button>
        <TipIcon hint={gloss("measurement")} size={11} />
        <button
          type="button"
          className="btn !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={running}
          onClick={() => measure(20)}
        >
          ×20
        </button>
        <button
          type="button"
          className="btn !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={running}
          onClick={() => measure(100)}
        >
          auto-run 100
        </button>
        <button
          type="button"
          className="btn-ghost text-xs disabled:opacity-40"
          disabled={running || total === 0}
          onClick={reset}
          aria-label="Reset the tally"
        >
          <RotateCcw className="w-3 h-3" /> reset
        </button>
      </div>
      <div className="w-full max-w-xs">
        <Tally counts={counts} order={["0", "1"]} />
      </div>
      <p className="text-[11px] text-mute text-center tabular-nums" aria-live="polite">
        {total === 0 ? (
          <>no looks yet — measure to start the tally</>
        ) : (
          <>
            after {total} look{total === 1 ? "" : "s"}:{" "}
            <span className="text-ink font-mono">{pct1}%</span> landed on 1 —
            the lean was{" "}
            <span className="text-ink font-mono">{leanPct}%</span>
          </>
        )}
      </p>
    </div>
  );
}
