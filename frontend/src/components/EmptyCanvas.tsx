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
        {/* Control names, not labels (audit S3): "Load preset" and
            "Run pipeline" render icon-only in the 768–1024 band, so
            the copy describes where to look instead of quoting text
            the user cannot see. */}
        <div className="text-sm text-mute mb-3">
          Drag blocks from the shelf above — its columns read left to
          right as the pipeline grammar (Source → … → Sink) — or load a
          preset from the
          toolbar's layers-icon menu — then hit{" "}
          <span className="kbd">Run</span> (toolbar top-right; round
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
