import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, HelpCircle, Play, Repeat } from "lucide-react";
import { gloss } from "../../lib/glossary";
import {
  applyH2,
  applyX2,
  deutschOracle,
  mulberry32,
  probs,
  zero2,
  type DeutschRule,
  type State2,
} from "../../lib/quantumToy";
import { TipIcon } from "../TipIcon";
import { AmpBars } from "./AmpBars";

/**
 * Frame step 8 (of 10) — "One question instead of two": the payoff
 * of interference, played as a game against a mystery coin-rule box.
 * Four hidden rules (always-0, always-1, copy, flip — drawn seeded
 * per round), one honest question about them: does the box answer
 * the SAME for both questions (constant) or DIFFERENTLY (balanced)?
 *
 * Act 1, classical: ask f(0) and f(1) one at a time. After ONE
 * query the verdict buttons stay disabled — one answer genuinely
 * cannot decide (every rule is still possible on either kind) — so
 * the classical score is pinned at 2 questions, not by clumsiness
 * but by information.
 *
 * Act 2, quantum: ONE run of the real Deutsch circuit on the toy
 * sim — |0⟩|1⟩, H on both, the oracle as a real permutation matrix
 * (lib/quantumToy.ts deutschOracle — the same hidden rule, worn as
 * a gate), H on q0, read q0: 0 means same kind, 1 means different
 * kind, with CERTAINTY (all four rules asserted deterministic in
 * scripts/check_quantum_toy.test.ts). The stage player shows the
 * 4-slot amplitude arrows between gates, with ghost route-arrows on
 * the q0-mix — step 5's cancelling, doing real work. Replay reruns
 * the identical round to show it is not luck.
 *
 * The HONESTY CARD closes the step (and the sales pitch): the trick
 * needed the question to have structure. No claim that quantum
 * computers are faster at everything — they are not.
 */
const RULES: DeutschRule[] = ["always0", "always1", "copy", "flip"];
const ROUND_SEED = 20260712;

const fOf = (rule: DeutschRule, x: 0 | 1): 0 | 1 =>
  rule === "always0" ? 0 : rule === "always1" ? 1 : rule === "copy" ? x : x === 0 ? 1 : 0;
const isBalanced = (rule: DeutschRule) => rule === "copy" || rule === "flip";
const RULE_WORDS: Record<DeutschRule, string> = {
  always0: "it always answers 0",
  always1: "it always answers 1",
  copy: "it answers whatever you asked (copy)",
  flip: "it answers the opposite (flip)",
};

const STAGES = [
  "prep: 0 and 1",
  "mix both",
  "ask the box — once",
  "mix qubit 0 again",
  "read qubit 0",
] as const;
const STAGE_MS = 900;

export function Step7Deutsch() {
  const [round, setRound] = useState(1);
  const rule = RULES[Math.floor(mulberry32(ROUND_SEED + round)() * 4)];

  // Act 1 — classical queries
  const [asked, setAsked] = useState<{ 0: 0 | 1 | null; 1: 0 | 1 | null }>({ 0: null, 1: null });
  const [guess, setGuess] = useState<"same" | "diff" | null>(null);
  const queries = (asked[0] != null ? 1 : 0) + (asked[1] != null ? 1 : 0);
  const correct = guess != null && (guess === "diff") === isBalanced(rule);

  // Act 2 — the quantum run, staged
  const [stage, setStage] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  // the real circuit, computed exactly (all real amplitudes)
  const qStates = useMemo<State2[]>(() => {
    const s0 = applyX2(zero2(), 1); // |0⟩|1⟩
    const s1 = applyH2(applyH2(s0, 0), 1); // H on both
    const s2 = deutschOracle(rule)(s1); // ONE question
    const s3 = applyH2(s2, 0); // mix q0 again
    return [s0, s1, s2, s3];
  }, [rule]);
  const finalP = probs(qStates[3]);
  const q0ReadsOne = finalP[2] + finalP[3] > 0.5; // exactly 0 or 1
  const quantumDone = stage === STAGES.length - 1;

  const runQuantum = () => {
    if (timer.current) clearInterval(timer.current);
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setStage(STAGES.length - 1);
      return;
    }
    setStage(0);
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      setStage(i);
      if (i >= STAGES.length - 1 && timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    }, STAGE_MS);
  };

  const newRound = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setAsked({ 0: null, 1: null });
    setGuess(null);
    setStage(null);
    setRound((r) => r + 1);
  };

  // ghost route-arrows for the q0 mix (stage 3): every outcome is fed
  // by the two arrows that share its q1 bit — via q0=0 and via q0=1.
  const R2 = Math.SQRT1_2;
  const pre = qStates[2];
  const mixGhosts = [
    [R2 * pre[0], R2 * pre[2]],
    [R2 * pre[1], R2 * pre[3]],
    [R2 * pre[0], -R2 * pre[2]],
    [R2 * pre[1], -R2 * pre[3]],
  ];

  const shownState = stage == null ? null : qStates[Math.min(stage, 3)];

  return (
    <div className="flex flex-col items-center gap-3">
      {/* the mystery box */}
      <div className="flex items-center gap-2">
        <span className="chip !bg-surface">
          <HelpCircle className="w-3 h-3 text-accent" /> mystery coin-rule box
          · round {round}
        </span>
        <span className="text-[10px] text-mute">
          ask it 0 or 1 — it answers 0 or 1, by a hidden rule
        </span>
      </div>

      {/* Act 1 — the classical round */}
      <div className="panel-alt p-3 w-full max-w-md flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-wider text-mute">
          act 1 · the classical way
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {([0, 1] as const).map((x) => (
            <button
              key={x}
              type="button"
              className="btn !px-2.5 !py-1 text-xs disabled:opacity-40 font-mono"
              disabled={asked[x] != null || guess != null}
              onClick={() => setAsked((a) => ({ ...a, [x]: fOf(rule, x) }))}
            >
              ask {x}
            </button>
          ))}
          {([0, 1] as const).map(
            (x) =>
              asked[x] != null && (
                <span key={`r${x}`} className="chip font-mono">
                  asked {x} → got {asked[x]}
                </span>
              ),
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-mute">
            your verdict — does it answer the same for both questions?
          </span>
          <button
            type="button"
            className="btn !px-2.5 !py-1 text-xs disabled:opacity-40"
            disabled={queries < 2 || guess != null}
            onClick={() => setGuess("same")}
          >
            same kind
          </button>
          <button
            type="button"
            className="btn !px-2.5 !py-1 text-xs disabled:opacity-40"
            disabled={queries < 2 || guess != null}
            onClick={() => setGuess("diff")}
          >
            different kind
          </button>
        </div>
        <p className="text-[11px] text-mute tabular-nums" aria-live="polite">
          {guess != null ? (
            <>
              {correct ? "right" : "wrong"} — {RULE_WORDS[rule]}, so the two
              answers {isBalanced(rule) ? "differ" : "match"}. Either way it
              took <span className="text-ink font-mono">2</span> questions:{" "}
              <span className="text-ink">classical: 2 questions.</span>
            </>
          ) : queries === 0 ? (
            <>no questions asked yet — the box could be any of its 4 rules</>
          ) : queries === 1 ? (
            <>
              <span className="text-ink">
                you can't know yet — one answer isn't enough.
              </span>{" "}
              Whatever it said, both kinds are still possible: ask the other
              question.
            </>
          ) : (
            <>two answers in hand — now the verdict is yours to give</>
          )}
        </p>
      </div>

      {/* Act 2 — the quantum round */}
      <div className="panel-alt p-3 w-full max-w-md flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-wider text-mute">
          act 2 · the quantum way — same box, same round
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="btn-primary !px-2.5 !py-1 text-xs disabled:opacity-40"
            disabled={guess == null || (stage != null && !quantumDone)}
            onClick={runQuantum}
            title={
              guess == null
                ? "finish the classical round first — then beat it"
                : "one run: mix, ask once, mix, read"
            }
          >
            {quantumDone ? (
              <>
                <Repeat className="w-3.5 h-3.5" /> replay — same box, same
                answer
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> run the quantum question
              </>
            )}
          </button>
          {guess == null && (
            <span className="text-[10px] text-mute">
              finish the classical round first
            </span>
          )}
        </div>
        {stage != null && (
          <>
            {/* stage strip */}
            <div className="flex flex-wrap items-center gap-1">
              {STAGES.map((s, i) => (
                <span
                  key={s}
                  className={`text-[9px] px-1.5 py-0.5 rounded-full border transition-colors ${
                    i === stage
                      ? "border-accent/60 bg-accent/10 text-accent"
                      : i < stage
                        ? "border-edge text-mute"
                        : "border-edge/60 text-mute/50"
                  }`}
                >
                  {s}
                </span>
              ))}
            </div>
            {shownState && (
              <div className="flex flex-col items-center">
                <AmpBars
                  amps={shownState}
                  labels={["00", "01", "10", "11"]}
                  ghosts={stage === 3 ? mixGhosts : undefined}
                  height={150}
                />
                <div className="text-[9px] text-mute -mt-1">
                  four arrows now — first bit is qubit 0, the one we will read
                  {stage === 3 && " · ghost arrows: the two routes into each"}
                </div>
              </div>
            )}
            <p className="text-[11px] text-mute tabular-nums" aria-live="polite">
              {quantumDone ? (
                <>
                  qubit 0 reads{" "}
                  <span className="text-ink font-mono">{q0ReadsOne ? 1 : 0}</span>{" "}
                  →{" "}
                  <span className="text-ink font-medium">
                    “{q0ReadsOne ? "different kind" : "same kind"}”
                  </span>
                  {" — "}
                  {(q0ReadsOne ? "diff" : "same") ===
                  (isBalanced(rule) ? "diff" : "same")
                    ? "correct, "
                    : ""}
                  certain, in{" "}
                  <span className="text-ink font-mono">one</span> question.{" "}
                  <span className="text-ink">quantum: 1 question</span> — and
                  it's not luck: replay it. The wrong-kind arrows cancelled{" "}
                  <TipIcon hint={gloss("interference")} size={10} /> before
                  the look.
                </>
              ) : stage === 2 ? (
                <>the one and only question — the rule acts on the arrows</>
              ) : stage === 3 ? (
                <>the mix again: watch routes agree or cancel on qubit 0</>
              ) : (
                <>the arrows are being set up — no look has happened yet</>
              )}
            </p>
          </>
        )}
      </div>

      {/* round controls + score line */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button type="button" className="btn !px-2.5 !py-1 text-xs" onClick={newRound}>
          <Dices className="w-3.5 h-3.5" /> new round — new hidden rule
        </button>
        {guess != null && quantumDone && (
          <span className="chip tabular-nums">
            classical: 2 questions · quantum: 1
          </span>
        )}
      </div>

      {/* THE HONESTY CARD */}
      <div className="w-full max-w-md rounded-lg border border-edge bg-surfaceAlt/60 p-3">
        <div className="text-[10px] uppercase tracking-wider text-mute mb-1">
          before you extrapolate
        </div>
        <p className="text-[11px] leading-snug text-mute">
          <span className="text-ink font-medium">
            This trick needed the question to have structure.
          </span>{" "}
          Quantum computers are not faster at everything — they shine where
          interference can be choreographed: simulating molecules, searching,
          factoring. Your laptop keeps its job.
        </p>
      </div>
    </div>
  );
}
