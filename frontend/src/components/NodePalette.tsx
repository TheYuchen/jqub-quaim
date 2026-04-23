import { NODE_CATALOG, type NodeSpec } from "../lib/nodeCatalog";

/**
 * Side panel of draggable node templates. Dragging onto the canvas
 * is handled by FlowCanvas via the dataTransfer "application/reactflow"
 * payload (we just put the node kind into it).
 */
export function NodePalette() {
  return (
    <div className="flex-1 overflow-y-auto p-3 min-h-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-mute mb-2">
        Blocks
      </h3>
      <div className="space-y-1.5">
        {["source", "backend", "algorithm", "metric", "sink"].map((fam) => {
          const items = NODE_CATALOG.filter((n) => n.family === fam);
          if (items.length === 0) return null;
          return (
            <div key={fam}>
              <div className="text-[10px] text-mute/70 uppercase tracking-wider pl-1 pt-2 pb-1">
                {fam}
              </div>
              {items.map((n) => (
                <PaletteItem key={n.kind} spec={n} />
              ))}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-mute/70 mt-4 leading-relaxed">
        Drag a block onto the canvas. Connect right-handle to left-handle to define data
        flow; run order is inferred by topological sort.
      </p>
    </div>
  );
}

function PaletteItem({ spec }: { spec: NodeSpec }) {
  const Icon = spec.icon;
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/reactflow", spec.kind);
    e.dataTransfer.effectAllowed = "move";
  }
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`group cursor-grab active:cursor-grabbing flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent hover:border-edge hover:bg-surfaceAlt transition-colors`}
      title={spec.description}
    >
      <span
        className={`w-7 h-7 rounded-md border ${spec.accentRing} bg-surface flex items-center justify-center ${spec.accent} shrink-0`}
      >
        <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="text-sm text-ink truncate">{spec.label}</div>
        <div className="text-[10px] text-mute truncate">{spec.description}</div>
      </div>
    </div>
  );
}
