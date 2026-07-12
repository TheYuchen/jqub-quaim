import { probs, stateAngle, type State1 } from "../../lib/quantumToy";

/**
 * The learn track's honest Bloch slice — a FULL circle replacing the
 * step-0 semicircular Dial wherever the sign (phase) matters. The
 * needle is the current state's point on the X–Z great circle
 * (lib/quantumToy.ts stateAngle: |0⟩ top, |+⟩ right, |1⟩ bottom,
 * |−⟩ left — global sign already modded out, so the needle shows
 * physical states only). The side points carry plain-language labels
 * ("fifty-fifty, plus-way" / "fifty-fifty, minus-way").
 *
 * THE KEY VISUAL is the shadow: a thin projection line drops the
 * needle tip onto the vertical (0–1) axis, and the % labels along
 * that axis are the measurement odds — p(1) = (1 − cos θ)/2. Two
 * different points (right and left) cast the SAME 50/50 shadow;
 * that near-collision is the phase step's whole argument, and the
 * reason the dial's semicircle was only a first approximation.
 *
 * Read-only by design (gates move it, fingers don't — the honest
 * contrast to the step-0 dial: you can PREPARE any lean, but the
 * hidden direction is only reachable through gates here). `snapped`
 * mirrors the Dial's measurement-collapse idiom: the needle briefly
 * points at the outcome pole (warn tip, ~200ms transition) while the
 * shadow keeps showing the state's odds underneath.
 */
export function CircleState({
  state,
  snapped = null,
  size = 180,
  label,
}: {
  state: State1;
  snapped?: 0 | 1 | null;
  /** Rendered width in px (height follows the 260:224 viewBox). */
  size?: number;
  /** Optional caption under the circle (e.g. "end of the wire"). */
  label?: string;
}) {
  const theta = stateAngle(state); // 0 top → clockwise
  const deg = (theta * 180) / Math.PI;
  const p = probs(state);
  const p0 = Math.round(p[0] * 100);
  const p1 = Math.round(p[1] * 100);

  const cx = 130;
  const cy = 112;
  const r = 76;
  const rn = 62; // needle length
  const tipX = cx + rn * Math.sin(theta);
  const tipY = cy - rn * Math.cos(theta);
  const shadowY = cy - rn * Math.cos(theta);

  const shownDeg = snapped == null ? deg : snapped === 0 ? 0 : 180;

  const dir =
    p1 <= 2
      ? "at 0 (top)"
      : p1 >= 98
        ? "at 1 (bottom)"
        : theta < Math.PI
          ? p1 === 50
            ? "at fifty-fifty, plus-way (right)"
            : "on the right half"
          : p1 === 50
            ? "at fifty-fifty, minus-way (left)"
            : "on the left half";

  return (
    <div className="inline-flex flex-col items-center">
      <svg
        viewBox="0 0 260 224"
        width={size * (260 / 224)}
        height={size}
        role="img"
        aria-label={`qubit on the circle: needle ${dir}; would read 0 ${p0}% and 1 ${p1}% of the time`}
      >
        {/* the circle — every one-qubit state our gates reach lives here */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          strokeWidth="5"
          style={{ stroke: "rgb(var(--color-edge))" }}
        />
        {/* vertical 0–1 axis: the only direction measurement sees */}
        <line
          x1={cx}
          y1={cy - r}
          x2={cx}
          y2={cy + r}
          strokeWidth="1"
          strokeDasharray="3 3"
          style={{ stroke: "rgb(var(--color-mute))", opacity: 0.55 }}
        />
        {/* pole + side markers */}
        {[
          { y: cy - r, ly: cy - r - 8, t: "0" },
          { y: cy + r, ly: cy + r + 16, t: "1" },
        ].map((m) => (
          <g key={m.t}>
            <circle cx={cx} cy={m.y} r={3} style={{ fill: "rgb(var(--color-mute))" }} />
            <text
              x={cx}
              y={m.ly}
              textAnchor="middle"
              fontSize="13"
              className="font-mono"
              style={{ fill: "rgb(var(--color-ink))" }}
            >
              {m.t}
            </text>
          </g>
        ))}
        <circle cx={cx + r} cy={cy} r={3} style={{ fill: "rgb(var(--color-mute))" }} />
        <circle cx={cx - r} cy={cy} r={3} style={{ fill: "rgb(var(--color-mute))" }} />
        <text x={cx + r + 6} y={cy - 2} fontSize="9.5" style={{ fill: "rgb(var(--color-mute))" }}>
          fifty-fifty,
        </text>
        <text x={cx + r + 6} y={cy + 9} fontSize="9.5" style={{ fill: "rgb(var(--color-mute))" }}>
          plus-way
        </text>
        <text x={cx - r - 6} y={cy - 2} textAnchor="end" fontSize="9.5" style={{ fill: "rgb(var(--color-mute))" }}>
          fifty-fifty,
        </text>
        <text x={cx - r - 6} y={cy + 9} textAnchor="end" fontSize="9.5" style={{ fill: "rgb(var(--color-mute))" }}>
          minus-way
        </text>
        {/* the shadow: needle tip projected onto the vertical axis.
            Drawn from the STATE (not the snap) — the odds stay honest
            while the needle briefly visits the outcome pole. */}
        {Math.abs(Math.sin(theta)) > 0.02 && (
          <g>
            <line
              x1={tipX}
              y1={tipY}
              x2={cx}
              y2={shadowY}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              style={{ stroke: "rgb(var(--color-accent2))", opacity: 0.8 }}
            />
            <circle cx={cx} cy={shadowY} r={3.5} style={{ fill: "rgb(var(--color-accent2))" }} />
          </g>
        )}
        {/* measurement odds along the axis — what the shadow means */}
        <text
          x={cx + 7}
          y={cy - r + 16}
          fontSize="10"
          className="font-mono tabular-nums"
          style={{ fill: "rgb(var(--color-ink))" }}
        >
          {p0}%
        </text>
        <text
          x={cx + 7}
          y={cy + r - 9}
          fontSize="10"
          className="font-mono tabular-nums"
          style={{ fill: "rgb(var(--color-ink))" }}
        >
          {p1}%
        </text>
        {/* needle — CSS transform, same collapse idiom as the Dial */}
        <g
          style={{
            transform: `translate(${cx}px, ${cy}px) rotate(${shownDeg}deg)`,
            transition:
              snapped != null
                ? "transform 200ms cubic-bezier(.3,.9,.4,1)"
                : "transform 240ms cubic-bezier(.2,.8,.3,1)",
          }}
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={-rn}
            strokeWidth="3"
            strokeLinecap="round"
            style={{ stroke: "rgb(var(--color-ink))" }}
          />
          <circle
            cx="0"
            cy={-rn}
            r="5.5"
            style={{
              fill:
                snapped != null
                  ? "rgb(var(--color-warn))"
                  : "rgb(var(--color-accent))",
              transition: "fill 200ms linear",
            }}
          />
        </g>
        <circle
          cx={cx}
          cy={cy}
          r={5.5}
          style={{
            fill: "rgb(var(--color-surface))",
            stroke: "rgb(var(--color-edge))",
            strokeWidth: 2,
          }}
        />
      </svg>
      {label && <div className="text-[10px] text-mute -mt-1">{label}</div>}
    </div>
  );
}
