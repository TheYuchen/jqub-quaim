/**
 * The fixed two-slot Bell recipe on two wires, read-only — steps 3
 * and 4 share it. Slot 1: H on q0 (the mix). Slot 2: either the CX
 * link (control dot on q0, ⊕ target on q1 — exactly the default
 * wiring of lib/quantumToy.ts applyCX) or, with `broken`, an H on q1
 * instead. NOTE the "break the link" contrast is H⊗H, not merely
 * deleting CX: deleting it alone would pin q1 at 0 forever (only
 * 00/10 could show), which reads as "q1 is dead", not "the qubits
 * are independent". Giving each qubit its OWN mix keeps both dials
 * at 50% and lets all four cells fill — the honest independent
 * contrast to the linked pair.
 */
export function BellRecipe({
  broken = false,
  className = "w-full max-w-[290px]",
}: {
  broken?: boolean;
  className?: string;
}) {
  const edge = "rgb(var(--color-edge))";
  const accent = "rgb(var(--color-accent))";
  const ink = "rgb(var(--color-ink))";
  const mute = "rgb(var(--color-mute))";
  const y0 = 30;
  const y1 = 82;
  const xH = 96; // slot 1 center
  const xL = 186; // slot 2 center
  const chip = (x: number, y: number) => (
    <g>
      <rect
        x={x - 15}
        y={y - 15}
        width={30}
        height={30}
        rx={7}
        fill={accent}
        fillOpacity={0.12}
        stroke={accent}
        strokeOpacity={0.5}
      />
      <text
        x={x}
        y={y + 4.5}
        textAnchor="middle"
        fontSize="13"
        className="font-mono"
        fill={accent}
      >
        H
      </text>
    </g>
  );
  return (
    <svg
      viewBox="0 0 290 108"
      className={className}
      role="img"
      aria-label={
        broken
          ? "recipe: a mix on q0 and a mix on q1 — no link between the qubits"
          : "recipe: a mix on q0, then a controlled flip linking q0 to q1"
      }
    >
      {[
        { y: y0, q: "q0" },
        { y: y1, q: "q1" },
      ].map(({ y, q }) => (
        <g key={q}>
          <text
            x={2}
            y={y + 3.5}
            fontSize="10"
            className="font-mono"
            fill={mute}
          >
            {q}
          </text>
          <line x1={22} y1={y} x2={288} y2={y} stroke={edge} strokeWidth={2} />
          <rect
            x={30}
            y={y - 11}
            width={22}
            height={22}
            rx={5}
            fill="rgb(var(--color-surface))"
            stroke={edge}
          />
          <text
            x={41}
            y={y + 3.5}
            textAnchor="middle"
            fontSize="11"
            className="font-mono"
            fill={ink}
          >
            0
          </text>
        </g>
      ))}
      {chip(xH, y0)}
      {broken ? (
        <g>
          {/* the removed link leaves an empty dashed slot on q0 */}
          <rect
            x={xL - 15}
            y={y0 - 15}
            width={30}
            height={30}
            rx={7}
            fill="none"
            stroke={edge}
            strokeDasharray="3 3"
          />
          {chip(xL, y1)}
        </g>
      ) : (
        <g>
          <line x1={xL} y1={y0} x2={xL} y2={y1} stroke={accent} strokeWidth={2} />
          <circle cx={xL} cy={y0} r={5} fill={accent} />
          <circle
            cx={xL}
            cy={y1}
            r={10}
            fill="none"
            stroke={accent}
            strokeWidth={2}
          />
          <line
            x1={xL}
            y1={y1 - 10}
            x2={xL}
            y2={y1 + 10}
            stroke={accent}
            strokeWidth={2}
          />
          <line
            x1={xL - 10}
            y1={y1}
            x2={xL + 10}
            y2={y1}
            stroke={accent}
            strokeWidth={2}
          />
        </g>
      )}
    </svg>
  );
}
