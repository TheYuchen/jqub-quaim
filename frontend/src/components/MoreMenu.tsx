import { useEffect, useRef, useState } from "react";
import {
  Link as LinkIcon,
  MoreHorizontal,
  Trash2,
  Wand2,
} from "lucide-react";

/**
 * Mobile-only overflow menu for the canvas toolbar.
 *
 * Bundles Auto-connect / Share / Clear into a single "⋮" dropdown so
 * narrow viewports (< md, i.e. <768px) keep the toolbar to three visible
 * controls (Load preset, More, Run pipeline) instead of five. Desktop
 * renders each action as its own toolbar button and hides this
 * component entirely via `md:hidden` on the wrapper `className`.
 *
 * The component closes itself on:
 *   - outside click
 *   - Escape keypress
 *   - viewport growing past `md` (i.e. the menu's wrapper flips to
 *     `display:none`; without this guard the React `open` state would
 *     silently stay `true` and the menu would pop back open if the
 *     user shrinks the viewport again)
 */
export function MoreMenu({
  className = "",
  canAutoConnect,
  hasEdgesToReplace,
  canClear,
  onAutoConnect,
  onShare,
  onClear,
}: {
  className?: string;
  canAutoConnect: boolean;
  hasEdgesToReplace: boolean;
  canClear: boolean;
  onAutoConnect: () => void;
  onShare: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Outside-click / Escape handlers.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as globalThis.Node)) setOpen(false);
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

  // Responsive guard: if the viewport grows past the `md` breakpoint
  // while the menu is open, the wrapper becomes `display:none` but the
  // React `open` state is unchanged. Resizing back to mobile would then
  // re-reveal the menu in an "open" state the user never asked for.
  // `matchMedia` fires the moment the breakpoint is crossed so we can
  // close the menu eagerly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const items: {
    key: string;
    icon: React.ReactNode;
    label: string;
    sub?: string;
    disabled?: boolean;
    tone?: "default" | "danger";
    onClick: () => void;
  }[] = [
    {
      key: "auto",
      icon: <Wand2 className="w-4 h-4" />,
      label: "Auto-connect",
      sub: hasEdgesToReplace
        ? "Re-wire all blocks (replaces existing links)"
        : "Wire all blocks into a sensible chain",
      disabled: !canAutoConnect,
      onClick: onAutoConnect,
    },
    {
      key: "share",
      icon: <LinkIcon className="w-4 h-4" />,
      label: "Copy share link",
      sub: "Copies a URL that restores this pipeline",
      onClick: onShare,
    },
    {
      key: "clear",
      icon: <Trash2 className="w-4 h-4" />,
      label: "Clear canvas",
      sub: "Remove every block and link",
      disabled: !canClear,
      tone: "danger",
      onClick: onClear,
    },
  ];

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn"
        title="More actions"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 rounded-lg border border-edge bg-surface shadow-xl z-30 p-1.5 flex flex-col gap-0.5 w-[min(18rem,calc(100vw-1.5rem))]"
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                if (it.disabled) return;
                it.onClick();
                setOpen(false);
              }}
              className={`flex items-start gap-3 px-3 py-2 rounded-md text-left transition-colors border border-transparent disabled:opacity-40 disabled:cursor-not-allowed ${
                it.tone === "danger"
                  ? "hover:bg-danger/10 hover:border-danger/40 text-ink"
                  : "hover:bg-surfaceAlt hover:border-edge/60 text-ink"
              }`}
            >
              <span
                className={`shrink-0 mt-0.5 ${
                  it.tone === "danger" ? "text-danger" : "text-mute"
                }`}
              >
                {it.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{it.label}</span>
                {it.sub && (
                  <span className="block text-[11px] text-mute leading-snug mt-0.5">
                    {it.sub}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
