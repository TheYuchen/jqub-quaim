// Provenance timeline — the archive of every run this browser has
// executed, newest first. Each entry can be:
//
//   * restored  — canvas + params + circuit come back exactly as run,
//                 next run counts as a fork of this one;
//   * replayed  — restore + pin the recorded root seed, so pressing
//                 Run reproduces the exact stochastic draw;
//   * deleted   — drop the record.
//
// The colored #hash chip identifies the *configuration* (structural
// hash of circuit + graph + params): runs sharing a chip are
// replicates of the same experiment and feed one distribution.

import { useEffect, useState } from "react";
import { History, Play, RotateCcw, Trash2 } from "lucide-react";
import { useApp } from "../lib/store";
import { deleteRun, listRuns, type RunRecord } from "../lib/runStore";

function timeLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** Stable pastel per config hash so replicate groups pop visually. */
function hashHue(hash: string): number {
  let h = 0;
  for (let i = 0; i < hash.length; i++) h = (h * 31 + hash.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function RunHistory() {
  const historyVersion = useApp((s) => s.historyVersion);
  const requestRestore = useApp((s) => s.requestRestore);
  const compareIds = useApp((s) => s.compareIds);
  const toggleCompare = useApp((s) => s.toggleCompare);
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listRuns(50)
      .then((rs) => {
        if (!cancelled) setRecords(rs);
      })
      .catch(() => {
        /* IndexedDB unavailable (private mode etc.) — panel stays empty */
      });
    return () => {
      cancelled = true;
    };
  }, [historyVersion]);

  if (records.length === 0) return null;

  const restore = (r: RunRecord, pin: boolean) =>
    requestRestore({
      graph: r.graph,
      sampleKey: r.sample_key,
      pinSeed: pin ? r.root_seed : null,
      sourceRunId: r.run_id,
    });

  return (
    <div className="panel-alt overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-surfaceAlt"
        aria-expanded={open}
      >
        <History className="w-3.5 h-3.5 text-mute" />
        <span className="text-xs font-semibold text-ink">Run history</span>
        <span className="chip">{records.length}</span>
        <span className="ml-auto text-[10px] text-mute">
          {open ? "hide" : "show"}
        </span>
      </button>
      {open && (
        <ul className="max-h-64 overflow-y-auto divide-y divide-edge/60">
          {records.map((r) => (
            <li key={r.run_id} className="px-3 py-1.5 flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                className="w-3 h-3 accent-current shrink-0 cursor-pointer"
                checked={compareIds.includes(r.run_id)}
                onChange={() => toggleCompare(r.run_id)}
                title="Select for comparison (pick two runs)"
                aria-label={`Select run ${r.run_id} for comparison`}
              />
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.ok ? "bg-ok" : "bg-danger"}`}
                title={r.ok ? "completed" : "errored"}
              />
              <span className="text-mute font-mono shrink-0">{timeLabel(r.created_at)}</span>
              <span
                className="chip shrink-0"
                style={{ borderColor: `hsl(${hashHue(r.config_hash)} 60% 55% / 0.6)` }}
                title={`Configuration ${r.config_hash} — rows with the same tag are replicates of the same experiment${r.forked_from ? `\nForked from run ${r.forked_from}` : ""}`}
              >
                #{r.config_hash.slice(0, 4)}
              </span>
              <span className="truncate text-ink" title={r.sample_key ?? r.circuit_name ?? "uploaded circuit"}>
                {r.sample_key ?? r.circuit_name ?? "upload"}
              </span>
              {r.headline_value != null && (
                <span className="font-mono text-mute shrink-0">
                  F={(r.headline_value * 100).toFixed(1)}%
                </span>
              )}
              <span
                className={`shrink-0 ${r.seed_mode === "pinned" ? "text-accent" : "text-mute"}`}
                title={
                  r.root_seed != null
                    ? `${r.seed_mode} seed — root ${r.root_seed}. Replay reproduces this draw exactly.`
                    : "no seed recorded (pre-provenance run or cached response)"
                }
              >
                {r.seed_mode === "pinned" ? "⚲" : "∿"}
              </span>
              <span className="ml-auto flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  className="p-0.5 text-mute hover:text-ink rounded hover:bg-surfaceAlt"
                  title="Restore this run's graph + circuit onto the canvas"
                  aria-label="Restore run"
                  onClick={() => restore(r, false)}
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  className="p-0.5 text-mute hover:text-accent rounded hover:bg-surfaceAlt disabled:opacity-30"
                  title={
                    r.root_seed != null
                      ? "Replay: restore + pin this run's seed. Pressing Run then reproduces the exact numbers."
                      : "This run has no recorded seed (cached response) — plain restore is available."
                  }
                  aria-label="Replay run"
                  disabled={r.root_seed == null}
                  onClick={() => restore(r, true)}
                >
                  <Play className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  className="p-0.5 text-mute hover:text-danger rounded hover:bg-surfaceAlt"
                  title="Delete this record"
                  aria-label="Delete run record"
                  onClick={() => {
                    void deleteRun(r.run_id).then(() =>
                      useApp.getState().bumpHistoryVersion(),
                    );
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
