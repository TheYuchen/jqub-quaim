import { useMemo, useState } from "react";
import { X as XIcon } from "lucide-react";
import { gloss } from "../../lib/glossary";
import {
  applyH1,
  applyX1,
  applyZ1,
  measureMany,
  mulberry32,
  probs,
  zero1,
  type State1,
} from "../../lib/quantumToy";
import { TipIcon } from "../TipIcon";
import { CircleState } from "./CircleState";
import { Tally } from "./Tally";

/**
 * Step 2 — "Gates steer the lean." One horizontal wire, a shelf with
 * X, H and Z chips, up to four removable slots. The state runs
 * left→right through the slots on every edit (exact sim —
 * lib/quantumToy.ts), the CircleState at the wire's end shows the
 * resulting state live (the full circle, because Z can push the
 * needle to the left half — the semicircular dial could not show
 * that), and the step-1 histogram under it re-tallies a persistent
 * seeded ×200 auto-measure of the current end state.
 *
 * The dynamic caption's boldest claim — H twice is EXACTLY back where
 * you started — only holds because the toy sim carries real
 * amplitudes with signs (interference), not probabilities.
 *
 * REACHABLE-SET TRUTH (asserted in scripts/check_quantum_toy.test.ts):
 * from |0⟩, words in X/H/Z generate a dihedral orbit of 8 SIGNED
 * amplitude pairs at 45° multiples of the amplitude circle — but a
 * global sign is unphysical, so the pairs collapse two-by-two into
 * exactly FOUR physical states: |0⟩, |+⟩, |1⟩, |−⟩, the circle's
 * compass points. Leans stay {0%, 50%, 100%}; what Z adds is not a
 * new lean but the left half of the circle (|−⟩), invisible to the
 * tally, visible to H. The caption's case analysis below is
 * exhaustive over those four states, not heuristic.
 */
type GateKind = "X" | "H" | "Z";
const MAX_SLOTS = 4;
const SHOTS = 200;
const TALLY_SEED = 42; // fixed → the histogram is a pure function of the circuit

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

function describe(gates: GateKind[], states: State1[]): string {
  if (gates.length === 0)
    return "An empty wire changes nothing: the qubit stays at 0, with certainty.";
  const prev = probs(states[states.length - 2])[1];
  const now = probs(states[states.length - 1])[1];
  const last = gates[gates.length - 1];
  if (last === "X")
    return near(now, 0.5)
      ? // X genuinely fixes BOTH fifty-fifty points here: X|+⟩ = |+⟩ and
        // X|−⟩ = −|−⟩, and an overall sign is not a different state.
        "X swaps 0-ness and 1-ness — but a fifty-fifty state is its own swap, so the needle stays put."
      : `X flips: the qubit now reads ${now > 0.5 ? "1" : "0"}, with certainty.`;
  if (last === "Z")
    return near(now, 0.5)
      ? "Z flips a hidden sign: the needle swings across the circle, yet the tally will not budge."
      : "On a definite 0 or 1, Z changes nothing at all — its sign flip only matters mid-lean.";
  // last === "H"; a lean of exactly 0 or 1 before it means a fresh split
  if (near(prev, 0) || near(prev, 1))
    return "H splits a definite value into a fifty-fifty lean — the needle moves to the side of the circle.";
  const before = gates[gates.length - 2];
  if (before === "H")
    return "H twice: exactly back where it started — thanks to a hidden direction you'll meet in a moment.";
  if (before === "Z")
    return `H turns the hidden sign into something visible: a definite ${now > 0.5 ? "1" : "0"}, with certainty.`;
  return `The two mixes cancelled — a definite ${now > 0.5 ? "1" : "0"} again. Nothing here was random.`;
}

export function Step2Gates() {
  const [gates, setGates] = useState<GateKind[]>(["H"]); // preloaded example

  const states = useMemo(() => {
    const acc: State1[] = [zero1()];
    for (const g of gates) {
      const cur = acc[acc.length - 1];
      acc.push(g === "X" ? applyX1(cur) : g === "H" ? applyH1(cur) : applyZ1(cur));
    }
    return acc;
  }, [gates]);

  const end = states[states.length - 1];
  const tallies = useMemo(
    () => ({ "0": 0, "1": 0, ...measureMany(end, SHOTS, mulberry32(TALLY_SEED)) }),
    [end],
  );

  const add = (g: GateKind) =>
    setGates((gs) => (gs.length >= MAX_SLOTS ? gs : [...gs, g]));
  const removeAt = (i: number) =>
    setGates((gs) => gs.filter((_, j) => j !== i));

  return (
    <div className="flex flex-col gap-4">
      {/* gate shelf */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-mute flex items-center gap-1">
          gate shelf <TipIcon hint={gloss("gates")} size={10} />
        </span>
        <button
          type="button"
          className="btn !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={gates.length >= MAX_SLOTS}
          onClick={() => add("X")}
          title="Append an X gate to the wire"
        >
          <span className="font-mono text-accent2">X</span> flip
        </button>
        <button
          type="button"
          className="btn !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={gates.length >= MAX_SLOTS}
          onClick={() => add("H")}
          title="Append an H gate to the wire"
        >
          <span className="font-mono text-accent2">H</span> mix
        </button>
        <button
          type="button"
          className="btn !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={gates.length >= MAX_SLOTS}
          onClick={() => add("Z")}
          title="Append a Z gate — a sign flip that does nothing you can SEE yet"
        >
          <span className="font-mono text-accent2">Z</span> sign flip
        </button>
        {gates.length >= MAX_SLOTS && (
          <span className="text-[10px] text-mute">wire full — remove one to add</span>
        )}
      </div>

      {/* the wire: start chip → 4 slots → end dial */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="relative flex items-center gap-2.5 py-2 grow min-w-[230px] max-w-sm">
          <svg
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 w-full h-[2px]"
            viewBox="0 0 100 2"
            preserveAspectRatio="none"
            aria-hidden
          >
            <line
              x1="0"
              y1="1"
              x2="100"
              y2="1"
              strokeWidth="2"
              style={{ stroke: "rgb(var(--color-edge))" }}
            />
          </svg>
          <span className="relative chip font-mono !bg-surface shrink-0">0</span>
          {Array.from({ length: MAX_SLOTS }).map((_, i) =>
            gates[i] != null ? (
              <span
                key={i}
                className="relative w-9 h-9 shrink-0 rounded-lg border border-accent/50 bg-accent/10 text-accent font-mono text-sm flex items-center justify-center"
              >
                {gates[i]}
                <button
                  type="button"
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-surface border border-edge text-mute hover:text-danger hover:border-danger/50 flex items-center justify-center"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove the ${gates[i]} gate in slot ${i + 1}`}
                >
                  <XIcon className="w-2.5 h-2.5" />
                </button>
              </span>
            ) : (
              <span
                key={i}
                className="relative w-9 h-9 shrink-0 rounded-lg border border-dashed border-edge/80 bg-canvas/50"
                aria-hidden
              />
            ),
          )}
        </div>
        <div className="flex flex-col items-center mx-auto">
          <CircleState state={end} size={150} label="end of the wire" />
          <div className="text-[10px] text-mute mt-0.5 max-w-[190px] text-center leading-snug flex items-start gap-1">
            <span>
              from 0, every X/H/Z recipe lands on one of these four compass
              points — never in between
            </span>
            <TipIcon hint={gloss("amplitude")} size={10} />
          </div>
        </div>
      </div>

      {/* dynamic caption — what the LAST edit did */}
      <p className="text-[11px] leading-snug text-mute border-l-2 border-accent/50 pl-2">
        {describe(gates, states)}
      </p>

      {/* step-1's histogram, fed by a persistent seeded auto-measure */}
      <div className="w-full max-w-xs">
        <div className="text-[10px] uppercase tracking-wider text-mute mb-1 flex items-center gap-1">
          if you measured now — 200 shots{" "}
          <TipIcon hint={gloss("shots")} size={10} />
        </div>
        <Tally counts={tallies} order={["0", "1"]} />
      </div>
    </div>
  );
}
