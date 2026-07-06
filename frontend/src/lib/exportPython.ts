/**
 * Generate a runnable Python script from the current canvas pipeline.
 *
 * The script imports Qiskit + qlib modules and reproduces the same
 * operations the backend would run, so a researcher can copy the file
 * into their own project, tweak it, and run batch experiments without
 * the web UI.
 *
 * We deliberately keep the generated code flat and readable (no
 * classes, no abstractions) so someone unfamiliar with the codebase
 * can follow it line by line.
 *
 * Architecture: one ``Emitter`` per node kind. Each emitter is a pure
 * function from (params, stepNum, ctx) to a list of source lines. The
 * main loop walks the topo-sorted nodes, dispatches to the emitter,
 * and concatenates. To support a new node kind, add one entry to
 * ``EMITTERS``.
 */

import type { Node, Edge } from "@xyflow/react";
import { APP_NAME } from "./anon";
import type { QNodeData } from "../components/QNode";
import type { NodeKind } from "./nodeCatalog";

interface PipelineNode {
  /** Canvas node id — the SAME id the backend keyed this node's
   *  per-node seed on (StepResult.node_id), so the exported script's
   *  _derive_seed(root, id) reproduces the run's exact draw. */
  id: string;
  kind: NodeKind;
  params: Record<string, unknown>;
}

interface EmitContext {
  /** Filename suggestion for an Option A QPY load. */
  sampleKey: string | null;
  /** Root seed of the exported run, non-null ONLY when the script
   *  preamble emitted the _derive_seed helper — emitters may then
   *  thread per-node seeds into stochastic calls. */
  rootSeed: number | null;
}

/** Provenance envelope of the run this export descends from (the
 *  store's most recent run). Stamped into the script header so any
 *  number the script produces can be traced back to a run_id + seed. */
export interface ExportProvenance {
  runId: string | null;
  seedMode: "fresh" | "pinned" | null;
  rootSeed: number | null;
  appVersion: string | null;
}

type Emitter = (b: PipelineNode, stepNum: number, ctx: EmitContext) => string[];

// ---- topology helper -----------------------------------------------------

/**
 * Topological sort of canvas nodes using the edge list.
 * Falls back to catalog order if the graph is disconnected.
 */
function topoSort(nodes: Node[], edges: Edge[]): Node[] {
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n.id, []);
    indeg.set(n.id, 0);
  }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const queue = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const d = (indeg.get(next) ?? 1) - 1;
      indeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // Append any disconnected nodes at the end.
  for (const n of nodes) {
    if (!order.includes(n.id)) order.push(n.id);
  }
  return order.map((id) => byId.get(id)!).filter(Boolean);
}

// ---- emitters: one per node kind -----------------------------------------
//
// Each emitter returns ONLY the body lines for its step — the main
// loop handles the leading "# Step N: <title>" header and a trailing
// blank line. Keep each emitter self-contained so adding a new node
// kind is a strictly additive change.

function asStr(v: unknown, dflt: string): string {
  return typeof v === "string" && v.length > 0 ? v : dflt;
}

function asNum(v: unknown, dflt: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : dflt;
}

const emitInputCircuit: Emitter = (_b, _step, { sampleKey }) => {
  const lines: string[] = [];
  if (sampleKey) {
    lines.push(`# Sample: ${sampleKey}`);
    lines.push(`# Option A: Load from a .qpy file`);
    lines.push(`# from qiskit import qpy`);
    lines.push(`# with open("${sampleKey}.qpy", "rb") as f:`);
    lines.push(`#     qc = qpy.load(f)[0]`);
    lines.push(``);
    lines.push(`# Option B: Build programmatically (replace with your circuit)`);
  } else {
    lines.push(`# Replace with your circuit`);
  }
  lines.push(`qc = QuantumCircuit(4, name="my_circuit")`);
  lines.push(`# qc.ry(0.5, 0)`);
  lines.push(`# qc.cx(0, 1)`);
  lines.push(`# ... add your gates here`);
  return lines;
};

const emitFakeBackend: Emitter = (b) => {
  const name = asStr(b.params.backend_name, "FakeFez");
  const shots = asNum(b.params.shots, 1024);
  return [
    `from qiskit.providers.fake_provider import ${name}V2`,
    `backend = ${name}V2()`,
    `noise_model = NoiseModel.from_backend(backend)`,
    `shots = ${shots}  # user-set measurement count`,
  ];
};

const emitIbmBackend: Emitter = (b) => {
  const name = asStr(b.params.backend_name, "ibm_fez");
  const shots = asNum(b.params.shots, 1024);
  return [
    `# Requires: pip install qiskit-ibm-runtime`,
    `# from qiskit_ibm_runtime import QiskitRuntimeService`,
    `# service = QiskitRuntimeService(channel="ibm_quantum", token="YOUR_TOKEN")`,
    `# backend = service.backend("${name}")`,
    `# noise_model = NoiseModel.from_backend(backend)`,
    `#`,
    `# For now, falling back to fake backend:`,
    `from qiskit.providers.fake_provider import FakeFezV2`,
    `backend = FakeFezV2()`,
    `noise_model = NoiseModel.from_backend(backend)`,
    `shots = ${shots}`,
  ];
};

const emitQucad: Emitter = (b) => {
  const iters = asNum(b.params.iterations, 3);
  const lam = asNum(b.params.lam, 0.005);
  const rho = asNum(b.params.rho, 500.0);
  return [
    `from qlib.qucad import run_qucad_training_noisy`,
    ``,
    `# Bind free parameters to zero if circuit is parameterized`,
    `if qc.num_parameters > 0:`,
    `    qc_bound = qc.assign_parameters([0.0] * qc.num_parameters)`,
    `else:`,
    `    qc_bound = qc`,
    ``,
    `theta, mask, history = run_qucad_training_noisy(`,
    `    qc, noise_model, backend,`,
    `    iterations=${iters}, lam=${lam}, rho=${rho},`,
    `)`,
    `qc = qc.assign_parameters(theta * (mask != 0))`,
    `print(f"QuCAD: kept {int((mask != 0).sum())}/{len(mask)} parameters")`,
  ];
};

const emitQubound: Emitter = (b) => {
  const cacheBackend = asStr(b.params.cache_backend, "ibm_fez");
  const threshRaw = asNum(b.params.threshold, 0);
  // 0 / negative disables pass/fail, matching the backend's
  // _build_summary contract.
  const threshold = threshRaw > 0 ? threshRaw : null;
  const lines = [
    `from qlib.qbound import call_QuBound_from_cache`,
    `from pathlib import Path`,
    ``,
    `cache_path = Path("cache/ibm_history/${cacheBackend}.pkl")`,
    `if qc.num_parameters > 0:`,
    `    qc_eval = qc.assign_parameters([0.0] * qc.num_parameters)`,
    `else:`,
    `    qc_eval = qc`,
    ``,
    `bound, model, meta = call_QuBound_from_cache(`,
    `    qc_eval, cache_path, reference_backend=backend if 'backend' in dir() else None,`,
    `)`,
    `print(f"QuBound predicted error bound: {bound:.6f}")`,
  ];
  if (threshold !== null) {
    lines.push(
      `threshold = ${threshold}`,
      `passes = bound <= threshold`,
      `margin = threshold - bound`,
      `print(f"  threshold {threshold}: {'PASS' if passes else 'FAIL'} (margin {margin:+.4f})")`,
    );
  }
  return lines;
};

const emitCompvqc: Emitter = () => [
  `from qlib.compvqc import get_LUT, quadraticProgram_luttoqp, admmOptimizedCompVQC, resultsCompressVQC`,
  ``,
  `if qc.num_parameters > 0:`,
  `    comp_backend = backend if 'backend' in dir() else None`,
  `    if comp_backend is None:`,
  `        from qiskit.providers.fake_provider import FakeFezV2`,
  `        comp_backend = FakeFezV2()`,
  `    lut = get_LUT(qc, comp_backend)`,
  `    if lut:`,
  `        qp = quadraticProgram_luttoqp(qc, lut)`,
  `        result = admmOptimizedCompVQC(qp)`,
  `        qc = resultsCompressVQC(result, qc)`,
  `        print(f"CompressVQC: compressed circuit depth {qc.depth()}")`,
  `    else:`,
  `        print("CompressVQC: no compressible pairs found")`,
  `else:`,
  `    print("CompressVQC: skipped (no parameterized gates)")`,
];

const emitQshot: Emitter = (b) => {
  const snapshot = asStr(b.params.noise_snapshot, "pittsburgh_1");
  const alpha = asNum(b.params.alpha, 0.95);
  return [
    `from qlib.qshot import get_recommender, resolve_noise_snapshot`,
    ``,
    `if qc.num_parameters > 0:`,
    `    qc_shot = qc.assign_parameters([0.0] * qc.num_parameters)`,
    `else:`,
    `    qc_shot = qc`,
    ``,
    `noise_path = resolve_noise_snapshot("${snapshot}")`,
    `recommender = get_recommender()`,
    `result = recommender.predict(qc_shot, noise_path, alpha=${alpha})`,
    `if result:`,
    `    print(f"Qshot: recommended {result['recommended_shots']} shots")`,
    `    print(f"  predicted fidelity: {result['predicted_fidelity']:.4f}")`,
    `else:`,
    `    print("Qshot: could not produce recommendation")`,
  ];
};

const emitFidelity: Emitter = (b, _step, ctx) => {
  const method = asStr(b.params.method, "statevector");
  const policy = asStr(b.params.unbound_param_policy, "bind_zero");
  if (method === "sampled") {
    // Reproducibility: `seed=` threads through to AerSimulator's
    // seed_simulator inside sampledFidelityEstimator. With the run's
    // root seed and this node's id, the derived seed is identical to
    // the one the backend used — the script reproduces the studio
    // run's exact sampled draw.
    const seedLines =
      ctx.rootSeed != null
        ? [`    seed=_derive_seed(ROOT_SEED, "${b.id}"),  # -> seed_simulator`]
        : [];
    return [
      `from qlib.qiskit_utils import sampledFidelityEstimator`,
      ``,
      `fidelity, meta = sampledFidelityEstimator(`,
      `    qc,`,
      `    backend if 'backend' in dir() else None,`,
      `    shots=shots if 'shots' in dir() else 1024,`,
      `    unbound_param_policy="${policy}",`,
      ...seedLines,
      `)`,
      `print(f"Fidelity (sampled, shots={meta['shots']}): {fidelity:.6f}")`,
    ];
  }
  return [
    `from qlib.qiskit_utils import simpleFidelityEstimator`,
    ``,
    `fidelity, meta = simpleFidelityEstimator(`,
    `    qc, unbound_param_policy="${policy}",`,
    `)`,
    `print(f"Fidelity (noiseless statevector): {fidelity:.6f}")`,
  ];
};

const emitOutput: Emitter = () => [
  `print("\\n" + "=" * 60)`,
  `print(f"Final circuit: {qc.num_qubits}q, depth {qc.depth()}, {qc.size()} gates")`,
  `print(f"Gate counts: {dict(qc.count_ops())}")`,
  `print(qc.draw(output='text', fold=120))`,
];

const STEP_TITLES: Record<NodeKind, string> = {
  input_circuit: "Load circuit",
  fake_backend: "Noisy simulator",
  ibm_backend: "IBM live backend",
  qucad: "QuCAD — noise-aware VQC sparsification",
  qubound: "QuBound — LSTM error-bound prediction",
  compvqc: "CompressVQC — fold redundant gates",
  qshot: "Qshot — noise-aware shot-count recommendation",
  fidelity: "Fidelity estimate",
  output: "Output summary",
};

const EMITTERS: Record<NodeKind, Emitter> = {
  input_circuit: emitInputCircuit,
  fake_backend: emitFakeBackend,
  ibm_backend: emitIbmBackend,
  qucad: emitQucad,
  qubound: emitQubound,
  compvqc: emitCompvqc,
  qshot: emitQshot,
  fidelity: emitFidelity,
  output: emitOutput,
};

// ---- main entry ----------------------------------------------------------

export function generatePythonScript(
  nodes: Node[],
  edges: Edge[],
  sampleKey: string | null,
  provenance: ExportProvenance | null = null,
): string {
  const sorted = topoSort(nodes, edges);
  const blocks: PipelineNode[] = sorted.map((n) => ({
    id: n.id,
    kind: (n.data as QNodeData).kind,
    params: ((n.data as QNodeData).params as Record<string, unknown>) ?? {},
  }));

  // Reproducibility: when the exported run recorded a root seed AND
  // the pipeline contains a stochastic step we can seed (sampled
  // fidelity), the script gets a _derive_seed helper replicating the
  // backend's per-node derivation, so exported numbers match archived
  // numbers bit-for-bit.
  const rootSeed = provenance?.rootSeed ?? null;
  const needsSeedHelper =
    rootSeed != null &&
    blocks.some(
      (b) =>
        b.kind === "fidelity" &&
        asStr(b.params.method, "statevector") === "sampled",
    );

  const lines: string[] = [];

  // Header — provenance stamp ties the file to the exact archived run
  // it was exported from (reviewer-traceable: number -> run_id -> seed).
  lines.push(`"""`);
  lines.push(`Pipeline exported from ${APP_NAME}`);
  // Current origin, not a hardcoded URL: correct on any deployment and
  // never leaks the primary Space's identity from an anonymous one.
  lines.push(
    typeof window !== "undefined" ? `${window.location.origin}/` : ``,
  );
  if (provenance) {
    lines.push(``);
    lines.push(`Provenance of the run this pipeline was exported from:`);
    if (provenance.runId) lines.push(`  run_id      : ${provenance.runId}`);
    if (provenance.seedMode) lines.push(`  seed_mode   : ${provenance.seedMode}`);
    if (provenance.rootSeed != null)
      lines.push(`  root_seed   : ${provenance.rootSeed}`);
    if (provenance.appVersion)
      lines.push(`  app_version : ${provenance.appVersion}`);
    lines.push(`  exported    : ${new Date().toISOString()}`);
  }
  lines.push(`"""`);
  lines.push(``);

  // Imports. QuantumCircuit is always needed; AerSimulator + NoiseModel
  // come along for any backend block. Detailed qlib imports are emitted
  // inline in each step's body so unused steps don't leave dead imports.
  const imports = new Set<string>(["from qiskit import QuantumCircuit"]);
  const hasBackend = blocks.some(
    (b) => b.kind === "fake_backend" || b.kind === "ibm_backend",
  );
  if (hasBackend) {
    imports.add("from qiskit_aer import AerSimulator");
    imports.add("from qiskit_aer.noise import NoiseModel");
  }
  if (needsSeedHelper) imports.add("import hashlib");
  lines.push([...imports].sort().join("\n"));
  lines.push(``);

  if (needsSeedHelper) {
    lines.push(``);
    lines.push(`# Per-node seed, matching ${APP_NAME}'s backend derivation exactly:`);
    lines.push(`# sha256(f"{root}:{node_id}") -> first 4 bytes -> 31-bit int.`);
    lines.push(`# Order-independent: editing unrelated nodes never changes this`);
    lines.push(`# node's draw under the same root seed.`);
    lines.push(`def _derive_seed(root: int, node_id: str) -> int:`);
    lines.push(`    digest = hashlib.sha256(f"{root}:{node_id}".encode()).digest()`);
    lines.push(`    return int.from_bytes(digest[:4], "big") % (2**31)`);
    lines.push(``);
    lines.push(``);
    lines.push(`ROOT_SEED = ${rootSeed}  # recorded by ${APP_NAME} for this run`);
    lines.push(``);
  }

  const sep = `# ${"─".repeat(60)}`;
  const ctx: EmitContext = {
    sampleKey,
    rootSeed: needsSeedHelper ? rootSeed : null,
  };
  blocks.forEach((b, i) => {
    const stepNum = i + 1;
    const emitter = EMITTERS[b.kind];
    if (!emitter) return; // Plugin / unknown — skip silently.
    lines.push(sep);
    lines.push(`# Step ${stepNum}: ${STEP_TITLES[b.kind] ?? b.kind}`);
    lines.push(...emitter(b, stepNum, ctx));
    lines.push(``);
  });

  // Footer
  lines.push(`# ${"─".repeat(60)}`);
  lines.push(`# End of exported pipeline`);
  lines.push(`# To run: python pipeline.py`);
  lines.push(`# Make sure qlib/ is on your PYTHONPATH (or run from the backend/ dir)`);

  return lines.join("\n");
}
