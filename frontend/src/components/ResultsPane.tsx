// Results pane — the right-hand column that renders each pipeline step's
// outcome as a card. Per-algorithm cards live in `./results/cards`; the
// small visual primitives they share live in `./results/viz`. This file
// keeps the pane's own scaffolding (header, empty/running states, final
// metrics roll-up).

import { useEffect, useRef, useState } from "react";
import { useApp } from "../lib/store";
import type { StepResult } from "../lib/api";
import {
  resolveNodeSpec,
  type PluginNodeSpec,
} from "../lib/nodeCatalog";
import {
  AlertCircle,
  Check,
  ChevronRight,
  CircleDot,
  Clock,
  Code2,
  Sparkles,
} from "lucide-react";
import { StepBody } from "./results/cards";
import { PluginFigures } from "./PluginFigures";
import { RunStatusChips } from "./RunStatusChips";
import { RunHistory } from "./RunHistory";
import { countRuns } from "../lib/runStore";
import { SignatureCard } from "./TransformationSignature";
import { CompareView } from "./CompareView";
import { FigureExportButton } from "./FigureExportButton";
import { TipIcon } from "./TipIcon";
import { gloss } from "../lib/glossary";

// Internal tab ids are STABLE KEYS — they ride in scenario uiState
// (lib/scenarios.ts evidenceTab), the store bridge (pendingEvidenceTab)
// and figure-export view names/provenance ("evidence-current" etc.), so
// renaming them would orphan recorded figures and scenario URLs. The
// user-visible LABELS carry the narrative instead: the three tabs ARE
// the paper's three scales of sequential evidence —
//   current → "This run"               (scale 1: within a run)
//   history → "This configuration"     (scale 2: across replicates)
//   compare → "Between configurations" (scale 3: between configurations)
type EvidenceTab = "current" | "history" | "compare";

export function ResultsPane({ onCollapse }: { onCollapse?: () => void } = {}) {
  const run = useApp((s) => s.run);
  const running = useApp((s) => s.running);
  const compareIds = useApp((s) => s.compareIds);
  const historyVersion = useApp((s) => s.historyVersion);

  // Tabbed information architecture. The pane is an evidence
  // workbench with three analytical modes — the live run (cards),
  // the archive (lineage view), and the cross-run comparison — and
  // each mode gets the full pane height instead of fighting for
  // scroll space in one vertical stack.
  const [tab, setTab] = useState<EvidenceTab>("current");
  const contentRef = useRef<HTMLDivElement>(null);

  // Archive size for the History badge. countRuns() is a bare
  // IndexedDB count (no record materialization), refreshed whenever a
  // run is archived (historyVersion bump) — cheaper than threading a
  // callback out of RunHistory, and it works while that tab is
  // unmounted.
  const [archived, setArchived] = useState(0);
  useEffect(() => {
    let cancelled = false;
    countRuns()
      .then((n) => {
        if (!cancelled) setArchived(n);
      })
      .catch(() => {
        /* IndexedDB unavailable (private mode etc.) — badge stays 0 */
      });
    return () => {
      cancelled = true;
    };
  }, [historyVersion]);

  // Auto-switching: starting a run pulls focus to the live cards;
  // ticking the 2nd compare checkbox (in History) jumps straight to
  // the comparison verdict.
  useEffect(() => {
    if (running) setTab("current");
  }, [running]);
  // Scenario bridge: a ?scenario= boot can pick the tab a figure needs
  // (F4 history, F6 compare). Consumed once.
  const pendingTab = useApp((s) => s.pendingEvidenceTab);
  useEffect(() => {
    if (!pendingTab) return;
    setTab(pendingTab);
    useApp.getState().setPendingEvidenceTab(null);
  }, [pendingTab]);
  // Keyed on the ARRAY IDENTITY, not .length: one-hop affordances
  // (e.g. "compare vs previous run") replace a 2-element selection
  // with another 2-element selection — a length dep never re-fires
  // and the pane silently stayed on the old tab (audit S2).
  useEffect(() => {
    if (compareIds.length === 2) setTab("compare");
  }, [compareIds]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-12 shrink-0 border-b border-edge px-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink truncate">Evidence</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Paper-figure export of the active evidence tab (hybrid
              path: cards/funnel/lineage/compare as shown). */}
          {(run != null || tab !== "current") && (
            <FigureExportButton
              getTarget={() => contentRef.current}
              name={`evidence-${tab}`}
              view={`evidence-${tab}`}
            />
          )}
          {/* Chip budget (visual-calm pass): at most TWO chips in this
              header — the seed-state chip and the step count. The seed
              chip ABSORBS the cached state ("cached · no seed" — a
              precomputed-cache response is exactly a response no seed
              was drawn for), instead of stacking a third chip that
              overflowed narrow panes. */}
          {run && (run.seed_mode || run.from_cache) && (
            <span
              className={`chip ${
                run.seed_mode === "pinned" || run.from_cache
                  ? "!border-accent/40 !text-accent"
                  : ""
              }`}
              title={
                run.from_cache
                  ? "Served from a precomputed cache (this circuit + pipeline combo was run ahead of time) — no seed was drawn for this response. Swap in your own circuit or tweak the graph to trigger a fresh, seeded run."
                  : run.seed_mode === "pinned"
                    ? `Replayed with pinned root seed ${run.root_seed} — stochastic steps reproduce exactly.`
                    : run.root_seed != null
                      ? `Fresh draw. Recorded root seed ${run.root_seed} — replay it any time from the “This configuration” tab.`
                      : "No seed was drawn for this response."
              }
            >
              {run.from_cache
                ? "cached · no seed"
                : run.seed_mode === "pinned"
                  ? `seed ${run.root_seed}`
                  : "fresh"}
              <TipIcon hint={gloss("seed")} size={10} position="below" />
            </span>
          )}
          {run && (
            <span className="chip">
              {run.steps.length} step{run.steps.length === 1 ? "" : "s"}
            </span>
          )}
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="text-mute hover:text-ink rounded hover:bg-surfaceAlt p-0.5"
              title="Collapse evidence pane"
              aria-label="Collapse evidence pane"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {/* Segmented tab control. flex-wrap so it degrades gracefully at
          mobile-drawer widths (this pane is also hosted in MobileDrawer). */}
      <div
        className="shrink-0 border-b border-edge px-2 py-1.5 flex flex-wrap items-center gap-1"
        role="tablist"
        aria-label="Evidence views"
      >
        <TabButton
          label="This run"
          title="Scale 1 — steer a single estimate: one card per pipeline step; the funnel card expands into the Evidence Theater"
          active={tab === "current"}
          onClick={() => setTab("current")}
        />
        <TabButton
          label="This configuration"
          title="Scale 2 — pool replicates of one configuration: every archived run as a lineage; restore, replay (exact numbers), tick two to compare"
          active={tab === "history"}
          onClick={() => setTab("history")}
          badge={archived > 0 ? archived : null}
        />
        <TabButton
          label="Between configurations"
          title="Scale 3 — compare configurations: two runs side by side as 95% intervals, plus the difference funnel (sequential A/B)"
          active={tab === "compare"}
          onClick={() => setTab("compare")}
          badge={compareIds.length > 0 ? compareIds.length : null}
        />
      </div>
      {/* Active-scale subtitle (visible, not hover): one plain-words
          line naming what the active tab pools. The tab tooltips keep
          the full framing, but the minimum needed to USE the view must
          not live in hover alone. */}
      <div className="shrink-0 border-b border-edge/60 bg-surfaceAlt/30 px-3 py-1 text-[10px] text-mute">
        {tab === "current" &&
          "Scale 1 — this run, step by step; each shot batch tightens the 95% interval"}
        {tab === "history" &&
          "Scale 2 — all archived runs; same color = same configuration"}
        {tab === "compare" &&
          "Scale 3 — two configurations side by side; the difference interval carries the verdict"}
      </div>
      <div ref={contentRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {tab === "current" && (
          <>
            {!run && !running && <EmptyHint />}
            {running && <RunningHint />}
            {run && run.steps.map((s) => <StepCard key={s.node_id} step={s} />)}
            {run && run.final_metrics && <FinalMetrics metrics={run.final_metrics} />}
            {run && !running && run.ok && <NextStepsHint />}
          </>
        )}
        {tab === "history" && <RunHistory embedded />}
        {tab === "compare" &&
          (compareIds.length === 2 ? (
            <CompareView />
          ) : (
            <CompareEmptyHint
              selected={compareIds.length}
              onGoToHistory={() => setTab("history")}
            />
          ))}
      </div>
    </div>
  );
}

function TabButton({
  label,
  title,
  active,
  onClick,
  badge = null,
}: {
  label: string;
  title?: string;
  active: boolean;
  onClick: () => void;
  badge?: number | null;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={title}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors border ${
        active
          ? "border-edge bg-surfaceAlt text-ink font-medium"
          : "border-transparent text-mute hover:text-ink hover:bg-surfaceAlt"
      }`}
    >
      {label}
      {badge != null && (
        <span className={`chip !px-1 !py-0 ${active ? "!border-accent/40 !text-accent" : ""}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

/** Between-configurations tab, fewer than two runs selected: the
 *  checkboxes live in the This-configuration tab, so point there
 *  instead of rendering nothing. */
function CompareEmptyHint({
  selected,
  onGoToHistory,
}: {
  selected: number;
  onGoToHistory: () => void;
}) {
  return (
    <div className="panel-alt p-4 text-[12px] text-mute leading-relaxed">
      <p className="text-ink font-medium mb-1">Compare two archived runs.</p>
      <p>
        The compare checkboxes live in the{" "}
        <button
          type="button"
          className="text-accent hover:underline"
          onClick={onGoToHistory}
        >
          “This configuration” tab
        </button>{" "}
        — tick two runs there and this panel lays out their configuration
        diff, fidelity as confidence intervals, step-aligned
        transformation signatures, and the difference funnel.
        {selected === 1 && (
          <span className="text-ink"> One run selected — pick one more.</span>
        )}
      </p>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="panel-alt p-4 text-sm text-mute leading-relaxed">
      <p className="text-ink font-medium mb-2">Ready when you are.</p>
      <ol className="space-y-1 text-[12px] list-decimal list-inside marker:text-mute/60">
        <li>Pick a circuit on the left (or upload your own).</li>
        <li>Arrange your pipeline on the canvas, or load a preset.</li>
        <li>
          Hit <span className="kbd">Run pipeline</span> — one result card
          will appear here per block as it finishes.
        </li>
      </ol>
      <p className="mt-3 text-[11px]">
        Default pipelines on the built-in samples hit a precomputed cache and
        return instantly. A cold <span className="text-ink">QuBound</span>{" "}
        (model training) or <span className="text-ink">Qshot</span> (clustering
        warmup + pilot measurements) run on the shared CPU can take
        1–3&nbsp;minutes; every other block finishes within seconds.
      </p>
      <p className="mt-2 text-[11px]">
        Every run is archived with its seed — replay, fork, and compare
        runs from the <span className="text-ink">This configuration</span>{" "}
        tab; sampled results show confidence intervals, not bare numbers.
      </p>
    </div>
  );
}

function RunningHint() {
  return (
    <div className="panel-alt p-4 text-sm text-mute">
      <div className="flex items-center gap-2">
        <CircleDot className="w-3.5 h-3.5 text-accent animate-pulse" />
        Executing pipeline…
      </div>
      <div className="mt-2 text-[11px] leading-relaxed">
        Most runs finish within a few seconds. Cold{" "}
        <span className="text-ink">QuBound</span> (model training) or{" "}
        <span className="text-ink">Qshot</span> (clustering warmup + pilot
        measurements) runs can take 1–3&nbsp;minutes on the shared CPU —
        please don't close the tab.
      </div>
    </div>
  );
}

/** Subtle "what next" prompt shown at the bottom of the results pane
 *  after a successful run. Surfaces Export .py as the natural follow-up
 *  (take the pipeline home for iteration). */
function NextStepsHint() {
  return (
    <div className="panel-alt p-3 text-[11px] leading-relaxed">
      <div className="flex items-center gap-1.5 text-mute mb-2">
        <Sparkles className="w-3 h-3 text-accent" />
        <span className="uppercase tracking-wider">Where to go from here</span>
      </div>
      <div className="flex items-start gap-1.5 text-mute">
        <Code2 className="w-3 h-3 mt-0.5 text-accent shrink-0" />
        <span>
          <span className="text-ink">Export .py</span> (in the toolbar's ⋯
          menu) to keep iterating in your own Jupyter / slurm setup, or
          tweak parameters and re-run to compare.
        </span>
      </div>
    </div>
  );
}

function StepCard({ step }: { step: StepResult }) {
  const plugins = useApp((s) => s.plugins);
  const spec = resolveNodeSpec(step.node_type, plugins);
  const isPlugin = spec && "isPlugin" in spec && spec.isPlugin;
  const Icon = spec?.icon ?? CircleDot;
  const dur = step.finished_at - step.started_at;

  const statusIcon = {
    ok: <Check className="w-3 h-3" />,
    skipped: <Clock className="w-3 h-3" />,
    error: <AlertCircle className="w-3 h-3" />,
  }[step.status];
  const statusClass = {
    ok: "!border-ok/40 !text-ok",
    skipped: "!border-mute/40 !text-mute",
    error: "!border-danger/40 !text-danger",
  }[step.status];

  return (
    <div className="panel-alt p-3">
      <div className="flex items-center gap-2">
        {isPlugin ? (
          <span
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
            style={{ backgroundColor: (spec as PluginNodeSpec).pluginColor }}
            title={`User plugin (${step.node_type})`}
          >
            {(spec as PluginNodeSpec).initials}
          </span>
        ) : (
          <span
            className={`w-7 h-7 rounded-md border bg-surface flex items-center justify-center shrink-0 ${
              spec?.accent ?? "text-mute"
            } ${spec?.accentRing ?? "border-edge"}`}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink text-sm">{step.label}</span>
            <span className={`chip ${statusClass}`}>
              {statusIcon} {step.status}
            </span>
            <RunStatusChips step={step} variant="card" />
          </div>
          <div className="text-[11px] text-mute">
            {dur.toFixed(2)}s · node <span className="font-mono">{step.node_id}</span>
          </div>
        </div>
      </div>
      {step.message && (
        <div className="mt-2 text-[11px] text-mute leading-relaxed border-l border-edge pl-2">
          {step.message}
        </div>
      )}
      {step.status === "ok" && step.summary && Object.keys(step.summary).length > 0 && (
        <StepBody step={step} />
      )}
      {step.status === "ok" && <SignatureCard step={step} />}
      {step.status === "ok" && step.figures && step.figures.length > 0 && (
        <PluginFigures figures={step.figures} />
      )}
      {step.status === "ok" &&
        isPlugin &&
        (!step.summary || Object.keys(step.summary).length === 0) &&
        (!step.figures || step.figures.length === 0) && (
          // Without this hint, a plugin author who forgot to return a
          // summary dict OR any figures sees a card with just the
          // header — they can't tell "ran fine but quiet" apart from
          // "broken plugin".
          <div className="mt-2 text-[11px] text-mute italic leading-relaxed">
            Plugin ran OK but returned no summary or figures. Add a{" "}
            <span className="font-mono not-italic">"summary"</span> dict
            or a <span className="font-mono not-italic">"figures"</span>{" "}
            list to your handler's return value to display data here.
          </div>
        )}
    </div>
  );
}

function FinalMetrics({ metrics }: { metrics: Record<string, unknown> }) {
  const items: {
    key: string;
    label: string;
    help: string;
    big: string;
    tone?: string;
  }[] = [];

  if (typeof metrics["qubound_error_bound"] === "number") {
    const v = metrics["qubound_error_bound"] as number;
    items.push({
      key: "qubound_error_bound",
      label: "predicted error bound",
      help: "How much error QuBound expects today's noise to add. Lower is better.",
      big: v.toFixed(4),
      tone: v < 0.05 ? "text-ok" : v < 0.15 ? "text-warn" : "text-danger",
    });
  }
  if (typeof metrics["fidelity"] === "number") {
    const v = metrics["fidelity"] as number;
    items.push({
      key: "fidelity",
      label: "fidelity",
      help: "Similarity between noisy and ideal output. Higher is better.",
      big: `${(v * 100).toFixed(2)}%`,
      tone: v >= 0.95 ? "text-ok" : v >= 0.8 ? "text-warn" : "text-danger",
    });
  }
  if (typeof metrics["transpiled_depth"] === "number") {
    items.push({
      key: "transpiled_depth",
      label: "transpiled depth",
      help: "Circuit depth after compiling for the target chip's gate set.",
      big: String(metrics["transpiled_depth"]),
    });
  }
  if (typeof metrics["gates_removed"] === "number") {
    items.push({
      key: "gates_removed",
      label: "gates removed",
      help: "How many redundant rotations CompressVQC folded away.",
      big: String(metrics["gates_removed"]),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="panel p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-mute mb-2">
        Key metrics
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((m) => (
          <div key={m.key} className="panel-alt p-2">
            <div className="text-[10px] uppercase tracking-wider text-mute">{m.label}</div>
            <div className={`font-mono text-lg ${m.tone ?? "text-ink"}`}>
              {m.big}
            </div>
            <div className="text-[10px] text-mute leading-snug mt-0.5">
              {m.help}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
