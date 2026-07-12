import { useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { gloss } from "../../lib/glossary";
import { TipIcon } from "../TipIcon";

/**
 * Frame step 7 (of 10) — "Every qubit doubles the arrows" (marker:
 * learn-scale): why classical computers struggle, said honestly. One
 * interactive: a qubit-count stepper (1–30, slider + buttons). Up to
 * 5 qubits the wall shows the ACTUAL 2^n arrow slots as tiny bars;
 * beyond that drawing is hopeless (the point!) and the wall becomes
 * a log-scale bar plus the plain count, with anchors kept modest and
 * defensible (a spreadsheet, a photo's pixels, a laptop's RAM — no
 * atoms-in-the-universe hype at 30 qubits).
 *
 * The pedagogical crux is the HONESTY TURN, given its own graphic: a
 * readout funnel — 2^n arrows go in, one look returns just n bits
 * (each qubit answers 0 or 1, nothing more). The doubling wall is
 * only half the story; the art is step 5's cancelling, choreographed
 * so the few bits you CAN read carry the answer — which is exactly
 * what the next step's game does. Cross-link chips jump both ways.
 */
const MAX_N = 30;

const ANCHORS: { n: number; text: string }[] = [
  { n: 10, text: "a thousand — a spreadsheet" },
  { n: 20, text: "a million — a photo's pixels" },
  {
    n: 30,
    text: "a billion — more numbers than a laptop's RAM holds comfortably as amplitudes",
  },
];

export function Step6Scale({
  goToStep,
}: {
  goToStep?: (i: number) => void;
}) {
  const [n, setN] = useState(3);
  const count = 2 ** n;
  const fmt = count.toLocaleString("en-US");

  return (
    <div className="flex flex-col items-center gap-3" data-marker="learn-scale">
      {/* the stepper — slider + buttons, 1..30 qubits */}
      <div className="flex items-center gap-2 w-full max-w-md">
        <button
          type="button"
          className="btn !px-2 !py-1 text-xs disabled:opacity-40"
          disabled={n <= 1}
          onClick={() => setN((v) => Math.max(1, v - 1))}
          aria-label="One qubit fewer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          type="range"
          min={1}
          max={MAX_N}
          step={1}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          className="flex-1 accent-current text-accent"
          aria-label={`qubit count: ${n}`}
        />
        <button
          type="button"
          className="btn !px-2 !py-1 text-xs disabled:opacity-40"
          disabled={n >= MAX_N}
          onClick={() => setN((v) => Math.min(MAX_N, v + 1))}
          aria-label="One qubit more"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs text-ink font-mono tabular-nums w-20 text-right">
          {n} qubit{n === 1 ? "" : "s"}
        </span>
        <TipIcon hint={gloss("qubit")} size={10} />
      </div>

      {/* the wall of arrows */}
      <div className="panel-alt p-3 w-full max-w-md flex flex-col items-center gap-2">
        {n <= 5 ? (
          <>
            <div
              className="grid gap-1 justify-center"
              style={{
                gridTemplateColumns: `repeat(${Math.min(count, 8)}, minmax(0, 1fr))`,
              }}
              aria-label={`${fmt} arrow slots, drawn one by one`}
            >
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div className="w-2.5 h-6 rounded-sm bg-accent/50" />
                  {n <= 3 && (
                    <span className="font-mono text-[8px] text-mute">
                      {i.toString(2).padStart(n, "0")}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="text-[11px] text-mute tabular-nums">
              <span className="text-ink font-mono">{fmt}</span> arrows — one
              for every answer {n === 1 ? "the qubit" : `the ${n} qubits`}{" "}
              could give
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-ink font-mono tabular-nums">
              2<sup>{n}</sup> = {fmt} arrows
            </div>
            {/* log-scale bar: each pixel-step is a DOUBLING */}
            <div className="w-full">
              <div className="relative h-3 rounded bg-surfaceAlt overflow-hidden">
                <div
                  className="h-full bg-accent/60 transition-[width] duration-200 ease-out"
                  style={{ width: `${(n / MAX_N) * 100}%` }}
                />
                {ANCHORS.map((a) => (
                  <div
                    key={a.n}
                    className="absolute top-0 bottom-0 w-px bg-edge"
                    style={{ left: `${(a.n / MAX_N) * 100}%` }}
                  />
                ))}
              </div>
              <div className="text-[9px] text-mute mt-0.5">
                this bar is logarithmic: every step to the right is a
                doubling, not an addition
              </div>
            </div>
            <div className="w-full space-y-0.5">
              {ANCHORS.map((a) => (
                <div
                  key={a.n}
                  className={`text-[10px] tabular-nums transition-colors ${
                    n >= a.n ? "text-ink" : "text-mute/60"
                  }`}
                >
                  <span className="font-mono">{a.n} qubits</span>: {a.text}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="text-[11px] text-mute text-center max-w-sm">
          a classical computer must{" "}
          <span className="text-ink font-medium">TRACK</span> every arrow;{" "}
          {n} entangled qubit{n === 1 ? "" : "s"}{" "}
          <span className="text-ink font-medium">ARE</span> them{" "}
          <TipIcon hint={gloss("entanglement")} size={10} />
        </div>
      </div>

      {/* THE HONESTY TURN — the readout funnel */}
      <div className="w-full max-w-md border-l-2 border-accent/50 pl-3 flex flex-col gap-1.5">
        <div className="text-[10px] uppercase tracking-wider text-mute">
          but here is the catch
        </div>
        <svg
          viewBox="0 0 400 96"
          className="w-full"
          role="img"
          aria-label={`readout funnel: ${fmt} arrows go in, one look returns only ${n} bits`}
        >
          {/* incoming arrows (suggested, not literal) */}
          {Array.from({ length: 9 }).map((_, i) => (
            <line
              key={i}
              x1={8}
              y1={10 + i * 9.5}
              x2={116}
              y2={14 + i * 8.5}
              strokeWidth="1.5"
              style={{ stroke: "rgb(var(--color-accent))", opacity: 0.4 }}
            />
          ))}
          {/* the funnel body */}
          <path
            d="M 120 6 L 264 38 L 264 58 L 120 90 Z"
            style={{ fill: "rgb(var(--color-accent))", opacity: 0.1 }}
          />
          <path
            d="M 120 6 L 264 38 M 120 90 L 264 58"
            fill="none"
            strokeWidth="1.5"
            style={{ stroke: "rgb(var(--color-accent))", opacity: 0.6 }}
          />
          {/* the few bits that come out */}
          {Array.from({ length: Math.min(n, 6) }).map((_, i) => (
            <rect
              key={i}
              x={272 + i * 13}
              y={44}
              width={8}
              height={8}
              rx={1.5}
              style={{ fill: "rgb(var(--color-accent2))" }}
            />
          ))}
          {n > 6 && (
            <text
              x={272 + 6 * 13 + 2}
              y={51.5}
              fontSize="9"
              className="font-mono"
              style={{ fill: "rgb(var(--color-accent2))" }}
            >
              …×{n}
            </text>
          )}
          <text x={8} y={104 - 6} fontSize="9" className="tabular-nums" style={{ fill: "rgb(var(--color-mute))" }}>
            {fmt} arrows in
          </text>
          <text x={272} y={72} fontSize="9" className="tabular-nums" style={{ fill: "rgb(var(--color-ink))" }}>
            {n} bit{n === 1 ? "" : "s"} out — per look
          </text>
        </svg>
        <p className="text-[11px] leading-snug text-mute tabular-nums">
          you can't read the arrows out — one look returns just{" "}
          <span className="text-ink font-mono">{n}</span> bit
          {n === 1 ? "" : "s"}, one per qubit{" "}
          <TipIcon hint={gloss("measurement")} size={10} />. The art is step
          5's cancelling: make the arrows compute, so the few bits you{" "}
          <span className="text-ink">can</span> read carry the answer. The
          next step plays that art out.
        </p>
      </div>

      {/* cross-links: the mechanism behind, the payoff ahead */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          className="chip hover:border-accent/60 transition-colors"
          onClick={() => goToStep?.(4)}
        >
          <ChevronLeft className="w-3 h-3" /> revisit: Waves that cancel
        </button>
        <button
          type="button"
          className="chip hover:border-accent/60 transition-colors"
          onClick={() => goToStep?.(7)}
        >
          the payoff: One question instead of two{" "}
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
