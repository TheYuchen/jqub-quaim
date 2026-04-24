/**
 * Theme registry + persistence.
 *
 * Theme tokens are defined as CSS variables in index.css under
 * `:root` (dark), `[data-theme="light"]`, and `[data-theme="gmu"]`.
 * This module is responsible for picking which of those is active
 * at runtime by writing to `document.documentElement.dataset.theme`,
 * and for persisting the user's choice across page loads.
 */

export type ThemeKey = "dark" | "light" | "gmu";

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
    key: "dark",
    label: "Midnight",
    tagline: "Deep navy · electric cyan",
    swatch: ["#0b1020", "#4cc9f0"],
  },
  {
    key: "light",
    label: "Light",
    tagline: "White background · soft accents",
    swatch: ["#f6f7fb", "#0284c7"],
  },
  {
    key: "gmu",
    label: "GMU Mason",
    tagline: "Mason green · Mason gold",
    swatch: ["#0a1812", "#FFC72C"],
  },
];

export const THEME_BY_KEY: Record<ThemeKey, ThemeSpec> = Object.fromEntries(
  THEMES.map((t) => [t.key, t]),
) as Record<ThemeKey, ThemeSpec>;

export const DEFAULT_THEME: ThemeKey = "dark";
const LS_THEME = "jqub.theme";

export function loadStoredTheme(): ThemeKey {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(LS_THEME);
    if (raw && (raw === "dark" || raw === "light" || raw === "gmu")) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function applyTheme(theme: ThemeKey): void {
  if (typeof document === "undefined") return;
  // Dark is the :root default, so clear the attribute instead of setting
  // it. Avoids an extra CSS selector lookup and keeps inspector clean.
  if (theme === "dark") {
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
