// Scenario loader — scripted, seed-reproducible UI states for the
// paper's figures (Wave P; F0 teaser added with the Evidence Theater
// wave). One URL each: `?scenario=F3` boots the app
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

/** Left-to-right chain layout, same spacing the presets use.
 *  Exported for lib/lessons.ts — guided lessons build their step
 *  graphs with the same helper so layouts can't drift. */
export function chain(
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

/** QuCAD pipeline on the small VQC sample — the graph used by F1/F5.
 *  This is the EXACT graph of the bundled vqc_2q_small demo records
 *  (src/data/demoArchive.json: ids n1..n5, sampled fidelity, same
 *  params and positions) — deliberately NOT a chain() rebuild.
 *  Node ids are part of per-node seed identity (seed =
 *  sha256(root_seed:node_id)) and the structural config_hash groups
 *  by kinds+params, so matching the archive bit-for-bit means
 *  (a) scenario runs land in the same multiverse/timeline group as
 *  the demo cards, and (b) pinning an archived record's root_seed
 *  replays that record's exact numbers. */
// Exported for lib/lessons.ts (lesson L3 re-uses the exact demo graph
// + pinned seed, so its "what did the optimizer do" claim reproduces
// the bundled record bit-for-bit).
export const QUCAD_GRAPH: SharePayload = {
  v: 1,
  n: [
    { i: "n1", k: "input_circuit", x: 40, y: 140 },
    {
      i: "n2",
      k: "fake_backend",
      p: { backend_name: "FakeFez", shots: 1024 },
      x: 300,
      y: 140,
    },
    {
      i: "n3",
      k: "qucad",
      p: { iterations: 3, lam: 0.005, rho: 500.0 },
      x: 560,
      y: 140,
    },
    {
      i: "n4",
      k: "fidelity",
      p: { method: "sampled", unbound_param_policy: "bind_zero" },
      x: 820,
      y: 140,
    },
    { i: "n5", k: "output", x: 1080, y: 140 },
  ],
  e: [
    { s: "n1", t: "n2" },
    { s: "n2", t: "n3" },
    { s: "n3", t: "n4" },
    { s: "n4", t: "n5" },
  ],
};

/** Sampled-fidelity pipeline with a big shot budget — the F3 graph.
 *  4096 requested shots + a ±2pp target: bell_state's sampled point
 *  sits near 0.49 (ideal |00⟩ probability is 0.5); batches are 512
 *  shots each, and the Wilson interval first reaches ±2pp at the 5th
 *  batch — the run stops early at 2,560 of 4096 shots and the
 *  evidence funnel shows both the narrowing AND the stop (verified
 *  against the live API with seed 424242: 1251/2560, ±1.94pp). */
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
  /** STABLE internal tab ids (see ResultsPane's EvidenceTab note):
   *  current = "This run" (scale 1), history = "This configuration"
   *  (scale 2), compare = "Between configurations" (scale 3). Figure
   *  provenance and these scenario definitions key on the ids, so the
   *  three-scales rename changed only the user-visible labels. */
  evidenceTab?: "current" | "history" | "compare";
  /** Expand the right (Evidence) pane / open its mobile drawer. */
  expandEvidence?: boolean;
  /** F5: boot QuCAD cards with the gate-level diff <details> open. */
  openGateDiff?: boolean;
  /** F2/F4/F6/F8 render from the bundled demo archive. */
  needsArchive?: boolean;
  /** F6/F8: auto-select the two most-replicated configurations'
   *  latest successful runs for the comparison. Over the bundled
   *  archive these are the two bell-state fidelity configs (512-shot
   *  ×9 records, 2048-shot ×5 — the shots param is part of the
   *  structural config hash, so they are distinct configurations). */
  compareTopConfigs?: boolean;
  /** F0: boot with the evidence theater overlay open (it would also
   *  auto-open on the first progress frame, but a pinned replay can
   *  be served from cache with NO progress frames — the theater then
   *  renders from the persisted trace, so it must be opened
   *  explicitly). */
  openTheater?: boolean;
  /** F7: stage two same-configuration archived runs in the theater's
   *  overlay-comparison mode (marker: theater-overlay). */
  overlayPair?: boolean;
}

export const SCENARIOS: Record<string, Scenario> = {
  // F0 — THE TEASER: the evidence theater over an optional-stopping
  // run. bell_state on FakeFez, 4096 requested shots (8 batches of
  // 512), sampled fidelity, target ±2pp, seed pinned to 2026.
  //
  // Seed choice (probed against the live API, 2026-07-05): with
  // bell_state's sampled point ≈ 0.47-0.50 on FakeFez the Wilson
  // width trajectory is essentially seed-independent (±4.31pp →
  // ±1.93pp over batches 1→5), so EVERY candidate stops at 2,560 of
  // 4,096 shots — mid-run, at batch 5 of 8. What differs is the point
  // path. Candidates: 7 (max inter-batch jump 1.01pp), 42 (1.17pp),
  // 99 (1.33pp), 31415 (2.93pp — jagged), 2026 (0.34pp). Seed 2026
  // wins: the point path [0.4902, 0.4893, 0.4909, 0.4878, 0.4844]
  // drifts gently, so the funnel reads as a clean symmetric
  // convergence rather than a random walk. Pinned result: 1240/2560
  // hit the ideal outcome, point 0.484375, final half-width ±1.934pp
  // ≤ the ±2pp target; 1,536 shots unspent.
  //
  // FILMSTRIP RECIPE (paper Fig: interaction sequence). The theater's
  // trace scrubber ("batch k of B", visible once the run is replayed/
  // archived, i.e. not streaming) renders the chart AS OF batch k, and
  // the camera exports exactly that state with trace_position: k in
  // the provenance. B counts EXECUTED batches (the persisted trace),
  // so F0 scrubs over "batch k of 5" even though 8 were planned.
  // All widths below verified against the live API (seed 2026,
  // 2026-07-05). Suggested 3-panel strip:
  //   1. boot ?scenario=F0, wait for the run to finish;
  //   2. scrub to batch 2 → export  (wide interval ±3.06pp, corridor
  //      not yet reached — "so far: 1,024 shots");
  //   3. scrub to batch 4 → export  (funnel narrowing, ±2.16pp, still
  //      outside the ±2pp corridor);
  //   4. scrub to "final"  → export  (batch 5: ±1.93pp ≤ target, ⏹
  //      early-stop annotation + 1,536 shots unspent hatch).
  // Files land as evidence-theater_F0_batch2.svg / _batch4.svg /
  // evidence-theater_F0.svg — each bit-reproducible from its own
  // embedded provenance (scenario key + seed + trace_position).
  F0: {
    key: "F0",
    expect:
      "Evidence theater teaser: streaming CI funnel on bell_state, ±2pp target reached at 2,560 of 4,096 shots (seed 2026, point 0.484375), cost row + unspent budget visible.",
    graph: FUNNEL_GRAPH,
    sampleKey: "bell_state",
    pinSeed: 2026,
    precisionTarget: 0.02,
    autoRun: true,
    workspaceMode: "compose",
    openTheater: true,
  },
  // F1 — ribbon canvas after a run: tapered ribbons (width ∝ √gates),
  // green shrink taper on the QuCAD edge, delta-strip glyphs on node
  // faces, legend chip bottom-left. Pinned seed 336157917 is the
  // root_seed of bundled demo record 5c2a6a71a7a4, and QUCAD_GRAPH is
  // that record's exact graph (ids included) — so the auto-run
  // reproduces the archived numbers bit-exactly (fidelity
  // 0.974609375, 998/1024) and groups with the demo cards.
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
  // F2 — multiverse board: one card per configuration (bell-512 ×9,
  // bell-2048 ×5, vqc+QuCAD ×3 — the shots param is part of the
  // config hash), shared-scale outcome strips, baseline chip,
  // Δpp vs baseline. Since Wave J every archive card carries ≥2048
  // pooled shots, so the Δ compares POOLED means and the "(n small)"
  // honesty tag stays off — the pooled band + "over N shots" line say
  // how much evidence backs each card instead.
  F2: {
    key: "F2",
    expect:
      "Multiverse board over the bundled archive: small multiples, pooled bands, baseline Δ of pooled means.",
    workspaceMode: "multiverse",
    needsArchive: true,
  },
  // F3 — evidence funnel with an optional-stopping target: sampled
  // fidelity streams shot batches, interval narrows top-to-bottom,
  // run stops early at the ±2pp target (⏹ caption + warn tick marks).
  F3: {
    key: "F3",
    expect:
      "Evidence funnel: sampled fidelity on bell_state, ±2pp target reached at 2,560 of 4096 shots → early stop.",
    graph: FUNNEL_GRAPH,
    sampleKey: "bell_state",
    pinSeed: 424242,
    precisionTarget: 0.02,
    autoRun: true,
    workspaceMode: "compose",
    evidenceTab: "current",
    expandEvidence: true,
  },
  // F4 — provenance lineage: the This-configuration tab (id: history)
  // over the bundled archive,
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
  // of scalars, step-aligned transformation signatures). Over the
  // bundled archive the top two ARE the two bell configs (512 vs
  // 2048 shots) — an earlier version of this comment claimed bell vs
  // vqc+QuCAD, stale since the config hash started separating the
  // shots param. Since the difference-funnel wave the
  // Between-configurations tab (id: compare)
  // also draws the Δ(B−A) funnel below the bars (see F8, which pins
  // the expected numbers).
  F6: {
    key: "F6",
    expect:
      "Compare view: bell-512 vs bell-2048 fidelity configs (the two most-replicated), intervals + aligned signatures + difference funnel.",
    workspaceMode: "compose",
    evidenceTab: "compare",
    expandEvidence: true,
    needsArchive: true,
    compareTopConfigs: true,
  },
  // F7 — theater overlay comparison: two archived replays of ONE
  // configuration on one axis pair ("same rule, different draws").
  // The deterministic picker below lands on the bundled archive's
  // bell-state 2048-shot config (the largest traced budget with ≥2
  // replicates) and takes its two most recent runs:
  //   A = run 0b485ca23b88 (seed 1892016523): 983/2048 ideal, point
  //       48.00% ±2.16pp, 8 batches ±6.08pp → ±2.16pp;
  //   B = run ca3a5193e0f1 (seed 2072686634): 1032/2048 ideal, point
  //       50.39% ±2.16pp, 8 batches ±6.06pp → ±2.16pp.
  // Expected visuals: blue (A) and amber (B) funnels on the shared
  // 256-shot batch grid (x-dodged ∓3.5 px), envelopes at low alpha
  // crossing through each other's intervals, per-run id+seed legend
  // in the context strip, final readouts dodged in the right margin
  // (A 48.00%, B 50.39% — final intervals overlap: consistent with
  // one underlying configuration), Between-configurations tab open behind the
  // theater with the "overlay in theater" chip visible. No target
  // corridor (these archive runs executed their full budget with no
  // stopping rule). Scrubbing to batch k truncates BOTH funnels in
  // lockstep. Export: evidence-theater-overlay_F7.svg (true-SVG,
  // AI-editable), provenance carries both run_ids + root_seeds.
  F7: {
    key: "F7",
    expect:
      "Theater overlay: two bell-2048 replays on one axis pair — A 983/2048 (48.00% ±2.16pp, seed 1892016523) vs B 1032/2048 (50.39% ±2.16pp, seed 2072686634); overlapping funnels, per-run legend, lockstep scrubber.",
    workspaceMode: "compose",
    evidenceTab: "compare",
    expandEvidence: true,
    needsArchive: true,
    overlayPair: true,
  },
  // F8 — DIFFERENCE FUNNEL (marker: difference-funnel): sequential
  // A/B evidence steering in the Between-configurations tab.
  // compareTopConfigs lands
  // on the bundled archive's two most-replicated configurations,
  // which differ ONLY in the fake_backend shots param (512 vs 2048),
  // so the funnel answers a real tuning question: "did raising shots
  // change the measured fidelity?" — it should NOT (shots buy
  // precision, not a different underlying value), which makes the
  // honest expected demo a null result.
  //
  // Expected end state, computed from src/data/demoArchive.json (the
  // node lane scripts/check_difference_funnel.test.ts derives the
  // same numbers from that JSON, so figure caption and data cannot
  // drift):
  //   A = bell-512: 9 archived records, but 7e401b5270b9 is a pinned
  //       REPLAY of f0cb7403bbae (root seed 815033775, identical
  //       247/512 counts) and is deduped as the same draw → 8 unique
  //       draws pooling 1,952/4,096 (47.66%).
  //   B = bell-2048: 5 records → 5,065/10,240 (49.46%).
  //   Difference trace (Δ = B−A, Newcombe 95%), x = shots consumed:
  //     t=1   2,560  Δ+1.61pp [−3.23, +6.42]
  //     t=2   5,120  Δ+3.93pp [+0.51, +7.32]  ← first excludes 0
  //     t=3..5       stays excluded (t=5: +2.67pp [+0.50, +4.82])
  //     t=6  13,312  Δ+1.68pp [−0.34, +3.69]  ← re-includes 0
  //     t=8  14,336  Δ+1.81pp [−0.00, +3.62]  final: NOT established
  //   Verdict: "not sustained — inconclusive". An early look at
  //   5,120 shots would have claimed a win that further evidence
  //   withdrew — the multiple-looks trap demonstrated on real draws.
  //   Choosing this null(ish) result as the headline demo is
  //   deliberate: the instrument's value is preventing false wins,
  //   not manufacturing dramatic ones.
  F8: {
    key: "F8",
    expect:
      "Difference funnel: bell-512 (8 unique draws) vs bell-2048 (5 runs) — Δ(B−A) established at 5,120 shots (+3.93pp) but NOT sustained (re-includes 0 at 13,312); final Δ+1.81pp [−0.00, +3.62] over 14,336 shots.",
    workspaceMode: "compose",
    evidenceTab: "compare",
    expandEvidence: true,
    needsArchive: true,
    compareTopConfigs: true,
  },
};

// -- activation --------------------------------------------------------------

/** The scenario activated on this boot, if any — figure exports embed
 *  it (provenance.scenario) and use it as the filename slug, so every
 *  figure names the one-URL recipe that regenerates it. */
let activeKey: string | null = null;
export function activeScenarioKey(): string | null {
  return activeKey;
}

/** Pick the latest successful run of each of the two most-replicated
 *  configurations — deterministic over the bundled archive. */
async function pickTopTwoRunIds(): Promise<string[]> {
  // Unbounded one-shot scan (audit S3 cap sweep): the documented F6/F8
  // pair must be found even when it has aged past any display window.
  const all = await listRuns(Infinity);
  // Scenario-boot records are scripted figure states, not evidence —
  // the same exclusion pickOverlayPairRunIds (F7) applies. The tag
  // also carries guided-lesson runs (scenario "L1"…"L4",
  // lib/lessons.ts): teaching artifacts, equally excluded. And when
  // demo-flagged records exist, prefer them EXCLUSIVELY: on a well-used
  // browser the user's own configurations can out-replicate the bundled
  // groups and silently swap which pair F6/F8 select — the documented
  // figure numbers must reproduce wherever the demo archive is present
  // (audit S2).
  const pool = all.filter((r) => r.scenario == null);
  const demo = pool.filter((r) => r.demo === true);
  const runs = demo.length > 0 ? demo : pool;
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

/** F7: two archived replays of ONE configuration, both carrying
 *  per-batch traces — deterministic over the bundled archive: among
 *  config groups with ≥2 ok traced runs, pick the group with the
 *  largest requested shot budget (bell-2048 in the bundled archive),
 *  then its two most recent runs, older one as A. */
async function pickOverlayPairRunIds(): Promise<string[]> {
  // Unbounded one-shot scan — same reasoning as pickTopTwoRunIds.
  const runs = await listRuns(Infinity);
  const tracedBudget = (r: (typeof runs)[number]): number => {
    let req = 0;
    for (const st of r.response.steps) {
      const d = st.distribution as
        | { kind?: string; trace?: unknown[]; shots_requested?: number; shots?: number }
        | null
        | undefined;
      if (d?.kind === "binomial" && Array.isArray(d.trace) && d.trace.length > 0)
        req = Math.max(req, d.shots_requested ?? d.shots ?? 0);
    }
    return req;
  };
  const byHash = new Map<string, Array<{ r: (typeof runs)[number]; req: number }>>();
  for (const r of runs) {
    // Scenario-boot records are scripted figure states, not evidence —
    // never let an accumulated F0 group hijack the F7 pair. Guided-
    // lesson runs ("L1"…"L4", lib/lessons.ts) ride the same tag and
    // are equally excluded.
    if (!r.ok || r.scenario != null) continue;
    const req = tracedBudget(r);
    if (req === 0) continue;
    const arr = byHash.get(r.config_hash) ?? [];
    arr.push({ r, req });
    byHash.set(r.config_hash, arr);
  }
  const groups = [...byHash.values()].filter((g) => g.length >= 2);
  groups.sort(
    (a, b) =>
      Math.max(...b.map((x) => x.req)) - Math.max(...a.map((x) => x.req)),
  );
  const g = groups[0];
  if (!g) return [];
  const latestTwo = g
    .map((x) => x.r)
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 2)
    .sort((a, b) => a.created_at - b.created_at); // A = the older one
  return latestTwo.map((r) => r.run_id);
}

/**
 * Activate a scenario by key (case-insensitive). Returns false for
 * unknown keys so the caller can fall through to normal boot.
 */
export async function activateScenario(rawKey: string): Promise<boolean> {
  const sc = SCENARIOS[rawKey.toUpperCase()];
  if (!sc) return false;
  activeKey = sc.key;
  const app = useApp.getState();

  // Mode first, before any await (audit S3): the forced demo import
  // below can take long enough that the persisted workspace mode
  // visibly paints and then flips. Scripted figure state, not a user
  // preference: write directly so the persisted quda.workspaceMode
  // survives (setWorkspaceMode would persist it).
  useApp.setState({ workspaceMode: sc.workspaceMode });

  if (sc.needsArchive) await ensureDemoArchive({ force: true });
  if (sc.openGateDiff) app.setGateDiffDefaultOpen(true);
  if (sc.openTheater) app.setTheaterOpen(true);

  if (sc.graph) {
    app.requestRestore({
      graph: sc.graph,
      sampleKey: sc.sampleKey ?? null,
      pinSeed: sc.pinSeed ?? null,
      sourceRunId: null, // scenario boot is not a fork of an archived run
      precisionTarget: sc.precisionTarget ?? null,
      autoRunAfter: sc.autoRun === true,
      // Archive pollution guard: every scenario auto-run archives a
      // RunRecord like any run (each F0 boot adds one bell-state
      // record). Tagging it RunRecord.scenario keeps scripted figure
      // states out of the theater's prior-evidence pool and out of
      // pickOverlayPairRunIds below — otherwise repeated F0 boots
      // would accumulate into a fake "replicate" group and distort
      // (or hijack) the evidence the figures claim to show.
      ...(sc.autoRun === true ? { scenario: sc.key } : {}),
    });
  }

  if (sc.compareTopConfigs) {
    const ids = await pickTopTwoRunIds();
    if (ids.length === 2) useApp.setState({ compareIds: ids });
  }

  if (sc.overlayPair) {
    const ids = await pickOverlayPairRunIds();
    if (ids.length === 2) {
      // The Between-configurations tab shows the pair (overlay chip); the
      // theater opens on top in overlay-comparison mode.
      useApp.setState({ compareIds: ids });
      app.setTheaterOverlay([ids[0], ids[1]]);
    }
  }

  if (sc.evidenceTab) app.setPendingEvidenceTab(sc.evidenceTab);
  if (sc.expandEvidence) app.bumpHintExpandRightPane();
  return true;
}
