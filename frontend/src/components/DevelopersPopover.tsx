import { useEffect, useRef, useState } from "react";
import { CircleUser, ExternalLink } from "lucide-react";

/**
 * Popover listing the people behind the app.
 *
 * Kept as a small dropdown (rather than two separate top-bar links)
 * because the TopBar already has four external-link buttons (JQub Lab,
 * Papers, Theme, Tour) and we don't want a fifth row of clutter.
 *
 * Same open/close UX as the Papers popover (outside-click + Escape)
 * and the same mobile-vs-desktop anchoring: fixed to the viewport on
 * narrow screens (so the popover never slides off the edge), anchored
 * to the button on ≥sm.
 */

interface Person {
  name: string;
  /** Where the "open" click takes the user (primary link). */
  url: string;
  /** Domain/platform label shown as a right-aligned footer chip. */
  linkLabel: string;
  /** Optional second link shown as a small chip alongside the first. */
  secondaryUrl?: string;
  secondaryLabel?: string;
}

const PEOPLE: Person[] = [
  {
    name: "Yuchen Yuan",
    url: "https://theyuchen.github.io/",
    linkLabel: "theyuchen.github.io",
    secondaryUrl: "https://www.linkedin.com/in/yuchen-ethan-yuan-851130378/",
    secondaryLabel: "LinkedIn",
  },
  {
    name: "Jovin Antony Maria",
    url: "https://www.linkedin.com/in/jovin-antony-maria-987262348/",
    linkLabel: "LinkedIn",
  },
];

export function DevelopersPopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
        title="People behind the app"
        aria-label="Developers"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CircleUser className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Developers</span>
      </button>
      {open && (
        // Mobile (<sm): pin to viewport top-right so a narrow screen
        // never pushes the popover off the left edge. Desktop (≥sm):
        // anchor to the Developer button. Same pattern as PapersPopover.
        <div
          role="menu"
          className="fixed right-3 top-14 sm:absolute sm:right-0 sm:top-full sm:mt-1 rounded-lg border border-edge bg-surface shadow-xl z-40 p-2 flex flex-col gap-0.5 w-[min(20rem,calc(100vw-1.5rem))]"
        >
          {PEOPLE.map((p) => (
            // Two-row layout when there are multiple links: name on top
            // (full width, no truncation), chips below. Single-link
            // people still look natural because the chip row collapses
            // to one entry. This avoids the bug where a long name +
            // two chips squeezed the name down to its first letter.
            <div
              key={p.name}
              role="menuitem"
              className="px-3 py-2 rounded-md hover:bg-surfaceAlt transition-colors border border-transparent hover:border-edge/60 flex items-start gap-3"
            >
              <CircleUser className="w-4 h-4 text-mute shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-sm text-ink font-medium truncate">
                  {p.name}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-1 text-[10px] text-mute hover:text-ink font-mono px-1.5 py-0.5 rounded border border-edge/40 hover:border-edge"
                    title={`Open ${p.linkLabel} for ${p.name}`}
                  >
                    {p.linkLabel}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {p.secondaryUrl && p.secondaryLabel && (
                    <a
                      href={p.secondaryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-1 text-[10px] text-mute hover:text-ink font-mono px-1.5 py-0.5 rounded border border-edge/40 hover:border-edge"
                      title={`Open ${p.secondaryLabel} for ${p.name}`}
                    >
                      {p.secondaryLabel}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
