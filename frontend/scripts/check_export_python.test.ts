// Shape verification of the exported-Python generator
// (lib/exportPython.ts) — string assertions on the generated script,
// covering the provenance threading that makes the doc's
// "reproduces the archived run's exact draw" claim true:
//   1. root seed -> _derive_seed helper + seed= kwarg on sampled runs;
//   2. precision_target -> precision_target= kwarg + header stamp
//      (an early-stopped run's script must re-send the stopping rule
//      or it would run all shots and reproduce nothing);
//   3. absence cases: no seed helper without a root seed / without a
//      sampled step; no precision_target kwarg when the run had none.
//
// exportPython imports lib/anon.ts, which touches import.meta.env at
// module scope, so this cannot run under plain node strip-types.
// Run via an esbuild bundle instead (from frontend/):
//   node_modules/.bin/esbuild scripts/check_export_python.test.ts \
//     --bundle --platform=node --format=esm \
//     --define:import.meta.env.VITE_ANON='"0"' \
//     --outfile=/tmp/check_export_python.mjs && node /tmp/check_export_python.mjs

import assert from "node:assert/strict";
import { generatePythonScript } from "../src/lib/exportPython.ts";
import type { ExportProvenance } from "../src/lib/exportPython.ts";

// Minimal canvas-shaped nodes (only id/data are read by the generator).
/* eslint-disable @typescript-eslint/no-explicit-any */
function graph(fidelityMethod: "sampled" | "statevector") {
  const nodes = [
    { id: "n1", data: { kind: "input_circuit", params: {} } },
    {
      id: "n2",
      data: { kind: "fake_backend", params: { backend_name: "FakeFez", shots: 2048 } },
    },
    {
      id: "n4",
      data: {
        kind: "fidelity",
        params: { method: fidelityMethod, unbound_param_policy: "bind_zero" },
      },
    },
  ] as any[];
  const edges = [
    { id: "e1", source: "n1", target: "n2" },
    { id: "e2", source: "n2", target: "n4" },
  ] as any[];
  return { nodes, edges };
}

const prov = (over: Partial<ExportProvenance> = {}): ExportProvenance => ({
  runId: "abc123def456",
  seedMode: "pinned",
  rootSeed: 424242,
  appVersion: "0.2.0-test",
  precisionTarget: null,
  ...over,
});

// -- 1. seeded sampled run: helper + seed kwarg ------------------------------
{
  const { nodes, edges } = graph("sampled");
  const s = generatePythonScript(nodes, edges, "bell_state", prov());
  assert.match(s, /def _derive_seed\(root: int, node_id: str\) -> int:/);
  assert.match(s, /ROOT_SEED = 424242/);
  assert.match(s, /seed=_derive_seed\(ROOT_SEED, "n4"\),\s+# -> seed_simulator/);
  assert.match(s, /run_id\s+: abc123def456/);
  // No target on this run -> the kwarg must NOT appear.
  assert.doesNotMatch(s, /precision_target=/);
  assert.doesNotMatch(s, /stop_target/);
}

// -- 2. early-stopped run: precision_target threaded -------------------------
{
  const { nodes, edges } = graph("sampled");
  const s = generatePythonScript(
    nodes,
    edges,
    "bell_state",
    prov({ precisionTarget: 0.02 }),
  );
  // Header stamp ties the file to the stopping rule.
  assert.match(s, /stop_target : 0\.02\s+# 95%-CI half-width/);
  // Call kwarg re-sends the rule so the script stops where the run did.
  assert.match(
    s,
    /precision_target=0\.02,\s+# stop at ±2\.0pp \(95%-CI half-width\)/,
  );
  // Kwarg order: seed before precision_target, both inside the call.
  const call = s.slice(s.indexOf("sampledFidelityEstimator("));
  assert.ok(
    call.indexOf("seed=_derive_seed") < call.indexOf("precision_target="),
    "seed kwarg precedes precision_target",
  );
}

// -- 3. target without a seed: rule still re-sent ----------------------------
{
  const { nodes, edges } = graph("sampled");
  const s = generatePythonScript(
    nodes,
    edges,
    "bell_state",
    prov({ rootSeed: null, seedMode: "fresh", precisionTarget: 0.05 }),
  );
  assert.doesNotMatch(s, /_derive_seed/); // no seed -> no helper
  assert.match(s, /precision_target=0\.05,\s+# stop at ±5\.0pp/);
}

// -- 4. statevector fidelity: no stochastic threading at all ------------------
{
  const { nodes, edges } = graph("statevector");
  const s = generatePythonScript(
    nodes,
    edges,
    "bell_state",
    prov({ precisionTarget: 0.02 }),
  );
  assert.doesNotMatch(s, /_derive_seed/);
  assert.doesNotMatch(s, /sampledFidelityEstimator/);
  assert.match(s, /simpleFidelityEstimator/);
  // Header still records the rule (run-level provenance), but no
  // sampled call exists to thread it into.
  assert.match(s, /stop_target : 0\.02/);
  assert.doesNotMatch(s, /precision_target=/);
}

// -- 5. no provenance: plain script, no stamps -------------------------------
{
  const { nodes, edges } = graph("sampled");
  const s = generatePythonScript(nodes, edges, "bell_state", null);
  assert.doesNotMatch(s, /_derive_seed|ROOT_SEED|precision_target|stop_target|run_id/);
}

console.log("check_export_python: all assertions passed");
