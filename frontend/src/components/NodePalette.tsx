import { useState, useMemo } from "react";
import { Check, ChevronDown, FileText, Plus, Search, X } from "lucide-react";
import { NODE_CATALOG, type NodeKind, type NodeSpec } from "../lib/nodeCatalog";
import { useApp } from "../lib/store";

/**
 * Categorised block catalog above the canvas.
 *
 * Designed to scale from the current 9 blocks to 30+ without layout
 * breakage. Blocks are grouped by family; each family is a collapsible
 * section with a header chip. A search box filters across all families
 * in real time.
 *
 * Three interaction modes:
 *   - **Drag** a tile onto the canvas (classic).
 *   - **Click** the checkbox on a tile to select it, then hit "Add N
 *     to canvas" to batch-add all selected blocks at once (the
 *     FlowCanvas picks them up via the Zustand `pendingBlockKinds`
 *     bridge and auto-connects them).
 *   - **Single click** the + icon on a tile to add just that one block.
 *
 * The whole palette collapses to a thin bar ("N blocks available") via
 * a toggle so the canvas can reclaim vertical space.
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
  const [expanded, setExpanded] = useState(true);
  const [collapsedFams, setCollapsedFams] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<NodeKind>>(new Set());
  const addBlocksToCanvas = useApp((s) => s.addBlocksToCanvas);

  const toggleFamily = (fam: string) =>
    setCollapsedFams((s) => {
      const next = new Set(s);
      next.has(fam) ? next.delete(fam) : next.add(fam);
      return next;
    });

  const toggleCheck = (kind: NodeKind) =>
    setChecked((s) => {
      const next = new Set(s);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });

  const addSingle = (kind: NodeKind) => {
    addBlocksToCanvas([kind]);
  };

  const addSelected = () => {
    if (checked.size === 0) return;
    // Preserve catalog family order so auto-connect produces a sensible chain.
    const ordered = NODE_CATALOG.filter((n) => checked.has(n.kind)).map(
      (n) => n.kind,
    );
    addBlocksToCanvas(ordered);
    setChecked(new Set());
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return NODE_CATALOG;
    const q = search.toLowerCase();
    return NODE_CATALOG.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.tagline.toLowerCase().includes(q) ||
        n.family.toLowerCase().includes(q) ||
        n.kind.toLowerCase().includes(q),
    );
  }, [search]);

  const totalCount = NODE_CATALOG.length;

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
        <div className="relative flex-1 max-w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-mute pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks..."
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
                  collapsedFams.has(fm.key)
                    ? "border-edge/40 text-mute/60 bg-transparent"
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
        {/* Add-selected button (appears when any block is checked) */}
        {checked.size > 0 && (
          <button
            type="button"
            onClick={addSelected}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-accent text-canvas hover:bg-accent/90 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3 h-3" />
            Add {checked.size} to canvas
          </button>
        )}
        <div className="flex-1" />
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
        {FAMILY_META.map((fm) => {
          const items = filtered.filter((n) => n.family === fm.key);
          if (items.length === 0) return null;
          const isCollapsed = collapsedFams.has(fm.key);
          return (
            <div key={fm.key} className="shrink-0 flex items-start gap-1">
              <button
                type="button"
                onClick={() => toggleFamily(fm.key)}
                className="hidden md:flex flex-col items-center justify-center py-1 px-0.5 gap-0.5 text-mute/60 hover:text-mute transition-colors self-stretch"
                title={`${fm.label}: ${fm.description}`}
              >
                <span
                  className="text-[9px] uppercase tracking-widest whitespace-nowrap font-medium"
                  style={{ writingMode: "vertical-rl" }}
                >
                  {fm.label}
                </span>
                <ChevronDown
                  className={`w-2.5 h-2.5 transition-transform ${
                    isCollapsed ? "-rotate-90" : "rotate-0"
                  }`}
                />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-1 flex-wrap">
                  {items.map((n) => (
                    <PaletteTile
                      key={n.kind}
                      spec={n}
                      isChecked={checked.has(n.kind)}
                      onToggleCheck={() => toggleCheck(n.kind)}
                      onAddSingle={() => addSingle(n.kind)}
                    />
                  ))}
                </div>
              )}
              {isCollapsed && (
                <div className="flex items-center h-[76px] px-2 text-[10px] text-mute/50 italic">
                  {items.length} hidden
                </div>
              )}
              <div className="hidden md:block w-px self-stretch bg-edge/40 mx-0.5" />
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-4 w-full text-center text-[11px] text-mute">
            No blocks match "{search}"
          </div>
        )}
      </div>
    </div>
  );
}

function PaletteTile({
  spec,
  isChecked,
  onToggleCheck,
  onAddSingle,
}: {
  spec: NodeSpec;
  isChecked: boolean;
  onToggleCheck: () => void;
  onAddSingle: () => void;
}) {
  const Icon = spec.icon;
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/reactflow", spec.kind);
    e.dataTransfer.effectAllowed = "move";
  }
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`group relative shrink-0 cursor-grab active:cursor-grabbing flex flex-col items-center justify-center gap-0.5 w-[108px] h-[76px] rounded-md border transition-colors text-center px-1.5 py-1.5 ${
        isChecked
          ? "border-accent bg-accent/10"
          : "border-edge/60 hover:border-edge hover:bg-surfaceAlt"
      }`}
      title={spec.description}
    >
      {/* Checkbox (top-left) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleCheck();
        }}
        draggable={false}
        onDragStart={(e) => e.stopPropagation()}
        className={`absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center transition-colors z-10 ${
          isChecked
            ? "bg-accent border border-accent text-canvas"
            : "border border-edge bg-surface text-transparent hover:border-mute hover:text-mute"
        }`}
        aria-label={isChecked ? `Deselect ${spec.label}` : `Select ${spec.label}`}
      >
        <Check className="w-2.5 h-2.5" strokeWidth={3} />
      </button>
      {/* Quick-add button (top-right, shows on hover when not checked) */}
      {!isChecked && !spec.paper && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddSingle();
          }}
          draggable={false}
          onDragStart={(e) => e.stopPropagation()}
          className="absolute top-1 right-1 w-4 h-4 rounded-full border border-edge bg-surface text-mute hover:border-accent hover:text-accent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title={`Add ${spec.label} to canvas`}
          aria-label={`Add ${spec.label} to canvas`}
        >
          <Plus className="w-2.5 h-2.5" strokeWidth={2.5} />
        </button>
      )}
      {spec.paper && (
        <a
          href={spec.paper.url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          onDragStart={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent/20 border border-accent/70 text-accent hover:bg-accent/40 hover:border-accent hover:text-ink flex items-center justify-center shadow-sm transition-colors z-10"
          title={`Paper: ${spec.paper.title} (${spec.paper.venue})`}
          aria-label={`Open paper: ${spec.paper.title}`}
        >
          <FileText className="w-2.5 h-2.5" strokeWidth={2} />
        </a>
      )}
      <span
        className={`w-6 h-6 rounded-md border ${spec.accentRing} bg-surface flex items-center justify-center ${spec.accent}`}
      >
        <Icon className="w-3 h-3" strokeWidth={2} />
      </span>
      <span className="text-[10px] text-ink truncate max-w-full leading-tight">
        {spec.label}
      </span>
      <span className="text-[9px] text-mute/80 leading-tight max-w-full line-clamp-2">
        {spec.tagline}
      </span>
    </div>
  );
}
