// Uniform transformation signature — the same visual vocabulary for
// what ANY step did to the circuit, whether it's QuCAD pruning,
// CompVQC folding, a transpile, or a user plugin. The executor
// captures before/after structural snapshots centrally; this module
// renders them as a designed GLYPH (the "delta strip") rather than
// text chips, so that a composition of steps can be read as a row of
// small multiples and compared at a glance.
//
// ── Delta-strip design rationale (cited in the paper) ──────────────
//
// 1. FIXED CHANNEL ORDER. The strip always shows the same four
//    channels in the same order, top-to-bottom: D(epth), G(ates),
//    P(arams), Q(ubits). Position — not a label — identifies the
//    channel, which is what makes the glyph learnable: after seeing
//    two or three strips the reader stops decoding and starts
//    pattern-matching ("top-heavy strip = depth optimizer"). The
//    cost-like channels (D, G, P — the things optimizers try to
//    shrink) sit together at the top; the width channel (Q) anchors
//    the bottom. We use horizontal bars stacked vertically, mirrored
//    around a CENTER VERTICAL zero axis, because at tile scale
//    (14px tall) four 2px-high rows still give each bar ~20px of
//    horizontal run to encode magnitude — the transposed variant
//    (vertical bars) would compress magnitude into ±6px, below
//    useful resolution.
//
// 2. RELATIVE-CHANGE NORMALIZATION. Bar length encodes
//    delta / before, capped at ±100%. Absolute deltas are
//    incomparable across circuits (−6 depth is dramatic on a depth-12
//    circuit, noise on depth-600); normalizing by the BEFORE value
//    makes "halved the depth" the same visual size on any circuit,
//    which is the invariant a comparison table needs. The cap keeps
//    growth (e.g. transpile blow-ups) from destroying the scale; the
//    printed numbers carry exactness where it matters. A channel
//    that appears from zero (before=0, delta>0, e.g. parameters
//    introduced by an ansatz) renders at full scale.
//
// 3. DIVERGING ENCODING WITH GOAL-ANCHORED COLOR. Bars extend LEFT
//    of the axis for decreases (ok/green — every optimizer in this
//    catalog aims to shrink cost channels) and RIGHT for increases
//    (warn/amber). Qubit-count changes are neutral (accent/blue in
//    either direction): at these scales width is a property, not a
//    cost, and pruning a qubit is not automatically "good". Sign is
//    thus double-encoded (side + hue) and survives both colorblind
//    viewing and grayscale print.
//
// 4. CONSTANT SILHOUETTE. Zero-change channels render as a faint
//    tick on the axis instead of disappearing. Every strip therefore
//    has the same 4-row frame; glyph recognition (and step-aligned
//    comparison across runs) depends on that constant frame — a
//    missing row would re-introduce per-glyph decoding.
//
// All fills use currentColor driven by the theme token classes
// (text-ok / text-warn / text-accent / text-mute), so the glyph
// re-colors under all three themes (dark / light / GMU) for free.
//
// Two densities:
//   size="tile"  — 46×14, no labels (tooltip carries numbers); for
//                  canvas nodes and comparison-table cells;
//   size="card"  — 180×56, with channel letters + printed deltas;
//                  for the results pane.

import type { StepResult } from "../lib/api";
import CircuitDiff from "./CircuitDiff";

export interface TransformationPayload {
  before: {
    num_qubits: number;
    depth: number;
    size: number;
    num_parameters: number;
    ops: Record<string, number>;
  } | null;
  after: TransformationPayload["before"];
  delta: {
    num_qubits: number;
    depth: number;
    size: number;
    num_parameters: number;
  };
  ops_delta: Record<string, number>;
  changed: boolean;
}

export function transformationOf(
  step: StepResult | undefined | null,
): TransformationPayload | null {
  const t = step?.transformation;
  if (!t || typeof t !== "object") return null;
  return t as unknown as TransformationPayload;
}

// Fixed strip order (design point 1). This array is the single
// source of truth: glyph rows, tooltip lines and the numeric grid
// all iterate it, so every surface presents channels identically.
const CHANNELS: Array<{
  key: keyof TransformationPayload["delta"];
  short: string;
  label: string;
  neutral?: boolean;
}> = [
  { key: "depth", short: "D", label: "depth" },
  { key: "size", short: "G", label: "gates" },
  { key: "num_parameters", short: "P", label: "params" },
  { key: "num_qubits", short: "Q", label: "qubits", neutral: true },
];

function deltaTone(v: number, neutral?: boolean): string {
  if (v === 0) return "text-mute";
  if (neutral) return "text-accent";
  return v < 0 ? "text-ok" : "text-warn";
}

function fmtDelta(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

/** Relative change, capped at ±1 (design point 2). before<=0 with a
 *  nonzero delta means the channel appeared from nothing — render at
 *  full scale in the delta's direction. */
function relChange(before: number | undefined, delta: number): number {
  if (delta === 0) return 0;
  if (!before || before <= 0) return delta > 0 ? 1 : -1;
  return Math.max(-1, Math.min(1, delta / before));
}

function sigTooltip(t: TransformationPayload): string {
  return `Circuit transformation (Δ / before):\n${CHANNELS.map((c) => {
    const b = t.before ? t.before[c.key] : 0;
    return `${c.label}: ${fmtDelta(t.delta[c.key])} (was ${b})`;
  }).join("\n")}`;
}

// Per-density geometry. Tile numbers are tuned so the strip stays
// legible at 100% zoom on a canvas node: 2px bars with 1px gaps read
// as distinct rows down to ~12px total height.
const GEOM = {
  tile: {
    w: 46,
    h: 14,
    barH: 2,
    gap: 1,
    padY: 1.5,
    cx: 23,
    half: 20,
    minBar: 2, // a real change is never mistaken for a zero tick
    tickW: 1,
    labels: false,
  },
  card: {
    w: 180,
    h: 56,
    barH: 5,
    gap: 9,
    padY: 4.5,
    cx: 94,
    half: 44,
    minBar: 3,
    tickW: 1.5,
    labels: true,
  },
} as const;

/** The delta-strip glyph itself, rendering a raw transformation
 *  payload. Exported so the canvas tile, the results card and the
 *  comparison table all draw the exact same encoding. */
export function SignatureGlyph({
  t,
  size = "tile",
  className = "",
  stretch = false,
}: {
  t: TransformationPayload;
  size?: "tile" | "card";
  className?: string;
  /** Fill the parent's width (preserveAspectRatio="none"). Only the
   *  horizontal axis stretches, and every bar scales by the same
   *  factor around the centered zero axis — the relative-magnitude
   *  encoding is invariant under this transform, so a stretched
   *  strip stays comparable with an unstretched one. Used on canvas
   *  node faces where the glyph anchors the full tile width. */
  stretch?: boolean;
}) {
  const g = GEOM[size];
  const aria = `delta-strip: ${CHANNELS.map(
    (c) => `${c.label} ${fmtDelta(t.delta[c.key])}`,
  ).join(", ")}`;
  return (
    <svg
      viewBox={`0 0 ${g.w} ${g.h}`}
      width={stretch ? "100%" : g.w}
      height={g.h}
      preserveAspectRatio={stretch ? "none" : "xMidYMid meet"}
      className={`delta-strip ${className}`}
      role="img"
      aria-label={aria}
    >
      {/* zero axis — part of the constant frame (design point 4) */}
      <line
        x1={g.cx}
        y1={0.5}
        x2={g.cx}
        y2={g.h - 0.5}
        stroke="currentColor"
        strokeWidth={1}
        className="text-mute"
        opacity={0.45}
      />
      {CHANNELS.map((c, i) => {
        const y = g.padY + i * (g.barH + g.gap);
        const cy = y + g.barH / 2;
        const d = t.delta[c.key];
        const rel = relChange(t.before ? t.before[c.key] : 0, d);
        const tone = deltaTone(d, c.neutral);
        let bar;
        if (d === 0) {
          // faint tick: keeps the 4-row silhouette constant
          bar = (
            <rect
              x={g.cx - g.tickW / 2}
              y={y}
              width={g.tickW}
              height={g.barH}
              fill="currentColor"
              className="text-mute"
              opacity={0.35}
            />
          );
        } else {
          const len = Math.max(g.minBar, Math.abs(rel) * g.half);
          bar = (
            <rect
              x={rel < 0 ? g.cx - len : g.cx}
              y={y}
              width={len}
              height={g.barH}
              rx={size === "card" ? 1 : 0.5}
              fill="currentColor"
              className={tone}
              opacity={0.9}
            />
          );
        }
        return (
          <g key={c.key}>
            {bar}
            {g.labels && (
              <>
                <text
                  x={8}
                  y={cy + 3}
                  fontSize={8}
                  fill="currentColor"
                  className="text-mute font-mono"
                >
                  {c.short}
                </text>
                <text
                  x={g.w - 4}
                  y={cy + 3}
                  fontSize={8}
                  textAnchor="end"
                  fill="currentColor"
                  className={`${tone} font-mono`}
                >
                  {d === 0 ? "·" : fmtDelta(d)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Compact canvas-tile form. Renders nothing for pass-through steps
 *  — an unchanged circuit needs no ink on the canvas (the constant-
 *  silhouette rule applies WITHIN a strip; whether to show a strip
 *  at all is the node's call, and canvas real estate is scarce). */
export function SignatureTile({
  step,
  stretch = false,
}: {
  step: StepResult;
  stretch?: boolean;
}) {
  const t = transformationOf(step);
  if (!t || !t.changed) return null;
  return (
    <div
      className={`mt-1 leading-none ${stretch ? "w-full" : ""}`}
      title={sigTooltip(t)}
    >
      <SignatureGlyph t={t} size="tile" stretch={stretch} />
    </div>
  );
}

/** Full results-card form: card-size glyph beside the before → after
 *  numeric grid (the glyph gives shape, the numbers give exactness),
 *  then a per-op diverging bar list. Pass-through steps get an
 *  explicit one-liner so the reader can tell "read the circuit, left
 *  it alone" from "no circuit in scope at all" (renders nothing). */
export function SignatureCard({ step }: { step: StepResult }) {
  const t = transformationOf(step);
  if (!t) return null;
  if (!t.changed) {
    return (
      <div className="text-[10px] text-mute mt-1">
        Circuit pass-through — this step read the circuit but did not
        modify it.
      </div>
    );
  }
  const b = t.before;
  const a = t.after;
  // Per-op detail, sorted by |delta| so the biggest structural edit
  // leads; same diverging left/right + ok/warn encoding as the strip.
  const opEntries = Object.entries(t.ops_delta).sort(
    (x, y) => Math.abs(y[1]) - Math.abs(x[1]),
  );
  const opMax = Math.max(1, ...opEntries.map(([, d]) => Math.abs(d)));
  return (
    <div className="panel-alt p-2 mt-1 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-mute">
        circuit transformation
      </div>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <SignatureGlyph t={t} size="card" className="shrink-0" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 flex-1 min-w-[140px]">
          {CHANNELS.map((c) => {
            const d = t.delta[c.key];
            return (
              <div key={c.key} className="text-[10px]">
                <div className="text-mute">{c.label}</div>
                <div className="font-mono">
                  {b ? b[c.key] : 0}
                  <span className="text-mute"> → </span>
                  {a ? a[c.key] : 0}
                  {d !== 0 && (
                    <span className={`ml-1 ${deltaTone(d, c.neutral)}`}>
                      {fmtDelta(d)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {opEntries.length > 0 && (
        <div className="space-y-0.5">
          {opEntries.map(([op, d]) => {
            // bar width as % of the half-track, normalized by the
            // largest |op delta| in THIS step (op counts are only
            // comparable within a step, unlike the channel strip)
            const pct = (Math.abs(d) / opMax) * 50;
            return (
              <div
                key={op}
                className="flex items-center gap-1.5 text-[9px] font-mono leading-none"
                title={`${op}: ${fmtDelta(d)} gates`}
              >
                <span className="w-14 shrink-0 truncate text-right text-mute">
                  {op}
                </span>
                <div className="relative h-2 w-24 shrink-0">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-mute/40" />
                  <div
                    className={`absolute top-0.5 bottom-0.5 rounded-sm ${
                      d < 0 ? "bg-ok/80" : "bg-warn/80"
                    }`}
                    style={{
                      left: d < 0 ? `${50 - pct}%` : "50%",
                      width: `${Math.max(pct, 2)}%`,
                    }}
                  />
                </div>
                <span className={d < 0 ? "text-ok" : "text-warn"}>
                  {fmtDelta(d)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <CircuitDiff t={t} />
    </div>
  );
}
