import { useRef } from "react";
import {
  NODE_CATALOG,
  synthesizePluginSpec,
  type NodeKind,
  type NodeSpec,
  type PluginNodeSpec,
} from "../lib/nodeCatalog";
import type { Family } from "../lib/autoConnect";
import { useApp } from "../lib/store";
import { useDismissOn } from "../lib/useDismissOn";

/**
 * Mini contextual chooser for on-canvas insertion (marker:
 * canvas-insert-menu) — a compact form of the Add-block popover's
 * stage-section list. FlowCanvas opens it two ways:
 *
 *   - connect-end on empty pane: `families` = nextFamilies() of the
 *     dragged-from node's family, so the menu offers ONLY blocks that
 *     can legally follow per the auto-connect grammar; picking also
 *     wires the pending connection.
 *   - double-click on empty pane: `families` = null → all five
 *     stages, no wiring.
 *
 * ~240px wide, internal scroll past ~6 rows, Escape / outside-click
 * dismiss via the useDismissOn idiom. Positioned by the caller inside
 * the canvas wrapper (absolute, clamped to fit).
 */

const STAGE_ORDER: { key: Family; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "backend", label: "Backend" },
  { key: "algorithm", label: "Algorithm" },
  { key: "metric", label: "Metric" },
  { key: "sink", label: "Sink" },
];

export function CanvasInsertMenu({
  left,
  top,
  families,
  hasSource,
  onPick,
  onClose,
}: {
  left: number;
  top: number;
  /** Allowed families; null = unfiltered (double-click path). */
  families: Family[] | null;
  /** True when picking will also wire an edge (connect-end path). */
  hasSource: boolean;
  onPick: (kind: NodeKind) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissOn(true, rootRef, onClose);

  const plugins = useApp((s) => s.plugins);
  const combined: (NodeSpec | PluginNodeSpec)[] = [
    ...NODE_CATALOG,
    ...plugins.map(synthesizePluginSpec),
  ];
  const allowed = families
    ? combined.filter((n) => families.includes(n.family))
    : combined;

  return (
    <div
      ref={rootRef}
      data-marker="canvas-insert-menu"
      role="menu"
      aria-label={
        hasSource
          ? "Insert a block that can follow the dragged-from block"
          : "Insert a block here"
      }
      className="absolute z-30 w-[240px] rounded-lg border border-edge bg-surface shadow-xl flex flex-col overflow-hidden"
      style={{ left, top }}
    >
      <div className="px-2.5 py-1.5 border-b border-edge shrink-0 text-[9px] uppercase tracking-widest text-mute font-medium">
        {hasSource ? "Add & connect what follows" : "Add block here"}
      </div>
      <div className="max-h-[248px] overflow-y-auto p-1">
        {STAGE_ORDER.map((st) => {
          const items = allowed.filter((n) => n.family === st.key);
          if (items.length === 0) return null;
          return (
            <div key={st.key} className="mb-0.5">
              <div className="px-1.5 pt-1 pb-0.5 text-[9px] uppercase tracking-widest text-mute/60 font-medium">
                {st.label}
              </div>
              {items.map((n) => {
                const isPlugin = "isPlugin" in n && n.isPlugin;
                const Icon = n.icon;
                return (
                  <button
                    key={n.kind}
                    type="button"
                    role="menuitem"
                    onClick={() => onPick(n.kind as NodeKind)}
                    title={`${n.tagline} — ${n.description}`}
                    aria-label={`Insert ${n.label} block`}
                    className="w-full h-8 flex items-center gap-2 px-1.5 rounded-md text-left hover:bg-surfaceAlt transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {isPlugin ? (
                      <span
                        className="shrink-0 w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white"
                        style={{
                          backgroundColor: (n as PluginNodeSpec).pluginColor,
                        }}
                        aria-hidden
                      >
                        {(n as PluginNodeSpec).initials}
                      </span>
                    ) : (
                      <span
                        className={`shrink-0 w-4 h-4 rounded border ${n.accentRing} bg-surface flex items-center justify-center ${n.accent}`}
                        aria-hidden
                      >
                        <Icon className="w-2.5 h-2.5" strokeWidth={2} />
                      </span>
                    )}
                    <span className="flex-1 min-w-0 text-[11px] text-ink truncate">
                      {n.label}
                      {isPlugin && (
                        <span className="ml-1 text-[9px] uppercase tracking-wider text-mute/60">
                          plugin
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
