import { useRef, useState } from "react";
import { AlertCircle, Camera, Check, Loader2 } from "lucide-react";
import type { SharePayload } from "../lib/share";
import { exportFigure } from "../lib/figureExport";

/**
 * Small camera button that exports its host view as a paper figure
 * (one .bundle.zip: SVG + PNG + .provenance.json sidecar — see
 * lib/figureExport.ts).
 * Placed on the canvas toolbar, the Multiverse board header, the
 * Evidence pane header and the Evidence theater. The button itself
 * never appears in exports (figureExport strips all <button>
 * elements from the clone).
 *
 * Raster scale: a normal click exports the hybrid PNG at 2.5×;
 * alt/⌥-click OR press-and-hold (≥550 ms) exports at 4× — the
 * print-resolution option for large composite figures. (True-SVG
 * targets are resolution-independent; scale is a no-op there.)
 */
export function FigureExportButton({
  getTarget,
  name,
  view,
  getGraph,
  getTracePosition,
  className = "",
  labelBreakpoint,
}: {
  /** Resolve the DOM subtree to export at click time. */
  getTarget: () => HTMLElement | SVGSVGElement | null;
  /** Download basename (names the bundle zip and its contents). */
  name: string;
  /** Provenance view key: canvas | multiverse | evidence-<tab>. */
  view: string;
  /** Canvas graph to embed in the provenance, when the host knows it. */
  getGraph?: () => SharePayload | null;
  className?: string;
  /** Evidence-theater trace scrubber position at click time (batch
   *  k); embedded as provenance.trace_position + filename suffix. */
  getTracePosition?: () => number | null;
  /** Show a text label at/above this breakpoint (icon-only otherwise). */
  labelBreakpoint?: "sm" | "md" | "lg";
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  // Long-press detection (the touch counterpart to alt-click for the
  // 4× print-resolution raster).
  const longPress = useRef(false);
  const pressTimer = useRef<number | null>(null);
  const pressStart = () => {
    longPress.current = false;
    if (pressTimer.current != null) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPress.current = true;
    }, 550);
  };
  const pressEnd = () => {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  // Abandoned press (pointer leaves without a click): the 4× flag must
  // not leak into the NEXT normal click (audit S3). pointerup keeps
  // the flag — the click event that consumes it follows immediately.
  const pressCancel = () => {
    pressEnd();
    longPress.current = false;
  };

  const onClick = async (e: React.MouseEvent) => {
    const hires = e.altKey || longPress.current;
    longPress.current = false;
    const target = getTarget();
    if (!target || state === "busy") return;
    setState("busy");
    try {
      await exportFigure(target, {
        name,
        view,
        graph: getGraph ? getGraph() : null,
        scale: hires ? 4 : 2.5,
        tracePosition: getTracePosition ? getTracePosition() : null,
      });
      setState("done");
    } catch {
      setState("error");
    } finally {
      window.setTimeout(() => setState("idle"), 2000);
    }
  };

  const labelVisibility = labelBreakpoint
    ? { sm: "hidden sm:inline", md: "hidden md:inline", lg: "hidden lg:inline" }[
        labelBreakpoint
      ]
    : "hidden";

  const Icon =
    state === "busy"
      ? Loader2
      : state === "done"
        ? Check
        : state === "error"
          ? AlertCircle
          : Camera;

  return (
    <button
      type="button"
      onClick={(e) => void onClick(e)}
      onPointerDown={pressStart}
      onPointerUp={pressEnd}
      onPointerLeave={pressCancel}
      onPointerCancel={pressCancel}
      data-marker="figure-export"
      className={`btn ${className}`}
      title="Export this view as a paper figure: one .bundle.zip holding the SVG + PNG with embedded provenance (run ids, seeds, config hashes, graph) + a .provenance.json sidecar. Alt/⌥-click or press-and-hold for the 4× print-resolution PNG (default 2.5×)."
      aria-label="Export figure"
    >
      <Icon
        className={`w-3.5 h-3.5 ${state === "busy" ? "animate-spin" : ""} ${
          state === "done" ? "text-ok" : state === "error" ? "text-danger" : ""
        }`}
      />
      <span className={labelVisibility}>Figure</span>
    </button>
  );
}
