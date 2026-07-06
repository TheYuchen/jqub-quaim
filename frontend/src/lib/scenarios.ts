// Scenario loader — scripted, seed-reproducible UI states for the
// paper's figures (Wave P). One URL each: `?scenario=F3` boots the app
// straight into the state figure F3 is captured from, so any figure
// can be regenerated bit-exactly at any time (pinned seeds make the
// stochastic steps replay the identical draw; archive-backed scenarios
// render from the bundled demo archive, which is itself real seeded
// runs).
//
// Mechanics per scenario:
//   * graph + sampleKey are pushed through the SAME pendingRestore
//     bridge that archive restore uses — FlowCanvas rebuilds the
//     canvas, loads the sample circuit, pins the seed, restores the
//     precision target.
//   * autoRun rides on pendingRestore (autoRunAfter): FlowCanvas
//     requests the auto-run only AFTER the sample circuit has loaded,
//     which closes the race against the boot-time default-circuit
//     load (see FlowCanvas's pendingAutoRun consumer).
//   * uiState (workspace mode / evidence tab / pane expansion / gate
//     diff expansion) goes through small store bridges consumed by
//     App, ResultsPane and CircuitDiff.
//   * needsArchive scenarios force-import the bundled demo archive if
//     its records are missing (idempotent).

import type { SharePayload } from "./share";
import { useApp } from "./store";
import { listRuns } from "./runStore";
import { ensureDemoArchive } from "./demoArchive";

// -- graph builders ----------------------------------------------------------

/** Left-to-right chain layout, same spacing the presets use. */
function chain(
  nodes: { k: string; p?: Record<string, unknown> }[],
): SharePayload {
  return {
    v: 1,
    n: nodes.map((n, i) => ({
      i: `s${i + 1}`,
      k: n.k as SharePayload["n"][number]["k"],
      x: 80 + i * 260,
      y: 120,
      ...(n.p && Object.keys(n.p).length > 0 ? { p: n.p } : {}),
    })),
    e: nodes.slice(1).map((_, i) => ({ s: `s${i + 1}`, t: `s${i + 2}` })),
  };
}

/** QuCAD pipeline on the small VQC sample — the graph used by F1/F5. */
const QUCAD_GRAPH = chain([
  { k: "input_circuit" },
  { k: "fake_backend", p: { backend_name: "FakeFez", shots: 1024 } },
  { k: "qucad", p: { iterations: 3, lam: 0.005, rho: 500.0 } },
  { k: "fidelity", p: { method: "statevector", unbound_param_policy: "bind_zero" } },
  { k: "output" },
]);

/** Sampled-fidelity pipeline with a big shot budget — the F3 graph.
 *  4096 requested shots + a ±2pp target: bell_state's sampled point
 *  sits near 0.45 (ideal |00⟩ probability is 0.5), so the Wilson
 *  interval reaches ±2pp after roughly 2,300–2,500 shots — the run
 *  stops early and the evidence funnel shows both the narrowing AND
 *  the stop (verified against the live API with seed 424242). */
const FUNNEL_GRAPH = chain([
  { k: "input_circuit" },
  { k: "fake_backend", p: { backend_name: "FakeFez", shots: 4096 } },
  { k: "fidelity", p: { method: "sampled", unbound_param_policy: "bind_zero" } },
  { k: "output" },
]);

// -- scenario table ----------------------------------------------------------

export interface Scenario {
  key: string;
  /** What the figure shows — kept next to the state so the state and
   *  the caption can't drift apart. */
  expect: string;
  graph?: SharePayload;
  sampleKey?: string | null;
  /** Pinned root seed → the stochastic draw replays bit-exactly. */
  pinSeed?: number | null;
  precisionTarget?: number | null;
  /** Run the pipeline automatically once graph + circuit are ready. */
  autoRun?: boolean;
  workspaceMode: "compose" | "multiverse";
  evidenceTab?: "current" | "history" | "compare";
  /** Expand the right (Evidence) pane / open its mobile drawer. */
  expandEvidence?: boolean;
  /** F5: boot QuCAD cards with the gate-level diff <details> open. */
  openGateDiff?: boolean;
  /** F2/F4/F6 render from the bundled demo archive. */
  needsArchive?: boolean;
  /** F6: auto-select the two most-replicated configurations' latest
   *  successful runs for the interval comparison. */
  compareTopConfigs?: boolean;
}

export const SCENARIOS: Record<string, Scenario> = {
  // F1 — ribbon canvas after a run: tapered ribbons (width ∝ √gates),
  // green shrink taper on the QuCAD edge, delta-strip glyphs on node
  // faces, legend chip bottom-left. Pinned seed 336157917 (one of the
  // bundled vqc demo draws) so the numbers match the archive.
  F1: {
    key: "F1",
    expect:
      "Ribbon canvas post-run: QuCAD pipeline on vqc_2q_small, tapered ribbons + transformation glyphs.",
    graph: QUCAD_GRAPH,
    sampleKey: "vqc_2q_small",
    pinSeed: 336157917,
    autoRun: true,
    workspaceMode: "compose",
  },
  // F2 — multiverse board: one card per configuration (bell fidelity
  // ×14, vqc+QuCAD ×3), shared-scale outcome strips, baseline chip,
  // Δpp vs baseline with the honesty "(n small)" tag on the vqc card.
  F2: {
    key: "F2",
    expect:
      "Multiverse board over the bundled archive: small multiples, baseline Δ, (n small) tag.",
    workspaceMode: "multiverse",
    needsArchive: true,
  },
  // F3 — evidence funnel with an optional-stopping target: sampled
  // fidelity streams shot batches, interval narrows top-to-bottom,
  // run stops early at the ±2pp target (⏹ caption + warn tick marks).
  F3: {
    key: "F3",
    expect:
      "Evidence funnel: sampled fidelity on bell_state, ±2pp target reached around ~2,400 of 4096 shots → early stop.",
    graph: FUNNEL_GRAPH,
    sampleKey: "bell_state",
    pinSeed: 424242,
    precisionTarget: 0.02,
    autoRun: true,
    workspaceMode: "compose",
    evidenceTab: "current",
    expandEvidence: true,
  },
  // F4 — provenance lineage: History tab over the bundled archive,
  // which contains a pinned replay forked from an earlier bell run
  // (curved fork edge + seed ring) plus replicate bands/strips.
  F4: {
    key: "F4",
    expect:
      "Lineage view: fork edge from the pinned replay to its ancestor, replicate band + distribution strips.",
    workspaceMode: "compose",
    evidenceTab: "history",
    expandEvidence: true,
    needsArchive: true,
  },
  // F5 — gate-level circuit diff, expanded, on the QuCAD card of a
  // live run (kept/removed/added chips per qubit lane under the
  // before→after channel grid).
  F5: {
    key: "F5",
    expect:
      "QuCAD card with the gate-level diff open: per-qubit lanes of kept/removed/added operation chips.",
    graph: QUCAD_GRAPH,
    sampleKey: "vqc_2q_small",
    pinSeed: 336157917,
    autoRun: true,
    workspaceMode: "compose",
    evidenceTab: "current",
    expandEvidence: true,
    openGateDiff: true,
  },
  // F6 — interval comparison: the two most-replicated configurations
  // from the bundled archive side by side (config diff, CIs instead
  // of scalars, step-aligned transformation signatures).
  F6: {
    key: "F6",
    expect:
      "Compare view: bell-fidelity config vs vqc+QuCAD config, intervals + aligned signatures.",
    workspaceMode: "compose",
    evidenceTab: "compare",
    expandEvidence: true,
    needsArchive: true,
    compareTopConfigs: true,
  },
};

// -- activation --------------------------------------------------------------

/** Pick the latest successful run of each of the two most-replicated
 *  configurations — deterministic over the bundled archive. */
async function pickTopTwoRunIds(): Promise<string[]> {
  const runs = await listRuns(500);
  const byHash = new Map<string, typeof runs>();
  for (const r of runs) {
    const arr = byHash.get(r.config_hash) ?? [];
    arr.push(r);
    byHash.set(r.config_hash, arr);
  }
  const groups = [...byHash.values()]
    .map((list) => ({
      list,
      latestOk: list
        .filter((r) => r.ok)
        .sort((a, b) => b.created_at - a.created_at)[0],
    }))
    .filter((g) => g.latestOk != null)
    .sort((a, b) => b.list.length - a.list.length);
  return groups.slice(0, 2).map((g) => g.latestOk.run_id);
}

/**
 * Activate a scenario by key (case-insensitive). Returns false for
 * unknown keys so the caller can fall through to normal boot.
 */
export async function activateScenario(rawKey: string): Promise<boolean> {
  const sc = SCENARIOS[rawKey.toUpperCase()];
  if (!sc) return false;
  const app = useApp.getState();

  if (sc.needsArchive) await ensureDemoArchive({ force: true });
  if (sc.openGateDiff) app.setGateDiffDefaultOpen(true);
  app.setWorkspaceMode(sc.workspaceMode);

  if (sc.graph) {
    app.requestRestore({
      graph: sc.graph,
      sampleKey: sc.sampleKey ?? null,
      pinSeed: sc.pinSeed ?? null,
      sourceRunId: null, // scenario boot is not a fork of an archived run
      precisionTarget: sc.precisionTarget ?? null,
      autoRunAfter: sc.autoRun === true,
    });
  }

  if (sc.compareTopConfigs) {
    const ids = await pickTopTwoRunIds();
    if (ids.length === 2) useApp.setState({ compareIds: ids });
  }

  if (sc.evidenceTab) app.setPendingEvidenceTab(sc.evidenceTab);
  if (sc.expandEvidence) app.bumpHintExpandRightPane();
  return true;
}
