/**
 * Theme registry + persistence.
 *
 * Theme tokens are defined as CSS variables in index.css under
 * `:root` (light — the default) and `[data-theme="dark"]`. This
 * module is responsible for picking which of those is active at
 * runtime by writing to
 * `document.documentElement.dataset.theme`, and for persisting the
 * user's choice across page loads.
 */

export type ThemeKey = "light" | "dark";

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
    // Migration: the university-branded "gmu" theme was removed
    // (2026-07). A stored "gmu" preference from an earlier visit falls
    // through to the light default — never a broken/unknown attribute.
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function applyTheme(theme: ThemeKey): void {
  if (typeof document === "undefined") return;
  // Light is the :root default, so clear the attribute instead of
  // setting it. Dark lives behind the `data-theme` selector.
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
