import { useEffect, useRef, useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import { PIPELINE_PRESETS } from "../lib/presets";

/**
 * "Load preset" button that opens a small popover listing the named
 * pipelines from the preset registry. Dismissed on outside-click or
 * Escape. Picking a preset replaces the whole graph.
 */
export function PresetPicker({ onPick }: { onPick: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as globalThis.Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary"
        title="Load a preset pipeline onto the canvas"
        aria-label="Load a preset pipeline"
      >
        <Layers className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Load preset</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        // Mobile (<sm): this button sits in the right-hand cluster of the
        // toolbar, so anchoring `left-0` pushed the popover past the right
        // viewport edge. Pin it with `fixed right-3 top-14` instead so it
        // always stays inside the viewport — same pattern PapersPopover
        // and DevelopersPopover use. The header is z-20, and a fixed
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
