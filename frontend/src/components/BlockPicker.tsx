import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { NODE_CATALOG, type NodeKind, type NodeSpec } from "../lib/nodeCatalog";
import { useApp } from "../lib/store";

/**
 * Dropdown multi-select block picker.
 *
 * Opens a categorised list of all available blocks. The user checks the
 * ones they want, then clicks "Add to canvas" to batch-create them.
 * Blocks already on the canvas are marked with a subtle badge.
 *
 * Intended as the primary "browse & select" workflow for users who
 * don't want to drag tiles one by one. Lives in the NodePalette header
 * row, triggered by a button.
 */

const FAMILY_META: {
  key: NodeSpec["family"];
  label: string;
  hint: string;
}[] = [
  { key: "source", label: "Source", hint: "Required. Feeds a quantum circuit into the pipeline." },
  { key: "backend", label: "Backend", hint: "Provides a noise model. Required for QuCAD; others fall back to a default." },
  { key: "algorithm", label: "Algorithm", hint: "Pick one or more research algorithms to apply." },
  { key: "metric", label: "Metric", hint: "Optional. Scores the output circuit (e.g. fidelity)." },
  { key: "sink", label: "Sink", hint: "Required. Collects final metrics and the resulting circuit." },
];

/** Blocks that are pre-checked when the picker opens, because almost
 *  every pipeline needs them. The user can still uncheck them. */
const DEFAULT_CHECKED: NodeKind[] = ["input_circuit", "output"];

export function BlockPicker({
  canvasKinds,
}: {
  /** Kinds already present on the canvas, for "on canvas" badges. */
  canvasKinds: Set<NodeKind>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<NodeKind>>(new Set(DEFAULT_CHECKED));
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const addBlocksToCanvas = useApp((s) => s.addBlocksToCanvas);

  // Outside-click + Escape to close.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as globalThis.Node))
        setOpen(false);
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

  // Reset to defaults + focus search on open.
  useEffect(() => {
    if (open) {
      setChecked(new Set(DEFAULT_CHECKED));
      setSearch("");
      searchRef.current?.focus();
    }
  }, [open]);

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

  const toggle = (kind: NodeKind) =>
    setChecked((s) => {
      const next = new Set(s);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });

  const addSelected = () => {
    if (checked.size === 0) return;
    const ordered = NODE_CATALOG.filter((n) => checked.has(n.kind)).map(
      (n) => n.kind,
    );
    addBlocksToCanvas(ordered);
    setChecked(new Set());
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-accent/50 text-accent hover:bg-accent/10 transition-colors whitespace-nowrap"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Add blocks to canvas"
      >
        <Plus className="w-3 h-3" />
        Add blocks
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Block catalog"
          className="fixed left-3 top-14 sm:absolute sm:left-0 sm:top-full sm:mt-1 z-40 w-[min(320px,calc(100vw-1.5rem))] max-h-[70vh] rounded-lg border border-edge bg-surface shadow-xl flex flex-col"
        >
          {/* Search */}
          <div className="p-2 border-b border-edge">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-mute pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter blocks..."
                className="w-full text-[11px] bg-surfaceAlt border border-edge rounded-md pl-6 pr-6 py-1.5 text-ink placeholder:text-mute/60 focus:outline-none focus:border-accent/60"
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
          </div>

          {/* Categorised list */}
          <div className="flex-1 overflow-y-auto p-1">
            {FAMILY_META.map((fm) => {
              const items = filtered.filter((n) => n.family === fm.key);
              if (items.length === 0) return null;
              return (
                <div key={fm.key} className="mb-1">
                  <div className="px-2 pt-1.5 pb-0.5">
                    <div className="text-[9px] uppercase tracking-widest text-mute/70 font-medium">
                      {fm.label}
                    </div>
                    <div className="text-[9px] text-mute/50 leading-snug">
                      {fm.hint}
                    </div>
                  </div>
                  {items.map((n) => {
                    const isChecked = checked.has(n.kind);
                    const onCanvas = canvasKinds.has(n.kind);
                    const Icon = n.icon;
                    return (
                      <button
                        key={n.kind}
                        type="button"
                        onClick={() => toggle(n.kind)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                          isChecked
                            ? "bg-accent/10"
                            : "hover:bg-surfaceAlt"
                        }`}
                      >
                        {/* Checkbox */}
                        <span
                          className={`shrink-0 w-4 h-4 rounded flex items-center justify-center ${
                            isChecked
                              ? "bg-accent border border-accent text-canvas"
                              : "border border-edge bg-surface"
                          }`}
                        >
                          {isChecked && (
                            <Check className="w-2.5 h-2.5" strokeWidth={3} />
                          )}
                        </span>
                        {/* Icon */}
                        <span
                          className={`shrink-0 w-5 h-5 rounded border ${n.accentRing} bg-surface flex items-center justify-center ${n.accent}`}
                        >
                          <Icon className="w-2.5 h-2.5" strokeWidth={2} />
                        </span>
                        {/* Label + tagline */}
                        <span className="flex-1 min-w-0">
                          <span className="text-[11px] text-ink block truncate">
                            {n.label}
                          </span>
                          <span className="text-[9px] text-mute block truncate">
                            {n.tagline}
                          </span>
                        </span>
                        {/* On-canvas badge */}
                        {onCanvas && (
                          <span className="shrink-0 text-[9px] text-mute/50 border border-edge/50 rounded px-1 py-0.5">
                            on canvas
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-6 text-center text-[11px] text-mute">
                No blocks match "{search}"
              </div>
            )}
          </div>

          {/* Footer with Add button */}
          <div className="p-2 border-t border-edge flex items-center justify-between gap-2">
            <span className="text-[10px] text-mute">
              {checked.size > 0
                ? `${checked.size} selected`
                : "Check blocks to add"}
            </span>
            <button
              type="button"
              onClick={addSelected}
              disabled={checked.size === 0}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                checked.size > 0
                  ? "bg-accent text-canvas hover:bg-accent/90"
                  : "bg-surfaceAlt text-mute cursor-not-allowed"
              }`}
            >
              <Plus className="w-3 h-3" />
              Add to canvas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
