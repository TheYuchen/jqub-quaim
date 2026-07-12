import { useCallback, useRef, useState } from "react";

/**
 * The learn track's signature control: a semicircular dial whose
 * needle position IS the qubit's lean (probability of reading 1).
 * 0 at the left end of the arc, 1 at the right, anywhere in between —
 * the visual argument of step 0 ("a bit that can lean").
 *
 * - `onChange` present → draggable (pointer capture; the whole svg is
 *   the hit target) and keyboard-adjustable (role=slider, arrows ±5pp).
 *   Absent → a read-only display dial (step 2's wire-end readout).
 * - `snapped` (0|1) overrides the needle to a pole with a FAST
 *   transition — step 1's measurement collapse. The tinted arc keeps
 *   showing the lean underneath, so collapse reads as "the needle
 *   left the lean", not "the lean changed".
 * - Needle motion is one CSS transform transition (disabled while
 *   dragging so the needle tracks the pointer 1:1); the global
 *   prefers-reduced-motion rule in index.css collapses it.
 */
export function Dial({
  value,
  onChange,
  snapped = null,
  size = 220,
}: {
  /** Lean toward 1, in [0, 1]. */
  value: number;
  onChange?: (p: number) => void;
  snapped?: 0 | 1 | null;
  /** Rendered width in px (height follows the 200:132 viewBox). */
  size?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  const shown = snapped ?? value;
  const rot = shown * 180; // needle base points LEFT (0); 180° = right (1)

  // Tinted arc from the 0-end to the lean's angle (always the LEAN,
  // even mid-snap — see the header comment).
  const theta = Math.PI * (1 - value);
  const ax = 100 + 80 * Math.cos(theta);
  const ay = 100 - 80 * Math.sin(theta);

  const pFromEvent = useCallback((e: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = ((e.clientX - rect.left) / rect.width) * 200;
    const py = ((e.clientY - rect.top) / rect.height) * 132;
    const dx = px - 100;
    const dy = 100 - py; // up is positive
    // Below the pivot line, snap to the nearer end instead of wrapping.
    const angle = dy <= 0 ? (dx < 0 ? Math.PI : 0) : Math.atan2(dy, dx);
    return Math.min(1, Math.max(0, 1 - angle / Math.PI));
  }, []);

  const interactive = onChange != null;
  const pct = Math.round(shown * 100);

  return (
    <div
      className="inline-block select-none"
      role={interactive ? "slider" : "img"}
      tabIndex={interactive ? 0 : undefined}
      aria-label={
        interactive
          ? "Qubit lean toward 1"
          : `Qubit lean: ${Math.round(value * 100)}% toward 1`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? Math.round(value * 100) : undefined}
      aria-valuetext={interactive ? `${Math.round(value * 100)}% toward 1` : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              const step =
                e.key === "ArrowRight" || e.key === "ArrowUp"
                  ? 0.05
                  : e.key === "ArrowLeft" || e.key === "ArrowDown"
                    ? -0.05
                    : null;
              if (step != null) {
                e.preventDefault();
                onChange(Math.min(1, Math.max(0, value + step)));
              } else if (e.key === "Home") onChange(0);
              else if (e.key === "End") onChange(1);
            }
          : undefined
      }
    >
      <svg
        ref={svgRef}
        viewBox="0 0 200 132"
        width={size}
        height={(size * 132) / 200}
        className={interactive ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}
        style={{ touchAction: "none" }}
        onPointerDown={
          interactive
            ? (e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging(true);
                const p = pFromEvent(e);
                if (p != null) onChange(p);
              }
            : undefined
        }
        onPointerMove={
          interactive && dragging
            ? (e) => {
                const p = pFromEvent(e);
                if (p != null) onChange(p);
              }
            : undefined
        }
        onPointerUp={interactive ? () => setDragging(false) : undefined}
        onPointerCancel={interactive ? () => setDragging(false) : undefined}
        aria-hidden
      >
        {/* base arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          style={{ stroke: "rgb(var(--color-edge))" }}
        />
        {/* lean arc: 0-end → needle angle */}
        {value > 0.004 && (
          <path
            d={`M 20 100 A 80 80 0 0 1 ${ax.toFixed(2)} ${ay.toFixed(2)}`}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            style={{ stroke: "rgb(var(--color-accent))", opacity: 0.75 }}
          />
        )}
        {/* end labels */}
        <text x="16" y="118" textAnchor="middle" fontSize="12" className="font-mono" style={{ fill: "rgb(var(--color-mute))" }}>
          0
        </text>
        <text x="184" y="118" textAnchor="middle" fontSize="12" className="font-mono" style={{ fill: "rgb(var(--color-mute))" }}>
          1
        </text>
        {/* needle — CSS transform so one transition covers drag/snap */}
        <g
          style={{
            transform: `translate(100px, 100px) rotate(${rot}deg)`,
            transition: dragging
              ? "none"
              : snapped != null
                ? "transform 120ms cubic-bezier(.3,.9,.4,1)"
                : "transform 240ms cubic-bezier(.2,.8,.3,1)",
          }}
        >
          <line
            x1="0"
            y1="0"
            x2="-70"
            y2="0"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ stroke: "rgb(var(--color-ink))" }}
          />
          <circle
            cx="-70"
            cy="0"
            r="5.5"
            style={{
              fill:
                snapped != null
                  ? "rgb(var(--color-warn))"
                  : "rgb(var(--color-accent))",
              transition: "fill 120ms linear",
            }}
          />
        </g>
        <circle
          cx="100"
          cy="100"
          r="6"
          style={{
            fill: "rgb(var(--color-surface))",
            stroke: "rgb(var(--color-edge))",
            strokeWidth: 2,
          }}
        />
        <text
          x="100"
          y="126"
          textAnchor="middle"
          fontSize="14"
          className="font-mono"
          style={{ fill: "rgb(var(--color-ink))" }}
        >
          {pct}%
        </text>
      </svg>
    </div>
  );
}
