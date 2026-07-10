// Unit-style verification of the difference-funnel statistical core
// (lib/stats.ts: newcombe95 / dedupeDraws / differenceTrace /
// differenceVerdict) — pure functions, so this runs in plain node:
//   node --experimental-strip-types scripts/check_difference_funnel.test.ts
//
// What is verified:
//   1. newcombe95 against the worked example (a) of Newcombe 1998
//      (Stat. Med. 17:873–890, method 10: 56/70 vs 48/80 → d = 0.20,
//      95% CI [0.0524, 0.3339]), plus symmetry, the zero-difference
//      case and degenerate n;
//   2. differenceTrace semantics: sign convention (Δ = B − A, the
//      Compare view's "Δ(B−A)" text), established on BOTH sides of
//      zero (lo > 0 and hi < 0), chronological ordering, unequal run
//      counts (the shorter side stops growing) and unequal
//      shots-per-run (512-shot side vs 2048-shot side pool on counts);
//   3. replay dedup: same root seed = the same draw, pooled once;
//   4. the scenario-F8 numbers, derived from src/data/demoArchive.json
//      ITSELF (not hardcoded groupings), so the scenarios.ts comment,
//      docs/EVIDENCE_WORKBENCH.md and the bundled data cannot drift.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  dedupeDraws,
  differenceTrace,
  differenceVerdict,
  newcombe95,
  wilson95,
  type DatedEvidence,
} from "../src/lib/stats.ts";

const close = (got: number, want: number, tol = 1e-12, what = "") =>
  assert.ok(
    Math.abs(got - want) <= tol,
    `${what || "value"}: got ${got}, want ${want} (tol ${tol})`,
  );

// -- 1. newcombe95 ------------------------------------------------------------

// Wilson anchors first (newcombe95 is built from wilson95).
{
  const [lo, hi] = wilson95(238, 512);
  close(lo, 0.4220636212637802, 1e-12, "wilson lo");
  close(hi, 0.508147494216735, 1e-12, "wilson hi");
  assert.deepEqual(wilson95(0, 0), [0, 1]);
}

// Newcombe 1998 worked example (a): p1 = 56/70 = 0.80, p2 = 48/80 =
// 0.60, d = 0.20, method-10 95% CI [0.0524, 0.3339].
{
  const [lo, hi] = newcombe95(56, 70, 48, 80);
  close(lo, 0.052431472402365, 1e-9, "newcombe example lo");
  close(hi, 0.333872654036906, 1e-9, "newcombe example hi");
}

// Antisymmetry: swapping the sides mirrors the interval about 0.
{
  const [lo1, hi1] = newcombe95(56, 70, 48, 80);
  const [lo2, hi2] = newcombe95(48, 80, 56, 70);
  close(lo1, -hi2, 1e-12, "antisymmetry lo");
  close(hi1, -lo2, 1e-12, "antisymmetry hi");
}

// Zero difference: symmetric about 0, and includes 0.
{
  const [lo, hi] = newcombe95(100, 200, 100, 200);
  close(lo, -hi, 1e-12, "zero-diff symmetry");
  close(hi, 0.09707040325780714, 1e-9, "zero-diff width");
  assert.ok(lo < 0 && hi > 0);
}

// Degenerate n: no evidence = full unknown.
assert.deepEqual(newcombe95(5, 0, 3, 10), [-1, 1]);
assert.deepEqual(newcombe95(3, 10, 5, 0), [-1, 1]);

// -- 2. differenceTrace semantics ----------------------------------------------

const ev = (
  created_at: number,
  successes: number,
  shots: number,
  root_seed: number | null = null,
): DatedEvidence => ({ created_at, successes, shots, root_seed });

// Sign convention: B higher ⇒ d positive, established via lo > 0.
{
  const t = differenceTrace([ev(1, 10, 100)], [ev(1, 90, 100)]);
  assert.equal(t.length, 1);
  close(t[0].d, 0.8, 1e-12, "sign convention d");
  assert.ok(t[0].established && t[0].lo > 0, "established via lo > 0");
}
// ...and mirrored: A higher ⇒ d negative, established via hi < 0.
{
  const t = differenceTrace([ev(1, 90, 100)], [ev(1, 10, 100)]);
  close(t[0].d, -0.8, 1e-12, "mirrored d");
  assert.ok(t[0].established && t[0].hi < 0, "established via hi < 0");
}

// Chronological ordering: step 1 pools each side's EARLIEST run.
{
  const t = differenceTrace(
    [ev(5, 0, 512), ev(1, 512, 512)],
    [ev(2, 100, 512), ev(9, 400, 512)],
  );
  assert.equal(t[0].successesA, 512, "A step 1 = earliest (created_at 1)");
  assert.equal(t[0].successesB, 100, "B step 1 = earliest (created_at 2)");
}

// Unequal run counts + unequal shots-per-run: the shorter side stops
// growing; pooling is on raw counts so a 512-shot side and a
// 2048-shot side coexist honestly.
{
  const A = [ev(1, 250, 512), ev(2, 250, 512), ev(3, 250, 512)];
  const B = [ev(1, 1000, 2048)];
  const t = differenceTrace(A, B);
  assert.equal(t.length, 3, "steps = max(|A|, |B|)");
  assert.deepEqual(
    t.map((s) => [s.shotsA, s.shotsB, s.shots]),
    [
      [512, 2048, 2560],
      [1024, 2048, 3072],
      [1536, 2048, 3584],
    ],
    "B stops growing after its last run; totals are the sum",
  );
  assert.ok(t.every((s) => s.nRunsB === 1));
  assert.deepEqual(
    t.map((s) => s.nRunsA),
    [1, 2, 3],
  );
}

// -- 3. replay dedup ------------------------------------------------------------

{
  // Same root seed twice = one draw recorded twice (replay guarantee).
  const A = [ev(1, 240, 512, 7), ev(2, 240, 512, 7), ev(3, 260, 512, 9)];
  assert.equal(dedupeDraws(A).length, 2, "replay deduped");
  const t = differenceTrace(A, [ev(1, 500, 1024), ev(2, 500, 1024)]);
  assert.equal(t[t.length - 1].nRunsA, 2, "trace pools unique draws only");
  assert.equal(t[t.length - 1].shotsA, 1024);
  // Unknown seeds are never deduped — no proof they repeat a draw.
  assert.equal(dedupeDraws([ev(1, 1, 10, null), ev(2, 1, 10, null)]).length, 2);
}

// -- 4. scenario F8: the bundled demo archive -----------------------------------
//
// Derived from the JSON itself: the two bell-state fidelity configs
// (they differ only in the fake_backend shots param, 512 vs 2048).
// Expected story (documented in lib/scenarios.ts F8 and the docs):
// established at 5,120 shots (+3.93pp), NOT sustained (re-includes 0
// at 13,312 shots), final Δ+1.81pp with an interval including 0 —
// raising shots did not change the measured fidelity, and the trace
// demonstrates the multiple-looks trap on the way to saying so.

{
  const jsonPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../src/data/demoArchive.json",
  );
  interface Entry {
    sampleKey: string | null;
    created_at: number;
    graph: { n: Array<{ k: string; p?: Record<string, unknown> }> };
    response: {
      root_seed: number | null;
      steps: Array<{ distribution?: unknown }>;
    };
  }
  const entries = JSON.parse(readFileSync(jsonPath, "utf8")) as Entry[];
  const evidenceOf = (e: Entry): DatedEvidence => {
    let shots = 0;
    let successes = 0;
    for (const st of e.response.steps) {
      const d = st.distribution as
        | { kind?: string; shots?: number; successes?: number }
        | null
        | undefined;
      if (d?.kind === "binomial" && (d.shots ?? 0) > 0) {
        shots += d.shots as number;
        successes += d.successes as number;
      }
    }
    return {
      created_at: e.created_at,
      root_seed: e.response.root_seed,
      successes,
      shots,
    };
  };
  const shotsParam = (e: Entry): number | null => {
    for (const n of e.graph.n)
      if (typeof n.p?.shots === "number") return n.p.shots as number;
    return null;
  };
  const bell = entries.filter((e) => e.sampleKey === "bell_state");
  const A = bell.filter((e) => shotsParam(e) === 512).map(evidenceOf);
  const B = bell.filter((e) => shotsParam(e) === 2048).map(evidenceOf);
  assert.equal(A.length, 9, "bell-512 records (incl. the pinned replay)");
  assert.equal(B.length, 5, "bell-2048 records");
  assert.equal(
    dedupeDraws(A).length,
    8,
    "bell-512 has one replay (seed 815033775) → 8 unique draws",
  );

  const steps = differenceTrace(A, B);
  const v = differenceVerdict(steps);
  assert.ok(v != null);
  assert.equal(steps.length, 8, "max(8 unique A draws, 5 B runs)");

  // established / lost pattern: F F→T T T T →F F F
  assert.deepEqual(
    steps.map((s) => s.established),
    [false, true, true, true, true, false, false, false],
    "excludes 0 at steps 2–5 only",
  );
  assert.equal(v.establishedAt?.step, 2);
  assert.equal(v.establishedAt?.shots, 5120, "established at 5,120 shots");
  close(v.establishedAt!.d, 0.039306640625, 1e-12, "established Δ");
  close(v.establishedAt!.lo, 0.005086851045083, 1e-9, "established lo");
  close(v.establishedAt!.hi, 0.073225458819462, 1e-9, "established hi");
  assert.equal(v.lostAt?.shots, 13312, "re-includes 0 at 13,312 shots");
  assert.equal(v.sustained, false, "NOT sustained — inconclusive");

  const f = v.final;
  assert.equal(f.shots, 14336);
  assert.equal(f.shotsA, 4096);
  assert.equal(f.shotsB, 10240);
  assert.equal(f.successesA, 1952);
  assert.equal(f.successesB, 5065);
  close(f.d, 5065 / 10240 - 1952 / 4096, 1e-15, "final Δ");
  close(f.d, 0.01806640625, 1e-12, "final Δ literal (+1.81pp)");
  assert.equal(f.established, false, "final interval includes 0");
  close(f.lo, -0.0000476, 2e-5, "final lo hugs 0 from below");
  close(f.hi, 0.036152, 2e-5, "final hi");
}

console.log(
  "check_difference_funnel: all assertions passed (newcombe95, dedupeDraws, differenceTrace, differenceVerdict, F8 demo-archive numbers)",
);
