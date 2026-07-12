/**
 * Multi-slide welcome tour (restored 2026-07, rewritten for the
 * evidence-workbench system — the 2025 product-era tour this shell
 * descends from narrated features that no longer exist).
 *
 * Shown automatically on the first visit (flag in localStorage; the
 * key is versioned so this rewritten tour shows once even to visitors
 * who saw the old one) and re-openable from the TopBar "Tour" button.
 * Esc closes, arrow keys navigate. Copy rules: task language, ≤~60
 * words per slide, one visual each; domain terms carry a TipIcon
 * gloss from lib/glossary.ts. Under VITE_ANON the copy stays fully
 * neutral because it only brands itself via APP_NAME.
 *
 * NOT auto-shown when a ?scenario= boot is active: scenarios exist to
 * reproduce exact figure states and an overlay would cover them.
 */

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, Play, X } from "lucide-react";
import { APP_NAME } from "../lib/anon";
import { gloss } from "../lib/glossary";
import { useApp } from "../lib/store";
import { TipIcon } from "./TipIcon";

const TOUR_FLAG = "quda-tour-seen-v2";

const ORDER = ["what", "compose", "evidence", "compare", "try"] as const;
type Slide = (typeof ORDER)[number];

export function WelcomeTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [slide, setSlide] = useState<Slide>("what");

  // Reset to the first slide every time the tour opens.
  useEffect(() => {
    if (open) setSlide("what");
  }, [open]);

  // Keyboard shortcuts: Esc closes, arrow keys navigate between slides.
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${APP_NAME} welcome tour`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-canvas/85 backdrop-blur-sm"
        onClick={dismiss}
      />
      {/* Card */}
      <div className="relative panel w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close tour"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-md border border-edge bg-surface/80 text-mute hover:text-ink hover:border-edge transition flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 overflow-y-auto">
          {slide === "what" && <WhatSlide />}
          {slide === "compose" && <ComposeSlide />}
          {slide === "evidence" && <EvidenceSlide />}
          {slide === "compare" && <CompareSlide />}
          {slide === "try" && <TrySlide onDone={dismiss} />}
        </div>

        {/* Footer: progress dots + nav */}
        <div className="h-14 shrink-0 border-t border-edge px-4 flex items-center justify-between bg-surface/40">
          <div className="flex items-center gap-1.5">
            {ORDER.map((s, i) => (
              <button
                type="button"
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
              type="button"
              onClick={goPrev}
              disabled={isFirst}
              className="btn disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            {isLast ? (
              <button type="button" onClick={dismiss} className="btn-primary">
                <Play className="w-3.5 h-3.5" /> Get started
              </button>
            ) : (
              <button type="button" onClick={goNext} className="btn-primary">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** First-visit hook: pop the tour on initial load unless already seen
 *  or a ?scenario= boot owns the screen (figure states must not be
 *  covered by an overlay). */
export function useFirstVisitTour(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const scenario = new URLSearchParams(window.location.search).get(
        "scenario",
      );
      if (!scenario && !localStorage.getItem(TOUR_FLAG)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);
  return [open, setOpen];
}

/* ============================== slides =============================== */

/** Shared slide scaffold: kicker + title + ≤60-word body, visual below. */
function SlideShell({
  kicker,
  title,
  children,
  visual,
}: {
  kicker: string;
  title: React.ReactNode;
  children: React.ReactNode;
  visual: React.ReactNode;
}) {
  return (
    <div className="p-6 sm:p-8">
      <div className="text-xs uppercase tracking-wider text-mute mb-1">
        {kicker}
      </div>
      <h2 className="text-xl sm:text-2xl font-semibold text-ink mb-2 leading-tight">
        {title}
      </h2>
      <div className="text-sm text-ink/80 leading-relaxed max-w-xl">
        {children}
      </div>
      <div className="mt-5 flex justify-center">{visual}</div>
    </div>
  );
}

/* tokens for the inline SVGs — all colors via theme variables */
const C = {
  ink: "rgb(var(--color-ink))",
  mute: "rgb(var(--color-mute))",
  edge: "rgb(var(--color-edge))",
  surface: "rgb(var(--color-surfaceAlt))",
  accent: "rgb(var(--color-accent))",
  accent2: "rgb(var(--color-accent2))",
  ok: "rgb(var(--color-ok))",
  warn: "rgb(var(--color-warn))",
};

/** Slide 1 — pipeline → seeded run → archive, as one schematic. */
function WhatSlide() {
  return (
    <SlideShell
      kicker="What this is"
      title={
        <>
          Welcome to <span className="text-accent">{APP_NAME}</span>
        </>
      }
      visual={<WhatSVG />}
    >
      <p>
        Compose quantum pipelines from blocks — then treat every run as an
        experiment, not just output. Each run draws a recorded seed
        <TipIcon className="mx-0.5 align-text-top" hint={gloss("seed")} />,
        is archived in this browser, and replays bit-exactly. Evidence you
        can revisit, compare, and stand behind.
      </p>
    </SlideShell>
  );
}

function WhatSVG() {
  return (
    <svg
      width="440"
      height="96"
      viewBox="0 0 440 96"
      role="img"
      aria-label="Schematic: a pipeline of blocks runs with a recorded seed and lands in a replayable archive"
    >
      {/* pipeline */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={16 + i * 42}
          y={34}
          width={28}
          height={28}
          rx={6}
          fill={C.surface}
          stroke={i === 1 ? C.accent2 : C.edge}
          strokeWidth={1.5}
        />
      ))}
      <line x1={44} y1={48} x2={58} y2={48} stroke={C.mute} strokeWidth={1.5} />
      <line x1={86} y1={48} x2={100} y2={48} stroke={C.mute} strokeWidth={1.5} />
      <text x={30 + 42} y={87} fontSize={10} textAnchor="middle" fill={C.mute}>
        pipeline
      </text>
      {/* arrow to run */}
      <path d="M 150 48 h 34 m 0 0 l -6 -4 m 6 4 l -6 4" stroke={C.mute} strokeWidth={1.5} fill="none" />
      {/* seeded run */}
      <circle cx={222} cy={48} r={17} fill="none" stroke={C.accent} strokeWidth={1.5} />
      <path d="M 217 41 l 12 7 l -12 7 z" fill={C.accent} />
      <text x={222} y={87} fontSize={10} textAnchor="middle" fill={C.mute}>
        run · seed 42
      </text>
      {/* arrow to archive */}
      <path d="M 252 48 h 34 m 0 0 l -6 -4 m 6 4 l -6 4" stroke={C.mute} strokeWidth={1.5} fill="none" />
      {/* archive: stacked cards, one replayable */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={300 + i * 5}
          y={30 + i * 6}
          width={80}
          height={30}
          rx={5}
          fill={C.surface}
          stroke={C.edge}
          strokeWidth={1.2}
        />
      ))}
      <circle cx={322} cy={57} r={4} fill={C.accent} />
      <circle cx={336} cy={57} r={4} fill={C.accent2} />
      <circle cx={350} cy={57} r={3} fill={C.ok} />
      <text x={345} y={87} fontSize={10} textAnchor="middle" fill={C.mute}>
        archived · replayable
      </text>
    </svg>
  );
}

/** Slide 2 — ribbons + node faces. Board-first mental model: authoring
 *  is introduced as entering the Pipeline editor FROM the board to
 *  define one configuration. */
function ComposeSlide() {
  return (
    <SlideShell
      kicker="Define a configuration"
      title="The Pipeline editor is the definition view"
      visual={<ComposeSVG />}
    >
      <p>
        From the Evidence board (home), open the{" "}
        <span className="text-ink font-medium">Pipeline editor</span> to
        define a configuration: drag blocks from the pipeline shelf — its
        columns spell the grammar, Source → Backend → Algorithm → Metric →
        Sink — wire them (or Auto-connect), press{" "}
        <span className="kbd">Run pipeline</span>. Ribbons carry the circuit
        between blocks — a shrinking ribbon means a step compressed it (width
        tracks gate count
        <TipIcon className="mx-0.5 align-text-top" hint={gloss("gates")} />).
        Each block's face shows what it changed (delta strip) and how sure
        the estimate is (interval bar
        <TipIcon className="mx-0.5 align-text-top" hint={gloss("ci")} />).
      </p>
    </SlideShell>
  );
}

function ComposeSVG() {
  return (
    <svg
      width="440"
      height="110"
      viewBox="0 0 440 110"
      role="img"
      aria-label="Two pipeline blocks joined by a ribbon that narrows after a compressing step; the block face shows a delta strip and an interval bar"
    >
      {/* left block */}
      <rect x={20} y={26} width={92} height={56} rx={8} fill={C.surface} stroke={C.edge} strokeWidth={1.5} />
      <text x={66} y={44} fontSize={10} textAnchor="middle" fill={C.ink}>circuit in</text>
      <rect x={32} y={54} width={68} height={6} rx={2} fill={C.edge} />
      {/* tapering ribbon: thick -> thin (the step shrank the circuit) */}
      <path d="M 112 42 C 160 42 180 47 228 47 L 228 61 C 180 61 160 66 112 66 Z" fill={C.ok} opacity={0.35} />
      {/* right block with delta strip + CI bar */}
      <rect x={228} y={26} width={112} height={56} rx={8} fill={C.surface} stroke={C.accent2} strokeWidth={1.5} />
      <text x={284} y={42} fontSize={10} textAnchor="middle" fill={C.ink}>pruning step</text>
      {/* delta strip: bars diverging around a zero axis */}
      <line x1={252} y1={56} x2={316} y2={56} stroke={C.edge} strokeWidth={1} />
      <rect x={258} y={52} width={10} height={4} fill={C.ok} />
      <rect x={274} y={56} width={7} height={4} fill={C.warn} />
      <rect x={292} y={52} width={13} height={4} fill={C.ok} />
      {/* CI bar */}
      <rect x={252} y={68} width={64} height={5} rx={2} fill={C.edge} opacity={0.5} />
      <rect x={270} y={68} width={22} height={5} rx={2} fill={C.accent} opacity={0.65} />
      <line x1={281} y1={66} x2={281} y2={75} stroke={C.accent} strokeWidth={2} />
      <text x={66} y={100} fontSize={10} textAnchor="middle" fill={C.mute}>ribbon = circuit flowing</text>
      <text x={284} y={100} fontSize={10} textAnchor="middle" fill={C.mute}>face = change + certainty</text>
    </svg>
  );
}

/** Slide 3 — scales 1 & 2: steering one run, pooling its replicates. */
function EvidenceSlide() {
  return (
    <SlideShell
      kicker="Scales 1 & 2 — evidence accumulates"
      title="Steer one run, then pool its replicates"
      visual={<EvidenceSVG />}
    >
      <p>
        Inside a run (scale 1), the interval narrows as shot batches
        stream in — the funnel. A precision target
        <TipIcon
          className="mx-0.5 align-text-top"
          hint={gloss("precisionTarget")}
        />{" "}
        — the same knob IBM's Estimator API exposes — turns optional
        stopping into a visual decision. Across ×N replicates
        <TipIcon className="mx-0.5 align-text-top" hint={gloss("replicate")} />{" "}
        (scale 2), <span className="text-ink font-medium">This
        configuration</span> becomes a lineage: hue = configuration
        <TipIcon
          className="mx-0.5 align-text-top"
          hint={gloss("configuration")}
        />
        , dot size = shots
        <TipIcon className="mx-0.5 align-text-top" hint={gloss("shots")} /> of
        evidence.
      </p>
    </SlideShell>
  );
}

function EvidenceSVG() {
  // funnel: intervals narrowing toward a target corridor + lineage dots
  const rows = [
    { w: 150, o: 0.2 },
    { w: 104, o: 0.32 },
    { w: 76, o: 0.45 },
    { w: 58, o: 0.6 },
    { w: 46, o: 0.85 },
  ];
  return (
    <svg
      width="440"
      height="112"
      viewBox="0 0 440 112"
      role="img"
      aria-label="Left: an evidence funnel of stacked intervals narrowing into a target corridor. Right: a run-history lineage of dots colored by configuration and sized by evidence"
    >
      {/* funnel */}
      {rows.map((r, i) => (
        <rect
          key={i}
          x={130 - r.w / 2}
          y={14 + i * 13}
          width={r.w}
          height={5}
          rx={2.5}
          fill={C.accent}
          opacity={r.o}
        />
      ))}
      {/* target corridor */}
      <line x1={130 - 34} y1={8} x2={130 - 34} y2={84} stroke={C.warn} strokeWidth={1.2} strokeDasharray="3 3" />
      <line x1={130 + 34} y1={8} x2={130 + 34} y2={84} stroke={C.warn} strokeWidth={1.2} strokeDasharray="3 3" />
      <text x={130} y={101} fontSize={10} textAnchor="middle" fill={C.mute}>
        funnel narrows → stop at ±2pp
      </text>
      {/* lineage */}
      <line x1={300} y1={12} x2={300} y2={84} stroke={C.edge} strokeWidth={1.5} />
      <circle cx={300} cy={20} r={4} fill={C.accent} />
      <circle cx={300} cy={38} r={6} fill={C.accent} />
      <circle cx={300} cy={58} r={7} fill={C.accent} />
      <circle cx={300} cy={58} r={10.5} fill="none" stroke={C.accent} strokeWidth={1.2} />
      <circle cx={324} cy={78} r={5} fill={C.accent2} />
      <path d="M 324 73 C 324 64 300 70 300 64" fill="none" stroke={C.accent2} strokeWidth={1.2} />
      <text x={310} y={101} fontSize={10} textAnchor="middle" fill={C.mute}>
        lineage: hue = config · size = shots
      </text>
    </svg>
  );
}

/** Slide 4 — scale 3: between configurations (multiverse + honest A/B). */
function CompareSlide() {
  return (
    <SlideShell
      kicker="Scale 3 — between configurations"
      title="Every configuration, side by side"
      visual={<CompareSVG />}
    >
      <p>
        The Evidence board gives each configuration a card: pipeline strip,
        outcome dots, Δ versus the baseline. Pick any two runs for{" "}
        <span className="text-ink font-medium">Between configurations</span> —
        estimates render as 95% intervals
        <TipIcon className="mx-0.5 align-text-top" hint={gloss("ci")} />, and
        the verdict stays honest: overlapping intervals are{" "}
        <span className="text-ink font-medium">not</span> evidence, and the
        difference funnel accumulates the sequential A/B verdict.
      </p>
    </SlideShell>
  );
}

function CompareSVG() {
  return (
    <svg
      width="440"
      height="112"
      viewBox="0 0 440 112"
      role="img"
      aria-label="Left: two Evidence-board cards with outcome dot strips. Right: two overlapping confidence intervals labeled 'overlap is not evidence'"
    >
      {/* two config cards */}
      {[0, 1].map((i) => {
        const y = 14 + i * 44;
        const hue = i === 0 ? C.accent : C.accent2;
        return (
          <g key={i}>
            <rect x={22} y={y} width={168} height={36} rx={6} fill={C.surface} stroke={hue} strokeWidth={1.2} opacity={0.9} />
            {[0, 1, 2, 3].map((j) => (
              <rect key={j} x={32 + j * 14} y={y + 8} width={8} height={8} rx={2} fill={j === 2 && i === 1 ? C.accent2 : C.mute} opacity={0.75} />
            ))}
            <line x1={100} y1={y + 24} x2={180} y2={y + 24} stroke={C.edge} strokeWidth={1} />
            {[0.3, 0.45, 0.55, 0.7].map((v, j) => (
              <circle key={j} cx={100 + v * 80} cy={y + 24} r={2.5} fill={hue} opacity={0.4 + j * 0.18} />
            ))}
          </g>
        );
      })}
      <text x={106} y={106} fontSize={10} textAnchor="middle" fill={C.mute}>
        board: one card per configuration
      </text>
      {/* A/B intervals */}
      <line x1={252} y1={70} x2={420} y2={70} stroke={C.edge} strokeWidth={1} />
      <rect x={274} y={34} width={78} height={7} rx={3.5} fill={C.accent} opacity={0.5} />
      <line x1={313} y1={31} x2={313} y2={44} stroke={C.accent} strokeWidth={2} />
      <rect x={318} y={52} width={78} height={7} rx={3.5} fill={C.warn} opacity={0.5} />
      <line x1={357} y1={49} x2={357} y2={62} stroke={C.warn} strokeWidth={2} />
      <text x={336} y={91} fontSize={10} textAnchor="middle" fill={C.mute}>
        A/B: overlap ≠ evidence
      </text>
    </svg>
  );
}

/** Slide 5 — concrete first moves against the preloaded demo archive. */
function TrySlide({ onDone }: { onDone: () => void }) {
  const setWorkspaceMode = useApp((s) => s.setWorkspaceMode);
  return (
    <SlideShell
      kicker="Try it"
      title="A demo archive is already loaded"
      visual={
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setWorkspaceMode("multiverse");
            onDone();
          }}
        >
          <LayoutGrid className="w-3.5 h-3.5" /> Go to the Evidence board
        </button>
      }
    >
      {/* Honest tense (audit S3): the tour is re-openable — by then
          the user may have cleared the demo data, so this slide must
          not assert the archive is still there. */}
      <p className="mb-2">
        Real seeded runs shipped with your first visit, so the evidence
        views have something to show from minute one. (Cleared the demo
        data? Your own runs fill the same views.) Three good first moves:
      </p>
      <ol className="list-decimal list-inside space-y-1 text-[13px]">
        <li>
          The <span className="text-ink font-medium">Evidence board</span>{" "}
          (home) shows every demo configuration side by side — expand a
          card for its recent runs and quick actions.
        </li>
        <li>
          In{" "}
          <span className="text-ink font-medium">
            Evidence → This configuration
          </span>
          , press ▶ on a run: same seed, same numbers, bit-exact.
        </li>
        <li>
          Set <span className="kbd">target: ±2pp</span> in the toolbar and
          Run — watch the funnel stop early in the Evidence Theater.
        </li>
      </ol>
      <p className="mt-2 text-[11px] text-mute">
        Prefer a guided start? Append <span className="font-mono">?scenario=F0</span>{" "}
        to the URL for the streaming-evidence teaser.
      </p>
    </SlideShell>
  );
}
