// Segmented workspace switch — the IA-inversion control (board = home).
//
// Label ↔ internal-id mapping (ids FROZEN — scenario uiState, the
// persisted quda.workspaceMode preference and figure provenance key
// on them; only the user-visible language changed):
//
//   id "multiverse" → label "Evidence board"  — HOME: every
//                     configuration ever tried and its evidence.
//   id "compose"    → label "Pipeline editor" — the subordinate
//                     definition view of ONE configuration.
//
// Board segment renders first: home leads, the editor is entered.
//
// Lives in BOTH workspace headers (FlowCanvas toolbar and the
// MultiverseBoard header) so the user can always flip back — when the
// board covers the canvas, the canvas toolbar's copy of this control
// is unreachable.

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
        aria-selected={mode === "multiverse"}
        title="Evidence board: home — every configuration and its evidence"
        className={seg(mode === "multiverse")}
        onClick={() => setMode("multiverse")}
      >
        <LayoutGrid className="w-3 h-3" aria-hidden="true" />
        <span className="hidden sm:inline">Evidence board</span>
        <span className="sr-only sm:hidden">Evidence board</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "compose"}
        title="Pipeline editor: define or modify one configuration"
        className={seg(mode === "compose")}
        onClick={() => setMode("compose")}
      >
        <Workflow className="w-3 h-3" aria-hidden="true" />
        <span className="hidden sm:inline">Pipeline editor</span>
        <span className="sr-only sm:hidden">Pipeline editor</span>
      </button>
    </div>
  );
}
