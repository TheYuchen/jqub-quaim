import { useState } from "react";
import { AlertCircle, Camera, Check, Loader2 } from "lucide-react";
import type { SharePayload } from "../lib/share";
import { exportFigure } from "../lib/figureExport";

/**
 * Small camera button that exports its host view as a paper figure
 * (SVG + PNG + .provenance.json sidecar — see lib/figureExport.ts).
 * Placed on the canvas toolbar, the Multiverse board header, and the
 * Evidence pane header. The button itself never appears in exports
 * (figureExport strips all <button> elements from the clone).
 */
export function FigureExportButton({
  getTarget,
  name,
  view,
  getGraph,
  className = "",
  labelBreakpoint,
}: {
  /** Resolve the DOM subtree to export at click time. */
  getTarget: () => HTMLElement | SVGSVGElement | null;
  /** Download basename (also names the provenance sidecar). */
  name: string;
  /** Provenance view key: canvas | multiverse | evidence-<tab>. */
  view: string;
  /** Canvas graph to embed in the provenance, when the host knows it. */
  getGraph?: () => SharePayload | null;
  className?: string;
  /** Show a text label at/above this breakpoint (icon-only otherwise). */
  labelBreakpoint?: "sm" | "md" | "lg";
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );

  const onClick = async () => {
    const target = getTarget();
    if (!target || state === "busy") return;
    setState("busy");
    try {
      await exportFigure(target, {
        name,
        view,
        graph: getGraph ? getGraph() : null,
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
      onClick={() => void onClick()}
      data-marker="figure-export"
      className={`btn ${className}`}
      title="Export this view as a paper figure: SVG + PNG with embedded provenance (run ids, seeds, config hashes, graph) + a .provenance.json sidecar"
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
