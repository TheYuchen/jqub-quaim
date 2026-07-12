import { useState } from "react";
import { gloss } from "../../lib/glossary";
import { TipIcon } from "../TipIcon";
import { Dial } from "./Dial";

/**
 * Step 0 — "A bit that can lean." Side-by-side contrast: a classical
 * bit is a switch that SNAPS to 0 or 1 (nothing in between exists),
 * a qubit is a dial whose needle can rest anywhere on the arc. The
 * lean is lifted state (LearnLab owns it) so the SAME dial position
 * carries into step 1, where measurement collapses it.
 */
export function Step0Lean({
  lean,
  setLean,
}: {
  lean: number;
  setLean: (p: number) => void;
}) {
  const [bit, setBit] = useState<0 | 1>(0);
  const pct = Math.round(lean * 100);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="panel-alt p-4 flex flex-col items-center gap-4">
        <div className="text-[10px] uppercase tracking-wider text-mute">
          a classical bit
        </div>
        {/* The snap IS the message: an overshooting 200ms transform,
            no resting place between the two ends. */}
        <button
          type="button"
          onClick={() => setBit((b) => (b === 0 ? 1 : 0))}
          aria-pressed={bit === 1}
          aria-label={`Bit switch, currently ${bit}. Click to flip.`}
          className="relative w-28 h-14 rounded-full border border-edge bg-surface hover:border-accent/50 transition-colors"
        >
          <span
            className="absolute top-1.5 left-1.5 w-10 h-10 rounded-full bg-accent text-canvas font-mono text-lg flex items-center justify-center shadow-glow transition-transform duration-200"
            style={{
              transform: bit === 1 ? "translateX(56px)" : "translateX(0)",
              transitionTimingFunction: "cubic-bezier(.2, 1.4, .4, 1)",
            }}
          >
            {bit}
          </span>
        </button>
        <div className="text-[11px] text-mute text-center">
          holds: <span className="font-mono text-ink">0</span> or{" "}
          <span className="font-mono text-ink">1</span> — nothing in between
        </div>
      </div>

      <div className="panel-alt p-4 flex flex-col items-center gap-2">
        <div className="text-[10px] uppercase tracking-wider text-mute flex items-center gap-1">
          a qubit <TipIcon hint={gloss("qubit")} size={10} />
        </div>
        <Dial value={lean} onChange={setLean} size={210} />
        <div className="text-[11px] text-mute text-center">
          holds: a lean (here{" "}
          <span className="font-mono text-ink tabular-nums">{pct}%</span> toward
          1) — a first approximation; step 4 refines it
        </div>
      </div>
    </div>
  );
}
