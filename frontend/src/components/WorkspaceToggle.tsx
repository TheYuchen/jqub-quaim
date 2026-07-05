// Segmented Compose | Multiverse switch.
//
// Lives in BOTH canvas headers (FlowCanvas toolbar and the
// MultiverseBoard header) so the user can always flip back — when the
// board covers the canvas, the canvas toolbar's copy of this control
// is unreachable.
//
// "Compose" = the React Flow editor (one pipeline at a time).
// "Multiverse" = the set of all configurations ever tried, as small
// multiples — the archive promoted from a side panel to a workspace.

import { LayoutGrid, Workflow } from "lucide-react";
import { useApp } from "../lib/store";

export function WorkspaceToggle({ className = "" }: { className?: string }) {
  const mode = useApp((s) => s.workspaceMode);
  const setMode = useApp((s) => s.setWorkspaceMode);
  const seg = (active: boolean) =>
    `flex items-center gap-1 px-2 py-1 text-[11px] leading-none transition-colors ${
      active
        ? "bg-accent/15 text-accent"
        : "text-mute hover:text-ink hover:bg-surfaceAlt"
    }`;
  return (
    <div
      role="tablist"
      aria-label="Workspace mode"
      className={`flex items-stretch rounded-md border border-edge bg-surface overflow-hidden shrink-0 ${className}`}
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "compose"}
        title="Compose: edit and run one pipeline on the canvas"
        className={seg(mode === "compose")}
        onClick={() => setMode("compose")}
      >
        <Workflow className="w-3 h-3" aria-hidden="true" />
        <span className="hidden sm:inline">Compose</span>
        <span className="sr-only sm:hidden">Compose</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "multiverse"}
        title="Multiverse: every configuration you've tried, side by side with its outcome distribution"
        className={seg(mode === "multiverse")}
        onClick={() => setMode("multiverse")}
      >
        <LayoutGrid className="w-3 h-3" aria-hidden="true" />
        <span className="hidden sm:inline">Multiverse</span>
        <span className="sr-only sm:hidden">Multiverse</span>
      </button>
    </div>
  );
}
