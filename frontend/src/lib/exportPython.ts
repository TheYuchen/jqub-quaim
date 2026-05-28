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
 */

import type { Node, Edge } from "@xyflow/react";
import type { QNodeData } from "../components/QNode";
import type { NodeKind } from "./nodeCatalog";

interface PipelineNode {
  kind: NodeKind;
  params: Record<string, unknown>;
}

/**
 * Topological sort of canvas nodes using the edge list.
 * Falls back to catalog family order if the graph is disconnected.
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

export function generatePythonScript(
  nodes: Node[],
  edges: Edge[],
  sampleKey: string | null,
): string {
  const sorted = topoSort(nodes, edges);
  const blocks: PipelineNode[] = sorted.map((n) => ({
    kind: (n.data as QNodeData).kind,
    params: ((n.data as QNodeData).params as Record<string, unknown>) ?? {},
  }));

  const lines: string[] = [];
  const imports = new Set<string>();

  // Header
  lines.push(`"""`);
  lines.push(`Pipeline exported from QuDA Studio`);
  lines.push(`https://qudastudio-app.hf.space/`);
  lines.push(`"""`);
  lines.push(``);

  // Always need QuantumCircuit
  imports.add("from qiskit import QuantumCircuit");

  let hasBackend = false;

  // Scan what we need for imports.
  for (const b of blocks) {
    if (b.kind === "fake_backend" || b.kind === "ibm_backend") {
      hasBackend = true;
    }
  }

  // Imports section
  if (hasBackend) {
    imports.add("from qiskit_aer import AerSimulator");
    imports.add("from qiskit_aer.noise import NoiseModel");
  }

  lines.push([...imports].sort().join("\n"));
  lines.push(``);

  // Generate code for each block
  let stepNum = 0;
  for (const b of blocks) {
    stepNum++;
    const sep = `# ${"─".repeat(60)}`;
    lines.push(sep);

    switch (b.kind) {
      case "input_circuit": {
        lines.push(`# Step ${stepNum}: Load circuit`);
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
        lines.push(``);
        break;
      }

      case "fake_backend": {
        const name = String(b.params.backend_name ?? "FakeFez");
        lines.push(`# Step ${stepNum}: Noisy simulator (${name})`);
        lines.push(`from qiskit.providers.fake_provider import ${name}V2`);
        lines.push(`backend = ${name}V2()`);
        lines.push(`noise_model = NoiseModel.from_backend(backend)`);
        lines.push(``);
        break;
      }

      case "ibm_backend": {
        const name = String(b.params.backend_name ?? "ibm_fez");
        lines.push(`# Step ${stepNum}: IBM live backend (${name})`);
        lines.push(`# Requires: pip install qiskit-ibm-runtime`);
        lines.push(`# from qiskit_ibm_runtime import QiskitRuntimeService`);
        lines.push(`# service = QiskitRuntimeService(channel="ibm_quantum", token="YOUR_TOKEN")`);
        lines.push(`# backend = service.backend("${name}")`);
        lines.push(`# noise_model = NoiseModel.from_backend(backend)`);
        lines.push(`#`);
        lines.push(`# For now, falling back to fake backend:`);
        lines.push(`from qiskit.providers.fake_provider import FakeFezV2`);
        lines.push(`backend = FakeFezV2()`);
        lines.push(`noise_model = NoiseModel.from_backend(backend)`);
        lines.push(``);
        break;
      }

      case "qucad": {
        const iters = Number(b.params.iterations ?? 3);
        const lam = Number(b.params.lam ?? 0.005);
        const rho = Number(b.params.rho ?? 500.0);
        lines.push(`# Step ${stepNum}: QuCAD — noise-aware VQC sparsification`);
        lines.push(`from qlib.qucad import run_qucad_training_noisy`);
        lines.push(``);
        lines.push(`# Bind free parameters to zero if circuit is parameterized`);
        lines.push(`if qc.num_parameters > 0:`);
        lines.push(`    qc_bound = qc.assign_parameters([0.0] * qc.num_parameters)`);
        lines.push(`else:`);
        lines.push(`    qc_bound = qc`);
        lines.push(``);
        lines.push(`theta, mask, history = run_qucad_training_noisy(`);
        lines.push(`    qc, noise_model, backend,`);
        lines.push(`    iterations=${iters}, lam=${lam}, rho=${rho},`);
        lines.push(`)`);
        lines.push(`qc = qc.assign_parameters(theta * (mask != 0))`);
        lines.push(`print(f"QuCAD: kept {int((mask != 0).sum())}/{len(mask)} parameters")`);
        lines.push(``);
        break;
      }

      case "qubound": {
        const cacheBackend = String(b.params.cache_backend ?? "ibm_fez");
        lines.push(`# Step ${stepNum}: QuBound — LSTM error-bound prediction`);
        lines.push(`from qlib.qbound import call_QuBound_from_cache`);
        lines.push(`from pathlib import Path`);
        lines.push(``);
        lines.push(`cache_path = Path("cache/ibm_history/${cacheBackend}.pkl")`);
        lines.push(`if qc.num_parameters > 0:`);
        lines.push(`    qc_eval = qc.assign_parameters([0.0] * qc.num_parameters)`);
        lines.push(`else:`);
        lines.push(`    qc_eval = qc`);
        lines.push(``);
        lines.push(`bound, model, meta = call_QuBound_from_cache(`);
        lines.push(`    qc_eval, cache_path, reference_backend=backend if 'backend' in dir() else None,`);
        lines.push(`)`);
        lines.push(`print(f"QuBound predicted error bound: {bound:.6f}")`);
        lines.push(``);
        break;
      }

      case "compvqc": {
        lines.push(`# Step ${stepNum}: CompressVQC — fold redundant gates`);
        lines.push(`from qlib.compvqc import get_LUT, quadraticProgram_luttoqp, admmOptimizedCompVQC, resultsCompressVQC`);
        lines.push(``);
        lines.push(`if qc.num_parameters > 0:`);
        lines.push(`    comp_backend = backend if 'backend' in dir() else None`);
        lines.push(`    if comp_backend is None:`);
        lines.push(`        from qiskit.providers.fake_provider import FakeFezV2`);
        lines.push(`        comp_backend = FakeFezV2()`);
        lines.push(`    lut = get_LUT(qc, comp_backend)`);
        lines.push(`    if lut:`);
        lines.push(`        qp = quadraticProgram_luttoqp(lut)`);
        lines.push(`        result = admmOptimizedCompVQC(qp, lut)`);
        lines.push(`        qc = resultsCompressVQC(qc, result, lut)`);
        lines.push(`        print(f"CompressVQC: compressed circuit depth {qc.depth()}")`);
        lines.push(`    else:`);
        lines.push(`        print("CompressVQC: no compressible pairs found")`);
        lines.push(`else:`);
        lines.push(`    print("CompressVQC: skipped (no parameterized gates)")`);
        lines.push(``);
        break;
      }

      case "qshot": {
        const snapshot = String(b.params.noise_snapshot ?? "pittsburgh_1");
        const alpha = Number(b.params.alpha ?? 0.95);
        lines.push(`# Step ${stepNum}: Qshot — noise-aware shot-count recommendation`);
        lines.push(`from qlib.qshot import get_recommender, resolve_noise_snapshot`);
        lines.push(``);
        lines.push(`if qc.num_parameters > 0:`);
        lines.push(`    qc_shot = qc.assign_parameters([0.0] * qc.num_parameters)`);
        lines.push(`else:`);
        lines.push(`    qc_shot = qc`);
        lines.push(``);
        lines.push(`noise_path = resolve_noise_snapshot("${snapshot}")`);
        lines.push(`recommender = get_recommender()`);
        lines.push(`result = recommender.predict(qc_shot, noise_path, alpha=${alpha})`);
        lines.push(`if result:`);
        lines.push(`    print(f"Qshot: recommended {result['recommended_shots']} shots")`);
        lines.push(`    print(f"  predicted fidelity: {result['predicted_fidelity']:.4f}")`);
        lines.push(`else:`);
        lines.push(`    print("Qshot: could not produce recommendation")`);
        lines.push(``);
        break;
      }

      case "fidelity": {
        lines.push(`# Step ${stepNum}: Fidelity estimate`);
        lines.push(`from qlib.qiskit_utils import simpleFidelityEstimator`);
        lines.push(``);
        lines.push(`fidelity = simpleFidelityEstimator(qc)`);
        lines.push(`print(f"Fidelity (statevector vs noisy): {fidelity:.6f}")`);
        lines.push(``);
        break;
      }

      case "output": {
        lines.push(`# Step ${stepNum}: Output summary`);
        lines.push(`print("\\n" + "=" * 60)`);
        lines.push(`print(f"Final circuit: {qc.num_qubits}q, depth {qc.depth()}, {qc.size()} gates")`);
        lines.push(`print(f"Gate counts: {dict(qc.count_ops())}")`);
        lines.push(`print(qc.draw(output='text', fold=120))`);
        lines.push(``);
        break;
      }
    }
  }

  // Footer
  lines.push(`# ${"─".repeat(60)}`);
  lines.push(`# End of exported pipeline`);
  lines.push(`# To run: python pipeline.py`);
  lines.push(`# Make sure qlib/ is on your PYTHONPATH (or run from the backend/ dir)`);

  return lines.join("\n");
}
