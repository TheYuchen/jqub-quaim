import { NODE_CATALOG } from "../lib/nodeCatalog";

/**
 * Empty-state overlay shown when the canvas has no nodes. Nudges the
 * user toward the two entry paths (drag a block, or pick a preset) and
 * teases the block catalog so the canvas doesn't feel bare.
 */
export function EmptyCanvas() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div className="panel px-6 py-5 pointer-events-auto text-center max-w-sm">
        <div className="text-ink font-medium mb-1">Canvas is empty</div>
        <div className="text-sm text-mute mb-3">
          Drag blocks from the strip above, or pick a preset from{" "}
          <span className="kbd">Load preset</span>.
        </div>
        <div className="flex flex-wrap gap-1 justify-center">
          {NODE_CATALOG.slice(0, 6).map((n) => (
            <span key={n.kind} className="chip">
              {n.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
