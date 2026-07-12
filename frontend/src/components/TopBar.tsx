import { useCallback, useRef, useState } from "react";
import { useApp } from "../lib/store";
import { Activity, Check, Compass, GraduationCap, PanelLeft, PanelRight, Zap } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "../lib/anon";
import { ClaimsMapButton } from "./ClaimsMap";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { TipIcon } from "./TipIcon";
import { useDismissOn } from "../lib/useDismissOn";
import { areLessonsDone, isLearnLabDone } from "../lib/learnProgress";

/**
 * Top application bar — deliberately minimal since Wave P (the system
 * serves the paper, not a product): app name + tagline, the runtime
 * environment chip (qiskit/torch versions), the live-calibration
 * toggle when the server supports it, the welcome-tour reopener, and
 * the theme switcher. The product-era surfaces (sign-in, lab/paper/
 * developer links, funding popover) stay removed; the tour returned
 * in 2026-07 — with double-blind treatment no longer needed,
 * onboarding affordances are back, rewritten for the
 * evidence-workbench system.
 *
 * Mobile: the two side panes are swapped for drawers, so we surface two
 * edge buttons (PanelLeft / PanelRight) for toggling them.
 */
/** "Learn" — a two-item dropdown (the standard popover idiom:
 *  useDismissOn + right-anchored menu, viewport-pinned below sm like
 *  the ThemeSwitcher). Two tracks, one entry: "Start from zero"
 *  (LearnLab, marker learn-lab) teaches what a qubit even IS on the
 *  toy simulator; "Guided experiments" (LessonCard) runs the real
 *  pipeline. The from-zero track lists first because it is the one a
 *  reader with no background needs first. Completed tracks carry a ✓
 *  (lib/learnProgress flags, re-read every time the menu opens). */
function LearnMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissOn(open, rootRef, useCallback(() => setOpen(false), []));
  // Completion ticks — read on open (localStorage is the source of
  // truth; step 5 / the last lesson write it, possibly this session).
  const zeroDone = open && isLearnLabDone();
  const lessonsDone = open && areLessonsDone();
  const pick = (which: "zero" | "lessons") => {
    const app = useApp.getState();
    if (which === "zero") app.setLearnLabOpen(true);
    else app.setLessonsOpen(true);
    setOpen(false);
  };
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost"
        title="Learn — from zero (what a qubit is) or guided experiments in the real pipeline"
        aria-label="Open learn menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <GraduationCap className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Learn</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Learn"
          className="fixed right-3 top-14 sm:absolute sm:right-0 sm:top-full sm:mt-1 rounded-lg border border-edge bg-surface shadow-xl z-40 p-1.5 flex flex-col gap-0.5 w-[min(19rem,calc(100vw-1.5rem))]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => pick("zero")}
            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-surfaceAlt transition-colors"
          >
            <span className="flex items-center gap-1 text-xs text-ink font-medium">
              Start from zero
              {zeroDone && (
                <Check className="w-3 h-3 text-ok" aria-label="completed" />
              )}
            </span>
            <span className="block text-[10px] text-mute leading-snug">
              What a qubit even is — a ladder of tiny interactives, nothing assumed.
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => pick("lessons")}
            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-surfaceAlt transition-colors"
          >
            <span className="flex items-center gap-1 text-xs text-ink font-medium">
              Guided experiments
              {lessonsDone && (
                <Check className="w-3 h-3 text-ok" aria-label="completed" />
              )}
            </span>
            <span className="block text-[10px] text-mute leading-snug">
              Four micro-experiments in the real pipeline — sampling, noise,
              diffs, seeds.
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar({
  mobile = false,
  onOpenLeftDrawer,
  onOpenRightDrawer,
  onOpenTour,
}: {
  mobile?: boolean;
  onOpenLeftDrawer?: () => void;
  onOpenRightDrawer?: () => void;
  onOpenTour?: () => void;
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
  if (effectiveLive) {
    chipLabel = "live calibration: on";
    chipLabelShort = "live: on";
    chipClass =
      "!border-warn/50 !text-warn cursor-pointer hover:!border-warn hover:!text-warn";
    chipTitle =
      "Live mode ON. Each run fetches today's fresh machine calibration (error rates) instead of the shipped snapshot (+5-15s per run, counts against rate limits). Click to switch back to the snapshot.";
  } else {
    chipLabel = "live calibration: off (snapshot)";
    chipLabelShort = "live: off";
    chipClass =
      "!border-edge !text-mute cursor-pointer hover:!text-ink hover:!border-accent/40";
    chipTitle =
      "Using the shipped 14-day calibration snapshot (the machine's measured error rates). Deterministic and fine for reproduction. Click to fetch fresh calibration per run instead.";
  }

  return (
    <header
      // safe-area padding so the notch / Dynamic Island doesn't
      // occlude the header on iPhones in landscape.
      style={{
        paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right))",
      }}
      // z-40: the ThemeSwitcher dropdown is a CHILD of this header, so its
      // own z-index can never escape the header's stacking context. The
      // center-column overlays (Multiverse z-20, Evidence Theater z-30)
      // come later in the DOM and used to paint OVER the dropdown where
      // it hangs below the bar; z-40 keeps header dropdowns clickable
      // while any overlay is up. Mobile drawers (fixed z-40/z-50, later
      // in the DOM) still cover the header as before.
      className="relative z-40 h-14 shrink-0 border-b border-edge sm:px-5 flex items-center justify-between gap-2 sm:gap-4 bg-canvas"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
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
            {APP_NAME}
          </div>
          <div className="text-mute text-xs hidden sm:block truncate">
            {APP_TAGLINE}
          </div>
        </div>
        {/* Status chips: runtime library versions + whether the live-
            calibration path is hot. The version chip is hidden on
            mobile to save room; the live toggle is only shown when the
            server actually supports live mode. */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs shrink-0 ml-1 sm:ml-2">
          {!mobile && (
            <span className="chip">
              <Activity className="w-3 h-3" />
              {health
                ? `qiskit ${health.qiskit_version} · torch ${health.torch_version}`
                : "loading…"}
            </span>
          )}
          {serverCanGoLive && (
            <button
              type="button"
              onClick={() => setUseLiveIbm(!useLiveIbm)}
              aria-pressed={effectiveLive}
              aria-label="Toggle live IBM calibration"
              className={`chip transition-colors gap-1 ${chipClass}`}
            >
              <span>{mobile ? chipLabelShort : chipLabel}</span>
              <TipIcon hint={chipTitle} size={10} position="below" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 text-xs shrink-0">
        {onOpenTour && (
          <button
            type="button"
            onClick={onOpenTour}
            className="btn-ghost"
            title="Replay the welcome tour — what this system is and how evidence accumulates"
            aria-label="Open welcome tour"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tour</span>
          </button>
        )}
        <LearnMenu />
        <ClaimsMapButton />
        <ThemeSwitcher />
        {mobile && onOpenRightDrawer && (
          <button
            type="button"
            onClick={onOpenRightDrawer}
            aria-label="Open evidence"
            title="Evidence"
            className="w-9 h-9 rounded-md border border-edge bg-surface/60 text-mute hover:text-ink hover:border-accent/40 flex items-center justify-center shrink-0"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
