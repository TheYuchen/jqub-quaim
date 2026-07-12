import { useEffect, useRef, useState } from "react";
import { Eye, Link2, Link2Off, RotateCcw } from "lucide-react";
import { gloss } from "../../lib/glossary";
import {
  applyCX,
  applyH2,
  measureOnce,
  mulberry32,
  probs,
  zero2,
  type State2,
} from "../../lib/quantumToy";
import { TipIcon } from "../TipIcon";
import { BellRecipe } from "./BellRecipe";
import { Dial } from "./Dial";
import { PairGrid } from "./PairGrid";
import { useDrawLoop } from "./useDrawLoop";

/**
 * Step 3 — "Two qubits, one fate." The fixed Bell recipe (H on q0,
 * then CX — see BellRecipe for the wiring and for why "break the
 * link" swaps in H⊗H rather than just deleting CX) feeds one exact
 * two-qubit state; every look samples ONE four-way outcome and snaps
 * BOTH needles to its bits — with the link, always the same side
 * (the exact sim puts literally zero amplitude on 01/10, so "never a
 * disagreement" is a certainty claim, like step 2's H·H). Both
 * marginal dials read 50% in BOTH modes — that near-paradox is the
 * point: each qubit alone looks identical, only the JOINT tally
 * (the 2×2 grid) reveals the link.
 *
 * Seeded rng, reset on reset/toggle → every replay of a mode is
 * deterministic. Batch animation timing lives in useDrawLoop. The
 * seed is CHOSEN, not arbitrary: 20260703 opened with five 11s in a
 * row on the linked pair ("always the same side" read as "always
 * 11"); 20260708 gives 00 11 00 11… linked — both sides inside two
 * clicks — and a first-click disagreement (01) once broken.
 */
const SEED = 20260708;
const EMPTY: Record<string, number> = { "00": 0, "01": 0, "10": 0, "11": 0 };

function recipeState(broken: boolean): State2 {
  const mixed = applyH2(zero2(), 0);
  return broken ? applyH2(mixed, 1) : applyCX(mixed);
}

export function Step3Bell() {
  const [broken, setBroken] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({ ...EMPTY });
  const [snap, setSnap] = useState<[0 | 1, 0 | 1] | null>(null);
  const rng = useRef(mulberry32(SEED));
  const unsnap = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (unsnap.current) clearTimeout(unsnap.current);
    },
    [],
  );

  const settle = () => {
    if (unsnap.current) clearTimeout(unsnap.current);
    unsnap.current = setTimeout(() => setSnap(null), 380);
  };

  const { running, run, stop } = useDrawLoop(() => {
    const bits = measureOnce(recipeState(broken), rng.current);
    setCounts((c) => ({ ...c, [bits]: (c[bits] ?? 0) + 1 }));
    setSnap([bits[0] === "1" ? 1 : 0, bits[1] === "1" ? 1 : 0]);
    settle();
  });

  const reset = () => {
    stop();
    if (unsnap.current) clearTimeout(unsnap.current);
    setSnap(null);
    setCounts({ ...EMPTY });
    rng.current = mulberry32(SEED);
  };

  const toggleLink = () => {
    // Different distribution → fresh deterministic tally.
    setBroken((b) => !b);
    reset();
  };

  const state = recipeState(broken);
  const p = probs(state);
  const pQ0 = p[2] + p[3]; // P(q0 reads 1) — 50% in both modes
  const pQ1 = p[1] + p[3];
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const disagree = (counts["01"] ?? 0) + (counts["10"] ?? 0);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <div className="flex flex-col items-center gap-1 max-w-[300px]">
          <BellRecipe broken={broken} />
          <p className="text-[10px] text-mute text-center leading-snug flex items-start gap-1">
            <span>
              {broken
                ? "no link — each qubit mixes and answers alone"
                : "the second gate links them: whatever q0 answers, q1 must match"}
            </span>
            <TipIcon hint={gloss("entanglement")} size={10} />
          </p>
        </div>
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <Dial value={pQ0} snapped={snap?.[0] ?? null} size={120} />
            <div className="text-[10px] text-mute -mt-1 font-mono">q0</div>
          </div>
          <div className="flex flex-col items-center">
            <Dial value={pQ1} snapped={snap?.[1] ?? null} size={120} />
            <div className="text-[10px] text-mute -mt-1 font-mono">q1</div>
          </div>
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
        <button
          type="button"
          aria-pressed={broken}
          disabled={running}
          onClick={toggleLink}
          className={`btn !px-2.5 !py-1 text-xs disabled:opacity-40 ${
            broken ? "!border-warn/50 !text-warn" : ""
          }`}
          title={
            broken
              ? "Put the CX link back — the pair answers together again"
              : "Remove the link and give each qubit its own mix instead"
          }
        >
          {broken ? (
            <>
              <Link2 className="w-3.5 h-3.5" /> relink them
            </>
          ) : (
            <>
              <Link2Off className="w-3.5 h-3.5" /> break the link
            </>
          )}
        </button>
      </div>

      <PairGrid counts={counts} />

      <p
        className="text-[11px] text-mute text-center tabular-nums"
        aria-live="polite"
      >
        {total === 0 ? (
          <>no looks yet — measure the pair to fill the grid</>
        ) : broken ? (
          <>
            {total} look{total === 1 ? "" : "s"}:{" "}
            <span className="text-ink font-mono">{disagree}</span>{" "}
            disagreement{disagree === 1 ? "" : "s"} — no link, each qubit
            answers alone
          </>
        ) : (
          <>
            {total} look{total === 1 ? "" : "s"}:{" "}
            <span className="text-ink font-mono">00</span> and{" "}
            <span className="text-ink font-mono">11</span> only — never a
            disagreement
          </>
        )}
      </p>
    </div>
  );
}
