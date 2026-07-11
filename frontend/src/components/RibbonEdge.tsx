// Circuit ribbon edge — the canvas's flagship encoding.
//
// After a run, every circuit-flow edge (source → algorithm → metric →
// sink chain) is drawn as a tapered RIBBON whose band thickness at
// each end encodes the circuit's "mass" (gate count) AFTER the
// upstream step vs AFTER the downstream step:
//
//   thickness = clamp(1.5 · √gates, 3px, 18px)
//
// The square root is deliberate: a 4× change in gate count reads as a
// 2× change in band width, which keeps toy circuits and transpile
// blow-ups on one legible scale (linear scaling would either flatten
// small circuits or blow the canvas apart on large ones). The band
// tapers linearly from source thickness to target thickness, so each
// downstream transformation is visible as the ribbon narrowing
// (optimizer) or widening (transpiler) INTO the node that causes it.
// When the downstream step shrank the circuit (transformation
// delta.size < 0) the downstream half of the band is tinted ok/green
// at low alpha; grew → warn/amber — optimization visually flows along
// the pipeline. Backend → algorithm side-channel edges never get a
// ribbon: they carry calibration data, not a circuit (FlowCanvas
// keeps those on the default thin/dashed edge type).
//
// Geometry: we sample the same cubic bezier React Flow's default edge
// uses (identical control-point math, curvature 0.25) at 21 points,
// offset each sample along the curve normal by the interpolated
// half-thickness, and close the outline into a filled polygon. Two
// polygons (base over t∈[0,1], tint overlay over t∈[½,1]) let the
// downstream half carry its own hue without gradient-along-a-path
// tricks. A 1px core line (BaseEdge, so selection + dash-animation
// CSS still applies) rides on top and keeps the edge readable at
// ribbon widths near the 3px floor.

import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

export interface RibbonEdgeData extends Record<string, unknown> {
  /** Gate count after the upstream step (source end of the band). */
  srcSize: number;
  /** Gate count after the downstream step; null → unknown, and the
   *  band stays uniform at the source thickness. */
  tgtSize: number | null;
  /** Downstream step's transformation delta.size (<0 = shrank the
   *  circuit, >0 = grew it, 0 = size unchanged). null = the step
   *  reported no transformation at all — "unknown" is distinct from
   *  "unchanged" (audit S3). */
  deltaSize: number | null;
  /** Human-readable flow label ("2 qubits · depth 4 · 7 gates"). */
  flowLabel?: string;
  /** Canvas was edited after the run that produced these numbers —
   *  the whole encoding renders dimmed (FlowCanvas hash check). */
  stale?: boolean;
}

const CURVATURE = 0.25;
// 21 sample points along the bezier — visually indistinguishable from
// a continuous offset curve at canvas zoom levels.
const SAMPLES = 20;

/** √-mass → band thickness in px (see file header for rationale). */
function thicknessFor(size: number): number {
  return Math.min(18, Math.max(3, 1.5 * Math.sqrt(Math.max(0, size))));
}

/** React Flow's default-bezier control offset (mirrors
 *  @xyflow/system's calculateControlOffset so our sampled polygon
 *  hugs the exact same curve getBezierPath draws). */
function controlOffset(distance: number, curvature: number): number {
  return distance >= 0
    ? 0.5 * distance
    : curvature * 25 * Math.sqrt(-distance);
}

function controlPoint(
  pos: Position,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): [number, number] {
  switch (pos) {
    case Position.Left:
      return [x1 - controlOffset(x1 - x2, CURVATURE), y1];
    case Position.Right:
      return [x1 + controlOffset(x2 - x1, CURVATURE), y1];
    case Position.Top:
      return [x1, y1 - controlOffset(y1 - y2, CURVATURE)];
    case Position.Bottom:
      return [x1, y1 + controlOffset(y2 - y1, CURVATURE)];
  }
}

interface Sample {
  x: number;
  y: number;
  /** unit normal */
  nx: number;
  ny: number;
  /** half-thickness at this t */
  hw: number;
}

/** Closed polygon path for samples[from..to]: top offsets forward,
 *  bottom offsets back. */
function outlinePath(samples: Sample[], from: number, to: number): string {
  const top: string[] = [];
  const bot: string[] = [];
  for (let i = from; i <= to; i++) {
    const p = samples[i];
    top.push(`${(p.x + p.nx * p.hw).toFixed(2)},${(p.y + p.ny * p.hw).toFixed(2)}`);
    bot.push(`${(p.x - p.nx * p.hw).toFixed(2)},${(p.y - p.ny * p.hw).toFixed(2)}`);
  }
  bot.reverse();
  return `M${top.join(" L")} L${bot.join(" L")} Z`;
}

export function RibbonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const d = (data ?? {}) as RibbonEdgeData;
  const srcHalf = thicknessFor(d.srcSize ?? 0) / 2;
  const tgtHalf = thicknessFor(d.tgtSize ?? d.srcSize ?? 0) / 2;

  // Same curve getBezierPath draws — reused for the 1px core line and
  // the label anchor.
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: CURVATURE,
  });

  // Cubic bezier control points (identical math to the default edge).
  const [c1x, c1y] = controlPoint(sourcePosition, sourceX, sourceY, targetX, targetY);
  const [c2x, c2y] = controlPoint(targetPosition, targetX, targetY, sourceX, sourceY);

  const samples: Sample[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const u = 1 - t;
    // B(t) and B'(t) of the cubic bezier
    const x =
      u * u * u * sourceX + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * targetX;
    const y =
      u * u * u * sourceY + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * targetY;
    const dx =
      3 * u * u * (c1x - sourceX) + 6 * u * t * (c2x - c1x) + 3 * t * t * (targetX - c2x);
    const dy =
      3 * u * u * (c1y - sourceY) + 6 * u * t * (c2y - c1y) + 3 * t * t * (targetY - c2y);
    const len = Math.hypot(dx, dy);
    // Degenerate tangent (coincident points): fall back to a vertical
    // normal so the band still has width instead of collapsing.
    const nx = len > 1e-6 ? -dy / len : 0;
    const ny = len > 1e-6 ? dx / len : 1;
    samples.push({ x, y, nx, ny, hw: srcHalf + (tgtHalf - srcHalf) * t });
  }

  const basePath = outlinePath(samples, 0, SAMPLES);
  const half = SAMPLES / 2;
  const tint =
    d.deltaSize != null && d.deltaSize < 0
      ? "rgb(var(--color-ok))"
      : d.deltaSize != null && d.deltaSize > 0
        ? "rgb(var(--color-warn))"
        : null;
  const tintPath = tint ? outlinePath(samples, half, SAMPLES) : null;

  const outGates = d.tgtSize ?? d.srcSize ?? 0;
  return (
    <>
      <g
        className="circuit-ribbon"
        // role="img": aria-label on a bare <g> is ignored by most
        // screen readers without an image role (audit S3).
        role="img"
        opacity={d.stale ? 0.45 : undefined}
        aria-label={`circuit-ribbon: ${d.srcSize ?? 0} gates flowing in, ${outGates} gates out${
          d.deltaSize == null
            ? ""
            : d.deltaSize < 0
              ? " (step shrank the circuit)"
              : d.deltaSize > 0
                ? " (step grew the circuit)"
                : " (size unchanged)"
        }${d.stale ? " — canvas edited since this run" : ""}`}
      >
        {/* base band — low-opacity accent so ribbons layer politely
            over the dot grid and under node cards */}
        <path d={basePath} fill="rgb(var(--color-accent))" fillOpacity={0.15} stroke="none" />
        {/* downstream-half tint: green = the NEXT step shrank the
            circuit, amber = it grew it */}
        {tintPath && <path d={tintPath} fill={tint!} fillOpacity={0.16} stroke="none" />}
      </g>
      {/* 1px core line on top — keeps selection/animation semantics of
          a normal edge and stays legible when the band nears the 3px
          floor. Inline strokeWidth beats the 1.5px stylesheet rule. */}
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 1 }} />
      {d.flowLabel && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute pointer-events-none font-mono text-[9px] font-medium text-ink bg-surface/95 border border-edge rounded px-1 py-px"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              ...(d.stale ? { opacity: 0.45 } : {}),
            }}
          >
            {d.flowLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
