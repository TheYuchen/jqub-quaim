// Multiverse board — the archive promoted from a side panel to a
// workspace. The analyst's real object of study is not one pipeline
// but the SET of configurations they have tried; this view makes that
// set first-class: one card per configuration (config_hash group),
// laid out as small multiples so outcome distributions are comparable
// at a glance (multiverse-analysis framing).
//
// Encoding decisions, one channel per field:
//   * card HUE (chip + border tint + dots) = config_hash, same
//     hash→hue mapping as the timeline (lib/hues.ts) so a
//     configuration keeps its color across every panel.
//   * PIPELINE STRIP = the composition itself: 8-px rounded squares
//     in topological order, colored by node family (source slate,
//     backend accent, algorithm purple, metric green, sink gray).
//     Topology order, not canvas x/y — at thumbnail scale layout
//     jitter is noise, the stage sequence is the signal.
//   * DOT above a square = this stage's params differ from the
//     BASELINE configuration (the most-tried one). Diff is computed
//     per node kind with the same canonicalization the config hash
//     uses, so node ids and layout never produce false positives.
//   * OUTCOME STRIP = every archived headline value on a shared 0-1
//     scale, mean tick, latest run emphasized. Shared scale across
//     all cards is the point of small multiples.
//   * Δmean vs baseline is stated in percentage points and flagged
//     "(n small)" below 3 replicates on either side — a difference
//     built on one draw is not evidence, and the UI says so.

import { useEffect, useMemo, useState } from "react";
import { GitCompare, RotateCcw, Workflow } from "lucide-react";
import { useApp } from "../lib/store";
import { listRuns, type RunRecord } from "../lib/runStore";
import type { SharePayload, ShareNode } from "../lib/share";
import { resolveNodeSpec, type NodeSpec } from "../lib/nodeCatalog";
import type { PluginManifest } from "../lib/api";
import { hashHue, hueCss } from "../lib/hues";
import { WorkspaceToggle } from "./WorkspaceToggle";

// --- grouping model ---------------------------------------------------------

interface ConfigGroup {
  hash: string;
  hue: number;
  /** Oldest → newest. */
  runs: RunRecord[];
  latest: RunRecord;
  latestOk: RunRecord | null;
  /** Headline values of ok runs, chronological (latest last). */
  values: number[];
  mean: number | null;
  nErr: number;
  circuitTag: string;
  /** Representative graph: latest ok run's, else latest run's. */
  graph: SharePayload;
}

function buildGroups(runs: RunRecord[]): ConfigGroup[] {
  const byHash = new Map<string, RunRecord[]>();
  runs.forEach((r) => {
    const arr = byHash.get(r.config_hash) ?? [];
    arr.push(r);
    byHash.set(r.config_hash, arr);
  });
  const groups: ConfigGroup[] = [];
  byHash.forEach((list, hash) => {
    const sorted = [...list].sort((a, b) => a.created_at - b.created_at);
    const latest = sorted[sorted.length - 1];
    const oks = sorted.filter((r) => r.ok);
    const latestOk = oks.length > 0 ? oks[oks.length - 1] : null;
    const values = oks
      .filter((r) => r.headline_value != null)
      .map((r) => Math.min(1, Math.max(0, r.headline_value as number)));
    groups.push({
      hash,
      hue: hashHue(hash),
      runs: sorted,
      latest,
      latestOk,
      values,
      mean:
        values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : null,
      nErr: sorted.filter((r) => !r.ok).length,
      circuitTag:
        latest.sample_key ?? latest.circuit_name ?? "uploaded circuit",
      graph: (latestOk ?? latest).graph,
    });
  });
  // Display order: most recent activity first.
  groups.sort((a, b) => b.latest.created_at - a.latest.created_at);
  return groups;
}

/** Baseline = the most-populous configuration (most archived runs);
 *  ties break toward the most recently active. "The one you kept
 *  coming back to" is the natural reference point of the multiverse. */
function pickBaseline(groups: ConfigGroup[]): ConfigGroup | null {
  if (groups.length === 0) return null;
  return [...groups].sort(
    (a, b) =>
      b.runs.length - a.runs.length || b.latest.created_at - a.latest.created_at,
  )[0];
}

// --- structural diff vs baseline (light version of CompareView's) ----------

function canonParams(p: Record<string, unknown> | undefined): string {
  const params = p ?? {};
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${JSON.stringify(params[k])}`)
    .join(",");
}

/** Node kinds whose param multiset differs between the two graphs.
 *  Same canonicalization convention as computeConfigHash / CompareView's
 *  paramDiff: match by kind, compare sorted param fingerprints, so node
 *  ids and canvas layout can never produce a false "differs". */
function diffKinds(a: SharePayload, b: SharePayload): Set<string> {
  const collect = (g: SharePayload) => {
    const m = new Map<string, string[]>();
    g.n.forEach((n) => {
      const arr = m.get(n.k) ?? [];
      arr.push(canonParams(n.p));
      m.set(n.k, arr);
    });
    m.forEach((v) => v.sort());
    return m;
  };
  const A = collect(a);
  const B = collect(b);
  const out = new Set<string>();
  new Set([...A.keys(), ...B.keys()]).forEach((k) => {
    const la = A.get(k) ?? [];
    const lb = B.get(k) ?? [];
    if (la.length !== lb.length || la.some((v, i) => v !== lb[i])) out.add(k);
  });
  return out;
}

// --- pipeline schematic -----------------------------------------------------

/** Kahn topological order; x-position breaks ties so parallel branches
 *  keep their canvas left-to-right reading. Cycles / orphans (should
 *  not happen, but archives outlive invariants) append by x. */
function topoOrder(g: SharePayload): ShareNode[] {
  const indeg = new Map<string, number>();
  g.n.forEach((n) => indeg.set(n.i, 0));
  g.e.forEach((e) => {
    if (indeg.has(e.t)) indeg.set(e.t, (indeg.get(e.t) ?? 0) + 1);
  });
  const out: ShareNode[] = [];
  const used = new Set<string>();
  while (out.length < g.n.length) {
    const ready = g.n
      .filter((n) => !used.has(n.i) && (indeg.get(n.i) ?? 0) === 0)
      .sort((a, b) => a.x - b.x || a.y - b.y);
    if (ready.length === 0) {
      g.n
        .filter((n) => !used.has(n.i))
        .sort((a, b) => a.x - b.x)
        .forEach((n) => {
          out.push(n);
          used.add(n.i);
        });
      break;
    }
    const n = ready[0];
    out.push(n);
    used.add(n.i);
    g.e.forEach((e) => {
      if (e.s === n.i && !used.has(e.t))
        indeg.set(e.t, (indeg.get(e.t) ?? 0) - 1);
    });
  }
  return out;
}

const FAMILY_FILL: Record<NodeSpec["family"], string> = {
  source: "#64748b", // slate
  backend: "rgb(var(--color-accent))",
  algorithm: "rgb(var(--color-accent2))",
  metric: "rgb(var(--color-ok))",
  sink: "rgb(var(--color-mute))",
};

function PipelineStrip({
  graph,
  differing,
  plugins,
}: {
  graph: SharePayload;
  differing: Set<string> | null;
  plugins: PluginManifest[];
}) {
  const order = useMemo(() => topoOrder(graph), [graph]);
  const MAX = 14;
  const shown = order.slice(0, MAX);
  const overflow = order.length - shown.length;
  const SZ = 8;
  const GAP = 9;
  const PAD = 2;
  const w =
    PAD * 2 + shown.length * SZ + Math.max(0, shown.length - 1) * GAP;
  return (
    <div className="flex items-center gap-1 min-w-0 overflow-hidden">
      <svg
        width={w}
        height={22}
        role="img"
        aria-label={`Pipeline: ${shown.map((n) => n.k).join(" → ")}`}
        className="shrink-0"
      >
        {shown.length > 1 && (
          <line
            x1={PAD + SZ / 2}
            y1={14}
            x2={PAD + (shown.length - 1) * (SZ + GAP) + SZ / 2}
            y2={14}
            stroke="rgb(var(--color-edge))"
            strokeWidth={1}
          />
        )}
        {shown.map((n, i) => {
          const spec = resolveNodeSpec(n.k, plugins);
          const fam = spec?.family ?? "algorithm";
          const x = PAD + i * (SZ + GAP);
          const differs = differing?.has(n.k) ?? false;
          return (
            <g key={n.i}>
              <rect x={x} y={10} width={SZ} height={SZ} rx={2} fill={FAMILY_FILL[fam]}>
                <title>{`${spec?.label ?? n.k} (${fam})${differs ? " — settings differ from baseline" : ""}`}</title>
              </rect>
              {differs && (
                <circle cx={x + SZ / 2} cy={5} r={2} fill="rgb(var(--color-warn))">
                  <title>settings differ from baseline</title>
                </circle>
              )}
            </g>
          );
        })}
      </svg>
      {overflow > 0 && (
        <span className="text-[10px] text-mute shrink-0">+{overflow}</span>
      )}
    </div>
  );
}

// --- outcome distribution ---------------------------------------------------

function OutcomeStrip({ values, hue }: { values: number[]; hue: number }) {
  const W = 220;
  const H = 26;
  const X0 = 8;
  const X1 = W - 8;
  const px = (v: number) => X0 + v * (X1 - X0);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      height={H}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${values.length} replicates, mean ${(mean * 100).toFixed(1)}%`}
    >
      <line x1={X0} x2={X1} y1={H / 2} y2={H / 2} stroke="rgb(var(--color-edge))" strokeWidth={1} />
      <line x1={X0} x2={X0} y1={H / 2 - 3} y2={H / 2 + 3} stroke="rgb(var(--color-edge))" strokeWidth={1} />
      <line x1={X1} x2={X1} y1={H / 2 - 3} y2={H / 2 + 3} stroke="rgb(var(--color-edge))" strokeWidth={1} />
      <line
        x1={px(mean)}
        x2={px(mean)}
        y1={H / 2 - 8}
        y2={H / 2 + 8}
        stroke={hueCss(hue, 0.9)}
        strokeWidth={1.5}
      >
        <title>{`mean ${(mean * 100).toFixed(2)}%`}</title>
      </line>
      {values.map((v, i) => {
        const last = i === values.length - 1;
        return (
          <circle
            key={i}
            cx={px(v)}
            cy={H / 2}
            r={last ? 4 : 3}
            fill={hueCss(hue, last ? 0.95 : 0.45)}
            stroke={last ? "rgb(var(--color-ink))" : "none"}
            strokeWidth={last ? 1 : 0}
          >
            <title>{`${(v * 100).toFixed(2)}%${last ? " (latest)" : ""}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

// --- misc -------------------------------------------------------------------

function relTime(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

// --- board ------------------------------------------------------------------

export function MultiverseBoard() {
  const historyVersion = useApp((s) => s.historyVersion);
  const plugins = useApp((s) => s.plugins);
  const requestRestore = useApp((s) => s.requestRestore);
  const setWorkspaceMode = useApp((s) => s.setWorkspaceMode);
  const compareIds = useApp((s) => s.compareIds);
  const toggleCompare = useApp((s) => s.toggleCompare);

  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  useEffect(() => {
    let alive = true;
    listRuns(200)
      .then((r) => {
        if (alive) setRuns(r);
      })
      .catch(() => {
        if (alive) setRuns([]);
      });
    return () => {
      alive = false;
    };
  }, [historyVersion]);

  const groups = useMemo(() => buildGroups(runs ?? []), [runs]);
  const baseline = useMemo(() => pickBaseline(groups), [groups]);

  const openConfig = (g: ConfigGroup) => {
    const src = g.latestOk;
    if (!src) return;
    requestRestore({
      graph: src.graph,
      sampleKey: src.sample_key,
      pinSeed: null,
      sourceRunId: src.run_id,
    });
    setWorkspaceMode("compose");
  };

  return (
    <div
      className="multiverse-board flex-1 flex flex-col min-h-0 bg-canvas"
      aria-label="Multiverse board: all configurations as small multiples"
    >
      {/* Header mirrors the FlowCanvas toolbar height so flipping modes
          doesn't jump the layout. The toggle is duplicated here because
          the canvas toolbar is covered while this board is up. */}
      <div className="h-12 shrink-0 border-b border-edge px-3 sm:px-4 flex items-center gap-3">
        <WorkspaceToggle />
        <div className="text-xs text-mute truncate">
          <span className="text-ink font-medium">Multiverse</span>
          {runs != null && (
            <>
              {" "}
              · {groups.length} configuration{groups.length === 1 ? "" : "s"} ·{" "}
              {runs.length} archived run{runs.length === 1 ? "" : "s"}
            </>
          )}
        </div>
        <div className="ml-auto hidden lg:flex items-center gap-2 text-[10px] text-mute shrink-0">
          <span>squares = pipeline stages</span>
          <span className="text-edge">·</span>
          <span>dot above = differs from baseline</span>
          <span className="text-edge">·</span>
          <span>strip = one dot per replicate (0–100%)</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {runs == null ? (
          <div className="p-6 text-sm text-mute">Loading archive…</div>
        ) : groups.length === 0 ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="max-w-md text-center">
              <div className="text-ink font-medium mb-2">
                No configurations archived yet
              </div>
              <p className="text-sm text-mute leading-relaxed mb-4">
                The Multiverse view treats every configuration you try as
                evidence: one card per configuration, with its pipeline
                schematic and the distribution of outcomes across
                replicates. Switch to Compose, run a pipeline (try the ×5
                replicate runner), then flip back here to compare.
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => setWorkspaceMode("compose")}
              >
                <Workflow className="w-3.5 h-3.5" /> Go to Compose
              </button>
            </div>
          </div>
        ) : (
          <div
            className="grid gap-3 p-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            }}
          >
            {groups.map((g) => {
              const isBaseline = baseline != null && g.hash === baseline.hash;
              const differing =
                baseline != null && !isBaseline
                  ? diffKinds(g.graph, baseline.graph)
                  : null;
              const nSmall =
                baseline != null &&
                (g.values.length < 3 || baseline.values.length < 3);
              const delta =
                !isBaseline && g.mean != null && baseline?.mean != null
                  ? (g.mean - baseline.mean) * 100
                  : null;
              const abSelected =
                g.latestOk != null && compareIds.includes(g.latestOk.run_id);
              return (
                <div
                  key={g.hash}
                  className="rounded-lg border bg-surface p-3 flex flex-col gap-2 min-w-0"
                  style={{ borderColor: hueCss(g.hue, 0.35) }}
                >
                  {/* header: circuit + config identity */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="chip shrink-0"
                      style={{
                        color: hueCss(g.hue, 0.95),
                        borderColor: hueCss(g.hue, 0.5),
                      }}
                      title={`configuration #${g.hash}`}
                    >
                      #{g.hash.slice(0, 6)}
                    </span>
                    <span
                      className="text-xs text-ink truncate"
                      title={g.circuitTag}
                    >
                      {g.circuitTag}
                    </span>
                    {isBaseline && (
                      <span
                        className="chip !border-accent/50 !text-accent shrink-0 ml-auto"
                        title="Most-tried configuration — other cards report Δmean against this one."
                      >
                        baseline
                      </span>
                    )}
                  </div>

                  {/* pipeline schematic */}
                  <PipelineStrip
                    graph={g.graph}
                    differing={differing}
                    plugins={plugins}
                  />

                  {/* outcome distribution */}
                  {g.values.length >= 2 ? (
                    <>
                      <OutcomeStrip values={g.values} hue={g.hue} />
                      <div className="flex items-center gap-2 text-[10px] text-mute">
                        <span className="tabular-nums">
                          μ={((g.mean as number) * 100).toFixed(1)}%
                        </span>
                        <span className="tabular-nums">×{g.values.length}</span>
                        {delta != null && (
                          <span
                            className={`tabular-nums ${delta >= 0 ? "text-ok" : "text-warn"}`}
                            title="Difference of mean headline metric vs the baseline configuration, in percentage points."
                          >
                            Δ {delta >= 0 ? "+" : ""}
                            {delta.toFixed(1)}pp vs baseline
                            {nSmall ? " (n small)" : ""}
                          </span>
                        )}
                      </div>
                    </>
                  ) : g.values.length === 1 ? (
                    <div className="text-[11px] text-mute">
                      <span className="text-ink tabular-nums">
                        {g.latestOk?.headline_label ?? "metric"}{" "}
                        {(g.values[0] * 100).toFixed(1)}%
                      </span>{" "}
                      · single draw — run more replicates for a distribution
                      {delta != null && (
                        <span
                          className={`ml-1 tabular-nums ${delta >= 0 ? "text-ok" : "text-warn"}`}
                        >
                          Δ {delta >= 0 ? "+" : ""}
                          {delta.toFixed(1)}pp{nSmall ? " (n small)" : ""}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-mute">
                      no metric recorded
                    </div>
                  )}

                  {/* meta */}
                  <div className="flex items-center gap-2 text-[10px] text-mute">
                    <span>
                      {g.runs.length} run{g.runs.length === 1 ? "" : "s"}
                    </span>
                    <span className="text-edge">·</span>
                    <span>{relTime(g.latest.created_at)}</span>
                    {g.nErr > 0 && (
                      <>
                        <span className="text-edge">·</span>
                        <span className="text-danger">
                          {g.nErr} errored
                        </span>
                      </>
                    )}
                  </div>

                  {/* actions */}
                  <div className="flex items-center gap-1.5 mt-auto pt-1">
                    <button
                      type="button"
                      className="btn disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={g.latestOk == null}
                      onClick={() => openConfig(g)}
                      title={
                        g.latestOk
                          ? "Rebuild this configuration on the canvas (switches to Compose)"
                          : "No successful run to restore"
                      }
                    >
                      <RotateCcw className="w-3 h-3" /> Open
                    </button>
                    <button
                      type="button"
                      className={`btn disabled:opacity-40 disabled:cursor-not-allowed ${
                        abSelected ? "!border-accent/60 !text-accent" : ""
                      }`}
                      disabled={g.latestOk == null}
                      onClick={() =>
                        g.latestOk && toggleCompare(g.latestOk.run_id)
                      }
                      title={
                        g.latestOk
                          ? "Select this configuration's latest run for side-by-side comparison (pick two)"
                          : "No successful run to compare"
                      }
                    >
                      <GitCompare className="w-3 h-3" /> A/B
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
