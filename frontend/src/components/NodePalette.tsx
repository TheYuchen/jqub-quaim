import { useMemo, useState } from "react";
import { ChevronDown, FileText, Search, X } from "lucide-react";
import { api } from "../lib/api";
import {
  NODE_CATALOG,
  synthesizePluginSpec,
  type NodeKind,
  type NodeSpec,
  type PluginNodeSpec,
} from "../lib/nodeCatalog";
import { useApp } from "../lib/store";
import { ANON } from "../lib/anon";
import { bumpPluginsRev, getUserId } from "../lib/userId";
import { BlockPicker } from "./BlockPicker";

/**
 * Categorised block catalog above the canvas.
 *
 * Two complementary interaction modes:
 *   - **Drag** a tile onto the canvas (quick, for users who know what
 *     they want).
 *   - **"Add blocks" dropdown** (BlockPicker) — a categorised
 *     multi-select list where users browse all available blocks, check
 *     the ones they want, and batch-add them in one click. Better for
 *     newcomers or when building a pipeline from scratch.
 *
 * Blocks are grouped by family; each family section is collapsible. A
 * search box filters across all families in real time.
 */

const FAMILY_META: {
  key: NodeSpec["family"];
  label: string;
  description: string;
}[] = [
  { key: "source", label: "Source", description: "Where the pipeline starts" },
  { key: "backend", label: "Backend", description: "Provides a noise model" },
  {
    key: "algorithm",
    label: "Algorithm",
    description: "Research algorithms that transform or analyse the circuit",
  },
  { key: "metric", label: "Metric", description: "Computes a quantitative score" },
  { key: "sink", label: "Sink", description: "Aggregates final output" },
];

export function NodePalette() {
  const [search, setSearch] = useState("");
  // Kinds currently on the canvas — published by FlowCanvas (store
  // bridge, audit S2) and passed to BlockPicker for live "on canvas"
  // badges. The old prop defaulted to an empty set and no caller ever
  // threaded the real kinds, so the badges were dead code.
  const canvasKindsArr = useApp((s) => s.canvasKinds);
  const canvasKinds = useMemo(
    () => new Set<NodeKind>(canvasKindsArr),
    [canvasKindsArr],
  );
  const [expanded, setExpanded] = useState(true);
  // null = show all families; a family key = show only that family.
  const [activeFamily, setActiveFamily] = useState<NodeSpec["family"] | null>(null);

  // Plugin manifests this browser has uploaded — merged with NODE_CATALOG
  // so plugins show up under their declared family alongside built-ins.
  const plugins = useApp((s) => s.plugins);
  const setPlugins = useApp((s) => s.setPlugins);
  const pluginSpecs: PluginNodeSpec[] = useMemo(
    () => plugins.map(synthesizePluginSpec),
    [plugins],
  );
  const combined: (NodeSpec | PluginNodeSpec)[] = useMemo(
    () => [...NODE_CATALOG, ...pluginSpecs],
    [pluginSpecs],
  );

  const toggleFamily = (fam: NodeSpec["family"]) =>
    setActiveFamily((cur) => (cur === fam ? null : fam));

  const handleDeletePlugin = async (kind: string) => {
    try {
      await api.deletePlugin(getUserId(), kind);
      const fresh = await api.listPlugins(getUserId());
      setPlugins(fresh);
      bumpPluginsRev();
    } catch (err) {
      // Destructive actions failing silently look like the click
      // didn't register. Surface the error so the user knows to retry
      // — via the global toast channel (danger = sticky), not the
      // blocking alert() the toast idiom replaced. window.confirm
      // stays as the guard BEFORE the delete: destructive actions
      // still deserve a blocking yes/no.
      const msg = err instanceof Error ? err.message : String(err);
      useApp.getState().setGlobalNotice({
        text: `Could not delete plugin "${kind}": ${msg}`,
        tone: "danger",
      });
    }
  };

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

  const totalCount = combined.length;

  if (!expanded) {
    return (
      <div className="shrink-0 border-b border-edge bg-surface/40">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full px-3 py-1.5 flex items-center justify-between text-[10px] text-mute hover:text-ink transition-colors"
        >
          <span className="uppercase tracking-wider">
            {totalCount} blocks available
          </span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-edge bg-surface/40">
      {/* Header row */}
      <div className="px-3 pt-2 pb-1 flex items-center gap-2">
        {/* Multi-select dropdown picker */}
        <BlockPicker canvasKinds={canvasKinds} />
        {/* Plugin upload UI removed in Wave P (de-product). The plugin
            protocol itself is a paper claim and stays fully exercised
            via the backend API; uploaded plugins still appear here and
            still execute. */}
        {/* Search */}
        <div className="relative flex-1 max-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-mute pointer-events-none" />
          <input
            type="text"
            aria-label="Search blocks"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full text-[11px] bg-surfaceAlt border border-edge rounded-md pl-6 pr-6 py-1 text-ink placeholder:text-mute/60 focus:outline-none focus:border-accent/60"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-mute hover:text-ink"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {/* Family chips */}
        <div className="hidden md:flex items-center gap-1">
          {FAMILY_META.map((fm) => {
            const count = filtered.filter((n) => n.family === fm.key).length;
            if (count === 0) return null;
            return (
              <button
                key={fm.key}
                type="button"
                onClick={() => toggleFamily(fm.key)}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  activeFamily === fm.key
                    ? "border-accent/60 bg-accent/10 text-accent"
                    : activeFamily !== null
                      ? "border-edge/40 text-mute/40 bg-transparent"
                      : "border-edge bg-surfaceAlt text-mute hover:text-ink"
                }`}
                title={`${fm.description} (${count})`}
              >
                {fm.label}
                <span className="ml-0.5 text-mute/50">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <span className="hidden lg:inline text-[10px] text-mute/60">
          drag to canvas or use Add blocks
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-mute hover:text-ink p-0.5"
          title="Collapse block palette"
        >
          <ChevronDown className="w-3.5 h-3.5 rotate-180" />
        </button>
      </div>

      {/* Block grid grouped by family */}
      <div className="px-3 pb-2 flex flex-nowrap overflow-x-auto md:flex-wrap md:overflow-visible items-start gap-x-1 gap-y-1">
        {FAMILY_META.map((fm, famIdx) => {
          // When a family filter is active, only show that family.
          if (activeFamily !== null && activeFamily !== fm.key) return null;
          const items = filtered.filter((n) => n.family === fm.key);
          if (items.length === 0) return null;
          return (
            <div key={fm.key} className="shrink-0 flex items-start gap-1">
              <button
                type="button"
                onClick={() => toggleFamily(fm.key)}
                className={`hidden md:flex flex-col items-center justify-center py-1 px-0.5 gap-0.5 hover:text-mute transition-colors self-stretch ${
                  activeFamily === fm.key ? "text-accent" : "text-mute/60"
                }`}
                title={`${fm.label}: ${fm.description}`}
              >
                <span
                  className="text-[9px] uppercase tracking-widest whitespace-nowrap font-medium"
                  style={{ writingMode: "vertical-rl" }}
                >
                  {fm.label}
                </span>
              </button>
              <div className="flex items-center gap-1 flex-wrap">
                {items.map((n) => (
                  <PaletteTile
                    key={n.kind}
                    spec={n}
                    onDelete={
                      "isPlugin" in n && n.isPlugin
                        ? () => handleDeletePlugin(n.kind)
                        : undefined
                    }
                  />
                ))}
              </div>
              {/* Divider between visible families (not after the last) */}
              {activeFamily === null && famIdx < FAMILY_META.length - 1 && (
                <div className="hidden md:block w-px self-stretch bg-edge/40 mx-0.5" />
              )}
            </div>
          );
        })}
        {filtered.filter(
          (n) => activeFamily === null || n.family === activeFamily,
        ).length === 0 && (
          <div className="py-4 w-full text-center text-[11px] text-mute">
            No blocks match{search.trim() ? ` "${search}"` : ""}
            {activeFamily !== null
              ? ` in the ${
                  FAMILY_META.find((f) => f.key === activeFamily)?.label ??
                  activeFamily
                } family`
              : ""}
            .
            {activeFamily !== null && (
              <button
                type="button"
                className="ml-1.5 underline decoration-dotted hover:text-ink"
                onClick={() => setActiveFamily(null)}
              >
                Show all families
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PaletteTile({
  spec,
  onDelete,
}: {
  spec: NodeSpec | PluginNodeSpec;
  /** When set, shows a red × in the corner that calls back on click —
   *  used for user-uploaded plugins. */
  onDelete?: () => void;
}) {
  const addBlocksToCanvas = useApp((s) => s.addBlocksToCanvas);
  const setTouchDrag = useApp((s) => s.setTouchDrag);
  const setPendingTouchDrop = useApp((s) => s.setPendingTouchDrop);
  const isPlugin = "isPlugin" in spec && spec.isPlugin;
  const Icon = spec.icon;

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/reactflow", spec.kind);
    e.dataTransfer.effectAllowed = "move";
  }

  // Tap (mobile) / click (mouse) / Enter+Space (keyboard) all funnel
  // into the same "queue this kind for the canvas" path that the
  // BlockPicker dropdown uses. Drag-and-drop continues to work for
  // mouse users on top of this — they get both interactions.
  function addToCanvas() {
    addBlocksToCanvas([spec.kind]);
  }

  // ---- Touch drag (mobile) ------------------------------------------
  //
  // HTML5 drag-and-drop doesn't fire on touch; instead we implement a
  // PointerEvent-based drag that mirrors the HTML5 behaviour for the
  // canvas. Flow:
  //   1. pointerdown (touch only) — remember the start coord. No drag
  //      state yet; small movements still register as taps via the
  //      button's onClick.
  //   2. pointermove past TAP_THRESHOLD_PX — enter drag mode: take
  //      pointer capture, set touchDrag in the store, suppress scroll.
  //   3. pointermove while dragging — update touchDrag.x/y; FlowCanvas
  //      watches this and renders the floating preview + edge target.
  //   4. pointerup while dragging — set pendingTouchDrop with the
  //      final coords; FlowCanvas commits the drop.
  //   5. pointercancel / pointerup with no drag — clear state, let
  //      onClick fire normally.
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    const TAP_THRESHOLD_PX = 8;
    let dragging = false;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging) {
        if (Math.hypot(dx, dy) > TAP_THRESHOLD_PX) {
          dragging = true;
          try {
            (e.target as Element).setPointerCapture?.(pointerId);
          } catch {
            /* element may have already lost pointer */
          }
        } else {
          return;
        }
      }
      setTouchDrag({ kind: spec.kind, x: ev.clientX, y: ev.clientY });
      // preventDefault suppresses the palette strip's horizontal
      // scroll once we've committed to dragging.
      ev.preventDefault();
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      if (dragging) {
        // Hand off the final position to FlowCanvas via the store.
        setPendingTouchDrop({
          kind: spec.kind,
          x: ev.clientX,
          y: ev.clientY,
        });
        setTouchDrag(null);
      }
      // Non-drag pointerup: tap; the button's onClick will fire.
    };

    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      setTouchDrag(null);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onPointerDown={onPointerDown}
      onClick={addToCanvas}
      // The button gives us Enter/Space → click for free; we override
      // Space below so it doesn't also scroll the strip.
      onKeyDown={(e) => {
        if (e.key === " ") {
          e.preventDefault();
          addToCanvas();
        }
      }}
      className={`qf-no-callout group relative shrink-0 cursor-grab active:cursor-grabbing flex flex-col items-center justify-center gap-0.5 w-[108px] h-[76px] rounded-md border transition-colors text-center px-1.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isPlugin
          ? "border-edge bg-surface/60 hover:bg-surfaceAlt"
          : "border-edge/60 hover:border-edge hover:bg-surfaceAlt"
      }`}
      title={spec.description}
      aria-label={`Add ${spec.label} block to canvas. ${spec.tagline}`}
    >
      {/* Top-right corner badge: paper link, delete button, or nothing.
          These are interactive children; stopPropagation keeps the
          parent button from also firing. */}
      {spec.paper && !isPlugin && !ANON && (
        <a
          href={spec.paper.url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          onDragStart={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent/20 border border-accent/70 text-accent hover:bg-accent/40 hover:border-accent hover:text-ink flex items-center justify-center shadow-sm transition-colors z-10"
          title={`Paper: ${spec.paper.title} (${spec.paper.venue})`}
          aria-label={`Open paper: ${spec.paper.title}`}
        >
          <FileText className="w-2.5 h-2.5" strokeWidth={2} />
        </a>
      )}
      {isPlugin && onDelete && (
        // Always visible: previously hover-only, which left mobile +
        // keyboard users with no way to find or activate the delete
        // affordance. Slight opacity at rest keeps it from drawing too
        // much focus when the user is browsing the catalogue.
        <button
          type="button"
          draggable={false}
          onDragStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete plugin "${spec.label}"?`)) onDelete();
          }}
          onKeyDown={(e) => {
            // Don't bubble Enter/Space to the parent button when
            // focused on the delete X.
            if (e.key === "Enter" || e.key === " ") e.stopPropagation();
          }}
          className="absolute top-1 right-1 w-5 h-5 rounded-full border border-edge bg-surface text-mute hover:text-danger hover:border-danger/60 flex items-center justify-center opacity-70 hover:opacity-100 focus:opacity-100 transition-opacity z-10"
          title={`Delete plugin ${spec.label}`}
          aria-label={`Delete plugin ${spec.label}`}
        >
          <X className="w-3 h-3" strokeWidth={2.5} />
        </button>
      )}
      {isPlugin ? (
        <span
          className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
          style={{ backgroundColor: (spec as PluginNodeSpec).pluginColor }}
          aria-hidden
        >
          {(spec as PluginNodeSpec).initials}
        </span>
      ) : (
        <span
          className={`w-6 h-6 rounded-md border ${spec.accentRing} bg-surface flex items-center justify-center ${spec.accent}`}
          aria-hidden
        >
          <Icon className="w-3 h-3" strokeWidth={2} />
        </span>
      )}
      <span className="text-[10px] text-ink truncate max-w-full leading-tight">
        {spec.label}
      </span>
      <span className="text-[9px] text-mute/80 leading-tight max-w-full line-clamp-2">
        {spec.tagline}
      </span>
    </button>
  );
}
