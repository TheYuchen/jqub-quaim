/**
 * Multi-slide onboarding overlay.
 *
 * Shown automatically on the first visit (flag persisted in localStorage)
 * and re-openable via the help button in the TopBar. Each slide lives in
 * its own file under `./tour/`; this module owns the modal shell, slide
 * sequencing, and the first-visit hook.
 */

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { WelcomeSlide } from "./tour/WelcomeSlide";
import { AlgorithmsSlide } from "./tour/AlgorithmsSlide";
import { PipelineSlide } from "./tour/PipelineSlide";
import { TrySlide } from "./tour/TrySlide";

const TOUR_FLAG = "jqub-tour-seen-v1";

type Slide = "welcome" | "algorithms" | "pipeline" | "try";
const ORDER: Slide[] = ["welcome", "algorithms", "pipeline", "try"];

export function WelcomeTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [slide, setSlide] = useState<Slide>("welcome");

  // Reset to the first slide every time the tour opens.
  useEffect(() => {
    if (open) setSlide("welcome");
  }, [open]);

  // Keyboard shortcuts: Esc closes, arrow keys navigate between slides.
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slide]);

  if (!open) return null;

  const idx = ORDER.indexOf(slide);
  const isFirst = idx === 0;
  const isLast = idx === ORDER.length - 1;
  function goNext() {
    if (!isLast) setSlide(ORDER[idx + 1]);
  }
  function goPrev() {
    if (!isFirst) setSlide(ORDER[idx - 1]);
  }
  function dismiss() {
    try {
      localStorage.setItem(TOUR_FLAG, "1");
    } catch {
      /* ignore */
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-canvas/85 backdrop-blur-sm"
        onClick={dismiss}
      />
      {/* Card */}
      <div className="relative panel w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-md border border-edge bg-surface/80 text-mute hover:text-ink hover:border-edge transition flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 overflow-y-auto">
          {slide === "welcome" && <WelcomeSlide />}
          {slide === "algorithms" && <AlgorithmsSlide />}
          {slide === "pipeline" && <PipelineSlide />}
          {slide === "try" && <TrySlide />}
        </div>

        {/* Footer: progress dots + nav */}
        <div className="h-14 shrink-0 border-t border-edge px-4 flex items-center justify-between bg-surface/40">
          <div className="flex items-center gap-1.5">
            {ORDER.map((s, i) => (
              <button
                key={s}
                onClick={() => setSlide(s)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  s === slide ? "w-8 bg-accent" : "w-2 bg-edge hover:bg-mute"
                }`}
              />
            ))}
            <span className="ml-3 text-[11px] text-mute font-mono">
              {idx + 1} / {ORDER.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              disabled={isFirst}
              className="btn disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            {isLast ? (
              <button onClick={dismiss} className="btn-primary">
                <Play className="w-3.5 h-3.5" /> Get started
              </button>
            ) : (
              <button onClick={goNext} className="btn-primary">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** First-visit hook: pop the tour on initial load unless already seen. */
export function useFirstVisitTour(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_FLAG)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);
  return [open, setOpen];
}
