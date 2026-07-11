import { useCallback, useRef, useState } from "react";
import {
  Code2,
  Link as LinkIcon,
  MoreHorizontal,
  Trash2,
  Wand2,
} from "lucide-react";
import { useDismissOn } from "../lib/useDismissOn";

/**
 * Overflow menu for the canvas toolbar's AUTHORING cluster — rendered
 * at EVERY width since the authoring-vs-evidence cluster split.
 *
 * Contents by width:
 *   * always: Share + Export .py — rarely-used authoring actions,
 *     demoted out of permanent chrome but one click away;
 *   * < md only: Auto-connect + Clear join the menu (their standalone
 *     toolbar buttons are md-gated), keeping the phone toolbar to
 *     three visible controls. The rows carry `md:hidden` so exactly
 *     one reachable copy of each action exists at any width.
 *
 * Closes itself on outside click and Escape (useDismissOn).
 */
export function MoreMenu({
  className = "",
  canAutoConnect,
  hasEdgesToReplace,
  canClear,
  canExport,
  onAutoConnect,
  onShare,
  onExport,
  onClear,
}: {
  className?: string;
  canAutoConnect: boolean;
  hasEdgesToReplace: boolean;
  canClear: boolean;
  canExport: boolean;
  onAutoConnect: () => void;
  onShare: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useDismissOn(open, rootRef, useCallback(() => setOpen(false), []));

  const items: {
    key: string;
    icon: React.ReactNode;
    label: string;
    sub?: string;
    disabled?: boolean;
    tone?: "default" | "danger";
    /** true = this action has its own toolbar button at ≥md, so its
     *  menu row hides there (md:hidden) — one reachable copy only. */
    mobileOnly?: boolean;
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
      mobileOnly: true,
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
      key: "export",
      icon: <Code2 className="w-4 h-4" />,
      label: "Export .py",
      sub: "Download pipeline as a Python script",
      disabled: !canExport,
      onClick: onExport,
    },
    {
      key: "clear",
      icon: <Trash2 className="w-4 h-4" />,
      label: "Clear canvas",
      sub: "Remove every block and link",
      disabled: !canClear,
      tone: "danger",
      mobileOnly: true,
      onClick: onClear,
    },
  ];

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        // h-8: the canvas toolbar's uniform control height.
        className="btn h-8"
        title="More actions"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        // Mobile (<sm): viewport-pinned (canvas toolbar can scroll
        // horizontally on tiny screens, so an absolute-anchored menu
        // could end up off-edge).
        // Desktop (≥sm): anchored to the button.
        <div
          role="menu"
          className="fixed right-3 top-24 sm:absolute sm:right-0 sm:top-full sm:mt-1 rounded-lg border border-edge bg-surface shadow-xl z-30 p-1.5 flex flex-col gap-0.5 w-[min(18rem,calc(100vw-1.5rem))]"
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
              className={`${it.mobileOnly ? "md:hidden " : ""}flex items-start gap-3 px-3 py-2 rounded-md text-left transition-colors border border-transparent disabled:opacity-40 disabled:cursor-not-allowed ${
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
