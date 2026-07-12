import { probs } from "../../lib/quantumToy";

/**
 * Signed amplitude bars — the learn track's picture of a state as
 * ARROWS, one column per outcome. The wide bar is the amplitude:
 * it grows UP for a plus sign, DOWN for a minus sign, and its height
 * is the amplitude's size. The THIN overlay bar next to it (always
 * up) plus the % figure are the measurement odds (the amplitude's
 * square), kept deliberately separate so "arrows are not odds" stays
 * visible on screen: a downward arrow can carry the same 50% as an
 * upward one.
 *
 * `ghosts` draws route contributions into a slot as dashed ghost
 * arrows flanking the real one — the interference step's picture of
 * a mix: the two routes into an outcome, one per ghost, and the real
 * arrow is exactly their sum (asserted in
 * scripts/check_quantum_toy.test.ts — routes into 0 agree, routes
 * into 1 cancel). Bars animate through zero via a scaleY transform
 * (the CircleState transition idiom), so a cancelling arrow visibly
 * shrinks through the zero line rather than teleporting.
 */
export function AmpBars({
  amps,
  labels,
  ghosts,
  height = 176,
}: {
  /** Signed real amplitudes, one per outcome (2 or 4 slots). */
  amps: number[];
  /** Mute label under each column ("arrow for 0", or a bitstring). */
  labels: string[];
  /** Per-slot route contributions drawn as dashed ghost arrows. */
  ghosts?: (number[] | null)[];
  /** Rendered height in px (width follows the slot count). */
  height?: number;
}) {
  const n = amps.length;
  const COL = n <= 2 ? 104 : 68; // column width in viewBox units
  const AXIS = 26; // left gutter for the +1/0/−1 scale
  const W = AXIS + COL * n + 6;
  const VH = 196;
  const zeroY = 96; // the zero line
  const maxH = 60; // bar height for amplitude 1
  const bw = n <= 2 ? 20 : 12; // main bar width
  const gw = n <= 2 ? 9 : 6; // ghost bar width
  const p = probs(amps);

  const desc = amps
    .map(
      (a, i) =>
        `${labels[i]}: ${a < -0.01 ? "down" : a > 0.01 ? "up" : "zero"} ${Math.abs(a).toFixed(2)}, odds ${Math.round(p[i] * 100)}%`,
    )
    .join("; ");

  return (
    <svg
      viewBox={`0 0 ${W} ${VH}`}
      width={(height * W) / VH}
      height={height}
      role="img"
      aria-label={`amplitude arrows — ${desc}`}
    >
      {/* legend: the two kinds of bar */}
      <rect x={AXIS} y={6} width={7} height={7} rx={1.5} style={{ fill: "rgb(var(--color-accent))", opacity: 0.85 }} />
      <text x={AXIS + 10} y={12.5} fontSize="8.5" style={{ fill: "rgb(var(--color-mute))" }}>
        arrow (can point down)
      </text>
      <rect x={AXIS + 108} y={6} width={3} height={7} style={{ fill: "rgb(var(--color-accent2))", opacity: 0.85 }} />
      <text x={AXIS + 114} y={12.5} fontSize="8.5" style={{ fill: "rgb(var(--color-mute))" }}>
        odds
      </text>
      {/* the scale: +1 / 0 / −1 */}
      {[
        { y: zeroY - maxH, t: "+1" },
        { y: zeroY, t: "0" },
        { y: zeroY + maxH, t: "−1" },
      ].map((m) => (
        <g key={m.t}>
          <text
            x={AXIS - 5}
            y={m.y + 3}
            textAnchor="end"
            fontSize="8.5"
            className="font-mono"
            style={{ fill: "rgb(var(--color-mute))" }}
          >
            {m.t}
          </text>
          <line
            x1={AXIS}
            y1={m.y}
            x2={W - 4}
            y2={m.y}
            strokeWidth="1"
            strokeDasharray={m.t === "0" ? undefined : "2 3"}
            style={{
              stroke: "rgb(var(--color-mute))",
              opacity: m.t === "0" ? 0.55 : 0.2,
            }}
          />
        </g>
      ))}
      {amps.map((a, i) => {
        const cx = AXIS + COL * i + COL / 2;
        const g = ghosts?.[i] ?? null;
        const oddsX = cx + bw / 2 + (g ? gw + 8 : 6);
        return (
          <g key={i}>
            {/* ghost route-arrows, flanking the real bar */}
            {g?.map((v, j) => {
              const gx = cx + (j === 0 ? -1 : 1) * (bw / 2 + gw / 2 + 2);
              return (
                <g
                  key={j}
                  style={{
                    transform: `translate(${gx}px, ${zeroY}px) scaleY(${v * maxH})`,
                    transition: "transform 300ms cubic-bezier(.2,.8,.3,1)",
                  }}
                >
                  <rect
                    x={-gw / 2}
                    y={-1}
                    width={gw}
                    height={1}
                    style={{
                      fill: "rgb(var(--color-accent))",
                      opacity: 0.28,
                    }}
                  />
                </g>
              );
            })}
            {/* the real arrow — sign is direction, size is height */}
            <g
              style={{
                transform: `translate(${cx}px, ${zeroY}px) scaleY(${a * maxH})`,
                transition: "transform 300ms cubic-bezier(.2,.8,.3,1)",
              }}
            >
              <rect
                x={-bw / 2}
                y={-1}
                width={bw}
                height={1}
                style={{ fill: "rgb(var(--color-accent))", opacity: 0.85 }}
              />
            </g>
            {/* zero marker so a fully cancelled arrow stays legible */}
            {Math.abs(a) < 0.02 && (
              <circle cx={cx} cy={zeroY} r={2.5} style={{ fill: "rgb(var(--color-accent))", opacity: 0.7 }} />
            )}
            {/* the odds: thin bar (always up) + % — separate on purpose */}
            <g
              style={{
                transform: `translate(${oddsX}px, ${zeroY}px) scaleY(${p[i] * maxH})`,
                transition: "transform 300ms cubic-bezier(.2,.8,.3,1)",
              }}
            >
              <rect
                x={-1.5}
                y={-1}
                width={3}
                height={1}
                style={{ fill: "rgb(var(--color-accent2))", opacity: 0.85 }}
              />
            </g>
            <text
              x={oddsX}
              y={zeroY - p[i] * maxH - 4}
              textAnchor="middle"
              fontSize="8.5"
              className="font-mono tabular-nums"
              style={{ fill: "rgb(var(--color-accent2))" }}
            >
              {Math.round(p[i] * 100)}%
            </text>
            {/* mute outcome label */}
            <text
              x={cx}
              y={VH - 8}
              textAnchor="middle"
              fontSize={n <= 2 ? 9.5 : 10}
              className={n <= 2 ? undefined : "font-mono"}
              style={{ fill: "rgb(var(--color-mute))" }}
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
