import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { api } from "../lib/api";
import {
  NODE_CATALOG,
  synthesizePluginSpec,
  type NodeKind,
  type NodeSpec,
  type PluginNodeSpec,
} from "../lib/nodeCatalog";
import { useApp } from "../lib/store";
import { bumpPluginsRev, getUserId } from "../lib/userId";
import { useDismissOn } from "../lib/useDismissOn";

/**
 * "+ Add block" — THE block chooser (marker: block-chooser).
 *
 * The palette's PERMANENT chrome cost is exactly the one trigger
 * button this component renders in canvas-toolbar row 1; the whole
 * catalog — search, five stage sections, plugin management — lives in
 * a popover that exists only while open. That is the design principle
 * that killed the pipeline shelf (an always-visible ~300px strip that
 * grew with the catalog at the canvas's expense): chrome cost stays
 * constant, growth lands in on-demand surfaces.
 *
 * The popover still TEACHES the grammar the shelf used to spell out:
 * five stage sections in pipeline order — Source → Backend →
 * Algorithm → Metric → Sink, each a 10px uppercase header plus the
 * shelf's one-line tagline — the same canonical chain auto-connect
 * enforces. Plugins appear inside their declared family's section.
 *
 * Interactions:
 *   - click a row → queue the kind through the pendingBlockKinds
 *     store bridge (FlowCanvas creates the node + auto-connects).
 *     The popover STAYS OPEN so multiple blocks can be added by
 *     clicking; the clicked row flashes "added ✓".
 *   - drag a row onto the canvas — identical "application/reactflow"
 *     dataTransfer payload as the old shelf tiles, so FlowCanvas's
 *     onDrop and splice-on-edge targeting work unchanged. The popover
 *     closes on dragstart (deferred one tick: synchronously removing
 *     the drag source cancels the HTML5 drag in Chromium).
 *   - search filters rows live across all sections.
 *   - tap-to-add IS the touch path (the shelf's PointerEvent
 *     touch-drag bridge died with the shelf).
 *   - rows disable while a run is in progress — same authoring lock
 *     as the preset picker and param editors.
 */

const STAGE_META: {
  key: NodeSpec["family"];
  label: string;
  tagline: string;
}[] = [
  { key: "source", label: "Source", tagline: "where the circuit comes from" },
  { key: "backend", label: "Backend", tagline: "the noisy machine" },
  { key: "algorithm", label: "Algorithm", tagline: "transforms the circuit" },
  { key: "metric", label: "Metric", tagline: "measures the result" },
  { key: "sink", label: "Sink", tagline: "collects the evidence" },
];

export function BlockPicker() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const addBlocksToCanvas = useApp((s) => s.addBlocksToCanvas);
  const running = useApp((s) => s.running);

  useDismissOn(open, rootRef, useCallback(() => setOpen(false), []));

  // Fresh search + focus it on every open.
  useEffect(() => {
    if (open) {
      setSearch("");
      searchRef.current?.focus();
    }
  }, [open]);

  // Kinds currently on the canvas — a MULTISET (one entry per node)
  // published by FlowCanvas through the store bridge — drives the
  // per-row "n on canvas" count dot.
  const canvasKindsArr = useApp((s) => s.canvasKinds);
  const canvasCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of canvasKindsArr) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, [canvasKindsArr]);

  // "added ✓" flash on the row just clicked. A single kind + timer is
  // enough: rapid multi-adds move the flash to the latest row, which
  // reads correctly.
  const [flashKind, setFlashKind] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    },
    [],
  );
  const addOne = (kind: NodeKind) => {
    addBlocksToCanvas([kind]);
    setFlashKind(kind);
    if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashKind(null), 900);
  };

  // Deferred close on row dragstart — see the component doc comment.
  const closeForDrag = () => {
    window.setTimeout(() => setOpen(false), 0);
  };

  // Merge built-ins with this browser's uploaded plugin manifests so
  // plugins list under their declared family alongside the built-ins.
  const plugins = useApp((s) => s.plugins);
  const setPlugins = useApp((s) => s.setPlugins);
  const combined: (NodeSpec | PluginNodeSpec)[] = useMemo(
    () => [...NODE_CATALOG, ...plugins.map(synthesizePluginSpec)],
    [plugins],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return combined;
    const q = search.toLowerCase();
    return combined.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.tagline.toLowerCase().includes(q) ||
        n.family.toLowerCase().includes(q) ||
        n.kind.toLowerCase().includes(q),
    );
  }, [search, combined]);

  const handleDeletePlugin = async (kind: string) => {
    try {
      await api.deletePlugin(getUserId(), kind);
      const fresh = await api.listPlugins(getUserId());
      setPlugins(fresh);
      bumpPluginsRev();
    } catch (err) {
      // Destructive actions failing silently look like the click
      // didn't register — surface via the global toast channel
      // (danger = sticky). window.confirm stays as the guard BEFORE
      // the delete.
      const msg = err instanceof Error ? err.message : String(err);
      useApp.getState().setGlobalNotice({
        text: `Could not delete plugin "${kind}": ${msg}`,
        tone: "danger",
      });
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn h-8"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Add block to canvas"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add block</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Block catalog"
          data-marker="block-chooser"
          // <sm: the row-1 anchor sits ~140px in, so an anchored 90vw
          // popover would clip against <main>'s overflow-x-hidden —
          // pin it under the toolbar instead. ≥sm: anchored under the
          // trigger, the normal popover idiom.
          className="fixed left-3 top-24 sm:absolute sm:left-0 sm:top-full sm:mt-1 z-30 w-[min(480px,calc(100vw-1.5rem))] sm:w-[min(480px,90vw)] max-h-[min(380px,70vh)] rounded-lg border border-edge bg-surface shadow-xl flex flex-col"
        >
          {/* Search — filters rows live across all five sections */}
          <div className="p-2 border-b border-edge shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-mute pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                aria-label="Search blocks"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search blocks..."
                className="w-full text-[11px] bg-surfaceAlt border border-edge rounded-md pl-6 pr-6 py-1.5 text-ink placeholder:text-mute/60 focus:outline-none focus:border-accent/60"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-mute hover:text-ink"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Five stage sections in pipeline order */}
          <div className="flex-1 min-h-0 overflow-y-auto p-1.5">
            {STAGE_META.map((st) => {
              const items = filtered.filter((n) => n.family === st.key);
              if (items.length === 0) return null;
              return (
                <div key={st.key} className="mb-1.5">
                  <div className="px-1.5 pt-1 pb-0.5">
                    <div className="text-[10px] uppercase tracking-wider font-medium text-mute leading-tight">
                      {st.label}
                    </div>
                    <div className="text-[9px] text-mute/60 leading-tight truncate">
                      {st.tagline}
                    </div>
                  </div>
                  {items.map((n) => (
                    <ChooserRow
                      key={n.kind}
                      spec={n}
                      canvasCount={canvasCounts.get(n.kind) ?? 0}
                      flashed={flashKind === n.kind}
                      running={running}
                      onAdd={addOne}
                      onDragToCanvas={closeForDrag}
                      onDelete={
                        "isPlugin" in n && n.isPlugin
                          ? () => handleDeletePlugin(n.kind)
                          : undefined
                      }
                    />
                  ))}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-6 text-center text-[11px] text-mute">
                No blocks match "{search.trim()}"
              </div>
            )}
          </div>

          {/* One-line affordance hint */}
          <div className="px-3 py-1.5 border-t border-edge shrink-0 text-[9px] text-mute/60">
            Click to add (stays open for more) · or drag a row onto the canvas
          </div>
        </div>
      )}
    </div>
  );
}

/** One compact catalog row: icon, name, plugin badge, on-canvas count
 *  dot; the full description rides the title tooltip. Click adds via
 *  the store bridge; HTML5 drag carries the same payload the shelf
 *  tiles did. */
function ChooserRow({
  spec,
  canvasCount,
  flashed,
  running,
  onAdd,
  onDragToCanvas,
  onDelete,
}: {
  spec: NodeSpec | PluginNodeSpec;
  /** Copies of this kind already on the canvas (0 = none). */
  canvasCount: number;
  /** True for ~1s after this row was clicked — renders "added ✓". */
  flashed: boolean;
  running: boolean;
  onAdd: (kind: NodeKind) => void;
  onDragToCanvas: () => void;
  /** Set for user-uploaded plugins — renders the small delete ×. */
  onDelete?: () => void;
}) {
  const isPlugin = "isPlugin" in spec && spec.isPlugin;
  const Icon = spec.icon;
  return (
    <button
      type="button"
      role="menuitem"
      disabled={running}
      draggable={!running}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/reactflow", spec.kind);
        e.dataTransfer.effectAllowed = "move";
        onDragToCanvas();
      }}
      onClick={() => onAdd(spec.kind as NodeKind)}
      title={
        running
          ? "Locked while a run is in progress"
          : `${spec.tagline} — ${spec.description}`
      }
      aria-label={`Add ${spec.label} block to canvas. ${spec.tagline}`}
      className={`qf-no-callout w-full h-9 flex items-center gap-2 px-1.5 rounded-md border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        running
          ? "border-transparent opacity-40 cursor-not-allowed"
          : flashed
            ? "border-ok/50 bg-ok/10 cursor-grab active:cursor-grabbing"
            : "border-transparent hover:border-edge hover:bg-surfaceAlt cursor-grab active:cursor-grabbing"
      }`}
    >
      {isPlugin ? (
        <span
          className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white"
          style={{ backgroundColor: (spec as PluginNodeSpec).pluginColor }}
          aria-hidden
        >
          {(spec as PluginNodeSpec).initials}
        </span>
      ) : (
        <span
          className={`shrink-0 w-5 h-5 rounded-md border ${spec.accentRing} bg-surface flex items-center justify-center ${spec.accent}`}
          aria-hidden
        >
          <Icon className="w-3 h-3" strokeWidth={2} />
        </span>
      )}
      <span className="flex-1 min-w-0 text-[11px] text-ink truncate leading-tight">
        {spec.label}
        {isPlugin && (
          <span className="ml-1 text-[9px] uppercase tracking-wider text-mute/60">
            plugin
          </span>
        )}
      </span>
      {flashed ? (
        <span
          className="shrink-0 flex items-center gap-0.5 text-[9px] text-ok font-medium"
          aria-hidden
        >
          <Check className="w-3 h-3" strokeWidth={3} />
          added
        </span>
      ) : canvasCount > 0 ? (
        <span
          className="shrink-0 min-w-[14px] h-3.5 px-0.5 rounded-full bg-accent/15 border border-accent/40 text-accent text-[8px] leading-none font-medium flex items-center justify-center tabular-nums"
          title={`${canvasCount} on canvas`}
          aria-label={`${canvasCount} already on canvas`}
        >
          {canvasCount}
        </span>
      ) : null}
      {isPlugin && onDelete && (
        <button
          type="button"
          draggable={false}
          onDragStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete plugin "${spec.label}"?`)) onDelete();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") e.stopPropagation();
          }}
          className="shrink-0 w-4 h-4 rounded-full border border-edge bg-surface text-mute hover:text-danger hover:border-danger/60 flex items-center justify-center opacity-70 hover:opacity-100 focus:opacity-100 transition-opacity"
          title={`Delete plugin ${spec.label}`}
          aria-label={`Delete plugin ${spec.label}`}
        >
          <X className="w-2.5 h-2.5" strokeWidth={2.5} />
        </button>
      )}
    </button>
  );
}
