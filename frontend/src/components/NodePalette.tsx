import { useState, useMemo } from "react";
import { ChevronDown, FileText, Search, X } from "lucide-react";
import { NODE_CATALOG, type NodeKind, type NodeSpec } from "../lib/nodeCatalog";
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

export function NodePalette({
  canvasKinds = new Set(),
}: {
  /** Kinds currently on the canvas — passed through to BlockPicker for
   *  "on canvas" badges. */
  canvasKinds?: Set<NodeKind>;
} = {}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(true);
  // null = show all families; a family key = show only that family.
  const [activeFamily, setActiveFamily] = useState<NodeSpec["family"] | null>(null);

  const toggleFamily = (fam: NodeSpec["family"]) =>
    setActiveFamily((cur) => (cur === fam ? null : fam));

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
        {/* Multi-select dropdown picker */}
        <BlockPicker canvasKinds={canvasKinds} />
        {/* Search */}
        <div className="relative flex-1 max-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-mute pointer-events-none" />
          <input
            type="text"
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
                  <PaletteTile key={n.kind} spec={n} />
                ))}
              </div>
              {/* Divider between visible families (not after the last) */}
              {activeFamily === null && famIdx < FAMILY_META.length - 1 && (
                <div className="hidden md:block w-px self-stretch bg-edge/40 mx-0.5" />
              )}
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

function PaletteTile({ spec }: { spec: NodeSpec }) {
  const Icon = spec.icon;
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/reactflow", spec.kind);
    e.dataTransfer.effectAllowed = "move";
  }
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group relative shrink-0 cursor-grab active:cursor-grabbing flex flex-col items-center justify-center gap-0.5 w-[108px] h-[76px] rounded-md border border-edge/60 hover:border-edge hover:bg-surfaceAlt transition-colors text-center px-1.5 py-1.5"
      title={spec.description}
    >
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
