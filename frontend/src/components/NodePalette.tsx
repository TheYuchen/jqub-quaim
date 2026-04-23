import { NODE_CATALOG, type NodeSpec } from "../lib/nodeCatalog";

/**
 * Horizontal strip of draggable block tiles across the top of the canvas.
 *
 * Previously this lived as a vertical list in the left sidebar beneath
 * CircuitPicker, but with a longer circuit list it was getting squeezed
 * out. A horizontal strip also makes the "drag down onto canvas" motion
 * feel natural.
 */
export function NodePalette() {
  const families: NodeSpec["family"][] = [
    "source",
    "backend",
    "algorithm",
    "metric",
    "sink",
  ];

  return (
    <div className="shrink-0 border-b border-edge bg-surface/40">
      <div className="px-3 py-2 flex items-stretch gap-1 overflow-x-auto">
        <div className="flex items-center pr-2 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-mute/80 leading-tight">
            Drag a<br />block →
          </span>
        </div>
        {families.map((fam, famIdx) => {
          const items = NODE_CATALOG.filter((n) => n.family === fam);
          if (items.length === 0) return null;
          return (
            <div key={fam} className="flex items-center gap-1">
              {items.map((n) => (
                <PaletteTile key={n.kind} spec={n} />
              ))}
              {famIdx < families.length - 1 && (
                <div className="w-px self-stretch bg-edge mx-1" />
              )}
            </div>
          );
        })}
        <div className="hidden xl:flex items-center pl-2 text-[10px] text-mute/70 shrink-0 max-w-[220px]">
          Drop below to add a block. Hover a block on the canvas for the{" "}
          <span className="text-ink mx-1">×</span> delete button.
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
      className="group shrink-0 cursor-grab active:cursor-grabbing flex flex-col items-center justify-center gap-0.5 w-[72px] h-[52px] rounded-md border border-edge/60 hover:border-edge hover:bg-surfaceAlt transition-colors text-center px-1"
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
    </div>
  );
}
