import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import {
  THEMES,
  applyTheme,
  loadStoredTheme,
  storeTheme,
  type ThemeKey,
} from "../lib/theme";

/**
 * TopBar theme switcher.
 *
 * - Applies the stored theme on mount (before first paint the attribute is
 *   already set by the pre-hydration inline script in index.html, so this
 *   effect is only a no-op reconcile in the happy path).
 * - Dropdown lists all registered themes with a preview swatch and
 *   tagline; selection immediately flips the `<html data-theme>` attribute
 *   and persists to localStorage.
 */
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeKey>(() => loadStoredTheme());
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep DOM in sync with React state — covers both the initial mount
  // (in case the pre-hydration script is missing) and any later change.
  useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
  }, [theme]);

  // Close the menu on outside-click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as globalThis.Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost"
        title="Switch color theme"
        aria-label="Switch color theme"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Palette className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Theme</span>
      </button>
      {open && (
        // On mobile (<md) the Theme button sits near the middle of the
        // header, so a right-anchored 230px dropdown ends up straddling the
        // palette strip and clips the longest tagline ("print-ready").
        // Anchor right-0 on both sizes (button is right-of-center), but size
        // the popover to viewport width minus a small margin on mobile so
        // long taglines don't truncate.
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 rounded-lg border border-edge bg-surface shadow-xl z-50 p-2 flex flex-col gap-1 w-[min(17rem,calc(100vw-1.5rem))]"
        >
          {/* w- is viewport-aware: 17rem (272px) on wide screens, else
              capped at viewport minus 24px so it stays flush with the
              right edge and never overruns the left edge of the screen. */}
          {THEMES.map((t) => {
            const active = t.key === theme;
            return (
              <button
                key={t.key}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(t.key);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                  active
                    ? "bg-surfaceAlt border border-accent/40"
                    : "border border-transparent hover:bg-surfaceAlt hover:border-edge/60"
                }`}
              >
                <span
                  className="shrink-0 inline-flex rounded-md overflow-hidden border border-edge/60"
                  aria-hidden="true"
                >
                  <span
                    className="w-3 h-5"
                    style={{ background: t.swatch[0] }}
                  />
                  <span
                    className="w-3 h-5"
                    style={{ background: t.swatch[1] }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink leading-tight">
                    {t.label}
                  </span>
                  <span className="block text-[11px] text-mute leading-tight truncate">
                    {t.tagline}
                  </span>
                </span>
                {active && (
                  <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
