// Plain-language glossary — the single source of gloss strings for
// quantum terms that survive the non-quantum-reader copy pass (Wave P).
//
// Rationale: the paper's reviewers are visualization people, not
// quantum people. UI copy prefers task language (evidence, replicate,
// transformation, composition, precision); where a domain term must
// stay (it names the actual knob or quantity), it carries a TipIcon
// whose hint comes from here, so every surface glosses the same term
// with the same words.

export const GLOSSARY = {
  shots:
    "Shots = number of repeated measurements of the circuit. More shots → narrower uncertainty intervals, slower runs.",
  qubit:
    "Qubit = one quantum bit, the basic unit the circuit operates on. More qubits → larger, harder-to-simulate circuits.",
  measurement:
    "Measurement = asking the qubit for a definite answer. It always comes back 0 or 1, drawn with the lean's odds — and the lean itself is gone once you have looked.",
  fidelity:
    "Fidelity = similarity between the noisy result and the ideal (noise-free) result, from 0 to 1. Higher is better.",
  backend:
    "Backend = the (simulated) quantum machine the circuit runs on. It supplies the noise model — how much error each operation adds.",
  transpile:
    "Transpiling = compiling the circuit into the specific operations the target machine supports; usually changes depth and gate count.",
  depth:
    "Depth = the longest sequence of operations that must run one after another. Deeper circuits accumulate more noise.",
  gates:
    "Gates = the individual operations in the circuit (like instructions in a program).",
  entanglement:
    "Entanglement = a link between qubits prepared together: measure one and the other's answer is fixed too. Two-qubit gates like the controlled flip (CX) create it.",
  noise:
    "Noise = the small random errors a real machine adds \u2014 misfired operations, misread qubits. It blurs every tally; the agreement (fidelity) score says how much survives.",
  seed:
    "Seed = the number that fixes all random draws in a run. Re-running with the same (pinned) seed reproduces the result bit-exactly.",
  ci:
    "The sampled estimate is uncertain; the interval covers the plausible range (95% Wilson interval). More measurements → narrower interval.",
  calibration:
    "Calibration = the machine's measured error rates, re-measured daily. Noise drifts day to day, so results depend on when you run.",
  statevector:
    "Statevector = exact noise-free simulation. Fast and deterministic, but ignores machine noise entirely.",
  vqc:
    "A parameterized (trainable) circuit — a small machine-learning model whose parameters are rotation angles.",
  pruning:
    "Pruning = deleting parameters/operations that contribute little, producing a smaller circuit that is less exposed to noise.",
  errorBound:
    "Predicted upper limit on how much error today's machine noise adds to this circuit. Lower is better.",
  // Grounding note (evidence-grounding wave): the second sentence of
  // the precisionTarget gloss cites the field's own precision knobs so
  // the control speaks the practitioner's language. Our semantics stay
  // a 95% TWO-SIDED Wilson interval — the system-wide convention every
  // funnel, pooled band and difference interval shares — so we note the
  // Quantum Volume correspondence (97.5% ONE-SIDED) without adding a
  // convention switcher; the full mapping lives in
  // docs/EVIDENCE_WORKBENCH.md §1.2 "Grounding in documented practice".
  precisionTarget:
    "Optional stopping rule: keep measuring in batches and stop as soon as the uncertainty interval is at most this wide (± percentage points). Because stopping depends on the data, interval coverage is approximate under early stopping. IBM's Estimator API exposes the same knob (`precision`, default 0.0156 \u2248 \u00b13.1pp at 95% two-sided); Quantum Volume gates decisions at a 97.5% one-sided interval \u2014 precision-gated evidence is codified practice, this control makes it visible and interactive.",
  replicate:
    "Replicate = run the identical configuration again with a fresh random draw. The spread across replicates is the real uncertainty.",
  configuration:
    "Configuration = the pipeline recipe: which blocks, wired how, with which settings, on which circuit. Runs with the same recipe group together.",
  differenceInterval:
    "To compare two configurations, put ONE 95% interval on the difference between them (Newcombe score interval on \u0394 = B \u2212 A). If it excludes zero, the data distinguish the two. Eyeballing two separate intervals answers a different, stricter question.",
  established:
    "'Established' = the 95% interval of the difference excludes zero at this point of the accumulation. Checking again after every new replicate inflates the chance of a false positive (multiple looks), so an exclusion that later re-includes zero is reported as not sustained.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

/** Convenience accessor, so call sites read gloss("shots"). */
export function gloss(key: GlossaryKey): string {
  return GLOSSARY[key];
}
