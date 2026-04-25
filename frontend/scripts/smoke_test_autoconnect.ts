// Smoke test for autoConnect's corner cases. Print-and-eyeball style
// rather than assertion-based — the lab repo doesn't have a JS test
// runner wired up. Run with `npx tsx scripts/smoke_test_autoconnect.ts`
// from the frontend dir whenever you change autoConnect.ts; eyeball
// the output for: per-algorithm backend warnings (qucad hard-error,
// qubound/compvqc soft fallback, qshot self-contained), the dashed
// "noise profile" edge styling on backend → algorithm edges (skipped
// for qshot), and the source/sink/multi-backend advisory bullets.

import type { Edge, Node } from "@xyflow/react";
import type { QNodeData } from "../src/components/QNode";
import { autoConnect } from "../src/lib/autoConnect";
import type { NodeKind } from "../src/lib/nodeCatalog";

let counter = 0;
function n(kind: NodeKind, x = (counter += 100)): Node<QNodeData> {
  return {
    id: `n${counter}`,
    type: "qnode",
    position: { x, y: 0 },
    data: { kind },
  };
}

function run(label: string, nodes: Node<QNodeData>[], edges: Edge[] = []) {
  counter = 0;
  // Re-key positions so `n()` wasn't using stale counter
  nodes.forEach((node, i) => {
    node.id = `n${i + 1}`;
    node.position = { x: (i + 1) * 100, y: 0 };
  });
  const r = autoConnect(nodes, edges);
  console.log(`\n--- ${label} ---`);
  console.log(`  connected=${r.connected}, edges=${r.edges.length}, replaced=${r.replacedCount}`);
  for (const w of r.warnings) console.log(`  ⚠  ${w}`);
  for (const e of r.edges) {
    const dashed = (e.style as { strokeDasharray?: string } | undefined)?.strokeDasharray ? " (dashed)" : "";
    const lbl = e.label ? ` [${e.label}]` : "";
    console.log(`  → ${e.source} → ${e.target}${lbl}${dashed}`);
  }
}

// 1. empty canvas
run("1. empty canvas", []);

// 2. single block (input only)
run("2. single block", [n("input_circuit")]);

// 3. happy path — full QuCAD pipeline
run("3. full QuCAD pipeline", [
  n("input_circuit"),
  n("fake_backend"),
  n("qucad"),
  n("fidelity"),
  n("output"),
]);

// 4. QuCAD with NO backend → should emit hard warning
run("4. QuCAD without backend (hard error case)", [
  n("input_circuit"),
  n("qucad"),
  n("output"),
]);

// 5. QuBound with NO backend → soft fallback warning
run("5. QuBound without backend (soft fallback)", [
  n("input_circuit"),
  n("qubound"),
  n("output"),
]);

// 6. CompressVQC with NO backend → soft fallback warning
run("6. CompressVQC without backend (soft fallback)", [
  n("input_circuit"),
  n("compvqc"),
  n("output"),
]);

// 7. Qshot alone (no backend) → no backend warning at all
run("7. Qshot only (self-contained, no warnings expected)", [
  n("input_circuit"),
  n("qshot"),
  n("output"),
]);

// 8. Qshot WITH a backend → backend-ignored warning + plain (non-dashed) edge
run("8. Qshot + backend (backend should be flagged ignored, edge undashed)", [
  n("input_circuit"),
  n("fake_backend"),
  n("qshot"),
  n("output"),
]);

// 9. mix: QuCAD + Qshot, no backend → only QuCAD complains
run("9. QuCAD + Qshot, no backend (only QuCAD should hard-warn)", [
  n("input_circuit"),
  n("qucad"),
  n("qshot"),
  n("output"),
]);

// 10. mix: QuBound + CompressVQC + QuCAD, no backend
run("10. QuBound + CompressVQC + QuCAD, no backend", [
  n("input_circuit"),
  n("qubound"),
  n("compvqc"),
  n("qucad"),
  n("output"),
]);

// 11. multiple backends (last-wins warning)
run("11. two backends (last-wins warning)", [
  n("input_circuit"),
  n("fake_backend"),
  n("ibm_backend"),
  n("qucad"),
  n("output"),
]);

// 12. multiple sources
run("12. two sources", [
  n("input_circuit"),
  n("input_circuit"),
  n("fake_backend"),
  n("qucad"),
  n("output"),
]);

// 13. no sink
run("13. no Output", [
  n("input_circuit"),
  n("fake_backend"),
  n("qucad"),
]);

// 14. backend → qubound (legitimate noise sidechain, should be DASHED)
run("14. fake_backend → qubound (dashed expected)", [
  n("input_circuit"),
  n("fake_backend"),
  n("qubound"),
  n("output"),
]);

// 15. existing edges replacement
run(
  "15. canvas with existing edges (replacedCount > 0)",
  [
    n("input_circuit"),
    n("fake_backend"),
    n("qucad"),
    n("output"),
  ],
  [
    { id: "old1", source: "n1", target: "n2" },
    { id: "old2", source: "n2", target: "n3" },
  ],
);
