/**
 * Theme registry + persistence.
 *
 * Theme tokens are defined as CSS variables in index.css under
 * `:root` (light — the default), `[data-theme="dark"]`, and
 * `[data-theme="gmu"]`. This module is responsible for picking which of
 * those is active at runtime by writing to
 * `document.documentElement.dataset.theme`, and for persisting the
 * user's choice across page loads.
 */

import { ANON } from "./anon";

export type ThemeKey = "light" | "dark" | "gmu";

export interface ThemeSpec {
  key: ThemeKey;
  label: string;
  /** One-line tagline shown in the switcher menu. */
  tagline: string;
  /** Two sample swatches shown as a preview chip. */
  swatch: [string, string];
}

export const THEMES: ThemeSpec[] = [
  {
    key: "light",
    label: "Light",
    tagline: "White background · soft accents",
    swatch: ["#f6f7fb", "#0284c7"],
  },
  {
    key: "dark",
    label: "Midnight",
    tagline: "Deep navy · electric cyan",
    swatch: ["#0b1020", "#4cc9f0"],
  },
  // The university-branded theme identifies the group, so it is gated
  // behind the double-anonymous flag. Spread-of-ternary on the
  // build-time constant → the branded strings are dead-code-eliminated
  // from a VITE_ANON=1 bundle entirely; the runtime flag hides the
  // entry (and the stored preference falls back to light below).
  ...(ANON
    ? []
    : ([
        {
          key: "gmu",
          label: "GMU Mason",
          tagline: "Mason green · Mason gold",
          swatch: ["#0a1812", "#FFC72C"],
        },
      ] as ThemeSpec[])),
];

export const THEME_BY_KEY: Record<ThemeKey, ThemeSpec> = Object.fromEntries(
  THEMES.map((t) => [t.key, t]),
) as Record<ThemeKey, ThemeSpec>;

export const DEFAULT_THEME: ThemeKey = "light";
const LS_THEME = "quda.theme";

export function loadStoredTheme(): ThemeKey {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(LS_THEME);
    if (raw === "dark" || raw === "light") return raw;
    // The branded theme key is only honoured OUTSIDE anonymous mode.
    // Gated behind `!ANON &&` so that (a) a runtime ?anon=1 session
    // falls back to light instead of rendering university colors, and
    // (b) a VITE_ANON=1 build constant-folds ANON to true and the
    // minifier dead-code-eliminates the key literal — anonymous JS
    // must not even MENTION the branded theme key (M3 audit fix).
    if (!ANON && raw === "gmu") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function applyTheme(theme: ThemeKey): void {
  if (typeof document === "undefined") return;
  // Light is the :root default, so clear the attribute instead of
  // setting it. Dark and GMU live behind `data-theme` selectors.
  if (theme === "light") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

export function storeTheme(theme: ThemeKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_THEME, theme);
  } catch {
    /* ignore quota / disabled storage */
  }
}
