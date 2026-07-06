// Provenance lineage view — the archive of every run this browser has
// executed, drawn as a vertical lineage graph (newest at top) rather
// than a plain list. Encoding rationale (one field per channel):
//
//   * node HUE      = config_hash. Vertical position already encodes
//     time, so hue is the only channel that stays legible at 8-px
//     marks; a stable hash->hue mapping keeps one configuration the
//     same color across panels, sessions and screenshots.
//   * node RING     = seed_mode. Pinned (replayed) runs carry an
//     annulus around the dot — visually "sealed", i.e. deterministic.
//     Fresh runs are bare dots.
//   * HOLLOW+SLASH  = status. Errored runs render hollow with a red
//     slash: failure stays visible without stealing the hue channel.
//   * curved EDGES  = forked_from descent (restore / replay). Edges
//     take the child's hue, so you trace where a configuration came
//     from by following its own color upward through time.
//   * lane BAND + SPINE = a contiguous block of replicates of one
//     configuration (what the xN replicate runner produces). The band
//     plus the per-group dot STRIP above each block make distribution
//     buildup readable directly in the timeline: each strip shows all
//     headline values archived up to that moment, so older strips
//     have fewer dots.
//
//   * node AREA (Wave J) = evidence mass: dot area ∝ √(total shots
//     the run's stochastic steps actually EXECUTED). Provenance
//     usually pretends every state is equally solid; here a run IS a
//     distribution, and how much evidence backs it is part of the
//     record — an early-stopped run renders visibly lighter than a
//     full one, so optional stopping stays legible in the timeline.
//     Area (not radius) because dots read as quantities; √shots (not
//     shots) so a 4096-shot run cannot visually swallow eight 512s.
//     Runs with no sampled step keep the minimum radius: absence of
//     evidence, not zero size.
//   * group FUNNEL (Wave J) = two thin symmetric polylines around a
//     replicate band's spine: at each run's row, the POOLED Wilson CI
//     half-width of the group's binomial counts accumulated up to and
//     including that run (oldest at the bottom, so the funnel narrows
//     upward ≈ 1/√N). Same visual vocabulary as the within-run
//     evidence funnel on the fidelity card — one motif, two contexts:
//     shots accumulating inside a run, runs accumulating inside a
//     group. Pooled numbers live in the funnel tooltip.
//
// All list behaviors are preserved: restore / replay(pin seed) /
// delete per run, compare checkboxes (max 2, wired to useApp), the
// collapsible header. Hovering a row (or its dot) highlights the full
// lineage chain — ancestors via forked_from plus every descendant —
// by dimming unrelated rows, nodes and edges.

import { useEffect, useMemo, useState } from "react";
import { GitCompareArrows, History, Play, RotateCcw, Trash2 } from "lucide-react";
import { useApp } from "../lib/store";
import { deleteRun, listRuns, type RunRecord } from "../lib/runStore";
import { hashHue, hueCss } from "../lib/hues";
import { runEvidence, wilson95 } from "../lib/stats";
import { DemoArchiveBanner } from "./DemoArchiveBanner";

// --- layout constants (px) --------------------------------------------------
// Fixed row heights let the SVG gutter compute node centers arithmetically:
// HTML rows and SVG marks stay aligned without ever measuring the DOM.
const GUTTER_W = 58; // lineage gutter width; row content starts right of it
const RUN_H = 28; // height of one run row
const STRIP_H = 20; // height of a group distribution-strip row
const LANE_X0 = 13; // x of lane 0 inside the gutter
const LANE_DX = 11; // horizontal distance between lanes
const N_LANES = 4; // lanes cycle mod 4 — enough separation for edges to read
const R_MIN = 3; // node radius floor (runs with no sampled evidence)
const R_MAX = 7; // node radius cap
const SHOTS_REF = 2048; // shots that earn R_MAX = the app's default full budget
const RING_PAD = 2.5; // pinned-seed ring sits this far outside the dot
const FUNNEL_MAX_PX = 10; // widest half-width of a group certainty funnel

/** Wave J evidence mass: dot AREA ∝ √shots ⇒ radius ∝ shots^(1/4),
 *  against a FIXED 2048-shot reference (not view-normalized) so the
 *  same run keeps the same weight across sessions and figures — the
 *  same stability argument as the hash→hue mapping. 512 shots ≈ 5px,
 *  2048 ≈ 7px; an early stop at 512 of 2048 is plainly lighter. */
function evidenceRadius(shots: number): number {
  if (!(shots > 0)) return R_MIN;
  return Math.max(R_MIN, Math.min(R_MAX, R_MAX * Math.pow(shots / SHOTS_REF, 0.25)));
}
const STRIP_W = 92; // width of the 0-1 distribution mini strip

function timeLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** Multi-line native tooltip carrying the full provenance detail. */
function nodeTitle(r: RunRecord): string {
  const ev = runEvidence(r.response);
  const lines = [
    `run ${r.run_id}`,
    new Date(r.created_at).toLocaleString(),
    `config #${r.config_hash} · ${r.sample_key ?? r.circuit_name ?? "uploaded circuit"}`,
    r.root_seed != null
      ? `${r.seed_mode ?? "?"} seed · root ${r.root_seed}`
      : "no seed recorded (pre-provenance run or cached response)",
    r.headline_value != null
      ? `${r.headline_label ?? "metric"} = ${(r.headline_value * 100).toFixed(2)}%`
      : "no headline metric",
    `${r.n_steps} steps · ${r.ok ? "completed" : "errored"}`,
    ev
      ? `${ev.shots} shots of evidence (dot area)`
      : "no sampled evidence (deterministic steps only)",
  ];
  if (r.forked_from) lines.push(`forked from run ${r.forked_from}`);
  return lines.join("\n");
}

/** Cubic bezier from a child run down to its ancestor. Same-lane edges
 *  bow left so they separate from the straight lane spine. */
function edgePath(
  c: { x: number; y: number },
  p: { x: number; y: number },
  rc: number,
  rp: number,
): string {
  const dy = p.y - c.y;
  if (c.x === p.x) {
    const bow = c.x - 8;
    return `M ${c.x} ${c.y + rc} C ${bow} ${c.y + dy * 0.3} ${bow} ${p.y - dy * 0.3} ${p.x} ${p.y - rp}`;
  }
  return `M ${c.x} ${c.y + rc} C ${c.x} ${c.y + dy * 0.5} ${p.x} ${p.y - dy * 0.5} ${p.x} ${p.y - rp}`;
}

// --- layout model -------------------------------------------------------

interface NodePos {
  x: number;
  y: number;
}

type Row =
  | { kind: "run"; rec: RunRecord }
  | {
      kind: "strip";
      hash: string;
      hue: number;
      /** Headline values (clamped 0-1) of every run of this config
       *  archived up to this block; inSection = belongs to the block
       *  directly below (drawn brighter than older replicates). */
      dots: { v: number; inSection: boolean }[];
      mean: number;
    };

interface Layout {
  rows: Row[];
  totalH: number;
  nodeAt: Map<string, NodePos>;
  edges: { childId: string; parentId: string; hue: number }[];
  /** Children whose ancestor fell outside the visible window. */
  stubs: { childId: string }[];
  spines: { x: number; y0: number; y1: number; hue: number; ids: string[] }[];
  /** Wave J: per-run node radius (evidence mass). */
  radius: Map<string, number>;
  /** Wave J: one cumulative-certainty funnel per replicate band with
   *  ≥2 binomial runs. `pts` run oldest (widest) → newest. */
  funnels: {
    x: number;
    hue: number;
    ids: string[];
    pts: { y: number; hw: number; nRuns: number; shots: number }[];
  }[];
  parentOf: Map<string, string | null>;
}

function computeLayout(records: RunRecord[]): Layout {
  // Lane per configuration, in order of first (newest) appearance.
  // Lanes cycle mod N_LANES: only contiguity + hue identify a group,
  // so distant groups may share a column without ambiguity.
  const laneOf = new Map<string, number>();
  for (const r of records)
    if (!laneOf.has(r.config_hash)) laneOf.set(r.config_hash, laneOf.size % N_LANES);

  const groupTotal = new Map<string, number>();
  for (const r of records)
    groupTotal.set(r.config_hash, (groupTotal.get(r.config_hash) ?? 0) + 1);

  // Contiguous same-config sections (records arrive newest-first).
  const sections: RunRecord[][] = [];
  for (const r of records) {
    const last = sections[sections.length - 1];
    if (last && last[0].config_hash === r.config_hash) last.push(r);
    else sections.push([r]);
  }

  const rows: Row[] = [];
  const nodeAt = new Map<string, NodePos>();
  const spines: Layout["spines"] = [];
  const funnels: Layout["funnels"] = [];
  // Evidence mass per run, computed once (records carry full responses).
  const evidence = new Map(records.map((r) => [r.run_id, runEvidence(r.response)]));
  const radius = new Map(
    records.map((r) => [r.run_id, evidenceRadius(evidence.get(r.run_id)?.shots ?? 0)]),
  );
  let y = 0;

  for (const sec of sections) {
    const hash = sec[0].config_hash;
    const hue = hashHue(hash);
    const x = LANE_X0 + (laneOf.get(hash) ?? 0) * LANE_DX;

    // Distribution strip: only when the group has >=2 runs AND >=2 of
    // them (up to this point in time) carry a headline value. "Up to
    // this point" = created at or before this section's newest run,
    // which is what makes buildup visible when scrolling down the past.
    if ((groupTotal.get(hash) ?? 0) >= 2) {
      const cutoff = sec[0].created_at;
      const inSec = new Set(sec.map((r) => r.run_id));
      const dots = records
        .filter(
          (r) =>
            r.config_hash === hash &&
            r.created_at <= cutoff &&
            r.headline_value != null,
        )
        .map((r) => ({
          v: Math.max(0, Math.min(1, r.headline_value ?? 0)),
          inSection: inSec.has(r.run_id),
        }));
      if (dots.length >= 2) {
        const mean = dots.reduce((a, d) => a + d.v, 0) / dots.length;
        rows.push({ kind: "strip", hash, hue, dots, mean });
        y += STRIP_H;
      }
    }

    const y0 = y + RUN_H / 2;
    for (const rec of sec) {
      rows.push({ kind: "run", rec });
      nodeAt.set(rec.run_id, { x, y: y + RUN_H / 2 });
      y += RUN_H;
    }
    if (sec.length >= 2) {
      spines.push({ x, y0, y1: y - RUN_H / 2, hue, ids: sec.map((r) => r.run_id) });
      // Wave J — cumulative certainty funnel for this replicate band.
      // Pooling (Σsuccesses / Σshots + one Wilson interval) is valid
      // because the band holds replicates of ONE configuration — same
      // circuit, same backend snapshot, same params — so every run
      // draws from the same underlying success probability p; summed
      // counts are the sufficient statistic (full rationale in
      // lib/stats.ts). Walked oldest → newest so each row carries the
      // pooled half-width of everything up to and including it.
      const pts: Layout["funnels"][number]["pts"] = [];
      let cSucc = 0;
      let cShots = 0;
      let cRuns = 0;
      for (let i = sec.length - 1; i >= 0; i--) {
        const ev = evidence.get(sec[i].run_id);
        if (!ev) continue; // non-binomial runs neither widen nor narrow the pool
        cSucc += ev.successes;
        cShots += ev.shots;
        cRuns += 1;
        const [lo, hi] = wilson95(cSucc, cShots);
        pts.push({
          y: nodeAt.get(sec[i].run_id)?.y ?? 0,
          hw: (hi - lo) / 2,
          nRuns: cRuns,
          shots: cShots,
        });
      }
      if (pts.length >= 2) funnels.push({ x, hue, ids: sec.map((r) => r.run_id), pts });
    }
  }

  const edges: Layout["edges"] = [];
  const stubs: Layout["stubs"] = [];
  for (const r of records) {
    if (!r.forked_from) continue;
    if (nodeAt.has(r.forked_from))
      edges.push({ childId: r.run_id, parentId: r.forked_from, hue: hashHue(r.config_hash) });
    else stubs.push({ childId: r.run_id });
  }

  return {
    rows,
    totalH: y,
    nodeAt,
    edges,
    stubs,
    spines,
    radius,
    funnels,
    parentOf: new Map(records.map((r) => [r.run_id, r.forked_from])),
  };
}

/** Lineage chain of the hovered run: the run itself, every ancestor
 *  reachable via forked_from, and every descendant whose ancestor walk
 *  passes through it. Cycle-guarded (should never happen, but the data
 *  is user-editable IndexedDB). */
function lineageOf(
  hoverId: string,
  records: RunRecord[],
  parentOf: Map<string, string | null>,
): Set<string> {
  const chain = new Set<string>([hoverId]);
  const seen = new Set<string>([hoverId]);
  let cur = parentOf.get(hoverId) ?? null;
  while (cur && !seen.has(cur)) {
    chain.add(cur);
    seen.add(cur);
    cur = parentOf.get(cur) ?? null;
  }
  for (const r of records) {
    if (chain.has(r.run_id)) continue;
    const path = [r.run_id];
    const walked = new Set<string>([r.run_id]);
    let p = parentOf.get(r.run_id) ?? null;
    while (p && !walked.has(p)) {
      if (chain.has(p)) {
        for (const id of path) chain.add(id);
        break;
      }
      walked.add(p);
      path.push(p);
      p = parentOf.get(p) ?? null;
    }
  }
  return chain;
}

/** Provenance lineage panel.
 *
 * Hosting modes:
 *   standalone (default) — collapsible header + capped height (the
 *                          pre-tabs layout, kept for reuse);
 *   embedded             — inside the Evidence pane's History tab:
 *                          always fully expanded, no toggle, no height
 *                          cap (the tab body owns scrolling).
 */
export function RunHistory({ embedded = false }: { embedded?: boolean } = {}) {
  const historyVersion = useApp((s) => s.historyVersion);
  const requestRestore = useApp((s) => s.requestRestore);
  const compareIds = useApp((s) => s.compareIds);
  const toggleCompare = useApp((s) => s.toggleCompare);
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

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

  const layout = useMemo(() => computeLayout(records), [records]);

  const related = useMemo(
    () => (hoverId ? lineageOf(hoverId, records, layout.parentOf) : null),
    [hoverId, records, layout],
  );

  if (records.length === 0)
    return embedded ? (
      <div className="panel-alt p-4 text-[12px] text-mute leading-relaxed">
        No archived runs yet. Every run is archived here automatically,
        seed included — run the pipeline once and it will appear, ready
        to restore, replay (exact numbers), or compare.
      </div>
    ) : null;

  const restore = (r: RunRecord, pin: boolean) =>
    requestRestore({
      graph: r.graph,
      sampleKey: r.sample_key,
      pinSeed: pin ? r.root_seed : null,
      sourceRunId: r.run_id,
      // The optional-stopping target travels with the run: replaying
      // an early-stopped run without it would execute all shots and
      // reproduce nothing.
      precisionTarget: r.precision_target ?? null,
    });

  const enter = (id: string) => setHoverId(id);
  const leave = (id: string) => setHoverId((h) => (h === id ? null : h));

  return (
    <div className="panel-alt overflow-hidden">
      {!embedded && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-surfaceAlt"
          aria-expanded={open}
        >
          <History className="w-3.5 h-3.5 text-mute" />
          <span className="text-xs font-semibold text-ink">Run history</span>
          <span className="chip">{records.length}</span>
          <span className="ml-auto text-[10px] text-mute">{open ? "hide" : "show"}</span>
        </button>
      )}
      {(embedded || open) && (
        <>
          {records.some((r) => r.demo) && <DemoArchiveBanner />}
          {/* Compare needs TWO runs, but nothing used to acknowledge the
              first checkbox beyond a "1" on a tab the user may never
              look at — the interaction just seemed to do nothing. One
              transient chip closes the loop and names the alternative
              entry point (Multiverse A/B). Disappears at 0 or 2. */}
          {compareIds.length === 1 && (
            <div
              role="status"
              className="mx-2 mt-2 flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] text-accent"
            >
              <GitCompareArrows className="w-3 h-3 shrink-0" />
              <span>
                1 of 2 picked — tick one more run to compare, or A/B a
                card in Multiverse.
              </span>
            </div>
          )}
          <div className={embedded ? "" : "max-h-[320px] overflow-y-auto"}>
            {/* Relative wrapper: the SVG gutter is absolutely positioned
                inside the scrolled content, so lineage marks scroll in
                lockstep with the rows they annotate. */}
            <div className="relative">
              <div role="list">
                {layout.rows.map((row, i) => {
                  if (row.kind === "strip") {
                    const mx = 1 + row.mean * (STRIP_W - 2);
                    return (
                      <div
                        key={`strip-${row.hash}-${i}`}
                        className="flex items-center gap-1.5 border-b border-edge/40 bg-surfaceAlt/40"
                        style={{ height: STRIP_H, paddingLeft: GUTTER_W }}
                      >
                        <span
                          className="font-mono text-[9px] shrink-0"
                          style={{ color: hueCss(row.hue, 0.9) }}
                        >
                          #{row.hash.slice(0, 4)}
                        </span>
                        <span className="text-[9px] text-mute shrink-0">×{row.dots.length}</span>
                        <svg
                          width={STRIP_W}
                          height={12}
                          className="shrink-0"
                          role="img"
                          aria-label={`Replicate distribution for configuration ${row.hash}`}
                        >
                          <title>
                            {`headline values of all #${row.hash.slice(0, 4)} runs archived up to this block, on a 0-1 scale\nbright dots = this block · faint dots = older replicates · tick = mean`}
                          </title>
                          <line x1={1} y1={6} x2={STRIP_W - 1} y2={6} stroke="rgb(var(--color-edge))" strokeWidth={1} />
                          <line x1={1} y1={3} x2={1} y2={9} stroke="rgb(var(--color-edge))" strokeWidth={1} />
                          <line x1={STRIP_W - 1} y1={3} x2={STRIP_W - 1} y2={9} stroke="rgb(var(--color-edge))" strokeWidth={1} />
                          <line x1={mx} y1={2} x2={mx} y2={10} stroke="rgb(var(--color-ink) / 0.6)" strokeWidth={1} />
                          {row.dots.map((d, j) => (
                            <circle
                              key={j}
                              cx={1 + d.v * (STRIP_W - 2)}
                              cy={6}
                              r={2.2}
                              fill={hueCss(row.hue, d.inSection ? 0.95 : 0.4)}
                            />
                          ))}
                        </svg>
                        <span className="font-mono text-[9px] text-mute shrink-0">
                          μ={(row.mean * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  }
                  const r = row.rec;
                  const hue = hashHue(r.config_hash);
                  const dimmed = related != null && !related.has(r.run_id);
                  return (
                    <div
                      key={r.run_id}
                      role="listitem"
                      className="flex items-center gap-2 pr-2 text-[11px] border-b border-edge/40 hover:bg-surfaceAlt transition-opacity"
                      style={{ height: RUN_H, paddingLeft: GUTTER_W, opacity: dimmed ? 0.35 : 1 }}
                      onMouseEnter={() => enter(r.run_id)}
                      onMouseLeave={() => leave(r.run_id)}
                    >
                      <input
                        type="checkbox"
                        className="w-3 h-3 accent-current shrink-0 cursor-pointer"
                        checked={compareIds.includes(r.run_id)}
                        onChange={() => toggleCompare(r.run_id)}
                        title="Select for comparison (pick two runs)"
                        aria-label={`Select run ${r.run_id} for comparison`}
                      />
                      <span className="text-mute font-mono text-[10px] shrink-0">
                        {timeLabel(r.created_at)}
                      </span>
                      <span
                        className="font-mono text-[10px] shrink-0"
                        style={{ color: hueCss(hue, 0.9) }}
                        title={`Configuration ${r.config_hash} — same color = replicates of the same experiment${r.forked_from ? `\nForked from run ${r.forked_from}` : ""}`}
                      >
                        #{r.config_hash.slice(0, 4)}
                      </span>
                      {/* Shrinkable metadata group. The row's fixed-width
                          pieces (checkbox, time, hash, three action
                          buttons) alone add up to ~280px; with the demo
                          chip, F=…%, ⏹ and the seed glyph the old flat
                          layout exceeded a narrow Evidence pane and pushed
                          the restore/replay/delete buttons out of the
                          overflow-x-hidden aside. Grouping the middle
                          fields under min-w-0 + overflow-hidden makes THEM
                          give way (name truncates first, then the chips
                          clip) while the action buttons stay reachable at
                          any pane width. Everything stays one line — the
                          gutter's dot arithmetic depends on RUN_H. */}
                      <span className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                      <span
                        className="truncate text-ink"
                        title={r.sample_key ?? r.circuit_name ?? "uploaded circuit"}
                      >
                        {r.sample_key ?? r.circuit_name ?? "upload"}
                      </span>
                      {r.demo && (
                        <span
                          className="shrink-0 font-mono text-[9px] leading-none px-1 py-0.5 rounded border border-accent/40 text-accent"
                          title="Bundled demo record — a real run recorded against the live backend, replayable bit-exact via its pinned seed. Use 'Clear demo data' in the banner above to remove all demo records."
                        >
                          demo
                        </span>
                      )}
                      {r.headline_value != null && (
                        <span className="font-mono text-mute shrink-0">
                          F={(r.headline_value * 100).toFixed(1)}%
                        </span>
                      )}
                      {r.stopped_early && (
                        <span
                          className="shrink-0 text-accent"
                          title={`Stopped early: the precision target${r.precision_target != null ? ` (±${(r.precision_target * 100).toFixed(0)}pp)` : ""} was reached before all requested shots ran. Fewer shots = wider CI — the interval already tells that story.`}
                        >
                          ⏹
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
                            void deleteRun(r.run_id).then(() => {
                              const st = useApp.getState();
                              // A deleted run must not stay selected for
                              // comparison — CompareView would look up a
                              // record that no longer exists.
                              if (st.compareIds.includes(r.run_id))
                                st.toggleCompare(r.run_id);
                              st.bumpHistoryVersion();
                            });
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Lineage gutter. Rendered AFTER the rows so marks paint
                  above the row hover background; pointer events off except
                  on the node hit-targets (tooltips + hover-highlight). */}
              <svg
                className="evidence-mass absolute top-0 left-0"
                width={GUTTER_W}
                height={layout.totalH}
                style={{ pointerEvents: "none" }}
                role="img"
                aria-label="Run lineage graph: dots are runs colored by configuration and sized by shots of evidence, rings mark pinned seeds, curved edges link forked runs to their ancestors, funnels show pooled certainty accumulating across replicates"
              >
                {/* replicate bands + spines (background layer) */}
                {layout.spines.map((s, i) => {
                  const dimmed = related != null && !s.ids.some((id) => related.has(id));
                  return (
                    <g key={`spine-${i}`} className="transition-opacity" style={{ opacity: dimmed ? 0.15 : 1 }}>
                      <rect
                        x={s.x - 7}
                        y={s.y0 - 10}
                        width={14}
                        height={s.y1 - s.y0 + 20}
                        rx={7}
                        fill={hueCss(s.hue, 0.1)}
                      />
                      <line x1={s.x} y1={s.y0} x2={s.x} y2={s.y1} stroke={hueCss(s.hue, 0.35)} strokeWidth={2} />
                    </g>
                  );
                })}
                {/* Wave J — group certainty funnels: pooled Wilson CI
                    half-width at each replicate row, drawn as two thin
                    polylines mirrored around the band spine. Normalized
                    per group (widest row → ±FUNNEL_MAX_PX): the task is
                    the SHAPE of accumulation (≈1/√N narrowing upward,
                    echoing the fidelity card's within-run funnel);
                    absolute pooled numbers live in the tooltip. */}
                {layout.funnels.map((f, i) => {
                  const dimmed = related != null && !f.ids.some((id) => related.has(id));
                  const maxHw = Math.max(...f.pts.map((pt) => pt.hw));
                  const off = (hw: number) =>
                    maxHw > 0 ? (FUNNEL_MAX_PX * hw) / maxHw : 0;
                  const left = f.pts.map((pt) => `${f.x - off(pt.hw)},${pt.y}`);
                  const right = f.pts.map((pt) => `${f.x + off(pt.hw)},${pt.y}`);
                  const newest = f.pts[f.pts.length - 1];
                  return (
                    <g
                      key={`funnel-${i}`}
                      className="transition-opacity"
                      style={{ opacity: dimmed ? 0.15 : 1 }}
                    >
                      <polyline
                        points={left.join(" ")}
                        fill="none"
                        stroke={hueCss(f.hue, 0.6)}
                        strokeWidth={1}
                      />
                      <polyline
                        points={right.join(" ")}
                        fill="none"
                        stroke={hueCss(f.hue, 0.6)}
                        strokeWidth={1}
                      />
                      {/* invisible hit area carrying the pooled numbers */}
                      <polygon
                        points={[...left, ...right.slice().reverse()].join(" ")}
                        fill="transparent"
                        style={{ pointerEvents: "auto" }}
                      >
                        <title>
                          {`pooled ±${(newest.hw * 100).toFixed(1)}pp after ${newest.nRuns} runs / ${newest.shots} shots
cumulative Wilson CI half-width of this configuration's pooled counts, widest (oldest) row scaled to ${FUNNEL_MAX_PX}px — the funnel narrowing upward is certainty accumulating across replicate runs (same motif as the fidelity card's funnel, where shot batches accumulate inside one run)`}
                        </title>
                      </polygon>
                    </g>
                  );
                })}
                {/* fork edges: child -> ancestor, in the child's hue */}
                {layout.edges.map((e) => {
                  const c = layout.nodeAt.get(e.childId);
                  const p = layout.nodeAt.get(e.parentId);
                  if (!c || !p) return null;
                  const lit =
                    related == null || (related.has(e.childId) && related.has(e.parentId));
                  return (
                    <path
                      key={`edge-${e.childId}`}
                      d={edgePath(
                        c,
                        p,
                        layout.radius.get(e.childId) ?? R_MIN,
                        layout.radius.get(e.parentId) ?? R_MIN,
                      )}
                      fill="none"
                      stroke={hueCss(e.hue, 0.55)}
                      strokeWidth={related != null && lit ? 1.8 : 1.2}
                      className="transition-opacity"
                      style={{ opacity: lit ? 1 : 0.12 }}
                    />
                  );
                })}
                {/* dangling stubs: ancestor deleted or beyond the window */}
                {layout.stubs.map((s) => {
                  const c = layout.nodeAt.get(s.childId);
                  if (!c) return null;
                  const rs = layout.radius.get(s.childId) ?? R_MIN;
                  return (
                    <path
                      key={`stub-${s.childId}`}
                      d={`M ${c.x} ${c.y + rs} C ${c.x - 5} ${c.y + rs + 4} ${c.x - 6} ${c.y + rs + 8} ${c.x - 6} ${c.y + rs + 12}`}
                      fill="none"
                      stroke="rgb(var(--color-mute))"
                      strokeWidth={1.2}
                      strokeDasharray="2 2"
                      opacity={0.45}
                    />
                  );
                })}
                {/* run nodes */}
                {records.map((rec) => {
                  const pos = layout.nodeAt.get(rec.run_id);
                  if (!pos) return null;
                  const hue = hashHue(rec.config_hash);
                  const dimmed = related != null && !related.has(rec.run_id);
                  // Wave J: dot area = evidence mass; ring/slash/hit
                  // geometry all track the radius so the pinned ring,
                  // error slash and hover target stay legible at 3-7px.
                  const rad = layout.radius.get(rec.run_id) ?? R_MIN;
                  return (
                    <g key={rec.run_id} className="transition-opacity" style={{ opacity: dimmed ? 0.2 : 1 }}>
                      {rec.seed_mode === "pinned" && (
                        <circle cx={pos.x} cy={pos.y} r={rad + RING_PAD} fill="none" stroke={hueCss(hue, 0.9)} strokeWidth={1.3} />
                      )}
                      {rec.ok ? (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={rad}
                          fill={hueCss(hue, 0.95)}
                          stroke={`hsl(${hue} 60% 38%)`}
                          strokeWidth={0.8}
                        />
                      ) : (
                        <>
                          <circle cx={pos.x} cy={pos.y} r={rad} fill="none" stroke={hueCss(hue, 0.9)} strokeWidth={1.2} />
                          <line
                            x1={pos.x - rad - 1}
                            y1={pos.y + rad + 1}
                            x2={pos.x + rad + 1}
                            y2={pos.y - rad - 1}
                            stroke="rgb(var(--color-danger))"
                            strokeWidth={1.3}
                          />
                        </>
                      )}
                      {/* oversized invisible hit-target: tooltip + lineage hover */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={Math.max(9, rad + RING_PAD + 2.5)}
                        fill="transparent"
                        style={{ pointerEvents: "auto" }}
                        onMouseEnter={() => enter(rec.run_id)}
                        onMouseLeave={() => leave(rec.run_id)}
                      >
                        <title>{nodeTitle(rec)}</title>
                      </circle>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          {/* legend: one line, doubles as the figure caption key */}
          <div className="px-3 py-1 border-t border-edge/60 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-mute">
            <span>hue = configuration</span>
            {/* floor/cap disclosure: evidenceRadius clamps to
                [R_MIN, R_MAX], i.e. ≤69 shots all read as the 3px
                floor and ≥2048 as the cap (audit MINOR — the clamp
                was silent). */}
            <span>area = shots of evidence (floor ≤69, cap 2048)</span>
            <span>ring = pinned seed</span>
            <span>slash = error</span>
            <span>curve = forked from</span>
            <span>strip = replicate metrics (0–1)</span>
            {/* per-group scale disclosure: each band's funnel is
                normalized to its own widest row, so funnel widths are
                comparable WITHIN a band, not across bands (audit
                MINOR). */}
            <span>funnel = pooled CI narrowing (per-group scale)</span>
          </div>
        </>
      )}
    </div>
  );
}
