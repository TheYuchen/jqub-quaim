import { useState } from "react";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { gloss } from "../../lib/glossary";
import { applyH1, applyZ1, probs, zero1, type State1 } from "../../lib/quantumToy";
import { TipIcon } from "../TipIcon";
import { AmpBars } from "./AmpBars";

/**
 * Frame step 5 (of 10) — "Waves that cancel": the MECHANISM behind
 * step 3's "H twice: exactly back where it started" and step 4's
 * hidden direction. One state, drawn as signed amplitude arrows
 * (AmpBars.tsx), walked through a two-gate story frame by frame —
 * ‹ › step-through, never autoplay, so the reader owns the pace.
 *
 * Act 1 — H·H on |0⟩ in three frames (start → after H → after H).
 * The LAST frame overlays ghost route-arrows: the mix feeds every
 * outcome from BOTH current arrows, so two routes lead into 1 (one
 * +, one −) and merge to zero, while the two routes into 0 agree.
 * Deterministic, exact (the toy sim's real amplitudes — the ghost
 * pairs sum to the shown arrow, asserted in
 * scripts/check_quantum_toy.test.ts).
 *
 * Act 2 — a Z toggle between the H's ("flip the hidden sign"): the
 * routes into 0 now cancel instead, and the outcome snaps to a
 * certain 1 — mix, sign flip, mix acts as one clean flip. Toggling
 * keeps the reader's position in the story (final frame stays
 * final), so the cancelling visibly swaps sides in place.
 *
 * No randomness anywhere in this step: interference is about the
 * arrows themselves, before any measurement happens.
 */

export function Step4Interference() {
  const [zOn, setZOn] = useState(false);
  const [frame, setFrame] = useState(0);

  const gates: ("H" | "Z")[] = zOn ? ["H", "Z", "H"] : ["H", "H"];
  const states: State1[] = [zero1()];
  for (const g of gates) {
    const cur = states[states.length - 1];
    states.push(g === "H" ? applyH1(cur) : applyZ1(cur));
  }
  const last = gates.length; // final frame index
  const atEnd = frame === last;
  const cur = states[frame];

  // Ghost route-arrows, final frame only: the last H feeds outcome 0
  // with R2·a + R2·b and outcome 1 with R2·a − R2·b, where (a, b) is
  // the state just before it. Each pair sums exactly to the real bar.
  const R2 = Math.SQRT1_2;
  const prev = states[last - 1];
  const ghosts = atEnd
    ? [
        [R2 * prev[0], R2 * prev[1]],
        [R2 * prev[0], -R2 * prev[1]],
      ]
    : undefined;

  const endP1 = Math.round(probs(states[last])[1] * 100);

  const toggleZ = () => {
    // keep the story position meaningful: the final frame stays final
    // (the outcome snaps in place), earlier frames stay where they are.
    setZOn((z) => {
      const nextLast = z ? 2 : 3;
      setFrame((f) => (f === last ? nextLast : Math.min(f, nextLast)));
      return !z;
    });
  };

  const caption = (() => {
    if (frame === 0)
      return (
        <>
          start: one arrow, all of it on 0 — measuring now would read 0,
          100% of the time.
        </>
      );
    if (gates[frame - 1] === "Z")
      return (
        <>
          the sign flip: the arrow for 1 now points{" "}
          <span className="text-ink">down</span> — and the odds have not
          moved: still 50/50. Nothing you could measure has changed. Yet.
        </>
      );
    if (!atEnd)
      return (
        <>
          one mix: two equal arrows, both up — 50/50 odds, a fair coin if
          you looked now. Keep going.
        </>
      );
    return zOn ? (
      <>
        the second mix, after the sign flip: now the two routes into 0
        point against each other and vanish; the routes into 1 agree —{" "}
        <span className="text-ink">a certain 1 ({endP1}%)</span>. You
        choreographed the cancelling{" "}
        <TipIcon hint={gloss("interference")} size={10} /> — and only the
        wrong answer disappeared.
      </>
    ) : (
      <>
        the second mix: the two routes into 1 (ghost arrows) point against
        each other and merge to nothing; the two routes into 0 agree —{" "}
        <span className="text-ink">a certain 0</span>. That cancelling is
        interference <TipIcon hint={gloss("interference")} size={10} />,
        and nothing here was random.
      </>
    );
  })();

  return (
    <div className="flex flex-col items-center gap-3">
      {/* the story wire: start chip + gate chips, walked by the cursor */}
      <div className="flex items-center gap-2" aria-label="the story so far">
        <span
          className={`chip font-mono !bg-surface transition-opacity ${frame === 0 ? "" : "opacity-60"}`}
        >
          0
        </span>
        {gates.map((g, i) => (
          <span
            key={`${zOn}-${i}`}
            className={`w-8 h-8 rounded-lg border font-mono text-xs flex items-center justify-center transition-colors ${
              i < frame
                ? g === "Z"
                  ? "border-warn/60 bg-warn/10 text-warn"
                  : "border-accent/50 bg-accent/10 text-accent"
                : "border-edge/80 bg-canvas/50 text-mute"
            }`}
            title={
              g === "Z" ? "the sign flip between the mixes" : "a mixing gate"
            }
          >
            {g}
          </span>
        ))}
        <span className="text-[10px] text-mute tabular-nums">
          frame {frame + 1} of {last + 1}
        </span>
      </div>

      {/* the arrows themselves */}
      <AmpBars
        amps={cur}
        labels={["arrow for 0", "arrow for 1"]}
        ghosts={ghosts}
      />
      {atEnd && (
        <p className="text-[10px] text-mute -mt-2">
          ghost arrows = the two routes in: via 0 (left) and via 1 (right)
        </p>
      )}

      {/* controls: step-through, never autoplay — plus the Act-2 toggle */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          className="btn !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={frame === 0}
          onClick={() => setFrame((f) => Math.max(0, f - 1))}
          aria-label="Previous frame of the story"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> back
        </button>
        <button
          type="button"
          className="btn-primary !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={atEnd}
          onClick={() => setFrame((f) => Math.min(last, f + 1))}
          aria-label="Next frame of the story"
        >
          step <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className={`btn !px-2.5 !py-1 text-xs ${zOn ? "!border-warn/60 text-warn" : ""}`}
          onClick={toggleZ}
          title="Insert (or remove) a Z between the two mixes — flip the hidden sign"
        >
          <Repeat className="w-3.5 h-3.5" />
          {zOn ? "remove the hidden sign flip" : "flip the hidden sign"}
        </button>
      </div>

      {/* what this frame means */}
      <p
        className="text-[11px] leading-snug text-mute border-l-2 border-accent/50 pl-2 max-w-md tabular-nums"
        aria-live="polite"
      >
        {caption}
      </p>
    </div>
  );
}
