// Honesty banner for the bundled demo archive. Shown by any surface
// that is currently rendering demo-flagged records (History tab,
// Multiverse board). One line: what the data is, how to make your
// own, and a one-click way out. The copy deliberately says "real
// seeded runs" — the bundle is recorded API output, not mock numbers —
// and the banner disappears by itself once the records are gone
// (parents render it conditionally on demo records existing).

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { clearDemoRuns, demoReimportedForScenario } from "../lib/demoArchive";

export function DemoArchiveBanner() {
  const [busy, setBusy] = useState(false);
  return (
    // data-export-strip: guidance chrome, not evidence — figure
    // exports (F2 board/history figures) drop this strip (audit S2).
    <div
      data-export-strip
      className="shrink-0 border-b border-accent/25 bg-accent/5 px-3 py-1.5 flex items-center gap-2 text-[11px] text-mute"
    >
      <FlaskConical className="w-3 h-3 text-accent shrink-0" />
      <span className="min-w-0">
        {demoReimportedForScenario()
          ? "Demo archive re-imported for this figure scenario — Clear demo data again to remove it."
          : "Showing a bundled demo archive of real seeded runs — run any pipeline to start your own evidence."}
      </span>
      <button
        type="button"
        className="ml-auto shrink-0 underline decoration-accent/50 underline-offset-2 text-ink hover:text-accent disabled:opacity-50"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void clearDemoRuns();
        }}
        title="Delete every demo record from this browser's archive. Your own runs are untouched, and the demo won't auto-reload — though opening a documented ?scenario= figure link re-imports it for that figure."
      >
        {busy ? "Clearing…" : "Clear demo data"}
      </button>
    </div>
  );
}
