import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
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
      >
        Load preset <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        // Anchor on mobile vs desktop differs so the popover never clips:
        //   - Mobile (<md): `left-0` — popover extends rightwards from the
        //     button's left edge. On a ~390px iPhone, that keeps the full
        //     256px popover inside the viewport.
        //   - Desktop (≥md): `md:right-0` — popover aligns to the button's
        //     right edge and extends leftwards, staying flush with the
        //     right-hand cluster (Clear / Run pipeline).
        <div
          role="menu"
          className="absolute top-full mt-1 rounded-lg border border-edge bg-surface shadow-xl z-20 p-1.5 flex flex-col gap-0.5 left-0 md:left-auto md:right-0 w-[min(16rem,calc(100vw-1.5rem))]"
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
