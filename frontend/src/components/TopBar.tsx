import { useEffect, useRef, useState } from "react";
import { useApp } from "../lib/store";
import {
  Activity,
  BookOpen,
  CircleUser,
  GraduationCap,
  HelpCircle,
  PanelLeft,
  PanelRight,
  Zap,
} from "lucide-react";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { NODE_CATALOG } from "../lib/nodeCatalog";

/**
 * Top application bar.
 *
 * Desktop: renders the full status strip (qiskit/torch versions, live-IBM
 * toggle, theme switcher, tour button).
 *
 * Mobile: the two side panes are swapped for drawers, so we surface two
 * edge buttons (PanelLeft / PanelRight) for toggling them. The version
 * chip is hidden (noisy on a 390px screen), the live-IBM toggle stays
 * since users may actually want to flip it, and the theme switcher +
 * tour button stay as compact icons.
 */
export function TopBar({
  onOpenTour,
  mobile = false,
  onOpenLeftDrawer,
  onOpenRightDrawer,
}: {
  onOpenTour?: () => void;
  mobile?: boolean;
  onOpenLeftDrawer?: () => void;
  onOpenRightDrawer?: () => void;
}) {
  const health = useApp((s) => s.health);
  const useLiveIbm = useApp((s) => s.useLiveIbm);
  const setUseLiveIbm = useApp((s) => s.setUseLiveIbm);

  // Server can go live only when it has both the IBM token and the admin
  // has flipped ALLOW_LIVE_IBM=true in env. If either is missing we grey
  // the chip out and make it read-only.
  const serverCanGoLive =
    !!health?.live_ibm_allowed && !!health?.ibm_token_configured;
  const effectiveLive = serverCanGoLive && useLiveIbm;

  let chipLabel: string;
  let chipLabelShort: string;
  let chipClass: string;
  let chipTitle: string;
  if (!serverCanGoLive) {
    chipLabel = "live ibm: unavailable";
    chipLabelShort = "ibm: n/a";
    chipClass = "!border-edge !text-mute opacity-70 cursor-not-allowed";
    chipTitle =
      "Server has no IBM Quantum Platform token configured, so QuBound is using the shipped 14-day calibration cache (real IBM Fez data, just not refreshed live). To enable live mode, set IBM_QUANTUM_TOKEN + ALLOW_LIVE_IBM=true in the HF Space secrets.";
  } else if (effectiveLive) {
    chipLabel = "live ibm: on";
    chipLabelShort = "ibm: on";
    chipClass =
      "!border-warn/50 !text-warn cursor-pointer hover:!border-warn hover:!text-warn";
    chipTitle =
      "Live mode ON. QuBound will fetch fresh IBM Quantum Platform calibration on each run (+5-15s per run, counts against rate limits). Click to switch back to cache mode.";
  } else {
    chipLabel = "live ibm: off (using cache)";
    chipLabelShort = "ibm: cache";
    chipClass =
      "!border-edge !text-mute cursor-pointer hover:!text-ink hover:!border-accent/40";
    chipTitle =
      "Using the shipped 14-day IBM Fez calibration cache. This is fine for demos. Click to switch to live mode (fresh IBM calibration per run).";
  }

  return (
    <header className="h-14 shrink-0 border-b border-edge px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4 bg-canvas/60 backdrop-blur">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {mobile && onOpenLeftDrawer && (
          <button
            type="button"
            onClick={onOpenLeftDrawer}
            aria-label="Open pipeline input"
            title="Pipeline input"
            className="w-9 h-9 rounded-md border border-edge bg-surface/60 text-mute hover:text-ink hover:border-accent/40 flex items-center justify-center shrink-0"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center shadow-glow shrink-0">
          <Zap className="w-4 h-4 text-canvas" strokeWidth={2.5} />
        </div>
        <div className="leading-tight min-w-0">
          <div className="text-ink font-semibold tracking-tight truncate">
            JQub Quantum Flow
          </div>
          <div className="text-mute text-xs hidden sm:block truncate">
            Visual pipeline for noise-aware VQC experiments
          </div>
        </div>
        {/* Status chips live in the left cluster — they describe the app's
            runtime state (library versions + whether the live-IBM path is
            hot) and belong next to the title, not mixed in with the
            external-link / theme controls on the right. The version chip
            is hidden on mobile to save room; the IBM chip stays since it
            is interactive. */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs shrink-0 ml-1 sm:ml-2">
          {!mobile && (
            <span className="chip">
              <Activity className="w-3 h-3" />
              {health
                ? `qiskit ${health.qiskit_version} · torch ${health.torch_version}`
                : "loading…"}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (serverCanGoLive) setUseLiveIbm(!useLiveIbm);
            }}
            disabled={!serverCanGoLive}
            aria-pressed={effectiveLive}
            className={`chip transition-colors ${chipClass}`}
            title={chipTitle}
          >
            {mobile ? chipLabelShort : chipLabel}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs shrink-0">
        {/* External-links group: JQub lab, papers, developer. Desktop
            shows icon+label; mobile collapses to icon-only to keep the
            header under ~390px. A subtle vertical divider (desktop only)
            separates the links from the theme/tour controls that follow. */}
        <a
          href="https://jqub.ece.gmu.edu/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          title="JQub Lab at George Mason University"
          aria-label="JQub Lab"
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Lab</span>
        </a>
        <PapersPopover />
        <a
          href="https://theyuchen.github.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          title="Developer: Yuchen Yuan"
          aria-label="Developer homepage"
        >
          <CircleUser className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Developer</span>
        </a>
        <span
          className="hidden sm:inline-block w-px h-5 bg-edge/60 mx-0.5"
          aria-hidden="true"
        />
        <ThemeSwitcher />
        {onOpenTour && (
          <button
            onClick={onOpenTour}
            className="btn-ghost"
            title="Show the intro tour"
            aria-label="Show the intro tour"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tour</span>
          </button>
        )}
        {mobile && onOpenRightDrawer && (
          <button
            type="button"
            onClick={onOpenRightDrawer}
            aria-label="Open results"
            title="Results"
            className="w-9 h-9 rounded-md border border-edge bg-surface/60 text-mute hover:text-ink hover:border-accent/40 flex items-center justify-center shrink-0"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}

/**
 * Popover listing the three algorithm papers. Data is pulled from
 * nodeCatalog so there's a single source of truth: each algorithm block
 * already carries its own paper metadata (title, venue, arxiv URL), and
 * this popover just surfaces all of them at once. Same open/close UX as
 * the other popovers in the app (outside-click + Escape).
 */
function PapersPopover() {
  const [open, setOpen] = useState(false);
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
        // Same positioning strategy as ThemeSwitcher: absolute right-0
        // of the button so the menu tracks with the header cluster, and
        // `w-[min(22rem,100vw-1.5rem)]` caps the width on narrow screens
        // so it can't overflow the viewport's right edge. We do NOT use
        // `position: fixed` here — fixed+z-index creates a new stacking
        // context that can land behind the React Flow canvas in the
        // backdrop-blur header's layer.
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 rounded-lg border border-edge bg-surface shadow-xl z-30 p-2 flex flex-col gap-0.5 w-[min(22rem,calc(100vw-1.5rem))]"
        >
          {papers.map((p) => (
            <a
              key={p.algo}
              role="menuitem"
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-md hover:bg-surfaceAlt transition-colors border border-transparent hover:border-edge/60"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink font-medium">{p.algo}</span>
                <span className="text-[10px] text-mute font-mono shrink-0">
                  {p.venue}
                </span>
              </div>
              <div className="text-[11px] text-mute leading-snug mt-0.5">
                {p.title}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
