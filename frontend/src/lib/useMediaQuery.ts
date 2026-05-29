import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query and re-render when its match state
 * changes. Matches Tailwind breakpoints by convention (e.g. "(min-width:
 * 768px)" is `md:` in Tailwind).
 *
 * SSR-safe: returns `false` on the server. In the browser the initial
 * value reflects the current match synchronously, so the first paint
 * already has the correct layout.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Sync once in case the query changed between render and effect.
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Convenience: matches Tailwind's `md` breakpoint (≥ 768px). */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}

/** True when the user has expressed an OS-level preference for
 *  reduced motion. Reactive to live changes. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** True when the primary pointing device is "coarse" (touch). Used
 *  to distinguish phones / tablets / touch laptops from mouse-only
 *  desktops, independent of viewport width — a 1920px-wide touch
 *  screen is still touch. */
export function useIsTouchDevice(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
