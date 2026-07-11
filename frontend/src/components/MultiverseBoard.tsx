// Evidence board (internal id: "multiverse") — HOME since the IA
// inversion. The analyst's real object of study is not one pipeline
// but the SET of configurations they have tried; this view makes that
// set first-class: one card per configuration (config_hash group),
// laid out as small multiples so outcome distributions are comparable
// at a glance (multiverse-analysis framing). Since the IA-inversion
// wave the board is the DEFAULT workspace (store default + persisted
// preference), and a card expands IN PLACE into a scale-2 summary
// (marker: card-expand) — recent-run dots, pooled interval, quick
// actions — so working the evidence never requires leaving home. The
// Pipeline editor is the subordinate definition view of one
// configuration, entered from a card's "Open in editor" or the
// header's "New configuration" (marker: config-context).
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
//     BASELINE configuration — the most-tried config OF THE SAME
//     CIRCUIT (baselines are per circuit identity; see pickBaselines).
//     Diff is computed per node kind with the same canonicalization
//     the config hash uses, so node ids and layout never produce
//     false positives.
//   * OUTCOME STRIP = every archived headline value on a shared 0-1
//     scale, mean tick, latest run emphasized. Shared scale across
//     all cards is the point of small multiples.
//   * Δmean is stated in percentage points against the SAME-CIRCUIT
//     baseline only (fidelities of different circuits are different
//     quantities — a cross-circuit Δ would be meaningless), names its
//     reference inline ("vs #hash (same circuit)") and is flagged
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
import {
  ChevronDown,
  ChevronUp,
  GitCompare,
  HelpCircle,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Workflow,
  X,
} from "lucide-react";
import { useApp } from "../lib/store";
import { ARCHIVE_WINDOW, countRuns, listRuns, type RunRecord } from "../lib/runStore";
import type { SharePayload, ShareNode } from "../lib/share";
import { resolveNodeSpec, type NodeSpec } from "../lib/nodeCatalog";
import type { PluginManifest } from "../lib/api";
import { hashHue, hueCss } from "../lib/hues";
import { evidenceRadius } from "../lib/evidenceMass";
import {
  POOLED_SMALL_N_SHOTS,
  poolEvidence,
  runEvidence,
  dedupeDraws,
  type DatedEvidence,
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
  /** Circuit identity (computeConfigHash's circuitTag convention) —
   *  the scope within which baseline and Δ are defined. */
  circuitId: string;
  /** Representative graph: latest ok run's, else latest run's. */
  graph: SharePayload;
}

/** Circuit identity key — the exact convention computeConfigHash uses
 *  for its circuitTag component (lib/runStore.ts), so "same circuit"
 *  here can never disagree with configuration identity. */
function circuitIdOf(r: RunRecord): string {
  return r.sample_key ?? `upload:${r.circuit_name ?? "?"}`;
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
    // Exact replays counted once (dedupeDraws): pooling a pinned
    // replay twice would narrow the band with no new evidence.
    const evs = dedupeDraws(
      oks
        .map((r): DatedEvidence | null => {
          const ev = runEvidence(r.response);
          return ev
            ? { ...ev, created_at: r.created_at, root_seed: r.root_seed }
            : null;
        })
        .filter((e): e is DatedEvidence => e != null),
    );
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
      circuitId: circuitIdOf(latest),
      graph: (latestOk ?? latest).graph,
    });
  });
  // Display order: most recent activity first.
  groups.sort((a, b) => b.latest.created_at - a.latest.created_at);
  return groups;
}

/** Baselines are PER CIRCUIT identity. Fidelity is only comparable
 *  between configurations that ran the SAME circuit — a bell_state
 *  config as reference for a vqc_2q_small card would put two different
 *  quantities on one Δ line. Within each circuit's groups the baseline
 *  is the most-populous configuration (most archived runs); ties break
 *  toward the most recently active — "the one you kept coming back to"
 *  stays the natural reference point, just scoped to the circuit it
 *  measured. A circuit with a single configuration gets NO baseline:
 *  there is nothing same-circuit to compare against, so its card shows
 *  neither the chip nor a Δ line. */
function pickBaselines(groups: ConfigGroup[]): {
  byCircuit: Map<string, ConfigGroup>;
  configCounts: Map<string, number>;
} {
  const byId = new Map<string, ConfigGroup[]>();
  groups.forEach((g) => {
    const arr = byId.get(g.circuitId) ?? [];
    arr.push(g);
    byId.set(g.circuitId, arr);
  });
  const byCircuit = new Map<string, ConfigGroup>();
  const configCounts = new Map<string, number>();
  byId.forEach((list, id) => {
    configCounts.set(id, list.length);
    byCircuit.set(
      id,
      [...list].sort(
        (a, b) =>
          b.runs.length - a.runs.length ||
          b.latest.created_at - a.latest.created_at,
      )[0],
    );
  });
  return { byCircuit, configCounts };
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

// source is a hardcoded slate-500 hex ON PURPOSE: no theme token is
// "neutral but visible on both themes" (mute is taken by sink, ink
// flips to near-white in dark mode). Same trade the MiniMap palette
// makes — see FlowCanvas colorForKind (audit S3: documented, not a
// leftover).
const FAMILY_FILL: Record<NodeSpec["family"], string> = {
  source: "#64748b", // slate-500
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
                <title>{`${spec?.label ?? n.k} (${fam})${differs ? " — settings differ from this circuit's baseline" : ""}`}</title>
              </rect>
              {differs && (
                <circle cx={x + SZ / 2} cy={5} r={2} fill="rgb(var(--color-warn))">
                  <title>settings differ from this circuit's baseline</title>
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
          // 2px floor = PooledLine's, so a hairline interval reads as
          // a mark in both renderings (audit S3: 1.5px vanished on
          // low-DPI screens).
          width={Math.max(2, px(pooled.ci95[1]) - px(pooled.ci95[0]))}
          height={4}
          rx={2}
          fill={hueCss(hue, 0.3)}
          stroke={hueCss(hue, 0.6)}
          strokeWidth={0.75}
        >
          <title>{`pooled 95% interval: ${(pooled.ci95[0] * 100).toFixed(1)}–${(pooled.ci95[1] * 100).toFixed(1)}% (${pooled.successes}/${pooled.shots} pooled counts over ${pooled.nRuns} runs; exact replays counted once)`}</title>
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

// --- expanded card: in-place scale-2 summary (marker: card-expand) ----------

/** Newest runs of one configuration as a compact chronological dot
 *  timeline — the lineage's row-dot encoding, miniaturized and shared
 *  via lib/evidenceMass.ts so "dot area = shots of evidence" stays ONE
 *  encoding across panels: ring = pinned seed (deterministic replay),
 *  hollow + red slash = errored run, ink outline = newest. y is flat
 *  (time only): the outcome axis already lives in the card's 0-1
 *  strip, and duplicating it here would imply two value axes. */
const MAX_DOTS = 12;

function RunDotsStrip({ runs, hue }: { runs: RunRecord[]; hue: number }) {
  const shown = runs.slice(-MAX_DOTS);
  const earlier = runs.length - shown.length;
  const H = 24;
  const STEP = 19;
  const PADX = 10;
  const w = PADX * 2 + Math.max(0, shown.length - 1) * STEP;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {earlier > 0 && (
        <span className="text-[10px] text-mute shrink-0">+{earlier} earlier</span>
      )}
      <svg
        width={w}
        height={H}
        role="img"
        aria-label={`${shown.length} most recent runs, oldest to newest; dot area is shots of evidence, a ring marks a pinned (replayed) seed`}
        className="shrink-0"
      >
        {shown.length > 1 && (
          <line
            x1={PADX}
            x2={PADX + (shown.length - 1) * STEP}
            y1={H / 2}
            y2={H / 2}
            stroke="rgb(var(--color-edge))"
            strokeWidth={1}
          />
        )}
        {shown.map((r, i) => {
          const ev = runEvidence(r.response);
          const rad = evidenceRadius(ev?.shots ?? 0);
          const cx = PADX + i * STEP;
          const pinned = r.seed_mode === "pinned";
          const newest = i === shown.length - 1;
          const label = r.ok
            ? r.headline_value != null
              ? `${(Math.min(1, Math.max(0, r.headline_value)) * 100).toFixed(1)}%`
              : "no metric"
            : "errored";
          const title = `${label} · ${ev ? `${ev.shots} shots` : "no sampled evidence"}${
            r.root_seed != null
              ? ` · ${pinned ? "replayed seed" : "seed"} ${r.root_seed}`
              : ""
          } · ${relTime(r.created_at)}`;
          return (
            <g key={r.run_id}>
              {r.ok ? (
                <circle
                  cx={cx}
                  cy={H / 2}
                  r={rad}
                  fill={hueCss(hue, newest ? 0.95 : 0.55)}
                  stroke={newest ? "rgb(var(--color-ink))" : "none"}
                  strokeWidth={newest ? 1 : 0}
                >
                  <title>{title}</title>
                </circle>
              ) : (
                <g>
                  <circle
                    cx={cx}
                    cy={H / 2}
                    r={rad}
                    fill="none"
                    stroke={hueCss(hue, 0.55)}
                    strokeWidth={1.2}
                  >
                    <title>{title}</title>
                  </circle>
                  <line
                    x1={cx - rad}
                    y1={H / 2 + rad}
                    x2={cx + rad}
                    y2={H / 2 - rad}
                    stroke="rgb(var(--color-danger))"
                    strokeWidth={1.2}
                  />
                </g>
              )}
              {pinned && (
                <circle
                  cx={cx}
                  cy={H / 2}
                  r={rad + 2}
                  fill="none"
                  stroke={hueCss(hue, 0.8)}
                  strokeWidth={1}
                >
                  <title>pinned seed — deterministic replay</title>
                </circle>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** The pooled 95% interval as its own labeled line — the same Wilson
 *  pool the collapsed card draws as a band under the dots, promoted to
 *  a readable statement when the card is expanded. */
function PooledLine({ pooled, hue }: { pooled: PooledEvidence; hue: number }) {
  const H = 18;
  const X0 = 8;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <svg
        viewBox={`0 0 220 ${H}`}
        className="w-full max-w-[220px]"
        height={H}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Pooled 95% interval ${(pooled.ci95[0] * 100).toFixed(1)} to ${(pooled.ci95[1] * 100).toFixed(1)} percent over ${pooled.shots} shots`}
      >
        <line x1={X0} x2={212} y1={H / 2} y2={H / 2} stroke="rgb(var(--color-edge))" strokeWidth={1} />
        {(() => {
          const px = (v: number) => X0 + v * (212 - X0);
          return (
            <>
              <rect
                x={px(pooled.ci95[0])}
                y={H / 2 - 3}
                width={Math.max(2, px(pooled.ci95[1]) - px(pooled.ci95[0]))}
                height={6}
                rx={3}
                fill={hueCss(hue, 0.35)}
                stroke={hueCss(hue, 0.7)}
                strokeWidth={0.75}
              >
                <title>{`pooled 95% interval: ${(pooled.ci95[0] * 100).toFixed(1)}–${(pooled.ci95[1] * 100).toFixed(1)}% (${pooled.successes}/${pooled.shots} counts over ${pooled.nRuns} runs; exact replays counted once)`}</title>
              </rect>
              <line
                x1={px(pooled.point)}
                x2={px(pooled.point)}
                y1={H / 2 - 6}
                y2={H / 2 + 6}
                stroke={hueCss(hue, 0.95)}
                strokeWidth={1.5}
              />
            </>
          );
        })()}
      </svg>
      <span className="text-[10px] text-mute tabular-nums whitespace-nowrap shrink-0">
        {(pooled.ci95[0] * 100).toFixed(1)}–{(pooled.ci95[1] * 100).toFixed(1)}%
      </span>
    </div>
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
  const setEditorContext = useApp((s) => s.setEditorContext);
  const requestNewConfig = useApp((s) => s.requestNewConfig);
  const compareIds = useApp((s) => s.compareIds);
  const toggleCompare = useApp((s) => s.toggleCompare);

  const boardRef = useRef<HTMLDivElement>(null);
  // In-place card expansion (marker: card-expand): at most ONE card at
  // a time — the expansion is a focused reading of one configuration,
  // not a second grid density. Keyed by config hash so it survives
  // archive refreshes (run counts change, identity doesn't).
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  // Whether the grid is wide enough for an expanded card to span two
  // columns. Guarded because `grid-column: span 2` in a ONE-column
  // auto-fill grid would mint a phantom implicit column and shrink
  // every card; measured on the grid element itself.
  const gridRef = useRef<HTMLDivElement>(null);
  const [canSpan, setCanSpan] = useState(false);
  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  // True archive size for the header count — the card list below is
  // windowed, and a windowed length must not masquerade as a total
  // (audit S3 cap sweep).
  const [totalRuns, setTotalRuns] = useState<number | null>(null);
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
    // ARCHIVE_WINDOW newest runs suffice for the cards: groups are a
    // recency view of what the user is actively comparing; the header
    // total comes from countRuns() so nothing pretends the window is
    // the archive.
    listRuns(ARCHIVE_WINDOW)
      .then((r) => {
        if (alive) setRuns(r);
      })
      .catch(() => {
        if (alive) setRuns([]);
      });
    countRuns()
      .then((n) => {
        if (alive) setTotalRuns(n);
      })
      .catch(() => {
        /* count unavailable — fall back to the windowed length */
      });
    return () => {
      alive = false;
    };
  }, [historyVersion]);

  const groups = useMemo(() => buildGroups(runs ?? []), [runs]);
  const { byCircuit: baselines, configCounts } = useMemo(
    () => pickBaselines(groups),
    [groups],
  );

  const hasCards = groups.length > 0;
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    // Two 240px columns + the 12px gap must fit the grid content box.
    const update = () => setCanSpan(el.clientWidth >= 240 * 2 + 12);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasCards]);

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
    // The editor opens as this configuration's DEFINITION VIEW: the
    // context bar (marker: config-context) names the identity being
    // edited and live-rehashes it as params change.
    setEditorContext({
      source: "card",
      hash: g.hash,
      circuitTag: g.circuitTag,
      runCount: g.runs.length,
    });
    setWorkspaceMode("compose");
  };

  // Quick actions of an expanded card (marker: card-expand). Both stay
  // ON the board: the canvas underneath rebuilds and auto-runs (the
  // same pendingRestore/pendingAutoRun bridge scenario boots ride),
  // the theater overlays the board while the sampled step streams,
  // and the archive bump repaints this card. Disabled for runs on
  // uploaded circuits — auto-run needs a reloadable sample.
  const replayLatest = (g: ConfigGroup) => {
    const src = g.latestOk;
    if (!src || src.sample_key == null || src.root_seed == null) return;
    requestRestore({
      graph: src.graph,
      sampleKey: src.sample_key,
      pinSeed: src.root_seed,
      sourceRunId: src.run_id,
      precisionTarget: src.precision_target ?? null,
      autoRunAfter: true,
    });
  };
  const runThreeReplicates = (g: ConfigGroup) => {
    const src = g.latestOk;
    if (!src || src.sample_key == null) return;
    // Fresh draws, one-shot: pinSeed:null clears any stale pin via
    // the restore bridge, and replicateOnce asks THIS auto-run for 3
    // replicates without mutating the global toolbar replicateCount —
    // a board quick action must not rewrite the user's Run settings.
    requestRestore({
      graph: src.graph,
      sampleKey: src.sample_key,
      pinSeed: null,
      sourceRunId: src.run_id,
      precisionTarget: src.precision_target ?? null,
      autoRunAfter: true,
      replicateOnce: 3,
    });
  };

  return (
    <div
      ref={boardRef}
      className="multiverse-board flex-1 flex flex-col min-h-0 bg-canvas"
      aria-label="Evidence board: all configurations as small multiples"
    >
      {/* Board header — h-12, deliberately NOT the editor toolbar's
          two-row height (the board needs one row; the center column
          re-lays-out on mode flips anyway — audit S3: the old comment
          claimed a height mirror that stopped being true when the
          toolbar grew its second row). The toggle is duplicated here
          because the canvas toolbar is covered while this board is
          up. */}
      <div className="h-12 shrink-0 border-b border-edge px-3 sm:px-4 flex items-center gap-3">
        <WorkspaceToggle />
        <div className="text-xs text-mute truncate">
          <span className="text-ink font-medium">Evidence board</span>
          <TipIcon
            className="ml-1"
            hint={`${gloss("configuration")} Card key: squares = pipeline stages · dot above = settings differ from this circuit's baseline · strip dots = one per replicate (0-100%) · filled band = pooled 95% interval. Baseline and Δ are per circuit — cards of different circuits are never compared.`}
          />
          {runs != null && (
            <>
              {" "}
              · {groups.length} configuration{groups.length === 1 ? "" : "s"} ·{" "}
              {totalRuns ?? runs.length} archived run
              {(totalRuns ?? runs.length) === 1 ? "" : "s"}
            </>
          )}
        </div>
        {/* IA inversion: composing starts FROM home. The button clears
            the canvas (newConfigRequest bridge) and frames the editor
            as "New configuration — not yet run" (config-context). */}
        <button
          type="button"
          className="btn shrink-0"
          title="Define a new configuration in the Pipeline editor (opens a blank canvas)"
          onClick={() => {
            requestNewConfig();
            setWorkspaceMode("compose");
          }}
        >
          <Plus className="w-3 h-3" />
          <span className="hidden sm:inline">New configuration</span>
        </button>
        {/* hasCards gate (audit S3): the hint strip only renders over
            a non-empty grid, so on an empty board this "?" was a
            no-op — the empty state below teaches instead. */}
        {!hintVisible && hasCards && (
          <button
            type="button"
            data-export-strip
            className="shrink-0 p-0.5 rounded text-mute hover:text-ink hover:bg-surfaceAlt"
            title="Show the board orientation hint (what a card is and what Open / A/B do)"
            aria-label="Show board orientation hint"
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
        {/* Board-header-density pass: the encoding key lives in the
            header TipIcon and in the "?" hint strip below — the old
            lg-only inline note said the same thing a third time and
            crowded the 768-1200 band. Header keeps: title · counts ·
            New configuration · ? · export. */}
        {/* Paper-figure export of the whole board (hybrid path). */}
        <FigureExportButton
          className="ml-auto shrink-0"
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
          data-export-strip
          data-marker="multiverse-hint"
          aria-label="Board orientation hint"
        >
          <span className="min-w-0">
            Each card is one configuration — its pipeline (squares =
            stages, dot above = differs from baseline), its outcome
            distribution (one dot per replicate, 0–100%), Δ vs its
            circuit's baseline card. Expand (⌄) for recent runs and
            quick actions; Open rebuilds it in the Pipeline editor; A/B
            sends two cards to Between configurations.
          </span>
          <button
            type="button"
            className="ml-auto shrink-0 p-0.5 rounded text-mute hover:text-ink hover:bg-surfaceAlt"
            title="Dismiss (remembered on this device — the ? in the header brings it back)"
            aria-label="Dismiss board orientation hint"
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

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {runs == null ? (
          <div className="p-6 text-sm text-mute">Loading archive…</div>
        ) : groups.length === 0 ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="max-w-md text-center">
              <div className="text-ink font-medium mb-2">
                No configurations archived yet
              </div>
              <p className="text-sm text-mute leading-relaxed mb-4">
                The Evidence board is home: every configuration you try
                becomes a card, with its pipeline schematic and the
                distribution of outcomes across replicates. Open the
                Pipeline editor, define and run a configuration (try the
                ×5 replicate runner), then come back here to compare.
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  requestNewConfig();
                  setWorkspaceMode("compose");
                }}
              >
                <Workflow className="w-3.5 h-3.5" /> Define a configuration
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={gridRef}
            className="grid gap-3 p-3"
            style={{
              // min(240px, 100%): in a container narrower than one
              // 240px track the column shrinks to the container
              // instead of forcing horizontal overflow (the scroll
              // body's overflow-y:auto would otherwise mint an x
              // scrollbar — see the RESPONSIVE CONTRACT in App.tsx).
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(240px, 100%), 1fr))",
            }}
          >
            {groups.map((g) => {
              // Same-circuit reference only (see pickBaselines): a
              // card whose circuit has no other configuration gets no
              // baseline chip, no diff dots and no Δ line.
              const circuitBaseline = baselines.get(g.circuitId) ?? null;
              const isBaseline =
                circuitBaseline != null && g.hash === circuitBaseline.hash;
              const baseline = isBaseline ? null : circuitBaseline;
              const differing =
                baseline != null ? diffKinds(g.graph, baseline.graph) : null;
              // Wave J: when BOTH sides carry pooled binomial counts,
              // Δ compares POOLED means (shot-weighted, the honest
              // estimator) instead of unweighted per-run means, and
              // the "(n small)" suffix keys on pooled SHOTS: ≥2048 on
              // both sides ⇒ worst-case Wilson half-width ≤ ±2.2pp,
              // so a multi-pp Δ is signal, not shot noise (threshold
              // rationale in lib/stats.ts). Without pools the old
              // replicate-count heuristic stands.
              const pooledBoth =
                baseline != null && g.pooled != null && baseline.pooled != null;
              const nSmall = pooledBoth
                ? (g.pooled as PooledEvidence).shots < POOLED_SMALL_N_SHOTS ||
                  (baseline?.pooled as PooledEvidence).shots < POOLED_SMALL_N_SHOTS
                : baseline != null &&
                  (g.values.length < 3 || baseline.values.length < 3);
              const delta = pooledBoth
                ? ((g.pooled as PooledEvidence).point -
                    (baseline?.pooled as PooledEvidence).point) *
                  100
                : baseline != null && g.mean != null && baseline.mean != null
                  ? (g.mean - baseline.mean) * 100
                  : null;
              const abSelected =
                g.latestOk != null && compareIds.includes(g.latestOk.run_id);
              const expanded = expandedHash === g.hash;
              return (
                <div
                  key={g.hash}
                  className="rounded-lg border bg-surface p-3 flex flex-col gap-2 min-w-0"
                  style={{
                    borderColor: hueCss(g.hue, expanded ? 0.6 : 0.35),
                    // span 2 only when the grid really has two columns:
                    // in a 1-column grid, span 2 would mint a phantom
                    // implicit column and shrink every card (canSpan is
                    // measured on the grid element).
                    ...(expanded && canSpan ? { gridColumn: "span 2" } : {}),
                  }}
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
                    <span className="ml-auto flex items-center gap-1 shrink-0">
                      {isBaseline &&
                        (configCounts.get(g.circuitId) ?? 0) > 1 && (
                          <span
                            className="chip !border-accent/50 !text-accent shrink-0"
                            title={`Most-tried configuration of ${g.circuitTag} — other ${g.circuitTag} cards report Δmean against this one. Baselines are per circuit: fidelities of different circuits are not comparable, so a circuit with a single configuration shows no baseline and no Δ.`}
                          >
                            baseline
                          </span>
                        )}
                      <button
                        type="button"
                        className="p-0.5 rounded text-mute hover:text-ink hover:bg-surfaceAlt"
                        aria-expanded={expanded}
                        aria-label={
                          expanded
                            ? "Collapse configuration card"
                            : "Expand configuration card: recent runs, pooled interval, quick actions"
                        }
                        title={
                          expanded
                            ? "Collapse"
                            : "Expand in place: recent runs, pooled interval, quick actions"
                        }
                        onClick={() =>
                          setExpandedHash(expanded ? null : g.hash)
                        }
                      >
                        {expanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </span>
                  </div>

                  {/* pipeline schematic */}
                  <PipelineStrip
                    graph={g.graph}
                    differing={differing}
                    plugins={plugins}
                  />

                  {/* outcome distribution — the strip area doubles as
                      the expand affordance (chevron is the accessible
                      path; this is the big pointer target). */}
                  <div
                    className="cursor-pointer"
                    title={
                      expanded
                        ? "Collapse"
                        : "Expand in place: recent runs, pooled interval, quick actions"
                    }
                    onClick={() => setExpandedHash(expanded ? null : g.hash)}
                  >
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
                        {delta != null && baseline != null && (
                          <span
                            className={`tabular-nums ${delta >= 0 ? "text-ok" : "text-warn"}`}
                            title={
                              pooledBoth
                                ? `Difference of POOLED means (shot-weighted, Wilson-pooled counts) vs #${baseline.hash}, this circuit's baseline configuration, in percentage points. Baselines are per circuit — Δ is never taken across different circuits.`
                                : `Difference of mean headline metric vs #${baseline.hash}, this circuit's baseline configuration, in percentage points. Baselines are per circuit — Δ is never taken across different circuits.`
                            }
                          >
                            Δ {delta >= 0 ? "+" : ""}
                            {delta.toFixed(1)}pp vs #{baseline.hash.slice(0, 6)}{" "}
                            (same circuit)
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
                      {delta != null && baseline != null && (
                        <span
                          className={`ml-1 tabular-nums ${delta >= 0 ? "text-ok" : "text-warn"}`}
                        >
                          Δ {delta >= 0 ? "+" : ""}
                          {delta.toFixed(1)}pp vs #{baseline.hash.slice(0, 6)}{" "}
                          (same circuit){nSmall ? " (n small)" : ""}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-mute">
                      no metric recorded
                    </div>
                  )}
                  </div>

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

                  {/* actions. Collapsed: the two originals. Expanded
                      (marker: card-expand): the in-place scale-2
                      summary + quick actions — replay/replicates stay
                      ON the board (the canvas underneath runs, the
                      theater overlays, the card repaints), so the
                      board is a working surface, not a menu. */}
                  {!expanded ? (
                    <div className="flex items-center gap-1.5 mt-auto pt-1">
                      <button
                        type="button"
                        className="btn disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={g.latestOk == null}
                        onClick={() => openConfig(g)}
                        title={
                          g.latestOk
                            ? "Open this configuration in the Pipeline editor (its definition view)"
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
                  ) : (
                    <div
                      data-marker="card-expand"
                      className="mt-auto border-t border-edge/60 pt-2 flex flex-col gap-2"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-mute/70 select-none">
                        recent runs — oldest → newest
                      </div>
                      <RunDotsStrip runs={g.runs} hue={g.hue} />
                      {g.pooled ? (
                        <PooledLine pooled={g.pooled} hue={g.hue} />
                      ) : (
                        <div className="text-[10px] text-mute">
                          no pooled interval yet — pooling needs ≥2 runs
                          with measurement counts; +3 replicates buys them
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          className="btn disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={
                            g.latestOk == null ||
                            g.latestOk.sample_key == null ||
                            g.latestOk.root_seed == null
                          }
                          onClick={() => replayLatest(g)}
                          title={
                            g.latestOk == null
                              ? "No successful run to replay"
                              : g.latestOk.sample_key == null
                                ? "This run used an uploaded circuit — open it in the editor and re-upload to replay"
                                : g.latestOk.root_seed == null
                                  ? "No recorded seed on the latest run"
                                  : `Replay the latest run bit-exactly (pins seed ${g.latestOk.root_seed}, runs without leaving the board)`
                          }
                        >
                          <Play className="w-3 h-3" /> Replay latest
                        </button>
                        <button
                          type="button"
                          className="btn disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={
                            g.latestOk == null || g.latestOk.sample_key == null
                          }
                          onClick={() => runThreeReplicates(g)}
                          title={
                            g.latestOk == null
                              ? "No successful run to replicate"
                              : g.latestOk.sample_key == null
                                ? "This run used an uploaded circuit — open it in the editor and re-upload to replicate"
                                : "Buy more evidence: 3 fresh-seed replicates of this configuration, run from the board"
                          }
                        >
                          <Repeat className="w-3 h-3" /> +3 replicates
                        </button>
                        <button
                          type="button"
                          className="btn disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={g.latestOk == null}
                          onClick={() => openConfig(g)}
                          title={
                            g.latestOk
                              ? "Open this configuration in the Pipeline editor (its definition view)"
                              : "No successful run to restore"
                          }
                        >
                          <RotateCcw className="w-3 h-3" /> Open in editor
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
