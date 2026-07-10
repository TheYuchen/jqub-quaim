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
//   * POOLED BAND (Wave J) = when ≥2 runs carry binomial payloads,
//     their counts pool (Σsuccesses/Σshots, one Wilson interval — see
//     lib/stats.ts for why that is valid within a configuration) into
//     a filled band on the same 0-1 strip: a deliberately DIFFERENT
//     mark than the per-run dots, because dots are single draws and
//     the band is the interval the pooled evidence supports. The Δ
//     line compares pooled means when both sides have pools.

import { useEffect, useMemo, useRef, useState } from "react";
import { GitCompare, HelpCircle, RotateCcw, Workflow, X } from "lucide-react";
import { useApp } from "../lib/store";
import { listRuns, type RunRecord } from "../lib/runStore";
import type { SharePayload, ShareNode } from "../lib/share";
import { resolveNodeSpec, type NodeSpec } from "../lib/nodeCatalog";
import type { PluginManifest } from "../lib/api";
import { hashHue, hueCss } from "../lib/hues";
import {
  POOLED_SMALL_N_SHOTS,
  poolEvidence,
  runEvidence,
  type Evidence,
  type PooledEvidence,
} from "../lib/stats";
import { WorkspaceToggle } from "./WorkspaceToggle";
import { DemoArchiveBanner } from "./DemoArchiveBanner";
import { FigureExportButton } from "./FigureExportButton";
import { TipIcon } from "./TipIcon";
import { gloss } from "../lib/glossary";

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
  /** Wilson interval over the group's pooled binomial counts; null
   *  unless ≥2 ok runs carry binomial payloads (a pool of one is
   *  just that run's own interval — the fidelity card already shows
   *  it). */
  pooled: PooledEvidence | null;
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
    const evs = oks
      .map((r) => runEvidence(r.response))
      .filter((e): e is Evidence => e != null);
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
      pooled: evs.length >= 2 ? poolEvidence(evs) : null,
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
  // Node cap sized to the card's floor, not to a typical pipeline: at
  // the 240px card minimum (grid minmax) the content box is ~210px and
  // 14 squares (4 + 14·8 + 13·9 = 233px) overflow it, silently
  // clipping the strip's tail. 11 squares = 182px + the "+k" chip fits
  // the floor; longer pipelines degrade to an explicit count instead
  // of an invisible crop.
  const MAX = 11;
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

function OutcomeStrip({
  values,
  hue,
  pooled,
}: {
  values: number[];
  hue: number;
  pooled?: PooledEvidence | null;
}) {
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
      aria-label={`${values.length} replicates, mean ${(mean * 100).toFixed(1)}%${pooled ? `, pooled ${(pooled.point * 100).toFixed(1)}% ±${(pooled.halfWidth * 100).toFixed(1)}pp over ${pooled.shots} shots` : ""}`}
    >
      {/* Pooled Wilson interval (Wave J): a filled band UNDER the dot
          line — a different mark than the dots on purpose (dots =
          single draws, band = what the pooled counts support). */}
      {pooled && (
        <rect
          x={px(pooled.ci95[0])}
          y={H / 2 + 6}
          width={Math.max(1.5, px(pooled.ci95[1]) - px(pooled.ci95[0]))}
          height={4}
          rx={2}
          fill={hueCss(hue, 0.3)}
          stroke={hueCss(hue, 0.6)}
          strokeWidth={0.75}
        >
          <title>{`pooled 95% interval: ${(pooled.ci95[0] * 100).toFixed(1)}–${(pooled.ci95[1] * 100).toFixed(1)}% (${pooled.successes}/${pooled.shots} pooled counts over ${pooled.nRuns} runs)`}</title>
        </rect>
      )}
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

/** Orientation strip dismissal (marker: multiverse-hint). Same
 *  contract as the lineage legend / ribbon legend: dismissal is
 *  remembered per device, and a small "?" in the board header brings
 *  the strip back — first-contact guidance must be recoverable. */
const MULTIVERSE_HINT_LS_KEY = "quda.multiverseHintDismissed";

export function MultiverseBoard() {
  const historyVersion = useApp((s) => s.historyVersion);
  const plugins = useApp((s) => s.plugins);
  const requestRestore = useApp((s) => s.requestRestore);
  const setWorkspaceMode = useApp((s) => s.setWorkspaceMode);
  const compareIds = useApp((s) => s.compareIds);
  const toggleCompare = useApp((s) => s.toggleCompare);

  const boardRef = useRef<HTMLDivElement>(null);
  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  const [hintDismissed, setHintDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MULTIVERSE_HINT_LS_KEY) === "1";
    } catch {
      return false;
    }
  });
  // Guidance-strip budget (visual-calm pass): at most ONE strip at a
  // time on this board, priority demo banner > orientation hint. While
  // the demo banner is up the hint collapses to its "?" reopen
  // affordance; clicking "?" is explicit intent, so it force-shows the
  // hint for the session (hintForced) even alongside the banner.
  const [hintForced, setHintForced] = useState(false);
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

  const demoBannerVisible = runs != null && runs.some((r) => r.demo);
  const hintVisible =
    groups.length > 0 && (hintForced || (!hintDismissed && !demoBannerVisible));

  const openConfig = (g: ConfigGroup) => {
    const src = g.latestOk;
    if (!src) return;
    requestRestore({
      graph: src.graph,
      sampleKey: src.sample_key,
      pinSeed: null,
      sourceRunId: src.run_id,
      precisionTarget: src.precision_target ?? null,
    });
    setWorkspaceMode("compose");
  };

  return (
    <div
      ref={boardRef}
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
          <TipIcon
            className="ml-1"
            hint={`${gloss("configuration")} Card key: squares = pipeline stages · dot above = settings differ from baseline · strip dots = one per replicate (0-100%) · filled band = pooled 95% interval.`}
          />
          {runs != null && (
            <>
              {" "}
              · {groups.length} configuration{groups.length === 1 ? "" : "s"} ·{" "}
              {runs.length} archived run{runs.length === 1 ? "" : "s"}
            </>
          )}
        </div>
        {!hintVisible && (
          <button
            type="button"
            className="shrink-0 p-0.5 rounded text-mute hover:text-ink hover:bg-surfaceAlt"
            title="Show the board orientation hint (what a card is and what Open / A/B do)"
            aria-label="Show multiverse orientation hint"
            onClick={() => {
              // Explicit reopen beats the one-strip rule AND any
              // persisted dismissal.
              setHintForced(true);
              setHintDismissed(false);
              try {
                localStorage.removeItem(MULTIVERSE_HINT_LS_KEY);
              } catch {
                /* private mode — reopening is session-scoped anyway */
              }
            }}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="ml-auto hidden lg:flex items-center gap-2 text-[10px] text-mute shrink-0">
          <span>squares = pipeline stages</span>
          <span className="text-edge">·</span>
          <span>dot above = differs from baseline</span>
          <span className="text-edge">·</span>
          <span>strip = one dot per replicate (0–100%)</span>
        </div>
        {/* Paper-figure export of the whole board (hybrid path). */}
        <FigureExportButton
          className="ml-2 lg:ml-0 shrink-0"
          getTarget={() => boardRef.current}
          name="multiverse"
          view="multiverse"
        />
      </div>

      {demoBannerVisible && <DemoArchiveBanner />}

      {/* Orientation one-liner (marker: multiverse-hint): the board's
          only guidance once cards exist — the empty state teaches, the
          tour is skippable, and the header key is lg-only. One line,
          task language, pinned above the grid; dismissal persists and
          the header "?" brings it back. Suppressed while the demo
          banner is up (one guidance strip at a time) unless the user
          explicitly reopened it. */}
      {hintVisible && (
        <div
          className="multiverse-hint flex items-center gap-2 border-b border-edge/60 bg-surfaceAlt/40 px-3 py-1.5 text-[11px] text-mute"
          role="note"
          data-marker="multiverse-hint"
          aria-label="Multiverse orientation hint"
        >
          <span className="min-w-0">
            Each card is one configuration — its pipeline, its outcome
            distribution, Δ vs the baseline card. Open rebuilds it; A/B
            sends two cards to Between configurations.
          </span>
          <button
            type="button"
            className="ml-auto shrink-0 p-0.5 rounded text-mute hover:text-ink hover:bg-surfaceAlt"
            title="Dismiss (remembered on this device — the ? in the header brings it back)"
            aria-label="Dismiss multiverse orientation hint"
            onClick={() => {
              setHintForced(false);
              setHintDismissed(true);
              try {
                localStorage.setItem(MULTIVERSE_HINT_LS_KEY, "1");
              } catch {
                /* private mode etc. — the hint just reappears next visit */
              }
            }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

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
              // Wave J: when BOTH sides carry pooled binomial counts,
              // Δ compares POOLED means (shot-weighted, the honest
              // estimator) instead of unweighted per-run means, and
              // the "(n small)" suffix keys on pooled SHOTS: ≥2048 on
              // both sides ⇒ worst-case Wilson half-width ≤ ±2.2pp,
              // so a multi-pp Δ is signal, not shot noise (threshold
              // rationale in lib/stats.ts). Without pools the old
              // replicate-count heuristic stands.
              const pooledBoth =
                !isBaseline && g.pooled != null && baseline?.pooled != null;
              const nSmall = pooledBoth
                ? (g.pooled as PooledEvidence).shots < POOLED_SMALL_N_SHOTS ||
                  (baseline?.pooled as PooledEvidence).shots < POOLED_SMALL_N_SHOTS
                : baseline != null &&
                  (g.values.length < 3 || baseline.values.length < 3);
              const delta = pooledBoth
                ? ((g.pooled as PooledEvidence).point -
                    (baseline?.pooled as PooledEvidence).point) *
                  100
                : !isBaseline && g.mean != null && baseline?.mean != null
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
                      <OutcomeStrip values={g.values} hue={g.hue} pooled={g.pooled} />
                      {g.pooled && (
                        <div
                          className="text-[10px] text-mute tabular-nums"
                          title={`All ${g.pooled.nRuns} runs' measurement counts pooled (valid within one configuration: same underlying probability), then one Wilson interval — the filled band on the strip above.`}
                        >
                          pooled μ {(g.pooled.point * 100).toFixed(1)}% ±
                          {(g.pooled.halfWidth * 100).toFixed(1)}pp over{" "}
                          {g.pooled.shots} shots
                        </div>
                      )}
                      {/* flex-wrap: at the 240px card minimum the Δ-vs-
                          baseline span (~160px) plus μ and ×n exceed the
                          content box; wrapping keeps each stat intact on
                          its own line instead of mid-text folding. */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-mute">
                        <span className="tabular-nums">
                          μ={((g.mean as number) * 100).toFixed(1)}%
                        </span>
                        <span className="tabular-nums">×{g.values.length}</span>
                        {delta != null && (
                          <span
                            className={`tabular-nums ${delta >= 0 ? "text-ok" : "text-warn"}`}
                            title={
                              pooledBoth
                                ? "Difference of POOLED means (shot-weighted, Wilson-pooled counts) vs the baseline configuration, in percentage points."
                                : "Difference of mean headline metric vs the baseline configuration, in percentage points."
                            }
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
