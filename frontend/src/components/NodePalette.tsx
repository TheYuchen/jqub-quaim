import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
 * Pipeline shelf (marker: pipeline-shelf) — the block palette above the
 * canvas, laid out AS the pipeline grammar itself: five stage columns,
 * Source → Backend → Algorithm → Metric → Sink, separated by faint
 * arrow glyphs. Each column carries a compact header (stage name + a
 * one-line tagline) and stacks its blocks VERTICALLY beneath as
 * compact rows, so the shelf teaches the sentence structure a valid
 * pipeline follows while it serves as the drag source. Growth is
 * always vertical: a column with ≥5 blocks (plugins join their
 * declared family's column) scrolls internally behind a subtle fade
 * instead of sprawling horizontally.
 *
 * Interaction modes preserved from the previous strip:
 *   - **Drag** a row onto the canvas (HTML5 dataTransfer payload
 *     "application/reactflow", unchanged — FlowCanvas's onDrop and
 *     edge-splice targeting work as before).
 *   - **Tap / click / Enter / Space** queue the kind through the
 *     pendingBlockKinds store bridge (same path BlockPicker uses).
 *   - **Touch drag** via the PointerEvent bridge (touchDrag /
 *     pendingTouchDrop in the store; FlowCanvas renders the floating
 *     preview and commits the drop).
 *   - **"Add blocks"** (BlockPicker modal) and the live search stay in
 *     the header row; search filters rows across all five columns.
 *
 * Responsive: a ResizeObserver on the shelf (container query, same
 * pattern as MultiverseBoard's grid — the palette lives in a resizable
 * center column, so viewport breakpoints would lie) wraps the shelf to
 * two rows below ~880px container width: Source/Backend/Algorithm on
 * top, Metric/Sink below.
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

/** Container width below which the shelf wraps to two rows. */
const SHELF_WRAP_PX = 880;

export function NodePalette() {
  const [search, setSearch] = useState("");
  // Kinds currently on the canvas — published by FlowCanvas (store
  // bridge, audit S2). It is a MULTISET (one entry per node), so the
  // shelf can show a per-row count dot for kinds already placed;
  // BlockPicker keeps consuming it as a Set for its badges.
  const canvasKindsArr = useApp((s) => s.canvasKinds);
  const canvasKinds = useMemo(
    () => new Set<NodeKind>(canvasKindsArr),
    [canvasKindsArr],
  );
  const canvasCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of canvasKindsArr) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, [canvasKindsArr]);
  const [expanded, setExpanded] = useState(true);

  // Container-query wrap (ResizeObserver like MultiverseBoard, NOT a
  // viewport breakpoint: the center column is user-resizable).
  const shelfRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = shelfRef.current;
    if (!el) return;
    const update = () => setNarrow(el.clientWidth < SHELF_WRAP_PX);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded]);

  // Plugin manifests this browser has uploaded — merged with NODE_CATALOG
  // so plugins show up under their declared family alongside built-ins
  // (resolveNodeSpec family; manifests without a known family synthesize
  // as "algorithm" and land in that column, plugin badge intact).
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

  // Stage rows: one row of five in wide containers; Source/Backend/
  // Algorithm over Metric/Sink when narrow.
  const stageRows = narrow
    ? [STAGE_META.slice(0, 3), STAGE_META.slice(3)]
    : [STAGE_META];

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
        {/* Search — filters rows across all five stage columns, live */}
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

      {/* The shelf: stage columns in pipeline order, arrows between */}
      <div
        ref={shelfRef}
        data-marker="pipeline-shelf"
        className="px-3 pb-2 flex flex-col gap-1.5"
      >
        {stageRows.map((row, ri) => (
          <div key={ri} className="flex items-stretch gap-1">
            {row.map((st, i) => (
              <Fragment key={st.key}>
                {i > 0 && (
                  <div
                    className="shrink-0 self-start pt-1 text-[11px] leading-none text-mute/40 select-none"
                    aria-hidden="true"
                  >
                    →
                  </div>
                )}
                <StageColumn
                  meta={st}
                  narrow={narrow}
                  items={filtered.filter((n) => n.family === st.key)}
                  searching={search.trim().length > 0}
                  canvasCounts={canvasCounts}
                  onDeletePlugin={handleDeletePlugin}
                />
              </Fragment>
            ))}
          </div>
        ))}
        {search.trim() && filtered.length === 0 && (
          <div className="py-1 w-full text-center text-[11px] text-mute">
            No blocks match "{search.trim()}".
          </div>
        )}
      </div>
    </div>
  );
}

/** One stage of the grammar: compact header + vertically stacked block
 *  rows. ≥5 rows → the body scrolls internally behind a fade (growth
 *  is vertical, never horizontal sprawl). */
function StageColumn({
  meta,
  narrow,
  items,
  searching,
  canvasCounts,
  onDeletePlugin,
}: {
  meta: (typeof STAGE_META)[number];
  narrow: boolean;
  items: (NodeSpec | PluginNodeSpec)[];
  searching: boolean;
  canvasCounts: Map<string, number>;
  onDeletePlugin: (kind: string) => void;
}) {
  // Columns share width equally (flex-1 basis-0). Min width 120px in
  // the wide layout; the narrow two-row layout relaxes to 96px so a
  // 360px phone column still fits three stages plus arrows.
  const scrollable = items.length >= 5;
  return (
    <div
      className={`flex-1 basis-0 flex flex-col ${
        narrow ? "min-w-[96px]" : "min-w-[120px]"
      }`}
    >
      <div className="px-0.5 pb-1" title={`${meta.label}: ${meta.tagline}`}>
        <div className="text-[10px] uppercase tracking-wider font-medium text-mute leading-tight">
          {meta.label}
        </div>
        <div className="text-[9px] text-mute/60 leading-tight truncate">
          {meta.tagline}
        </div>
      </div>
      <div
        className={`flex flex-col gap-1 ${
          scrollable ? "overflow-y-auto max-h-[124px] pr-0.5" : ""
        }`}
        // Subtle bottom fade signals there are more rows below the
        // 3-row window. mask-image is theme-independent (no hardcoded
        // background color under a translucent shelf).
        style={
          scrollable
            ? {
                maskImage:
                  "linear-gradient(to bottom, black calc(100% - 14px), transparent)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black calc(100% - 14px), transparent)",
              }
            : undefined
        }
      >
        {items.map((n) => (
          <ShelfRow
            key={n.kind}
            spec={n}
            canvasCount={canvasCounts.get(n.kind) ?? 0}
            onDelete={
              "isPlugin" in n && n.isPlugin
                ? () => onDeletePlugin(n.kind)
                : undefined
            }
          />
        ))}
        {items.length === 0 && searching && (
          <div className="px-1 py-1.5 text-[9px] italic text-mute/50">
            no match
          </div>
        )}
      </div>
    </div>
  );
}

function ShelfRow({
  spec,
  canvasCount,
  onDelete,
}: {
  spec: NodeSpec | PluginNodeSpec;
  /** Copies of this kind already on the canvas (0 = none) — rendered
   *  as a subtle count dot so "already placed" reads at a glance. */
  canvasCount: number;
  /** When set, shows a small × that calls back on click — used for
   *  user-uploaded plugins. */
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
      // preventDefault suppresses the column's internal scroll once
      // we've committed to dragging.
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
      // Space below so it doesn't also scroll the column.
      onKeyDown={(e) => {
        if (e.key === " ") {
          e.preventDefault();
          addToCanvas();
        }
      }}
      className={`qf-no-callout group relative shrink-0 cursor-grab active:cursor-grabbing flex items-center gap-1.5 w-full h-9 rounded-md border transition-colors text-left px-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isPlugin
          ? "border-edge bg-surface/60 hover:bg-surfaceAlt"
          : "border-edge/60 hover:border-edge hover:bg-surfaceAlt"
      }`}
      // The tile's visible tagline moved here: tooltip = tagline +
      // long-form description.
      title={`${spec.tagline} — ${spec.description}`}
      aria-label={`Add ${spec.label} block to canvas. ${spec.tagline}`}
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
      <span className="flex-1 min-w-0 text-[10px] text-ink truncate leading-tight">
        {spec.label}
      </span>
      {/* "On canvas" count dot — subtle, non-interactive. */}
      {canvasCount > 0 && (
        <span
          className="shrink-0 min-w-[14px] h-3.5 px-0.5 rounded-full bg-accent/15 border border-accent/40 text-accent text-[8px] leading-none font-medium flex items-center justify-center tabular-nums"
          title={`${canvasCount} on canvas`}
          aria-label={`${canvasCount} already on canvas`}
        >
          {canvasCount}
        </span>
      )}
      {/* Right-edge adornments: paper link (built-ins, non-anon) or
          plugin delete. Interactive children; stopPropagation keeps
          the parent button from also firing. */}
      {spec.paper && !isPlugin && !ANON && (
        <a
          href={spec.paper.url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          onDragStart={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 w-4 h-4 rounded-full bg-accent/20 border border-accent/70 text-accent hover:bg-accent/40 hover:border-accent hover:text-ink flex items-center justify-center transition-colors"
          title={`Paper: ${spec.paper.title} (${spec.paper.venue})`}
          aria-label={`Open paper: ${spec.paper.title}`}
        >
          <FileText className="w-2 h-2" strokeWidth={2} />
        </a>
      )}
      {isPlugin && onDelete && (
        // Always visible (hover-only left mobile + keyboard users with
        // no way to find it); slight rest opacity keeps it quiet.
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
