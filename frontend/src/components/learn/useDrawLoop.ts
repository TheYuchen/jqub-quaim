import { useEffect, useRef, useState } from "react";

/**
 * Shared batch-measurement loop for the learn track. Step 1 planted
 * the idiom (draws land one per ~30ms so the tally visibly
 * accumulates; ONE synchronous batch under prefers-reduced-motion);
 * steps 3 and 4 reuse it via this hook so the timing and the
 * reduced-motion sync path stay identical across steps. The step owns
 * every piece of state — this hook only owns the interval timer.
 * `drawOne` is re-read each render (ref), so it may close over state.
 */
export function useDrawLoop(drawOne: () => void) {
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const draw = useRef(drawOne);
  draw.current = drawOne;

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRunning(false);
  };

  // Unmount cleanup (returns stop as the destructor).
  useEffect(() => stop, []);

  const run = (n: number) => {
    if (timer.current) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (n === 1 || reduced) {
      // Single draw, or the whole batch in one update (sync path).
      for (let i = 0; i < n; i++) draw.current();
      return;
    }
    setRunning(true);
    let i = 0;
    timer.current = setInterval(() => {
      draw.current();
      if (++i >= n) stop();
    }, 30);
  };

  return { running, run, stop };
}
