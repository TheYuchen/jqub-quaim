/**
 * Outcome tally — the counts_top histogram idiom from the Evidence
 * pane (components/results/cards.tsx UncertaintyBlock), reused so the
 * learn track's first histogram looks like the one the real system
 * will show later: mono bitstring label, proportional bar, count.
 * Bars animate via a width transition, so batch measurement in step 1
 * visibly grows them draw by draw.
 */
export function Tally({
  counts,
  order,
}: {
  counts: Record<string, number>;
  /** Row order — fixed so rows never jump while counts change. */
  order: string[];
}) {
  const max = Math.max(1, ...order.map((k) => counts[k] ?? 0));
  return (
    <div className="space-y-1 w-full">
      {order.map((bits) => {
        const c = counts[bits] ?? 0;
        return (
          <div key={bits} className="flex items-center gap-1.5 text-[10px]">
            <span className="font-mono text-mute w-8 shrink-0">{bits}</span>
            <div className="flex-1 h-2 rounded bg-surfaceAlt overflow-hidden">
              <div
                className="h-full bg-accent/60 transition-[width] duration-150 ease-out"
                style={{ width: `${(c / max) * 100}%` }}
              />
            </div>
            <span className="font-mono text-mute w-10 text-right tabular-nums">
              {c}
            </span>
          </div>
        );
      })}
    </div>
  );
}
