import { useRef, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { gloss } from "../../lib/glossary";
import {
  applyCX,
  applyH2,
  applyReadoutNoise,
  measureOnce,
  mulberry32,
  zero2,
} from "../../lib/quantumToy";
import { TipIcon } from "../TipIcon";
import { BellRecipe } from "./BellRecipe";
import { PairGrid } from "./PairGrid";
import { useDrawLoop } from "./useDrawLoop";

/**
 * Step 4 — "Real machines misread." Same Bell recipe, same 2×2 grid,
 * but now a machine switch: the perfect machine reports each draw
 * as-is, the noisy one pushes every reported bit through
 * applyReadoutNoise (the symmetric readout-error model — the same
 * model the backend's fake devices carry, measured from real device
 * calibration). The 01/10 cells LEAK warn-tinted counts, and the
 * agreement score = fraction of looks whose REPORTED pair matches
 * what the machine actually drew — an honest per-draw fidelity the
 * learner watches degrade as the eps slider rises (at 6% noise the
 * score settles near 88%, because BOTH bits must survive:
 * 0.94 × 0.94). Machine/eps changes reset the seeded rng, so every
 * setting replays deterministically.
 */
const SEED = 20260704;
const BELL = applyCX(applyH2(zero2(), 0));
const EMPTY: Record<string, number> = { "00": 0, "01": 0, "10": 0, "11": 0 };

export function Step4Noise() {
  const [noisy, setNoisy] = useState(false);
  const [eps, setEps] = useState(0.06);
  const [counts, setCounts] = useState<Record<string, number>>({ ...EMPTY });
  const [matches, setMatches] = useState(0);
  const rng = useRef(mulberry32(SEED));

  const { running, run, stop } = useDrawLoop(() => {
    const ideal = measureOnce(BELL, rng.current);
    const shown = noisy ? applyReadoutNoise(ideal, eps, rng.current) : ideal;
    setCounts((c) => ({ ...c, [shown]: (c[shown] ?? 0) + 1 }));
    if (shown === ideal) setMatches((m) => m + 1);
  });

  const reset = () => {
    stop();
    setCounts({ ...EMPTY });
    setMatches(0);
    rng.current = mulberry32(SEED);
  };

  const pickMachine = (n: boolean) => {
    if (n === noisy) return;
    setNoisy(n);
    reset(); // different reporting → fresh deterministic tally
  };

  const setNoise = (e: number) => {
    setEps(e);
    reset();
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const leaked = (counts["01"] ?? 0) + (counts["10"] ?? 0);
  const agreePct = total > 0 ? Math.round((matches / total) * 100) : 100;
  const epsPct = Math.round(eps * 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <BellRecipe className="w-full max-w-[240px]" />
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              role="group"
              aria-label="which machine reports the outcomes"
              className="flex items-center rounded-lg border border-edge overflow-hidden"
            >
              <button
                type="button"
                aria-pressed={!noisy}
                disabled={running}
                onClick={() => pickMachine(false)}
                className={`px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
                  !noisy
                    ? "bg-accent/15 text-ink"
                    : "text-mute hover:text-ink"
                }`}
              >
                perfect machine
              </button>
              <button
                type="button"
                aria-pressed={noisy}
                disabled={running}
                onClick={() => pickMachine(true)}
                className={`px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
                  noisy ? "bg-warn/15 text-ink" : "text-mute hover:text-ink"
                }`}
              >
                noisy machine
              </button>
            </div>
            <TipIcon hint={gloss("noise")} size={11} />
          </div>
          <label
            className={`flex items-center gap-2 text-[10px] text-mute ${
              noisy ? "" : "opacity-40"
            }`}
          >
            machine noise
            <input
              type="range"
              min={0}
              max={15}
              step={1}
              value={epsPct}
              disabled={!noisy || running}
              onChange={(e) => setNoise(Number(e.target.value) / 100)}
              className="w-28 accent-[rgb(var(--color-warn))]"
              aria-label="machine noise, percent of bits misread"
            />
            <span className="font-mono text-ink tabular-nums w-8">
              {epsPct}%
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          className="btn-primary !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={running}
          onClick={() => run(1)}
        >
          <Eye className="w-3.5 h-3.5" /> measure ×1
        </button>
        <button
          type="button"
          className="btn !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={running}
          onClick={() => run(20)}
        >
          ×20
        </button>
        <button
          type="button"
          className="btn !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={running}
          onClick={() => run(100)}
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

      <PairGrid counts={counts} leak />

      {total > 0 && (
        <p className="text-[11px] text-center tabular-nums" aria-live="polite">
          <span className="text-mute">agreement score: </span>
          <span className="font-mono text-ok">{agreePct}%</span>
          {noisy && matches === total ? (
            // 100% vs 100% would read as "noise does nothing" — name
            // the real situation: the dose is per look, luck so far.
            <span className="text-mute">
              {" "}
              — no misreads yet; noise strikes per look, not every look
            </span>
          ) : noisy ? (
            <>
              <span className="text-mute"> — on a perfect machine it is </span>
              <span className="font-mono text-ink">100%</span>
            </>
          ) : (
            <span className="text-mute">
              {" "}
              — this machine reports every draw as it happened
            </span>
          )}{" "}
          <TipIcon hint={gloss("fidelity")} size={10} />
        </p>
      )}
      <p className="text-[11px] text-mute text-center tabular-nums">
        {total === 0 ? (
          <>no looks yet — the grid and the score fill as you measure</>
        ) : noisy ? (
          <>
            {total} look{total === 1 ? "" : "s"}:{" "}
            <span className="text-warn font-mono">{leaked}</span> misread
            {leaked === 1 ? "" : "s"} leaked into 01/10
          </>
        ) : (
          <>
            {total} look{total === 1 ? "" : "s"}: 00 and 11 only — this
            machine never misreads
          </>
        )}
      </p>

      <p className="text-[11px] leading-snug text-mute border-l-2 border-accent/50 pl-2 max-w-md">
        The workbench&apos;s <span className="text-ink">Noisy simulator</span>{" "}
        block is exactly this — its misread rates measured on real device
        data.
      </p>
    </div>
  );
}
