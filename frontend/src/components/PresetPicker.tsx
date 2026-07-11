import { useCallback, useRef, useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import { PIPELINE_PRESETS } from "../lib/presets";
import { useApp } from "../lib/store";
import { useDismissOn } from "../lib/useDismissOn";

/**
 * "Load preset" button that opens a small popover listing the named
 * pipelines from the preset registry. Dismissed on outside-click or
 * Escape. Picking a preset replaces the whole graph.
 */
export function PresetPicker({ onPick }: { onPick: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Authoring lock (audit S2): a preset swap replaces the whole graph —
  // never allowed under a run in progress.
  const running = useApp((s) => s.running);

  useDismissOn(open, rootRef, useCallback(() => setOpen(false), []));

  return (
    <div ref={rootRef} className="relative">
      {/* Standard outline `btn`, deliberately NOT btn-secondary: the
          canvas toolbar reserves accent color for exactly one control
          (Run). The old accent2 pill made this secondary action read
          as a competing CTA. h-8 = the toolbar's uniform control
          height; the label lg-gates like its Auto-connect/Clear row
          siblings (icon + chevron still signal the dropdown). */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={running}
        className="btn h-8 disabled:opacity-40 disabled:cursor-not-allowed"
        title={
          running
            ? "Locked while a run is in progress"
            : "Load a preset pipeline onto the canvas"
        }
        aria-label="Load a preset pipeline"
      >
        <Layers className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Load preset</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        // Mobile (<sm): this button sits in the right-hand cluster of the
        // toolbar, so anchoring `left-0` pushed the popover past the right
        // viewport edge. Pin it with `fixed right-3 top-14` instead so it
        // always stays inside the viewport — same pattern PapersPopover
        // and DevelopersPopover use. The header is z-40, and a fixed
        // child with `z-30` stacks cleanly above React Flow.
        //
        // Desktop (≥sm): `absolute right-0 top-full` anchors it to the
        // button and extends leftwards under the right-hand toolbar cluster.
        <div
          role="menu"
          className="fixed right-3 top-14 sm:absolute sm:right-0 sm:top-full sm:mt-1 rounded-lg border border-edge bg-surface shadow-xl z-30 p-1.5 flex flex-col gap-0.5 w-[min(18rem,calc(100vw-1.5rem))]"
        >
          {PIPELINE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="menuitem"
              onClick={() => {
                onPick(p.key);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-surfaceAlt transition-colors border border-transparent hover:border-edge/60"
            >
              <div className="text-sm text-ink font-medium">{p.label}</div>
              <div className="text-[11px] text-mute leading-snug mt-0.5">
                {p.tagline}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
