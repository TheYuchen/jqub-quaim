/**
 * 2×2 outcome grid for the two-qubit steps — the Tally idiom (mono
 * bitstring label, proportional bar, count) rearranged into the
 * fourfold table a pair of bits actually has, so agreement (00/11,
 * the Bell diagonal) and disagreement (01/10) sit on opposite
 * diagonals of one small square. Color semantics shared with the
 * rest of the system: populated expected cells tint accent; `leak`
 * marks off-diagonal counts as readout misreads (step 4) and tints
 * them warn instead. Row order is fixed so cells never jump.
 */
const ORDER = ["00", "01", "10", "11"] as const;

export function PairGrid({
  counts,
  leak = false,
}: {
  counts: Record<string, number>;
  /** Step 4: off-diagonal counts are misreads → warn tint. In step 3
   *  they are honest outcomes of the unlinked recipe → accent. */
  leak?: boolean;
}) {
  const total = ORDER.reduce((a, k) => a + (counts[k] ?? 0), 0);
  const max = Math.max(1, ...ORDER.map((k) => counts[k] ?? 0));
  return (
    <div
      className="grid grid-cols-2 gap-1.5 w-full max-w-[260px]"
      role="group"
      aria-label={`pair outcomes after ${total} looks`}
    >
      {ORDER.map((bits) => {
        const c = counts[bits] ?? 0;
        const agree = bits === "00" || bits === "11";
        const isLeak = leak && !agree && c > 0;
        return (
          <div
            key={bits}
            className={`rounded-md border px-2 py-1.5 transition-colors ${
              isLeak
                ? "border-warn/50 bg-warn/5"
                : c > 0
                  ? "border-accent/40 bg-accent/5"
                  : "border-edge bg-surfaceAlt/40"
            }`}
            aria-label={`outcome ${bits}: ${c}`}
          >
            <div className="flex items-center justify-between text-[10px]">
              <span className={`font-mono ${c > 0 ? "text-ink" : "text-mute"}`}>
                {bits}
              </span>
              <span className="font-mono text-mute tabular-nums">{c}</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-surfaceAlt overflow-hidden">
              <div
                className={`h-full transition-[width] duration-150 ease-out ${
                  isLeak ? "bg-warn/70" : "bg-accent/60"
                }`}
                style={{ width: `${(c / max) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
