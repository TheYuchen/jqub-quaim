import { NODE_CATALOG } from "../lib/nodeCatalog";

/**
 * Empty-state overlay shown when the canvas has no nodes. Teaches the
 * two add paths — the "+ Add block" chooser in the toolbar, and
 * dragging out of a block's edge into empty space — plus the preset
 * shortcut, and carries the five-stage grammar line the old pipeline
 * shelf used to illustrate (the tour's slide 2 is the other carrier).
 */
export function EmptyCanvas() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div className="panel px-6 py-5 pointer-events-auto text-center max-w-sm">
        <div className="text-ink font-medium mb-1">Canvas is empty</div>
        {/* Control names, not labels (audit S3): "Load preset" and
            "Run pipeline" render icon-only in the 768–1024 band, so
            the copy describes where to look instead of quoting text
            the user cannot see. */}
        <div className="text-sm text-mute mb-3">
          Hit <span className="kbd">+ Add block</span> in the toolbar
          (click rows to add, or drag them in), or — once blocks exist —
          drag from a block's right edge into empty space and pick what
          legally comes next. Pipelines read left to right:{" "}
          <span className="whitespace-nowrap">
            Source → Backend → Algorithm → Metric → Sink
          </span>
          . Or load a preset from the toolbar's layers-icon menu, then
          hit <span className="kbd">Run</span> (toolbar top-right; round
          button bottom-right on phones) and evidence collects in the
          right-hand pane.
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
