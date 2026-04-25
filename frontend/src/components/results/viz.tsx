// Small, reusable visual primitives for the per-algorithm result cards.
//
// Nothing in here is algorithm-specific: Stat / Caption / Gauge /
// DepthCompare / Sparkline / OpBar / KvRow are just formatting atoms.
// The cards in `cards.tsx` wire them up into the QuBound / QuCAD /
// CompressVQC / Fidelity / Output views.

import type { ReactNode } from "react";

/** A big-number stat tile used in the per-algorithm cards. */
export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="panel px-2 py-1.5 text-center">
      <div className="text-[10px] uppercase tracking-wider text-mute">{label}</div>
      <div className="font-mono text-ink text-sm leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-mute leading-tight">{sub}</div>}
    </div>
  );
}

/** Plain-language caption sitting above the numbers. */
export function Caption({ children }: { children: ReactNode }) {
  return <p className="text-[11px] text-mute leading-relaxed">{children}</p>;
}

/**
 * A horizontal meter from 0 to 1.
 *
 * - default (`inverted=false`): low values are green ("low error is good"
 *   for QuBound), high values are red.
 * - `inverted`: high values are green ("high fidelity is good").
 */
export function Gauge({
  value,
  inverted = false,
}: {
  value: number;
  inverted?: boolean;
}) {
  const v = Math.max(0, Math.min(1, value));
  const pct = v * 100;
  // Color bands.
  const good = inverted ? v >= 0.95 : v < 0.05;
  const mid = inverted ? v >= 0.8 && v < 0.95 : v >= 0.05 && v < 0.15;
  const color = good
    ? "var(--color-ok, #2dd4bf)"
    : mid
      ? "var(--color-warn, #f4a261)"
      : "var(--color-danger, #f72585)";
  return (
    <div className="w-32 shrink-0">
      <div className="relative h-2.5 w-full rounded-full bg-canvas border border-edge overflow-hidden">
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-mute mt-0.5 font-mono">
        <span>0</span>
        <span>1</span>
      </div>
    </div>
  );
}

/** Compact comparison of two integer values as side-by-side proportional bars. */
export function DepthCompare({ before, after }: { before: number; after: number }) {
  const max = Math.max(before, after, 1);
  return (
    <div className="space-y-1">
      <CompareBar label="before" value={before} max={max} tone="mute" />
      <CompareBar label="after" value={after} max={max} tone="ok" />
    </div>
  );
}

function CompareBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "ok" | "mute";
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const bg = tone === "ok" ? "bg-ok/70" : "bg-mute/40";
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className="w-14 text-mute shrink-0">{label}</div>
      <div className="flex-1 h-3 rounded bg-canvas border border-edge overflow-hidden relative">
        <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-10 text-right font-mono text-ink">{value}</div>
    </div>
  );
}

/** Horizontal bar for a single gate count. */
export function OpBar({
  name,
  count,
  max,
}: {
  name: string;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className="w-14 text-mute font-mono truncate shrink-0">{name}</div>
      <div className="flex-1 h-2 rounded bg-canvas border border-edge overflow-hidden">
        <div className="h-full bg-accent/50" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 text-right font-mono text-ink">{count}</div>
    </div>
  );
}

/** Tiny SVG sparkline.
 *
 * Defensive about input shape: accepts any numeric array (negatives are
 * fine — the y-axis floor is `Math.min(...data, 0)`), returns null for
 * fewer than 2 points, and clamps the y-range to ≥1 so a flat trace
 * doesn't divide-by-zero. In practice the call sites pass strictly
 * non-negative values (QuCAD loss trace, Qshot pilot fidelities). */
export function Sparkline({
  data,
  height = 32,
}: {
  data: number[];
  height?: number;
}) {
  if (data.length < 2) return null;
  const w = 200;
  const h = height;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (w - 4) + 2;
      const y = h - 2 - ((v - min) / range) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-auto"
      preserveAspectRatio="none"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-accent2"
      />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * (w - 4) + 2;
        const y = h - 2 - ((v - min) / range) * (h - 4);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2}
            fill="currentColor"
            className="text-accent2"
          />
        );
      })}
    </svg>
  );
}

/** Generic key/value row used by the "raw summary" drawers. */
export function KvRow({ k, v }: { k: string; v: unknown }) {
  if (k === "diagram_text" && typeof v === "string") {
    return null; // handled by dedicated card
  }
  if (Array.isArray(v)) {
    return (
      <div className="flex justify-between items-center gap-2 text-[11px]">
        <span className="text-mute">{k}</span>
        <span className="font-mono text-ink truncate max-w-[60%] text-right">
          [{v.slice(0, 6).map(String).join(", ")}
          {v.length > 6 ? ", …" : ""}]
        </span>
      </div>
    );
  }
  if (typeof v === "object" && v !== null) {
    return (
      <div className="text-[11px]">
        <div className="text-mute">{k}</div>
        <div className="font-mono text-ink text-[11px] pl-2">
          {Object.entries(v as Record<string, unknown>).map(([kk, vv]) => (
            <div key={kk} className="flex gap-2">
              <span className="text-mute">{kk}</span>
              <span>{String(vv)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-between items-center gap-2 text-[11px]">
      <span className="text-mute">{k}</span>
      <span className="font-mono text-ink truncate max-w-[60%] text-right">
        {fmt(v)}
      </span>
    </div>
  );
}

/** Human-friendly number formatting. Ints stay integer; tiny floats go
 *  scientific; everything else gets 4 decimals. */
export function fmt(v: unknown): string {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return String(v);
    if (Math.abs(v) < 1e-3 && v !== 0) return v.toExponential(3);
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(4);
  }
  return String(v);
}

/** `v` if it's a finite number, else `fallback`. */
export function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
