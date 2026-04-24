import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, Copy } from "lucide-react";
import { NODE_CATALOG } from "../lib/nodeCatalog";
import { copyToClipboard } from "../lib/clipboard";

/**
 * Popover listing the algorithm papers. Data is pulled from nodeCatalog
 * so there's a single source of truth: each algorithm block already
 * carries its own paper metadata (title, venue, arxiv URL), and this
 * popover just surfaces all of them at once. Same open/close UX as the
 * other popovers in the app (outside-click + Escape).
 */
export function PapersPopover() {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const papers = NODE_CATALOG.filter((n) => n.paper).map((n) => ({
    algo: n.label,
    ...(n.paper as NonNullable<(typeof n)["paper"]>),
  }));

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

  // Copy a BibTeX entry to the clipboard and briefly flash a "copied" tick.
  // `copyToClipboard` handles the navigator.clipboard → textarea fallback.
  const copyBibtex = async (bibtex: string, algo: string) => {
    const ok = await copyToClipboard(bibtex);
    if (!ok) return; // silently ignore — the user can still click the arxiv link
    setCopiedKey(algo);
    window.setTimeout(() => {
      setCopiedKey((k) => (k === algo ? null : k));
    }, 1500);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost"
        title="Papers behind each algorithm block"
        aria-label="Papers"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Papers</span>
      </button>
      {open && (
        // Mobile (<sm): Papers button sits mid-header, so anchoring
        // `absolute right-0` to the button pushes the 22rem popover
        // off-screen on the left. Pin the popover to the viewport's
        // right edge with `fixed right-3 top-14` so it always stays
        // visible. The header itself is `z-20`, so a `fixed` child
        // with z-index stacks above the canvas without trouble.
        //
        // Desktop (≥sm): back to anchor-to-button behaviour so the
        // popover tracks with the Papers button in the header cluster.
        <div
          role="menu"
          className="fixed right-3 top-14 sm:absolute sm:right-0 sm:top-full sm:mt-1 rounded-lg border border-edge bg-surface shadow-xl z-30 p-2 flex flex-col gap-0.5 w-[min(22rem,calc(100vw-1.5rem))]"
        >
          {papers.map((p) => {
            const copied = copiedKey === p.algo;
            return (
              <div
                key={p.algo}
                className="flex items-stretch rounded-md hover:bg-surfaceAlt transition-colors border border-transparent hover:border-edge/60"
              >
                <a
                  role="menuitem"
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex-1 min-w-0 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink font-medium">
                      {p.algo}
                    </span>
                    <span className="text-[10px] text-mute font-mono shrink-0">
                      {p.venue}
                    </span>
                  </div>
                  <div className="text-[11px] text-mute leading-snug mt-0.5">
                    {p.title}
                  </div>
                </a>
                <button
                  type="button"
                  onClick={(e) => {
                    // Don't let the click bubble up & trigger the row's
                    // anchor-navigation. User's intent here is "copy",
                    // not "open arxiv".
                    e.stopPropagation();
                    copyBibtex(p.bibtex, p.algo);
                  }}
                  className="shrink-0 px-2.5 flex items-center justify-center text-mute hover:text-ink border-l border-edge/40 transition-colors"
                  title={copied ? "Copied!" : "Copy BibTeX"}
                  aria-label={`Copy BibTeX for ${p.algo}`}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-ok" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
