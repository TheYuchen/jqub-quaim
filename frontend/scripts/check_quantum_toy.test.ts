// Unit lane for the learn-from-zero toy simulator (lib/quantumToy.ts) —
// pure functions, plain node:
//   node --experimental-strip-types scripts/check_quantum_toy.test.ts
//
// The assertions ARE the honesty contract of the learn track: the
// real-amplitude subset must be EXACT for X/H/CX (H·H cancels by sign,
// Bell is exactly half/half), because step 2's "back where it
// started — gates are reversible" caption and the Bell tallies are
// claims the UI makes with certainty, not approximately.

import assert from "node:assert/strict";
import {
  applyCX,
  applyH1,
  applyH2,
  applyReadoutNoise,
  applyX1,
  leanState,
  measureMany,
  measureOnce,
  mulberry32,
  probs,
  zero1,
  zero2,
} from "../src/lib/quantumToy.ts";

const close = (a: number, b: number, eps = 1e-12) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

// -- H|0⟩ → exactly 50/50 ----------------------------------------------------
{
  const p = probs(applyH1(zero1()));
  close(p[0], 0.5);
  close(p[1], 0.5);
}

// -- H·H|0⟩ → |0⟩ EXACTLY (the sign in H does the cancelling) ----------------
{
  const s = applyH1(applyH1(zero1()));
  close(s[0], 1);
  close(s[1], 0);
  // and through a pole flip: H·H|1⟩ = |1⟩
  const s1 = applyH1(applyH1(applyX1(zero1())));
  close(probs(s1)[1], 1);
}

// -- X flips -----------------------------------------------------------------
{
  const s = applyX1(zero1());
  assert.deepEqual(probs(s), [0, 1]);
  assert.deepEqual(probs(applyX1(s)), [1, 0]);
}

// -- leanState: dial position IS the probability of 1 ------------------------
{
  const p = probs(leanState(0.73));
  close(p[1], 0.73);
  close(p[0] + p[1], 1);
}

// -- Bell: (H on q0) then CX from |00⟩ → {00: 0.5, 11: 0.5} ------------------
{
  const bell = applyCX(applyH2(zero2(), 0));
  const p = probs(bell);
  close(p[0], 0.5); // 00
  close(p[1], 0);   // 01
  close(p[2], 0);   // 10
  close(p[3], 0.5); // 11
}

// -- measureOnce: seeded, deterministic, respects the odds -------------------
{
  const a = measureMany(applyH1(zero1()), 1000, mulberry32(7));
  const b = measureMany(applyH1(zero1()), 1000, mulberry32(7));
  assert.deepEqual(a, b); // same seed → same tally
  assert.ok(Math.abs((a["1"] ?? 0) / 1000 - 0.5) < 0.05, `H tally ${a["1"]}`);
  // certainty stays certainty
  const ones = measureMany(applyX1(zero1()), 50, mulberry32(3));
  assert.deepEqual(ones, { "1": 50 });
  // two-qubit bitstrings come back two chars wide
  assert.equal(measureOnce(zero2(), mulberry32(1)), "00");
}

// -- readout noise: eps=0 identity; eps=1 flips every bit --------------------
{
  const rng = mulberry32(11);
  assert.equal(applyReadoutNoise("01", 0, rng), "01");
  assert.equal(applyReadoutNoise("01", 1, rng), "10");
  // eps=0.5 with a seeded rng is deterministic too
  assert.equal(
    applyReadoutNoise("0000", 0.5, mulberry32(5)),
    applyReadoutNoise("0000", 0.5, mulberry32(5)),
  );
}

console.log("check_quantum_toy: all assertions passed");
