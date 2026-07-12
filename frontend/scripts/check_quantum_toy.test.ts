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
import { wilson95 } from "../src/lib/stats.ts";

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

// -- step 3's certainty claim: a Bell TALLY never disagrees ------------------
// "N looks: 00 and 11 only — never a disagreement" is stated with
// certainty in the UI, so it must hold for every draw, not on average.
{
  const bell = applyCX(applyH2(zero2(), 0));
  const tally = measureMany(bell, 500, mulberry32(20260703));
  assert.equal((tally["01"] ?? 0) + (tally["10"] ?? 0), 0);
  assert.equal((tally["00"] ?? 0) + (tally["11"] ?? 0), 500);
}

// -- step 3's contrast: break-the-link = H⊗H, exactly uniform ---------------
// (H on both qubits, NOT just deleting CX — deleting it alone would
// pin q1 at 0; see components/learn/BellRecipe.tsx.) All four cells
// must actually populate in a modest seeded tally.
{
  const indep = applyH2(applyH2(zero2(), 0), 1);
  for (const p of probs(indep)) close(p, 0.25);
  const tally = measureMany(indep, 400, mulberry32(20260703));
  for (const bits of ["00", "01", "10", "11"])
    assert.ok((tally[bits] ?? 0) > 0, `cell ${bits} never filled`);
}

// -- step 4's agreement score: reported-vs-drawn match rate ≈ (1−eps)² ------
// Both bits must survive readout for the pair to match, so at 6%
// noise the honest score sits near 88%, not 94% — the UI's live
// number must track this (seeded, so also deterministic).
{
  const bell = applyCX(applyH2(zero2(), 0));
  const rng = mulberry32(20260704);
  const N = 4000;
  let match = 0;
  for (let i = 0; i < N; i++) {
    const ideal = measureOnce(bell, rng);
    if (applyReadoutNoise(ideal, 0.06, rng) === ideal) match += 1;
  }
  assert.ok(Math.abs(match / N - 0.8836) < 0.02, `agreement ${match / N}`);
}

// -- step 5's stop rule: wilson95 half-width hits ±2pp inside the budget -----
// Replays Step5Certainty's exact accumulation (seed, batch size,
// interval rule) and checks the auto-stop story: the target is
// reached before the 2000-look budget, and a second replay stops at
// the identical batch (deterministic funnel).
{
  const run = (): number => {
    const bell = applyCX(applyH2(zero2(), 0));
    const rng = mulberry32(20260705);
    let matches = 0;
    let looks = 0;
    while (looks < 2000) {
      for (let i = 0; i < 50; i++) {
        const ideal = measureOnce(bell, rng);
        if (applyReadoutNoise(ideal, 0.06, rng) === ideal) matches += 1;
      }
      looks += 50;
      const [lo, hi] = wilson95(matches, looks);
      if ((hi - lo) / 2 <= 0.02) return looks;
    }
    return -1;
  };
  const stopA = run();
  assert.ok(stopA > 0, "±2pp never reached inside the 2000-look budget");
  assert.equal(stopA, run()); // bit-identical replay
}

console.log("check_quantum_toy: all assertions passed");
