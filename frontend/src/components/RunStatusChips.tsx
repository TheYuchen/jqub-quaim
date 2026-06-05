import type { StepResult } from "../lib/api";

/**
 * The pair of contextual chips a step can carry beyond its status:
 *   * "cached" — served from the per-node prefix cache (pipeline
 *     prefix unchanged since the last run).
 *   * "live"   — intentionally nondeterministic (e.g. sampled
 *     fidelity with N shots). The cache is bypassed for this step
 *     and everything downstream so the user gets a fresh shot draw
 *     each run.
 *
 * Two visual variants:
 *   * `tile` — compact 9px text + tight padding for the canvas tile
 *     (QNode's result strip).
 *   * `card` — the global `.chip` pill used in the right pane card
 *     (ResultsPane's step header).
 *
 * cached and live are mutually exclusive in practice (a cache hit
 * can't also be flagged nondeterministic, since we never write
 * nondeterministic results into the cache), so we render at most one.
 */
export function RunStatusChips({
  step,
  variant,
}: {
  step: StepResult;
  variant: "tile" | "card";
}) {
  const isTile = variant === "tile";
  const cachedClass = isTile
    ? "text-[9px] px-1 py-0.5 rounded border border-accent/30 text-accent"
    : "chip !border-accent/30 !text-accent text-[9px]";
  const liveClass = isTile
    ? "text-[9px] px-1 py-0.5 rounded border border-warn/30 text-warn"
    : "chip !border-warn/30 !text-warn text-[9px]";

  if (step.from_step_cache) {
    return (
      <span
        className={cachedClass}
        title="Served from per-node cache (pipeline prefix unchanged)"
      >
        cached
      </span>
    );
  }
  if (step.nondeterministic) {
    return (
      <span
        className={liveClass}
        title="Result is intentionally fresh each run (e.g. sampled shots). The per-node cache is bypassed for this step and every downstream step."
      >
        live
      </span>
    );
  }
  return null;
}
