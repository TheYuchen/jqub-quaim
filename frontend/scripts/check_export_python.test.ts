// Shape verification of the exported-Python generator
// (lib/exportPython.ts) — string assertions on the generated script,
// covering the provenance threading that makes the doc's
// "reproduces the archived run's exact draw" claim true:
//   1. root seed -> _derive_seed helper + seed= kwarg on sampled runs;
//   2. precision_target -> precision_target= kwarg + header stamp
//      (an early-stopped run's script must re-send the stopping rule
//      or it would run all shots and reproduce nothing);
//   3. absence cases: no seed helper without a root seed / without a
//      sampled step; no precision_target kwarg when the run had none;
//   4. circuit provenance (Wave 1 audit): sample-key runs emit a real
//      QPY loader against /api/circuits/samples/<key>/download —
//      never a silent placeholder; uploaded-circuit runs emit a
//      sys.exit guard BEFORE the placeholder so the script can never
//      print wrong numbers silently;
//   5. Qiskit >= 1.0 imports (qiskit_ibm_runtime.fake_provider, the
//      same family the studio backend imports) and no dead qc_bound
//      in the QuCAD step; plugin steps are announced, not skipped.
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
  // Circuit provenance: a REAL loader for the sample QPY, not a
  // placeholder — and no refuse-to-run guard on a fetchable circuit.
  assert.match(s, /urlretrieve\(/);
  assert.match(s, /\/api\/circuits\/samples\/bell_state\/download/);
  assert.match(s, /qc = qpy\.load\(f\)\[0\]/);
  assert.doesNotMatch(s, /sys\.exit/);
  // Qiskit >= 1.0: the fake-provider family the studio backend uses.
  assert.match(s, /from qiskit_ibm_runtime\.fake_provider import FakeFez/);
  assert.doesNotMatch(s, /from qiskit\.providers\.fake_provider import/);
  assert.doesNotMatch(s, /FakeFezV2/);
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
    /precision_target=0\.02,\s+# stop at ±2pp \(95%-CI half-width\)/,
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
  assert.match(s, /precision_target=0\.05,\s+# stop at ±5pp/);
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

// -- 6. uploaded circuit: refuse-to-run guard, never a silent placeholder ----
{
  const { nodes, edges } = graph("sampled");
  const s = generatePythonScript(nodes, edges, null, prov());
  assert.match(s, /sys\.exit\(/);
  assert.match(s, /replace the placeholder circuit/);
  assert.doesNotMatch(s, /urlretrieve/);
  // The guard must come BEFORE the placeholder assignment.
  assert.ok(
    s.indexOf("sys.exit(") < s.indexOf("qc = QuantumCircuit(4"),
    "sys.exit guard precedes the placeholder circuit",
  );
}

// -- 7. plugin / unknown step: announced in the script, not skipped ----------
{
  const { nodes, edges } = graph("sampled");
  const withPlugin = [
    ...nodes,
    { id: "n9", data: { kind: "plugin:my_pass", params: {} } },
  ] as any[];
  const s = generatePythonScript(
    withPlugin,
    [...edges, { id: "e9", source: "n4", target: "n9" }] as any[],
    "bell_state",
    prov(),
  );
  assert.match(
    s,
    /# Step \d+: plugin:my_pass — plugin step, not exportable/,
  );
}

// -- 8. QuCAD: trains the parameterized circuit, no dead qc_bound ------------
{
  const nodes = [
    { id: "n1", data: { kind: "input_circuit", params: {} } },
    {
      id: "n2",
      data: { kind: "fake_backend", params: { backend_name: "FakeFez", shots: 1024 } },
    },
    { id: "n3", data: { kind: "qucad", params: {} } },
  ] as any[];
  const edges = [
    { id: "e1", source: "n1", target: "n2" },
    { id: "e2", source: "n2", target: "n3" },
  ] as any[];
  const s = generatePythonScript(nodes, edges, "vqc_2q_small", prov());
  assert.match(s, /run_qucad_training_noisy\(/);
  assert.doesNotMatch(s, /qc_bound/);
  // The trained parameters ARE bound after training (backend parity).
  assert.match(s, /qc = qc\.assign_parameters\(theta \* \(mask != 0\)\)/);
}

console.log("check_export_python: all assertions passed");
