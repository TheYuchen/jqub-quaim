// Guided experiments — four beginner micro-lessons that ride the SAME
// machinery scenario boots use (lib/scenarios.ts): each step is pushed
// through the pendingRestore bridge with autoRunAfter, and the run is
// tagged with the lesson key via the existing RunRecord.scenario field
// so lesson runs NEVER pollute evidence pools (the theater's
// prior-evidence filter and the F6/F7/F8 pickers all exclude
// scenario-tagged records — see the comments at those filters).
//
// Lessons are integrated, not a separate mode: the LessonCard overlay
// (components/LessonCard.tsx) floats bottom-right over whichever view
// the step drove the app into, asks one question, runs one pipeline,
// then points at what the just-produced evidence shows. Numbers cited
// below are grounded the same way scenarios are:
//   * L1 — bell_state's sampled point sits near 0.49 on FakeFez
//     (ideal |00⟩ probability 0.5; see F0/F3 notes); at 128 shots the
//     Wilson interval is ±8-9pp wide, at 4096 it tightens to ~±1.5pp.
//   * L2 — vqc_2q_small with unbound params bound to zero is RY(0)+CX
//     on |00⟩, i.e. identity in effect: statevector fidelity is
//     EXACTLY 1.0 (⟨00|U|00⟩ = 1). Sampled on FakeFez it lands ~0.97
//     (the bundled demo's QuCAD-bound twin measured 0.9746) — the gap
//     is the noise cost, and the interval clearly excludes 1.0.
//   * L3 — the exact QUCAD_GRAPH + pinned seed 336157917 of demo
//     record 5c2a6a71a7a4 (also scenarios F1/F5): its gate diff shows,
//     per qubit lane, ry(θ) removed and a near-zero fixed angle added
//     (n_removed = 2, n_added = 2, cx kept) — the optimizer re-bound
//     both trainable rotations. Pinning the seed makes the lesson's
//     "find the two rotations" claim reproduce bit-exactly.
//   * L4 — fresh draws by design (the point IS the draw-to-draw
//     scatter); step 3 replays step 1's root_seed with sourceRunId
//     threading forked_from, so the This-configuration lineage shows
//     the pinned ring + fork edge the lesson points at.

import type { SharePayload } from "./share";
import type { GlossaryKey } from "./glossary";
import { chain, QUCAD_GRAPH } from "./scenarios";

export type LessonKey = "L1" | "L2" | "L3" | "L4";

export interface LessonStep {
  /** Action-button label, e.g. "Run it" / "Run again with 4096". */
  label: string;
  graph: SharePayload;
  sampleKey: string;
  /** Seed policy. "fresh" = new draw (pinSeed null); "pinned" = the
   *  fixed seed below; "replayFirst" = replay this lesson's FIRST
   *  archived run (resolved at click time by LessonCard from the runs
   *  the lesson has produced — also threads sourceRunId so the replay
   *  shows up as a fork in the lineage view). */
  seed: "fresh" | "pinned" | "replayFirst";
  pinSeed?: number;
  /** Applied at launch through the same store bridges scenarios use. */
  evidenceTab?: "current" | "history" | "compare";
  expandEvidence?: boolean;
  openGateDiff?: boolean;
  /** After this step's run archives: select this lesson's last two
   *  runs in Between configurations (L2's ideal-vs-noisy A/B). */
  compareLessonRuns?: boolean;
}

export interface Lesson {
  key: LessonKey;
  title: string;
  /** The hook, asked before the run. Budget: ≤25 words. */
  question: string;
  /** Shown once the run completes. Budget: ≤35 words. */
  whatToLookFor: string;
  /** Glossary terms surfaced as TipIcon chips under the copy. */
  terms: GlossaryKey[];
  steps: LessonStep[];
}

const BELL_SAMPLED = (shots: number): SharePayload =>
  chain([
    { k: "input_circuit" },
    { k: "fake_backend", p: { backend_name: "FakeFez", shots } },
    {
      k: "fidelity",
      p: { method: "sampled", unbound_param_policy: "bind_zero" },
    },
    { k: "output" },
  ]);

const VQC_IDEAL: SharePayload = chain([
  { k: "input_circuit" },
  {
    k: "fidelity",
    p: { method: "statevector", unbound_param_policy: "bind_zero" },
  },
  { k: "output" },
]);

const VQC_SAMPLED: SharePayload = chain([
  { k: "input_circuit" },
  { k: "fake_backend", p: { backend_name: "FakeFez", shots: 1024 } },
  {
    k: "fidelity",
    p: { method: "sampled", unbound_param_policy: "bind_zero" },
  },
  { k: "output" },
]);

export const LESSONS: Lesson[] = [
  {
    key: "L1",
    title: "Measurement is sampling",
    question:
      "A Bell pair should land on |00⟩ half the time. Run 128 measurements — why isn't the answer exactly 50%?",
    whatToLookFor:
      "The estimate carries a wide ± interval — 128 shots can't pin it down. Now run 4096 and watch the funnel narrow as evidence accumulates.",
    terms: ["shots", "ci"],
    steps: [
      {
        label: "Run it (128 shots)",
        graph: BELL_SAMPLED(128),
        sampleKey: "bell_state",
        seed: "fresh",
        evidenceTab: "current",
        expandEvidence: true,
      },
      {
        label: "Run again with 4096",
        graph: BELL_SAMPLED(4096),
        sampleKey: "bell_state",
        seed: "fresh",
        evidenceTab: "current",
        expandEvidence: true,
      },
    ],
  },
  {
    key: "L2",
    title: "Noise costs fidelity",
    question:
      "The same trainable circuit, twice: once as ideal math, once measured on a simulated IBM chip. What does the noise cost?",
    whatToLookFor:
      "The ideal run scores exactly 1.0 — no interval. The noisy run lands visibly lower, and Between configurations puts one interval on the difference.",
    terms: ["fidelity", "statevector", "backend"],
    steps: [
      {
        label: "Run the ideal version",
        graph: VQC_IDEAL,
        sampleKey: "vqc_2q_small",
        seed: "fresh",
        evidenceTab: "current",
        expandEvidence: true,
      },
      {
        label: "Run it on the noisy machine",
        graph: VQC_SAMPLED,
        sampleKey: "vqc_2q_small",
        seed: "fresh",
        compareLessonRuns: true,
      },
    ],
  },
  {
    key: "L3",
    title: "What did the optimizer do?",
    question:
      "QuCAD just rewrote this trainable circuit. In the gate-level diff on its card, find the two rotations it re-bound.",
    whatToLookFor:
      "Each qubit lane removes ry(θ) and adds a near-zero fixed angle: the optimizer bound both trainable rotations and left the entangling gate untouched.",
    terms: ["vqc", "gates", "pruning"],
    steps: [
      {
        label: "Run it",
        graph: QUCAD_GRAPH,
        sampleKey: "vqc_2q_small",
        seed: "pinned",
        pinSeed: 336157917,
        evidenceTab: "current",
        expandEvidence: true,
        openGateDiff: true,
      },
    ],
  },
  {
    key: "L4",
    title: "Same recipe, different draw",
    question:
      "Run the identical pipeline twice. Same recipe — do you get the same number? Then replay draw #1's seed.",
    whatToLookFor:
      "The two fresh draws differ — that's sampling. The replay matches draw #1 bit-exactly: in This configuration, the pinned ring and fork edge mark it as a descendant.",
    terms: ["seed", "replicate"],
    steps: [
      {
        label: "Run a fresh draw",
        graph: BELL_SAMPLED(512),
        sampleKey: "bell_state",
        seed: "fresh",
        evidenceTab: "current",
        expandEvidence: true,
      },
      {
        label: "Run another fresh draw",
        graph: BELL_SAMPLED(512),
        sampleKey: "bell_state",
        seed: "fresh",
      },
      {
        label: "Replay draw #1's seed",
        graph: BELL_SAMPLED(512),
        sampleKey: "bell_state",
        seed: "replayFirst",
        evidenceTab: "history",
        expandEvidence: true,
      },
    ],
  },
];
