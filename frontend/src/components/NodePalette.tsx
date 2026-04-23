import { NODE_CATALOG, type NodeSpec } from "../lib/nodeCatalog";

/**
 * Adaptive strip of draggable block tiles across the top of the canvas.
 *
 * Rather than hard-coding one or two rows, the outer container uses
 * flex-wrap and marks each family group as shrink-0. Consequences:
 *
 *   - On a wide canvas, all 8 tiles sit in a single row.
 *   - When the canvas is squeezed (e.g. both side panes expanded on a
 *     laptop screen), the last family that doesn't fit wraps to a new
 *     row. Families never split mid-group, so "algorithm" stays together.
 *   - No ResizeObserver, no JS breakpoint math — purely CSS. Responds
 *     instantly to PaneResizer drags.
 */
const FAMILIES: NodeSpec["family"][] = [
  "source",
  "backend",
  "algorithm",
  "metric",
  "sink",
];

export function NodePalette() {
  return (
    <div className="shrink-0 border-b border-edge bg-surface/40">
      <div className="px-3 py-2 flex flex-wrap items-stretch gap-x-2 gap-y-1">
        <div className="flex items-center pr-1 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-mute/80 leading-tight">
            Drag a<br />block →
          </span>
        </div>
        {FAMILIES.map((fam, famIdx) => {
          const items = NODE_CATALOG.filter((n) => n.family === fam);
          if (items.length === 0) return null;
          return (
            <div key={fam} className="flex items-center gap-1 shrink-0">
              {items.map((n) => (
                <PaletteTile key={n.kind} spec={n} />
              ))}
              {famIdx < FAMILIES.length - 1 && (
                <div className="w-px self-stretch bg-edge mx-1" />
              )}
            </div>
          );
        })}
        <div className="hidden xl:flex items-center pl-2 text-[10px] text-mute/70 leading-tight shrink-0 max-w-[180px]">
          Drop onto the canvas below.
          <br />
          Hover a block to reveal its × delete button.
        </div>
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
      className="group shrink-0 cursor-grab active:cursor-grabbing flex flex-col items-center justify-center gap-0.5 w-[108px] h-[64px] rounded-md border border-edge/60 hover:border-edge hover:bg-surfaceAlt transition-colors text-center px-1.5 py-1"
      title={spec.description}
    >
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
