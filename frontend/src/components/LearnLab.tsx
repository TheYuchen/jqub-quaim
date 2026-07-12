import { useEffect, useState, type ComponentType } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { markLearnLabDone } from "../lib/learnProgress";
import { useApp } from "../lib/store";
import { Step0Lean } from "./learn/Step0Lean";
import { Step1Measure } from "./learn/Step1Measure";
import { Step2Gates } from "./learn/Step2Gates";
import { Step3Phase } from "./learn/Step3Phase";
import { Step4Interference } from "./learn/Step4Interference";
import { Step3Bell } from "./learn/Step3Bell";
import { Step6Scale } from "./learn/Step6Scale";
import { Step7Deutsch } from "./learn/Step7Deutsch";
import { Step4Noise } from "./learn/Step4Noise";
import { Step5Certainty } from "./learn/Step5Certainty";

/**
 * Learn from zero (marker: learn-lab) — the beginner track that sits
 * BEFORE the guided lessons (LessonCard/lib/lessons.ts): a ten-step
 * ladder of tiny interactives assuming nothing, not even what a
 * qubit is. Unlike
 * the lessons, this track never touches the real pipeline; everything
 * runs on lib/quantumToy.ts (exact toy simulator, seeded rng), so
 * every interaction is instant, offline and honest — see the honesty
 * stance in that module's header.
 *
 * Overlay contract: full center-column overlay, the same pattern as
 * MultiverseBoard/EvidenceTheater (absolute inset-0 inside <main>,
 * mounted in App.tsx at z-30); canvas/board stay mounted underneath.
 * Own header (title · step k of N, prev/next, progress dots, ×);
 * position persists per device in localStorage quda.learnLabStep.
 *
 * Copy rules, every step: ONE bold idea sentence (≤15 words), ONE
 * guiding line (≤25 words), then the interactive. Task language, no
 * formulas, percentages only; glossary TipIcons where a quantum term
 * first appears (qubit → frame step 1, measurement → 2, shots/gates/
 * amplitude → 3, phase → 4, interference → 5, entanglement → 6,
 * noise/fidelity → 9, interval → 10, 1-based as displayed).
 *
 * NOTE ON NAMES: step component FILES keep their original stage
 * names (Step3Bell was written when Bell was the fourth step); the
 * frame's STEPS array below is the only source of ORDER. Part B
 * settled the ladder at ten: lean / measure / gates / phase /
 * interference (Step4Interference, NEW) / Bell (moved, unchanged) /
 * scale (Step6Scale, NEW, marker learn-scale) / Deutsch
 * (Step7Deutsch, NEW) / noise / certainty — quda.learnLabStep
 * stores a plain index and loadStep clamps to STEPS.length, so old
 * stored positions stay valid (they may point a few steps earlier
 * than where the reader left off, which is harmless).
 *
 * Later steps (marker learn-complete lives in the last step): the
 * Bell pair with a break-the-link contrast (Step3Bell), readout
 * noise + the agreement score (Step4Noise), and how-many-looks with
 * live wilson95 intervals in the theater's funnel grammar
 * (Step5Certainty). The last step completes the track:
 * quda.learnLabDone is set (TopBar shows a ✓) and the handoff either
 * opens the guided lessons directly on L1 (store bridge
 * pendingLessonKey) or closes.
 */
const STEP_LS = "quda.learnLabStep";

interface StepProps {
  /** The lean is owned here so step 0's dial position IS step 1's. */
  lean: number;
  setLean: (p: number) => void;
  /** Frame navigation, for cross-link chips (the scale step points
   *  back at interference and ahead at Deutsch). Plain index. */
  goToStep?: (i: number) => void;
}

interface LearnStep {
  title: string;
  /** ONE idea sentence — bold, ≤15 words. */
  idea: string;
  /** ONE guiding line — ≤25 words, task language. */
  guide: string;
  Comp: ComponentType<StepProps>;
}

const STEPS: LearnStep[] = [
  {
    title: "A bit that can lean",
    idea: "A qubit is a bit that can lean between 0 and 1 — until you look.",
    guide:
      "Click the switch — it only snaps. Then drag the needle anywhere in between: that in-between is the whole trick.",
    Comp: Step0Lean,
  },
  {
    title: "Looking collapses the lean",
    idea: "You never see the lean itself — only 0s and 1s, drawn with its odds.",
    guide:
      "Set a lean, then measure — once, twenty times, a hundred; each look preps a fresh qubit. Watch the tally creep toward the lean.",
    Comp: Step1Measure,
  },
  {
    title: "Gates steer the lean",
    idea: "A circuit is choreography: gates steer, measurement finally asks.",
    guide:
      "Stack X, H and Z gates on the wire and watch the needle at the end. Try H twice — then H, Z, H.",
    Comp: Step2Gates,
  },
  {
    title: "The hidden direction",
    idea: "Two states can measure the same — a hidden direction still tells them apart.",
    guide:
      "Measure both circles a hundred times — twin tallies. Then apply H to both and watch them split, with certainty.",
    Comp: Step3Phase,
  },
  {
    title: "Waves that cancel",
    idea: "Quantum adds arrows, not odds — arrows can point against each other and cancel.",
    guide:
      "Step through the story with ‹ › — then flip the hidden sign: choreograph the cancelling and only wrong answers disappear.",
    Comp: Step4Interference,
  },
  {
    title: "Two qubits, one fate",
    idea: "Linked qubits answer together — see one, know the other.",
    guide:
      "Measure the pre-wired pair: both needles always land on the same side. Then break the link and watch all four cells fill.",
    Comp: Step3Bell,
  },
  {
    title: "Every qubit doubles the arrows",
    idea: "Each new qubit doubles the arrows a classical computer must track.",
    guide:
      "Slide the count up and the wall doubles; slide it down and it halves — then see how few bits one look returns.",
    Comp: Step6Scale,
  },
  {
    title: "One question instead of two",
    idea: "One quantum question settles what classically takes two — structure made the difference.",
    guide:
      "Play the classical round first — two questions, no shortcut. Then run the one quantum question and replay it: certainty, not luck.",
    Comp: Step7Deutsch,
  },
  {
    title: "Real machines misread",
    idea: "Noise makes machines misread — fidelity is the honesty score.",
    guide:
      "Measure on the perfect machine, then switch to the noisy one — watch 01 and 10 leak in. Slide the noise to feel the dose.",
    Comp: Step4Noise,
  },
  {
    title: "How many looks is enough?",
    idea: "More looks buy narrower certainty — buy only what you need.",
    guide:
      "Buy looks in batches of 50 and watch the band narrow — or let auto-stop call it at ±2 points.",
    Comp: Step5Certainty,
  },
];

function loadStep(): number {
  try {
    const n = Number(localStorage.getItem(STEP_LS));
    return Number.isInteger(n) && n >= 0 && n < STEPS.length ? n : 0;
  } catch {
    return 0;
  }
}

export function LearnLab() {
  const setOpen = useApp((s) => s.setLearnLabOpen);
  const [step, setStep] = useState<number>(loadStep);
  const [lean, setLean] = useState(0.7);

  useEffect(() => {
    try {
      localStorage.setItem(STEP_LS, String(step));
    } catch {
      /* private mode — session-scoped progress is fine */
    }
  }, [step]);

  // Escape dismisses, like every other transient surface.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const cur = STEPS[step];
  const Comp = cur.Comp;

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-canvas"
      role="dialog"
      aria-label="Learn the basics, from zero"
      data-marker="learn-lab"
    >
      {/* header — h-12, mirrors the board header idiom */}
      <div className="h-12 shrink-0 border-b border-edge px-3 sm:px-4 flex items-center gap-2 sm:gap-3">
        <Sparkles className="w-4 h-4 text-accent shrink-0" />
        <div className="text-xs text-mute truncate">
          <span className="text-ink font-medium">Learn the basics</span>
          <span> · step {step + 1} of {STEPS.length}</span>
        </div>
        {/* progress dots — visited ≤ current reads filled */}
        <div className="flex items-center gap-1.5 mx-auto" role="tablist" aria-label="Steps">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`Step ${i + 1}: ${s.title}`}
              title={s.title}
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step
                  ? "bg-accent"
                  : i < step
                    ? "bg-accent/40 hover:bg-accent/70"
                    : "bg-edge hover:bg-accent/40"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn-ghost !px-1.5 disabled:opacity-30"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          aria-label="Previous step"
          title="Previous step"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="btn-ghost !px-1.5 disabled:opacity-30"
          disabled={step === STEPS.length - 1}
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          aria-label="Next step"
          title="Next step"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="btn-ghost !px-1.5"
          onClick={() => setOpen(false)}
          aria-label="Close learn overlay"
          title="Close (progress is remembered)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* body — one idea, one guide, one interactive */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <div className="text-xs uppercase tracking-wider text-mute">
            {cur.title}
          </div>
          <p className="mt-1.5 text-sm font-semibold text-ink leading-snug">
            {cur.idea}
          </p>
          <p className="mt-1 text-sm text-mute leading-snug">{cur.guide}</p>
          <div className="mt-5">
            <Comp lean={lean} setLean={setLean} goToStep={setStep} />
          </div>
          <div className="mt-6 flex justify-end">
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="btn text-xs"
                onClick={() => setStep((s) => s + 1)}
              >
                Next: {STEPS[step + 1].title}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                className="btn text-xs"
                onClick={() => {
                  // Reaching the last step and leaving through this
                  // button counts as completing the track too.
                  markLearnLabDone();
                  setOpen(false);
                }}
              >
                Done — back to the workbench
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
