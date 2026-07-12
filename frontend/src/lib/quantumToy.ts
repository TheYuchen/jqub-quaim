// Tiny EXACT simulator behind the learn-from-zero track
// (components/LearnLab.tsx). No backend, no qiskit — a state is just a
// short array of numbers, so every lesson interaction is instant and
// deterministic when seeded.
//
// HONESTY STANCE (for maintainers; none of this wording reaches the UI):
// states are vectors of REAL amplitudes — [a, b] for one qubit with
// a² + b² = 1, [a00, a01, a10, a11] for two. For the gate set the
// lessons use (X, H, Z, CX) the real-amplitude subset is EXACT quantum
// mechanics, not an approximation: these matrices have only real
// entries, so a system started in |0…0⟩ never leaves the real
// subspace. That exactness is load-bearing — H·H|0⟩ returns |0⟩
// EXACTLY in step 2 because the minus sign in H cancels (interference,
// not rounding), and the Bell construction in the two-qubit steps is
// exactly half/half. What we defer, not deny: general quantum states
// need COMPLEX amplitudes (S/T/RZ create them). The track's one phase
// gate — Z, the sign flip — has real entries, so the subset stays
// exact; its ± sign on the |1⟩ amplitude is precisely the "hidden
// direction" the phase step makes visible on the circle (stateAngle
// below). The UI never shows a formula either way — leans, tallies
// and percentages only.

/** One qubit: [amp(0), amp(1)]. */
export type State1 = [number, number];
/** Two qubits: [amp(00), amp(01), amp(10), amp(11)] — bitstring
 *  "q0 q1", index = q0·2 + q1 (q0 is the LEFT bit). */
export type State2 = [number, number, number, number];

const R2 = Math.SQRT1_2; // 1/√2 — the only irrational the lessons need

/** mulberry32 — tiny seeded PRNG (same generator family the demo
 *  archive tooling uses). Deterministic across platforms. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const zero1 = (): State1 => [1, 0];
export const zero2 = (): State2 => [1, 0, 0, 0];

/** The dial's state: a qubit leaning toward 1 with probability p1.
 *  (Real, non-negative amplitudes — exactly what X/H reach from |0⟩
 *  up to sign, and sign never changes probabilities.) */
export function leanState(p1: number): State1 {
  const p = Math.min(1, Math.max(0, p1));
  return [Math.sqrt(1 - p), Math.sqrt(p)];
}

/** X (NOT): swaps the two amplitudes. */
export function applyX1([a, b]: State1): State1 {
  return [b, a];
}

/** H (Hadamard): the 1/√2 mixing matrix [[1,1],[1,-1]]/√2. The minus
 *  sign is what makes H its own inverse — see the module comment. */
export function applyH1([a, b]: State1): State1 {
  return [R2 * (a + b), R2 * (a - b)];
}

/** Z (sign flip): diag(1, −1) — negates the |1⟩ amplitude. Invisible
 *  to measurement on its own (probabilities square the sign away),
 *  visible the moment an H mixes the signed amplitudes: H·Z·H = X.
 *  The learn track's "hidden direction", made concrete. */
export function applyZ1([a, b]: State1): State1 {
  return [a, -b];
}

/** Angle of a one-qubit REAL state on the learn track's circle (the
 *  honest Bloch slice — the X–Z great circle of the sphere), in
 *  radians, clockwise from the top as drawn on screen:
 *    |0⟩ → 0 (top) · |+⟩ → π/2 (right) · |1⟩ → π (bottom) ·
 *    |−⟩ → 3π/2 (left).
 *  The signed amplitude pair (a, b) = ±(cos t, sin t) maps to angle
 *  2t — the usual Bloch doubling — so the two signed pairs ±(a, b)
 *  (a GLOBAL sign, unphysical: no gate or measurement distinguishes
 *  them) land on the SAME angle. The circle shows physical states
 *  only. Conventions asserted in scripts/check_quantum_toy.test.ts. */
export function stateAngle([a, b]: State1): number {
  // Mod out the global sign: first nonzero amplitude ≥ 0.
  if (a < 0 || (a === 0 && b < 0)) {
    a = -a;
    b = -b;
  }
  let t = 2 * Math.atan2(b, a); // a ≥ 0 ⇒ t ∈ (−π, π]
  if (t < 0) t += 2 * Math.PI;
  return t;
}

/** X on qubit q of a two-qubit state. */
export function applyX2(s: State2, q: 0 | 1): State2 {
  return q === 0 ? [s[2], s[3], s[0], s[1]] : [s[1], s[0], s[3], s[2]];
}

/** H on qubit q of a two-qubit state. */
export function applyH2(s: State2, q: 0 | 1): State2 {
  if (q === 0)
    return [
      R2 * (s[0] + s[2]),
      R2 * (s[1] + s[3]),
      R2 * (s[0] - s[2]),
      R2 * (s[1] - s[3]),
    ];
  return [
    R2 * (s[0] + s[1]),
    R2 * (s[0] - s[1]),
    R2 * (s[2] + s[3]),
    R2 * (s[2] - s[3]),
  ];
}

/** CX (controlled-X): flip `target` where `control` reads 1.
 *  Defaults to the Bell wiring (control q0, target q1). */
export function applyCX(s: State2, control: 0 | 1 = 0, target: 0 | 1 = 1): State2 {
  if (control === target) throw new Error("CX needs two distinct qubits");
  // control=0,target=1: swap |10⟩↔|11⟩; control=1,target=0: |01⟩↔|11⟩.
  return control === 0 ? [s[0], s[1], s[3], s[2]] : [s[0], s[3], s[2], s[1]];
}

/** Outcome probabilities: amplitude², index order of the state. */
export function probs(state: number[]): number[] {
  return state.map((a) => a * a);
}

/** One measurement: sample a bitstring by amplitude². The returned
 *  string has one character per qubit ("0"/"1", "00"…"11"). */
export function measureOnce(state: number[], rng: () => number): string {
  const nBits = Math.round(Math.log2(state.length));
  const u = rng();
  let acc = 0;
  for (let i = 0; i < state.length; i++) {
    acc += state[i] * state[i];
    if (u < acc) return i.toString(2).padStart(nBits, "0");
  }
  // float underflow guard: probabilities summed to <1 by an ulp
  return (state.length - 1).toString(2).padStart(nBits, "0");
}

/** Readout noise: flip each classical bit independently with
 *  probability eps (the standard symmetric readout-error model,
 *  which is also how the backend's fake devices misread). eps=0 is
 *  the identity — asserted in scripts/check_quantum_toy.test.ts. */
export function applyReadoutNoise(
  bits: string,
  eps: number,
  rng: () => number,
): string {
  if (eps <= 0) return bits;
  let out = "";
  for (const b of bits) out += rng() < eps ? (b === "0" ? "1" : "0") : b;
  return out;
}

/** n measurements, tallied — the lessons' histogram feed. */
export function measureMany(
  state: number[],
  n: number,
  rng: () => number,
): Record<string, number> {
  const tally: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const bits = measureOnce(state, rng);
    tally[bits] = (tally[bits] ?? 0) + 1;
  }
  return tally;
}
