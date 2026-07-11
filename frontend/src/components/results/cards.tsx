// Per-algorithm result cards.
//
// `StepBody` is the dispatcher that ResultsPane calls to render the body
// of a step card — it picks the right view by node type. Each view
// knows what fields to pull out of the step's `summary` dict and how to
// visualise them using the primitives from `./viz`.

import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import type { StepResult } from "../../lib/api";
import { useApp } from "../../lib/store";
import { listRunsByConfig } from "../../lib/runStore";
import { GLOSSARY } from "../../lib/glossary";
import {
  poolEvidence,
  runEvidence,
  dedupeDraws,
  type DatedEvidence,
  type PooledEvidence,
} from "../../lib/stats";
import {
  Caption,
  DepthCompare,
  Gauge,
  KvRow,
  OpBar,
  Sparkline,
  Stat,
  numOr,
} from "./viz";

/** Dispatch the step summary to a node-type-specific card; fall back to generic rows. */
export function StepBody({ step }: { step: StepResult }) {
  const s = step.summary;
  switch (step.node_type) {
    case "qubound":
      return <QuBoundCard s={s} />;
    case "qucad":
      return <QuCADCard s={s} />;
    case "compvqc":
      return <CompressVQCCard s={s} />;
    case "qshot":
      return <QshotCard s={s} />;
    case "fidelity":
      return <FidelityCard s={s} step={step} />;
    case "output":
      return <OutputCard s={s} />;
    case "input_circuit":
      return <InputCircuitCard s={s} />;
    case "fake_backend":
    case "ibm_backend":
      return <BackendCard s={s} />;
    default:
      return <GenericSummary s={s} />;
  }
}

/** QuBound — predicted error bound in [0, 1] + lay explanation. */
function QuBoundCard({ s }: { s: Record<string, unknown> }) {
  const raw = s["predicted_error_bound"];
  // Number.isFinite: a NaN payload must render as the absent state,
  // not a "NaN" tile with a confident explanation under it (audit S3).
  const value =
    typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
  const source = String(s["source"] ?? "");

  return (
    <div className="mt-2 space-y-2">
      <Caption>
        <span className="text-ink font-medium">What QuBound did:</span>{" "}
        looked at the machine's last 14 days of measured error rates and
        predicted how much error today's noise would add to your circuit
        (a small learned model does the extrapolation). Lower is better.
      </Caption>
      {value !== undefined && (
        <div className="flex items-center gap-3">
          <Gauge value={value} />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-mute">
              predicted error bound
            </div>
            <div className="font-mono text-ink text-lg">{value.toFixed(4)}</div>
            <div className="text-[10px] text-mute">
              {value < 0.05
                ? "very low: noise should barely matter"
                : value < 0.15
                  ? "moderate: noise will visibly affect outputs"
                  : "high: this circuit is likely noise-dominated on today's chip"}
            </div>
          </div>
        </div>
      )}
      <details className="text-[11px] text-mute">
        <summary className="cursor-pointer hover:text-ink">
          run details ({source || "cached"})
        </summary>
        <div className="mt-1 pl-2 border-l border-edge space-y-0.5">
          {Object.entries(s).map(([k, v]) => (
            <KvRow key={k} k={k} v={v} />
          ))}
        </div>
      </details>
    </div>
  );
}

/** QuCAD — parameter sparsification. Show kept/total + sparsity trace. */
function QuCADCard({ s }: { s: Record<string, unknown> }) {
  const original = numOr(s["original_parameters"], 0);
  const kept = numOr(s["kept_parameters"], 0);
  const trace = Array.isArray(s["sparsity_trace"])
    ? (s["sparsity_trace"] as number[])
    : [];
  const removed = original - kept;
  const pct = original > 0 ? (removed / original) * 100 : 0;

  return (
    <div className="mt-2 space-y-2">
      <Caption>
        <span className="text-ink font-medium">What QuCAD did:</span>{" "}
        pruned the trainable circuit — deleted the parameters that hurt
        accuracy under the machine's noise. Fewer parameters means fewer
        operations to execute, which often means less total error.
      </Caption>
      {original > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="kept" value={`${kept}`} sub={`of ${original}`} />
          <Stat label="removed" value={`${removed}`} sub={`${pct.toFixed(0)}%`} />
          <Stat
            label="final loss"
            // "—", not "NaN": a missing/broken payload is an absent
            // value, not a number (audit S3).
            value={
              Number.isFinite(numOr(s["final_loss"], NaN))
                ? numOr(s["final_loss"], NaN).toFixed(4)
                : "—"
            }
          />
        </div>
      )}
      {trace.length > 1 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-mute mb-1">
            sparsity per ADMM iteration (lower = more sparse)
          </div>
          <Sparkline data={trace} height={40} />
        </div>
      )}
      <details className="text-[11px] text-mute">
        <summary className="cursor-pointer hover:text-ink">raw summary</summary>
        <div className="mt-1 pl-2 border-l border-edge space-y-0.5">
          {Object.entries(s).map(([k, v]) => (
            <KvRow key={k} k={k} v={v} />
          ))}
        </div>
      </details>
    </div>
  );
}

/** CompressVQC — depth before vs after, gates removed. */
function CompressVQCCard({ s }: { s: Record<string, unknown> }) {
  const before = numOr(s["original_depth"], 0);
  const after = numOr(s["compressed_depth"], before);
  const removed = numOr(s["gates_removed"], 0);
  const shrinkPct = before > 0 ? ((before - after) / before) * 100 : 0;

  return (
    <div className="mt-2 space-y-2">
      <Caption>
        <span className="text-ink font-medium">What CompressVQC did:</span>{" "}
        merged redundant rotation operations via a precomputed lookup table.
        A shorter circuit runs faster and accumulates less noise.
      </Caption>
      {before > 0 && <DepthCompare before={before} after={after} />}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="gates removed" value={`${removed}`} />
        <Stat label="depth reduction" value={`${shrinkPct.toFixed(0)}%`} />
      </div>
      <details className="text-[11px] text-mute">
        <summary className="cursor-pointer hover:text-ink">raw summary</summary>
        <div className="mt-1 pl-2 border-l border-edge space-y-0.5">
          {Object.entries(s).map(([k, v]) => (
            <KvRow key={k} k={k} v={v} />
          ))}
        </div>
      </details>
    </div>
  );
}

/** Qshot — recommended shot count + predicted fidelity at that count. */
function QshotCard({ s }: { s: Record<string, unknown> }) {
  const shots = numOr(s["recommended_shots"], NaN);
  const fid = numOr(s["predicted_fidelity"], NaN);
  const std = numOr(s["predicted_std"], NaN);
  const method = String(s["method"] ?? "regression");
  const alpha = numOr(s["alpha"], 0.95);
  const snapshot = String(s["noise_snapshot"] ?? "");
  const cluster = s["cluster_label"];
  const tier = s["tier"];
  const nMatched = s["n_matched"];

  const fit = (s["fit"] as Record<string, unknown> | undefined) ?? {};
  const fInf = numOr(fit["F_inf"], NaN);
  const target = numOr(fit["target"], NaN);

  const pilot = (s["pilot_pf"] as Record<string, unknown> | undefined) ?? {};
  const pilotPoints = Object.entries(pilot)
    .map(([k, v]) => [Number(k), Number(v)] as [number, number])
    .filter(([k, v]) => Number.isFinite(k) && Number.isFinite(v))
    .sort((a, b) => a[0] - b[0]);

  // GNN fallback gets its own label so users can tell whether the main
  // regression path was used or not. When the fallback is active, Qshot
  // couldn't match the query to any cluster (cluster_label = -1) and is
  // extrapolating via the dual-graph network — worth flagging.
  const isFallback = method === "gnn_fallback";
  const methodLabel = isFallback ? "GNN fallback" : "regression";

  return (
    <div className="mt-2 space-y-2">
      <Caption>
        <span className="text-ink font-medium">What Qshot did:</span> predicted
        how many repeated measurements (shots) your circuit needs to reach{" "}
        {(alpha * 100).toFixed(0)}% of its best achievable accuracy under the
        chosen day's machine noise. Helps you size your measurement budget —
        the prediction assumes the bundled noise model, so real-hardware
        behaviour may drift.
      </Caption>

      {/* Three headline stats — mirrors the screenshot the author shared. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Stat
          label="recommended shots"
          value={Number.isFinite(shots) ? `${shots}` : "—"}
        />
        <Stat
          label="predicted fidelity"
          // House convention: fidelities read as percentages
          // everywhere else (cards, board, funnels) — a bare 0-1
          // 4-decimal here made the same quantity look like a
          // different one (audit S3). The α-formula line and pilot
          // table below keep the author's raw-unit notation.
          value={Number.isFinite(fid) ? `${(fid * 100).toFixed(2)}%` : "—"}
          sub={
            Number.isFinite(std) ? `± ${(std * 100).toFixed(2)}pp` : undefined
          }
        />
        <Stat label="method" value={methodLabel} />
      </div>

      {/* Flag fallback path so users know the number comes from a neural-
          network extrapolation, not a cluster match. Qshot's training
          distribution is 5-8 qubits; anything smaller/larger tends to
          fall through to fallback. */}
      {isFallback && (
        <div className="text-[11px] leading-relaxed rounded-md border border-warn/40 bg-warn/10 px-2 py-1.5 text-ink">
          Circuit didn't match any cluster in the training set — typically
          because it's outside the validated 5–8 qubit range or has an
          unusual structure. Qshot extrapolated with the dual-graph GNN
          fallback; treat the prediction as a best guess.
        </div>
      )}

      {/* Target-fidelity formula line — replicates the author's notation
          "α × converged F (F_inf=…) = target". Only render if all the
          numbers are real so we don't emit a half-filled sentence. */}
      {Number.isFinite(fInf) && Number.isFinite(target) && (
        <div className="text-[11px] text-mute">
          <span className="text-ink">Target</span>: α={alpha.toFixed(2)} ×
          converged F (F<sub>inf</sub>={fInf.toFixed(4)}) ={" "}
          <span className="text-ink">{target.toFixed(4)}</span>
        </div>
      )}

      {/* Cluster / tier / neighbors line — compact, tabular. The
          regression path reports these; the GNN fallback returns -1 / -1
          / 0, which is meaningless to a user, so suppress the whole line
          when the fallback path produced the result. */}
      {!isFallback && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mute">
          {cluster !== undefined && cluster !== null && (
            <span>
              <span className="text-ink">Cluster</span>: {String(cluster)}
            </span>
          )}
          {tier !== undefined && tier !== null && (
            <span>
              <span className="text-ink">Tier</span>: {String(tier)}
            </span>
          )}
          {nMatched !== undefined && nMatched !== null && (
            <span>
              <span className="text-ink">PF-matched neighbours</span>:{" "}
              {String(nMatched)}
            </span>
          )}
          {snapshot && (
            <span className="font-mono text-edge">· {snapshot}</span>
          )}
        </div>
      )}
      {isFallback && snapshot && (
        <div className="text-[11px] text-mute font-mono">
          · {snapshot}
        </div>
      )}

      {/* Pilot-measurement sparkline — shows the shots vs. observed PF
          points Qshot collected. Small, decorative, so keep it collapsed
          behind a disclosure. */}
      {pilotPoints.length >= 2 && (
        <details className="text-[11px] text-mute">
          <summary className="cursor-pointer hover:text-ink">
            pilot measurements ({pilotPoints.length} points)
          </summary>
          <div className="mt-1 pl-2 border-l border-edge space-y-1">
            <Sparkline data={pilotPoints.map(([, v]) => v)} height={28} />
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
              {pilotPoints.map(([shots, pf]) => (
                <div key={shots} className="flex justify-between">
                  <span className="text-edge">{shots} shots</span>
                  <span>{pf.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}

      <details className="text-[11px] text-mute">
        <summary className="cursor-pointer hover:text-ink">raw summary</summary>
        <div className="mt-1 pl-2 border-l border-edge space-y-0.5">
          {Object.entries(s).map(([k, v]) => (
            <KvRow key={k} k={k} v={v} />
          ))}
        </div>
      </details>
    </div>
  );
}

/** Fidelity — 0-1, higher is better. */
function FidelityCard({
  s,
  step,
}: {
  s: Record<string, unknown>;
  step?: StepResult;
}) {
  const f = numOr(s["fidelity"], NaN);
  const good = f >= 0.95;
  const mid = f >= 0.8 && f < 0.95;
  const tone = good ? "text-ok" : mid ? "text-warn" : "text-danger";
  const dist = step?.distribution as
    | {
        kind?: string;
        shots?: number;
        successes?: number;
        ci95?: [number, number];
        counts_top?: Record<string, number>;
        shots_requested?: number;
        stopped_early?: boolean;
        precision_target?: number;
        trace?: Array<{
          shots_done: number;
          point: number;
          ci95: [number, number];
        }>;
      }
    | null
    | undefined;

  return (
    <div className="mt-2 space-y-2">
      <Caption>
        <span className="text-ink font-medium">What this measures:</span>{" "}
        how close the noisy circuit's output distribution is to the ideal
        (noiseless) one. 1.0 is perfect; 0 is unrelated.
      </Caption>
      {Number.isFinite(f) && (
        <div className="flex items-center gap-3">
          <Gauge value={f} inverted />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-mute">
              estimated fidelity
              {dist?.kind === "binomial" && (
                <span className="ml-1 normal-case tracking-normal">
                  (sampled — a draw, not a number)
                </span>
              )}
            </div>
            <div className={`font-mono text-lg ${tone}`}>
              {(f * 100).toFixed(2)}%
            </div>
            <div className="text-[10px] text-mute">
              {good
                ? "very close to ideal"
                : mid
                  ? "noticeable noise, but usable"
                  : "heavily degraded by noise"}
            </div>
          </div>
        </div>
      )}
      {dist?.kind === "binomial" && dist.ci95 && (
        <UncertaintyBlock
          point={f}
          ci={dist.ci95}
          shots={dist.shots ?? 0}
          successes={dist.successes ?? 0}
          countsTop={dist.counts_top ?? {}}
          seedUsed={step?.seed_used ?? null}
          trace={dist.trace ?? []}
          precisionTarget={dist.precision_target ?? null}
          stoppedEarly={dist.stopped_early ?? false}
          shotsRequested={dist.shots_requested ?? dist.shots ?? 0}
        />
      )}
      {dist?.kind === "binomial" && <ReplicateStrip currentPoint={f} />}
    </div>
  );
}

/** Within-run uncertainty: the sampled estimate is a binomial draw, so
 *  show the Wilson interval on a 0-1 scale plus the raw histogram
 *  material — never let a stochastic quantity masquerade as a scalar. */
function UncertaintyBlock({
  point,
  ci,
  shots,
  successes,
  countsTop,
  seedUsed,
  trace = [],
  precisionTarget = null,
  stoppedEarly = false,
  shotsRequested = 0,
}: {
  point: number;
  ci: [number, number];
  shots: number;
  successes: number;
  countsTop: Record<string, number>;
  seedUsed: number | null;
  /** Cumulative per-batch evidence trajectory recorded by the server
   *  (one Wilson interval per shot batch). Empty for pre-Wave-I
   *  archived runs, which simply render no funnel. */
  trace?: Array<{ shots_done: number; point: number; ci95: [number, number] }>;
  precisionTarget?: number | null;
  stoppedEarly?: boolean;
  shotsRequested?: number;
}) {
  const [lo, hi] = ci;
  const allEntries = Object.entries(countsTop).sort((a, b) => b[1] - a[1]);
  const entries = allEntries.slice(0, 6);
  const maxCount = entries.length > 0 ? entries[0][1] : 1;
  // Honest truncation (audit S3): the histogram shows the top 6
  // outcomes; say what it hides. counts_top may itself be a server-
  // side top-N, so the shot arithmetic (not the entry count) is the
  // reliable signal.
  const hiddenOutcomes = allEntries.length - entries.length;
  const shownShots = entries.reduce((a, [, c]) => a + c, 0);
  const hiddenShots = Math.max(0, shots - shownShots);
  const ppTarget =
    precisionTarget != null ? (precisionTarget * 100).toFixed(0) : null;
  return (
    <div className="panel-alt p-2 space-y-2">
      <div className="flex items-center justify-between text-[10px] text-mute">
        <span title={GLOSSARY.ci} className="tabular-nums">
          95% interval: {(lo * 100).toFixed(1)}–{(hi * 100).toFixed(1)}% ·{" "}
          {successes}/{shots} measurements hit the ideal outcome
        </span>
        <span className="flex items-center gap-2">
          {seedUsed != null && (
            <span className="font-mono" title="Simulator seed consumed by this draw — part of the run's provenance record.">
              seed {seedUsed}
            </span>
          )}
          {/* THE theater entry point (three-scales IA): the theater is
              this tab's expanded mode, so its affordance lives on the
              funnel card itself — the toolbar button it replaces sat a
              panel away from the funnel it enlarged. Auto-open on
              streaming runs is unchanged. */}
          <button
            type="button"
            data-marker="open-theater"
            className="flex items-center gap-1 rounded border border-accent/50 px-1.5 py-0.5 text-accent hover:bg-accent/10"
            onClick={() => useApp.getState().setTheaterOpen(true)}
            title="Expand this funnel into the Evidence Theater — the large steering view: per-batch intervals on a shots axis, stopping target, cost row. (Opens by itself when a run streams.)"
          >
            <Maximize2 className="w-3 h-3" />
            expand · theater
          </button>
        </span>
      </div>
      {/* Evidence funnel — the run's whole uncertainty trajectory, not
          just its endpoint. One thin line per shot batch, oldest at
          the top and most transparent, each drawn on the same fixed
          0-1 scale as the main interval bar below. Read top-to-bottom
          it narrows toward the final interval: evidence accumulating.
          The trace is recorded server-side per batch, so the funnel
          renders identically for live runs, archived runs and
          replays — the trajectory is provenance, not an animation. */}
      {trace.length > 1 && (
        <div
          className="evidence-funnel space-y-px"
          role="img"
          aria-label={`evidence funnel: ${trace.length} shot batches, interval narrowing from ${((trace[0].ci95[1] - trace[0].ci95[0]) * 100).toFixed(1)} to ${((hi - lo) * 100).toFixed(1)} percentage points wide`}
          title={`Each line = the 95% CI after one more batch of shots (top = first batch). ${trace.length} batches; width ${((trace[0].ci95[1] - trace[0].ci95[0]) * 100).toFixed(1)}pp → ${((hi - lo) * 100).toFixed(1)}pp. Same funnel motif as the lineage in “This configuration”: here shot batches accumulate inside ONE run; there whole runs accumulate across a replicate group.`}
        >
          {trace.map((t, i) => (
            <div key={t.shots_done} className="relative h-[3px]" aria-hidden>
              <div
                className="absolute inset-y-0 rounded-full bg-accent"
                style={{
                  left: `${t.ci95[0] * 100}%`,
                  width: `${Math.max(0.5, (t.ci95[1] - t.ci95[0]) * 100)}%`,
                  // linear opacity ramp: oldest ≈ 0.14, newest ≈ 0.55 —
                  // history stays subtle, recency reads as saturation
                  opacity: 0.14 + (0.41 * (i + 1)) / trace.length,
                }}
              />
            </div>
          ))}
        </div>
      )}
      {/* interval bar on a fixed 0-1 scale */}
      <div className="relative h-2 rounded bg-surfaceAlt overflow-hidden" aria-hidden>
        <div
          className="absolute top-0 h-full bg-accent/25"
          style={{ left: `${lo * 100}%`, width: `${Math.max(0.5, (hi - lo) * 100)}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-accent"
          // clamp: a fidelity of exactly 0/1 must render AT the scale
          // edge, not clipped by overflow-hidden (audit S2)
          style={{
            left: `clamp(0px, calc(${point * 100}% - 1px), calc(100% - 2px))`,
          }}
        />
        {/* Optional-stopping target rendered as the width the user
            asked for: two ticks at point ± target. When the interval
            fits between them, the run had permission to stop. */}
        {precisionTarget != null && (
          <>
            <div
              className="absolute top-0 h-full w-px bg-warn"
              style={{ left: `${Math.max(0, point - precisionTarget) * 100}%` }}
            />
            <div
              className="absolute top-0 h-full w-px bg-warn"
              style={{ left: `${Math.min(1, point + precisionTarget) * 100}%` }}
            />
          </>
        )}
      </div>
      {precisionTarget != null && (
        <div className="text-[10px] text-mute">
          {stoppedEarly ? (
            <span className="text-accent">
              ⏹ stopped at {shots} of {shotsRequested} shots — target ±
              {ppTarget}pp reached
            </span>
          ) : (
            <span>
              target ±{ppTarget}pp (tick marks) — ran all {shots} shots
            </span>
          )}
        </div>
      )}
      {entries.length > 0 && (
        <div className="space-y-0.5">
          {entries.map(([bits, count]) => (
            <div key={bits} className="flex items-center gap-1.5 text-[10px]">
              <span className="font-mono text-mute w-16 truncate" title={`|${bits}⟩`}>
                {bits}
              </span>
              <div className="flex-1 h-1.5 rounded bg-surfaceAlt overflow-hidden">
                <div
                  className="h-full bg-accent/60"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="font-mono text-mute w-8 text-right">{count}</span>
            </div>
          ))}
          {hiddenShots > 0 && (
            <div className="text-[10px] text-mute/70">
              {hiddenOutcomes > 0
                ? `+${hiddenOutcomes} more outcome${hiddenOutcomes === 1 ? "" : "s"} · `
                : ""}
              {hiddenShots} shot{hiddenShots === 1 ? "" : "s"} in outcomes
              not listed
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Across-run distribution: every archived run of this same
 *  configuration contributes one dot. This is the empirical answer to
 *  "if I ran it again, what would I get?" — shot noise plus whatever
 *  else varies run-to-run. */
function ReplicateStrip({ currentPoint }: { currentPoint: number }) {
  const historyVersion = useApp((st) => st.historyVersion);
  const configHash = useApp((st) => st.lastConfigHash);
  const [points, setPoints] = useState<number[]>([]);
  const [pooled, setPooled] = useState<PooledEvidence | null>(null);
  // The two most recent archived runs of this configuration (oldest →
  // newest pair), fuel for the one-hop compare link below. By the time
  // this card renders, the run it belongs to is already archived
  // (FlowCanvas archives before bumping historyVersion), so "the two
  // latest" is "this run vs its predecessor".
  const [latestPair, setLatestPair] = useState<[string, string] | null>(null);

  useEffect(() => {
    if (!configHash) return;
    let cancelled = false;
    listRunsByConfig(configHash)
      .then((rs) => {
        if (cancelled) return;
        setLatestPair(
          rs.length >= 2
            ? [rs[rs.length - 2].run_id, rs[rs.length - 1].run_id]
            : null,
        );
        setPoints(
          rs
            // r.ok too (audit S3): a run whose LATER step failed still
            // carries a fidelity headline, but the pooled interval
            // below already excludes it — a dot indistinguishable from
            // trusted evidence would contradict the pool it sits on.
            .filter(
              (r) =>
                r.ok &&
                r.headline_label === "fidelity" &&
                r.headline_value != null,
            )
            .map((r) => r.headline_value as number),
        );
        // Wave J: pool the archived replicates' binomial counts —
        // valid within one configuration (same underlying p; see
        // lib/stats.ts) — so the across-runs answer carries a real
        // interval, not just a scatter of points.
        // Exact replays counted once (dedupeDraws): a pinned replay
        // repeats its ancestor's draw bit-exactly, so pooling it again
        // would narrow the interval with no new evidence.
        const evs = dedupeDraws(
          rs
            .filter((r) => r.ok)
            .map((r): DatedEvidence | null => {
              const ev = runEvidence(r.response);
              return ev
                ? { ...ev, created_at: r.created_at, root_seed: r.root_seed }
                : null;
            })
            .filter((e): e is DatedEvidence => e != null),
        );
        setPooled(evs.length >= 2 ? poolEvidence(evs) : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [configHash, historyVersion]);

  if (points.length < 2) return null;
  const mean = points.reduce((a, b) => a + b, 0) / points.length;
  const min = Math.min(...points);
  const max = Math.max(...points);
  return (
    <div className="panel-alt p-2 space-y-1">
      <div className="text-[10px] text-mute">
        Across {points.length} archived runs of this configuration: mean{" "}
        {(mean * 100).toFixed(1)}% · range {(min * 100).toFixed(1)}–
        {(max * 100).toFixed(1)}%
      </div>
      <div className="relative h-4 rounded bg-surfaceAlt" aria-hidden>
        {points.map((p, i) => {
          // Highlight THE newest dot when it matches the displayed run
          // (epsilon, not ===: float identity is luck, and two
          // coincidentally-equal older runs must not both light up —
          // audit S3).
          const isCurrent =
            i === points.length - 1 && Math.abs(p - currentPoint) < 1e-6;
          return (
            <div
              key={i}
              className={`absolute top-1 w-1 h-2 rounded-sm ${isCurrent ? "bg-accent" : "bg-accent/40"}`}
              // clamp: 0%/100% dots sit AT the scale edge instead of
              // overhanging it (audit S3, same rule as the interval bar).
              style={{
                left: `clamp(0px, calc(${p * 100}% - 2px), calc(100% - 4px))`,
              }}
              title={`${(p * 100).toFixed(2)}%`}
            />
          );
        })}
      </div>
      {pooled && (
        <div
          className="text-[10px] text-mute tabular-nums"
          title={`All ${pooled.nRuns} archived replicates' measurement counts pooled (${pooled.successes}/${pooled.shots}), one Wilson interval over the pooled counts — same math as the Evidence-board card's pooled band. Exact replays (same pinned seed) are counted once.`}
        >
          pooled μ {(pooled.point * 100).toFixed(1)}% ±
          {(pooled.halfWidth * 100).toFixed(1)}pp over {pooled.shots} shots (
          {pooled.nRuns} runs)
        </div>
      )}
      {/* One-hop route into the Compare view. Without it, comparison is
          only reachable via two History checkboxes or an Evidence-board A/B —
          three panels away from the card that just made the user ask
          "is this different from last time?". Setting both ids at once
          rides the Evidence pane's existing auto-switch to Compare. */}
      {latestPair && (
        <button
          type="button"
          data-marker="compare-vs-previous"
          className="text-[10px] text-accent hover:underline"
          onClick={() => useApp.getState().setCompareIds(latestPair)}
          title="Open “Between configurations” with this configuration's two most recent archived runs side by side."
        >
          compare vs previous run of this configuration ↗
        </button>
      )}
    </div>
  );
}

/** Output — depth, size, ops, diagram, transpiled stats. */
function OutputCard({ s }: { s: Record<string, unknown> }) {
  const ops = (s["ops"] as Record<string, number> | undefined) ?? {};
  const opEntries = Object.entries(ops).sort((a, b) => b[1] - a[1]);
  const maxOp = opEntries.length > 0 ? opEntries[0][1] : 0;
  const depth = numOr(s["depth"], 0);
  const size = numOr(s["size"], 0);
  const transpiled = numOr(s["transpiled_depth"], NaN);
  const diagram = typeof s["diagram_text"] === "string" ? (s["diagram_text"] as string) : "";

  return (
    <div className="mt-2 space-y-2">
      <Caption>
        <span className="text-ink font-medium">Final circuit:</span> what
        actually runs after every upstream block has had its say.
      </Caption>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="depth" value={`${depth}`} />
        <Stat label="size" value={`${size}`} sub="total gates" />
        <Stat
          label="transpiled depth"
          value={Number.isFinite(transpiled) ? `${transpiled}` : "—"}
          sub="on target chip"
        />
      </div>
      {opEntries.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-mute mb-1">
            gate breakdown
          </div>
          <div className="space-y-0.5">
            {opEntries.slice(0, 8).map(([name, count]) => (
              <OpBar key={name} name={name} count={count} max={maxOp} />
            ))}
          </div>
        </div>
      )}
      {diagram && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-mute hover:text-ink">
            ASCII circuit diagram
          </summary>
          <pre className="mt-1 font-mono text-[10px] leading-tight p-2 bg-canvas/60 border border-edge rounded overflow-x-auto text-ink">
            {diagram}
          </pre>
        </details>
      )}
    </div>
  );
}

/** Input circuit summary (diagram + counts). */
function InputCircuitCard({ s }: { s: Record<string, unknown> }) {
  return (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="qubits" value={`${numOr(s["num_qubits"], 0)}`} />
        <Stat label="depth" value={`${numOr(s["depth"], 0)}`} />
        <Stat label="params" value={`${numOr(s["num_parameters"], 0)}`} />
      </div>
      {typeof s["diagram_text"] === "string" && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-mute hover:text-ink">
            ASCII circuit diagram
          </summary>
          <pre className="mt-1 font-mono text-[10px] leading-tight p-2 bg-canvas/60 border border-edge rounded overflow-x-auto text-ink">
            {s["diagram_text"] as string}
          </pre>
        </details>
      )}
    </div>
  );
}

/** Backend card — minimal info. */
function BackendCard({ s }: { s: Record<string, unknown> }) {
  const name = String(s["backend_name"] ?? "");
  return (
    <div className="mt-2 text-[11px] text-mute">
      {name && (
        <div>
          backend: <span className="font-mono text-ink">{name}</span>
        </div>
      )}
      {s["live"] === true && <div className="text-warn">live IBM calibration</div>}
      {s["fallback"] != null && (
        <div>
          fallback: <span className="font-mono text-ink">{String(s["fallback"])}</span>
        </div>
      )}
    </div>
  );
}

/** Generic fallback — the previous flat k/v list. */
function GenericSummary({ s }: { s: Record<string, unknown> }) {
  return (
    <div className="mt-2 space-y-1">
      {Object.entries(s).map(([k, v]) => (
        <KvRow key={k} k={k} v={v} />
      ))}
    </div>
  );
}
