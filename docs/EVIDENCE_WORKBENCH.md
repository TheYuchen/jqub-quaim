# Evidence Workbench — the paper, stated as a system

This file is the single source of truth for the IEEE VIS submission
built around QuDA Studio. The sections below ARE the paper's skeleton;
the system's structure mirrors them one-to-one. The test every future
pixel must pass: **does it serve a scale?** If a proposed view, chip,
button or hint cannot name its scale (or its contribution) below, it
does not ship.

## 1. The narrative

**Evidence steering: sequential visual analysis of stochastic, costly
computational experiments — one grammar, three scales.** QuDA Studio
treats every pipeline execution as what it physically is: a stochastic
experiment whose evidence is bought shot by shot, minute by minute.
One visual grammar — a 95% interval narrowing as evidence
accumulates, drawn as a funnel against the cost axis — is
instantiated at three scales. **Scale 1, within a run:** the Evidence
Theater shows the Wilson interval narrowing over streaming shot
batches, and a precision target turns optional stopping into a visual
interaction ("stop when it's precise enough — keep the unspent
budget"). **Scale 2, across replicates of one configuration:** the
lineage renders every archived run as a distribution-weighted dot,
and pooled/certainty funnels show replicates compounding to a
1/√N-tighter interval; the theater overlay compares two draws of one
rule. **Scale 3, between configurations:** the difference funnel puts
one Newcombe interval on Δ(B−A) and accumulates it chronologically
across both sides' replicates — sequential A/B analysis whose verdict
can be watched, priced, and revoked. Everything else is supporting
cast: transformation signatures and the gate-level diff define what
"a configuration" IS (so replicates and comparisons have a stable
identity); the multiverse board is the portfolio entry point to
scale 3; circuit ribbons are context, not claim.

### 1.1 IA inversion (board = home)

The narrative implies an information architecture, and since the
IA-inversion wave the app enforces it: **configurations are the
first-class objects; the Evidence board is home; the Pipeline editor
is the subordinate definition view of one configuration.** Concretely:
the board is the default workspace (store default; last mode persisted
per device in `quda.workspaceMode`, so a first-ever visit and the
demo-archive landing are one path); board cards expand IN PLACE into a
scale-2 summary — recent-run dots on the shared evidence-mass
encoding, the pooled interval, and quick actions (replay latest, +3
replicates, open in editor, A/B) that run WITHOUT leaving home (marker
`card-expand`); and entering the editor from a card or the board's
"New configuration" button raises a context bar that names the
configuration being defined and re-derives its structural hash live as
the user edits — "edited: will archive as a new configuration #…" —
making configuration identity, the thing replicates and comparisons
key on, visible at authoring time (marker `config-context`, a C2
detail). Internal ids stay frozen ("compose"/"multiverse" in scenario
uiState, localStorage, provenance); only labels speak the new language
("Pipeline editor"/"Evidence board").

### 1.2 Grounding in documented practice

The task analysis behind the three scales is corpus-grounded (two
literature passes, 2026-07): each scale answers a *documented*
practice, a *documented* pain, or a *documented* absence, so the
paper cites its way through the taxonomy — the corpus substitutes
for formative interviews. Use EXACTLY the citations listed at the
end of this section; nothing here is folklore.

**Scale 1 (within a run) ← codified precision (P1) + adaptivity
hidden in optimizers (P4) + hard costs (T2).** Precision-gated
evidence is codified practice at the protocol layer: Quantum Volume
requires n_c ≥ 100 circuits and gates acceptance on a z = 2 "97.5%
one-sided confidence interval" (Cross et al. 2019, Appendix C);
randomized benchmarking has confidence-bounded prescriptions
(Wallman & Flammia 2014); Google's XEB claim sized its samples for
5σ (Arute et al. 2019); and Qiskit Runtime's EstimatorV2 exposes
`precision` as a first-class request parameter (default 0.015625 =
1/√4096 shots). Adaptive shot allocation exists too — but INSIDE
optimizers: iCANS (Kübler et al. 2020) and Rosalin (Arrasmith et
al. 2020) adapt shots per iteration under the hood, invisible to the
person running the experiment; our move is to surface that
shot-frugality to the interaction layer, where a human decides. And
the stopping decision is economically real, not a stylized cost
axis: IBM pay-as-you-go hardware bills $1.60 per second and the Open
Plan grants 10 minutes per 28-day window — unspent budget is money
and quota (surfaced in the theater's cost-anchor line, marker
`cost-anchor`, and in the cost chip tooltip).

**Scale 2 (across replicates) ← documented irreproducibility (P3) +
the tracking void (T1) + history fragility (T5).** Repetition is
normal and instability is documented, not anecdotal: Dasgupta &
Humble characterize run-to-run non-reproducibility and temporal
drift across calibration cycles (arXiv:2008.09612; Entropy
24(2):244); barren plateaus make any single trace an
unrepresentative draw (McClean et al. 2018); Qiskit's own docs state
the transpiler is stochastic and require seed_transpiler /
seed_simulator for reproducibility — seeds scattered across API
layers (P2: repetition is normal, reporting of it is chaotic). Yet
the tooling for replicates is a void: official VQE tutorials track
convergence with an in-memory list and matplotlib (T1); Gamage et
al. (QCE'25) had to graft MLflow onto quantum workflows to get any
experiment tracking at all; and platform history is fragile — IBM's
2025 classic-platform retirement made old job records inaccessible
(T5). Scale 2 is the missing replicate-level record: the archive,
lineage-as-distributions, pooled/certainty funnels.

**Scale 3 (between configurations) ← no difference-CI convention
(P5) + the benchmark-lottery critique (P2).** Bowles, Ahmed & Schuld
(2024) document the "benchmark lottery" in quantum ML — top-of-20
reporting, comparisons published without any interval on the
difference; QED-C's volumetric benchmarking (arXiv:2110.03137)
standardizes reporting — but at the DEVICE level, static, published
once. No difference-CI convention exists for configuration
comparison. (T3 wording fix, folded in: existing benchmark
ecosystems are device-level and static; ours is experiment-level and
single-user, a person steering their own comparisons in the loop.)
Scale 3 supplies exactly the missing convention: one Newcombe
interval on Δ(B−A), accumulated chronologically across both sides'
replicates, verdict watchable, priced, and revocable.

**The gap, stated once.** Statistical rigor for shot-bought evidence
is codified at the PROTOCOL layer (QV's one-sided CI gate, RB
confidence bounds, XEB's 5σ sizing) and automated at the OPTIMIZER
layer (iCANS/Rosalin shot-frugality), but it has never been surfaced
at the INTERACTIVE layer — where practitioners actually watch, stop,
replicate, and compare runs. That stratified absence — rigor above
the human in the protocols, rigor below the human in the optimizers,
nothing at the human — is the design opportunity the three scales
fill.

Grounding corpus (cite exactly these):

* Cross, Bishop, Sheldon, Nation, Gambetta. "Validating quantum
  computers using randomized model circuits." Phys. Rev. A 100,
  032328 (2019); arXiv:1811.12926. — QV: n_c ≥ 100 circuits, z = 2
  "97.5% one-sided CI" acceptance gate (Appendix C).
* Wallman, Flammia. "Randomized benchmarking with confidence." New
  J. Phys. 16, 103032 (2014).
* Arute et al. "Quantum supremacy using a programmable
  superconducting processor." Nature 574, 505–510 (2019). — XEB
  sample sizing for 5σ.
* Qiskit Runtime EstimatorV2 API docs — `precision` as a first-class
  request parameter, default 0.015625 = 1/√4096.
* Kübler, Arrasmith, Cincio, Coles. "An Adaptive Optimizer for
  Measurement-Frugal Variational Algorithms" (iCANS). Quantum 4, 263
  (2020).
* Arrasmith, Cincio, Somma, Coles. "Operator Sampling for Shot-frugal
  Optimization in Variational Algorithms" (Rosalin). arXiv:2004.06252
  (2020); PennyLane tutorial implementation.
* Dasgupta, Humble. Stability/reproducibility series:
  arXiv:2008.09612 (2020) and Entropy 24(2), 244 (2022). —
  documented run-to-run irreproducibility, drift across calibration
  cycles.
* McClean, Boixo, Smelyanskiy, Babbush, Neven. "Barren plateaus in
  quantum neural network training landscapes." Nat. Commun. 9, 4812
  (2018).
* Qiskit documentation — transpiler passes are stochastic;
  seed_transpiler / seed_simulator required for reproducibility.
* Bowles, Ahmed, Schuld. "Better than classical? The subtle art of
  benchmarking quantum machine learning models." arXiv:2403.07059
  (2024). — "benchmark lottery", top-of-20 reporting critique.
* Lubinski et al. (QED-C). "Application-Oriented Performance
  Benchmarks for Quantum Computing." arXiv:2110.03137. — volumetric
  plots; device-level, static.
* Gamage et al. arXiv:2507.06990 (IEEE QCE 2025). — grafting MLflow
  onto quantum experiment workflows (the tracking void, made
  explicit).
* IBM Quantum plans documentation
  (quantum.cloud.ibm.com/docs/en/guides/plans-overview) —
  Pay-As-You-Go $1.60/second; Open Plan 10 minutes per 28-day window.
* Qiskit issues #3689 and #13972; Trebugger
  (medium.com/qiskit/qiskit-trebugger) — documented demand for
  transpile-level diffing.
* IBM classic-platform deprecation announcement (2025) — jobs on the
  retired platform inaccessible (history fragility).

## 2. Contributions

* **C1 — the grammar + the paradigm** (one funnel, three scales;
  steering instead of monitoring). Where in the system: the Evidence
  Theater with precision-target stopping and trace scrubbing
  (scale 1); the lineage's per-band certainty funnels and the theater
  overlay (scale 2); the Compare tab's difference funnel with
  established/not-sustained verdicts, plus the multiverse board as
  the scale-3 portfolio. Figures: **F0 (teaser) + F0 filmstrip, F3,
  F7, F8, F2.**
* **C2 — the stochastic-provenance substrate** that makes steering
  replayable. Where: root/per-node/per-batch seed derivation with
  bit-exact pinned replay (early stops included); the IndexedDB run
  archive + archive import/export; lineage-as-distributions (evidence
  mass, fork edges); configuration identity via the structural config
  hash, made legible by transformation signatures and the gate-level
  circuit diff; per-batch traces persisted as provenance, so funnels
  render identically live, archived, and replayed. Figures: **F4,
  F1, F5.**
* **C3 — honesty devices** for sequential evidence. Where: intervals
  instead of scalars everywhere a quantity is sampled; "intervals
  overlap: not evidence" and the funnel-owned verdict line;
  optional-stopping coverage disclosure (M2) and the multiple-looks
  caveat on the difference funnel; replay-deduped pooling; "(n
  small)" suffixes and pooled-shots gates; the demo-data banner; and
  provenance-backed figure export (every figure regenerates from its
  own metadata). Figures: **F6, F8 (a deliberate null result), F0
  filmstrip panels.**

## 3. Figure plan

| fig | boots via | shows (scale · contribution) | export path |
|---|---|---|---|
| F0 teaser | `?scenario=F0` | theater funnel, ±2pp stop at 2,560 of 4,096 shots, unspent budget (1 · C1) | true-SVG `evidence-theater_F0.svg` |
| F0 filmstrip | F0 + scrub batch 2 / 4 / final | optional stopping as an interaction sequence (1 · C1+C3) | true-SVG ×3, `_batchK` suffixes |
| F1 | `?scenario=F1` | ribbon canvas post-run: √gates ribbons, delta-strip glyph faces (context · C2) | hybrid PNG |
| F2 | `?scenario=F2` | multiverse board: configuration small multiples, pooled bands, baseline Δ (3 · C1) | hybrid PNG |
| F3 | `?scenario=F3` | funnel on the fidelity card + early stop, This-run tab (1 · C1) | hybrid PNG |
| F4 | `?scenario=F4` | lineage: evidence mass, replicate bands + certainty funnels, fork edge (2 · C2) | hybrid PNG |
| F5 | `?scenario=F5` | gate-level circuit diff on the QuCAD card (config identity · C2) | hybrid PNG |
| F6 | `?scenario=F6` | interval comparison + aligned signatures, Between-configurations tab (3 · C3) | hybrid PNG |
| F7 | `?scenario=F7` | theater overlay: two replays of one configuration, one axis pair (2 · C1) | true-SVG `evidence-theater-overlay_F7.svg` |
| F8 | `?scenario=F8` | difference funnel: established at 5,120 shots, NOT sustained — the multiple-looks trap on real draws (3 · C1+C3) | true-SVG funnel camera / hybrid tab |
| planned | F7 + lockstep scrub | overlay filmstrip: two funnels truncated in lockstep (2 · C1) | true-SVG ×k |
| planned | F8 recompute at t=2 vs t=8 | "early win withdrawn" pair for the discussion section (3 · C3) | true-SVG ×2 |

Vector-vs-raster rationale and the per-camera table live in the
Wave Q section of the wave history below.

## 4. Related-work positioning

VACSEN (backend noise), Quantivine (large circuits), QuantumEyes /
VIOLET (circuit/QNN interpretability) are single-point tools; CHI'25
"Toward HQCI" is an interface-technique design space; QCE tooling
(QuBridge, CircInspect) is engineering without a vis-research
framing. Every node-wire pipeline tool we know of — in the quantum
stack and beyond it — is editor-centric: the graph canvas is home and
results live in side surfaces; ours is evidence-centric — the evidence
board is home and the editor is the subordinate definition view of one
configuration (§1.1). Nobody treats the *composition* as the object of analysis,
and nothing in the quantum stack — or in progressive/anytime
visualization generally — offers sequential-analysis steering:
progressive vis approximates a fixed answer ever better, while
evidence steering makes the stopping decision itself a first-class,
replayable, honestly-disclosed interaction (verified via adversarial
search, 2026-07). Provenance work assumes deterministic states; our
lineage nodes ARE distributions (Wave J). Optional stopping and
sequential A/B bring the statistics literature (Wilson/Newcombe
intervals, coverage-under-stopping caveats) into the visualization
loop instead of leaving it in the appendix. The nearest statistical
relatives are the shot-frugal optimizers — iCANS (Kübler et al. 2020)
and Rosalin (Arrasmith et al. 2020) — which adapt shots per iteration
INSIDE the optimization loop; evidence steering surfaces the same
frugality one layer up, as a human-facing visual stopping decision
(§1.2). On configuration identity: demand for transformation-level
diffing is documented (Qiskit issues #3689/#13972; Trebugger, the
third-party transpiler-debugging diff tool), but Trebugger diffs the
transpiler's own internal passes for debugging; our signatures + gate
diff give one uniform before→after vocabulary across ARBITRARY
pipeline steps, plugins included, in service of a stable notion of
"the same configuration".

## 5. System = paper structure

| paper section | system surface (internal id) |
|---|---|
| teaser | Evidence Theater over F0 |
| §3 grammar: the funnel | UncertaintyBlock funnel + theater (one motif, stated once, reused) |
| §4 scale 1 — within a run | Evidence pane tab "This run" (`current`) + theater as its expanded mode |
| §5 scale 2 — across replicates | tab "This configuration" (`history`): lineage, evidence mass, certainty funnels; theater overlay |
| §6 scale 3 — between configurations | tab "Between configurations" (`compare`): interval bars, prefix folding, difference funnel; Multiverse board as entry |
| §7 substrate (C2) | seeds/archive/replay, signatures + gate diff, ribbons as context |
| §8 honesty (C3) | disclosure devices across all tabs + provenance-backed figures |

The Evidence pane's three tabs carry the scales in the user's face:
tab labels are the narrative ("This run" / "This configuration" /
"Between configurations"), tab tooltips name the scales, and the
internal ids (`current`/`history`/`compare`) stay frozen because
scenario URLs and figure provenance key on them.

## Not done yet (ordered backlog)

* **Phase 3.5 leftovers** — pick-which-fidelity-node in comparison,
  dual-canvas visual diff, >2-way comparison.
* **Phase 4 leftovers** — opt-in interaction logging (schema first —
  needed for the user study). Reproducible export and the cost
  preview are DONE.
* **Gate-diff niceties** — pair remove+add of the same op with only a
  param change into a "modified" state; column-align lanes across
  qubits by circuit moment.
* ~~Distribution payloads for QuBound/Qshot~~ — CLOSED 2026-07-06,
  decided AGAINST adding payloads (rationale in the leftover-clearing
  wave section below and in both handlers).
* ~~Prewarm decision~~ — CLOSED 2026-07-06: cache schema gate +
  live-API regeneration (leftover-clearing wave below).
* **Formative study** — interview protocol before locking the task
  taxonomy (Meyer-Dykes INFORMED). Blocked on user's go-ahead.

## Conventions

Push to `github` + `hf` (jqub21/quaim) only; qudastudio/app is a
mirror synced ONLY on explicit request. After push: ~2-4 min rebuild,
smoke = /api/health + a pinned-seed run. Unit lane:
backend/tests/*.py runnable directly, no torch needed
(29 tests green as of d105dc7).

---

# — wave history —

Everything below is the chronological engineering log (shipped
items, encoding rationale, audits, verification numbers). It is
kept verbatim as the project's memory; the sections ABOVE are the
current truth and the paper skeleton.

## Shipped (commits 2efd890 → d105dc7)

1. **Provenance core (backend)** — every run gets run_id, seed_mode,
   root_seed, app_version. Fresh runs draw-and-record a root seed →
   any archived run is exactly replayable. Per-node seeds =
   sha256(root_seed, node_id): order-independent, graph-edit-local.
   Sampled fidelity honours the seed (seed_simulator) and emits a
   distribution payload (binomial successes/shots, Wilson 95% CI,
   top-16 counts). Cache: pinned runs live in a seed-salted prefix
   namespace and may cache stochastic steps; fresh runs keep the
   legacy namespace + nondeterministic bypass. SSE opens with a
   run_meta event.
2. **Run archive (frontend, IndexedDB)** — immutable RunRecord: graph
   (share-link serialization), full response, seed envelope,
   structural config_hash (ids/layout-independent), forked_from
   lineage. Server stays stateless by design.
3. **Timeline panel** — restore / replay(pin seed) / delete;
   config-hash chips group replicates; ×1/5/10/20 replicate runner
   (fresh seeds, sequential, per-run archiving).
4. **Distribution-first fidelity card** — CI bar, counts histogram,
   consumed seed, across-runs strip (one dot per archived replicate
   of the current config).
5. **Transformation signatures** — executor-level before/after
   structural snapshots (shape + ops counts) on every step, uniform
   across built-ins AND plugins. SignatureTile (canvas, e.g. "P-2")
   + SignatureCard (before→after grid + per-op chips + explicit
   pass-through line).
6. **Composition comparison** — two archived runs side by side:
   structural param diff, same-config detection ("differences are
   noise"), fidelity as two Wilson CIs on one scale with overlap
   callout ("intervals overlap: not evidence"), step-aligned
   signatures.

All verified on the live Space (pinned replay reproduces bit-exact;
5-replicate distribution accumulation; signature on QuCAD pruning of
vqc_2q_small showed P-2; interval-overlap callout fires).

## Shipped, second push (waves A–D, commits cfb84a4 → f25d955)

7. **Provenance lineage view** — history is now a real visualization:
   SVG lineage gutter (dots hued by config_hash, rings = pinned seed,
   hollow+slash = errored, bezier forked_from edges, lane bands for
   replicate groups), per-group distribution strips (dots on 0-1 with
   mean tick, buildup visible over time), hover = lineage-chain
   highlight. No new deps.
8. **Delta-strip signature glyph** — designed SVG glyph replaces text
   chips: fixed channel order D/G/P/Q, diverging bars around a zero
   axis (left/green = decrease = optimizer goal, right/amber =
   increase, qubits neutral), relative-change normalization capped at
   ±100%, constant silhouette via zero-ticks. Tile (46×14) and card
   (180×56) sizes; used on canvas nodes, results cards, comparison
   table. Per-op diverging bar list in the card.
9. **Gate-level circuit diff** — backend circuit_diff.py tokenizes
   per-qubit lanes (op + 3dp param fingerprint, ·c/·t role tags) and
   LCS-aligns before/after; executor copies the circuit pre-dispatch
   (mutation-proof) and stamps gate_diff into the transformation
   payload (≤12q, ≤600 gates, else truncated). Frontend lane view in
   the signature card (kept dimmed / removed green strikethrough /
   added amber). Live-verified: QuCAD on vqc_2q_small shows
   ry(theta_0) removed → ry(0) added, cx kept.
10. **Evidence pane IA** — pane renamed Evidence with three tabs
    (Current run / History / Compare), count badges, auto-switch on
    run start and on second compare selection.
11. **Comparison shared-prefix folding** — identical leading steps
    fold into one expandable row; first divergence gets an accent
    marker ("where do these compositions part ways?").
12. **Reproducible export** — exported Python embeds the provenance
    header (run_id/seed_mode/root_seed/app_version) and a
    _derive_seed helper reproducing the backend's per-node seed
    derivation, threaded into sampled fidelity as seed_simulator, AND
    (since the 2026-07-10 improvement wave) the run's
    precision_target re-sent as the `precision_target=` kwarg plus a
    `stop_target` header stamp — so an early-stopped run's script
    stops at the same batch instead of running the full budget; the
    exported script reproduces the archived run's exact draw.
    Shape-verified by scripts/check_export_python.test.ts (esbuild
    bundle + node, command in its header).

Backend test lane: 57 green (test_provenance_phase0 24,
test_gate_diff 14, test_workflow_helpers 11, test_seed_coverage 8).

## Shipped, third push (waves E-F, commits 324791f → 4bf1a9d)

13. **Circuit ribbon canvas** — the pipeline itself is now the
    visualization: custom React Flow edges render the circuit as a
    tapering ribbon (width = clamp(1.5·√gates, 3, 18)px per end, √ so
    4× gates reads as 2× width), green/amber downstream tint when a
    step shrank/grew the circuit; backend edges stay dashed (noise
    profile, not circuit flow). Node faces: full-width delta-strip
    glyph + micro CI bar for sampled fidelity. Dismissible canvas
    legend.
14. **Multiverse board** — Compose|Multiverse workspace toggle; every
    configuration as a small-multiple card: family-colored pipeline
    strip (topological), dots marking stages that differ from the
    baseline (most-populous config), outcome dot-strip with mean,
    Δmean vs baseline in pp with "(n small)" honesty suffix, Open
    (restore) and A/B (into compare) actions. This is the analyst's
    decision surface and the paper's second hero figure (multiverse
    analysis narrative anchor).

## Shipped, fourth push (claim-integrity wave)

15. **Seed coverage: QuBound + Qshot** — the last two stochastic
    handlers now honour the executor's per-node seed. QuBound: both ok
    paths (live IBM / cached-history pickle) always train the LSTM, so
    both seed the global RNGs via `_seed_stochastic_libs` (random +
    numpy + lazily-imported torch) AND thread `seed=` into qlib
    (Aer `seed_simulator`, Sabre `seed_transpiler`); results are
    `nondeterministic=True` + `seed_used`. Qshot: the pilot's
    "fixed" internal seed mixed in `hash(str(base))`, which Python
    salts per process — reproducible only until a restart. `pilot_seed`
    is now threaded `predict → recommend_shots → compute_pilot_pf`, so
    the recommendation is reproducible across processes given the
    seed; marked nondeterministic since fresh runs draw fresh seeds.
16. **Cost estimate chip** (`cost-estimate`) — `lib/costModel.ts`
    learns median per-kind step durations from the browser's own run
    archive (ok steps only, cache hits excluded) and the canvas
    toolbar shows "est ~Ns" (+ "M unknown" when a kind has no
    history) next to Run; ×N replicates add (N−1)×Σ(stochastic
    blocks), approximating the cached-prefix effect.

## Shipped, fifth push (first-contact wave, b84dc32 + 8829e2f)

17. **Noise-model memoization** — `AerSimulator.from_backend` /
    `NoiseModel.from_backend` rebuilt the full device model per
    sampled-fidelity/QuCAD step (~40-90 s GIL-bound each; the Space
    once queued >30 of these and served nothing else for an hour).
    Fake* snapshots are frozen → memoized by backend name
    (qlib/qiskit_utils.aer_simulator_for / noise_model_for; live IBM
    never cached). Live-verified: uncached sampled run now ~5 s.
18. **Bundled first-visit demo archive** — src/data/demoArchive.json:
    17 REAL RunResponses recorded against the live API (bell_state
    512-shot ×8 + 2048-shot ×5 for the CI-width A/B; vqc_2q_small
    QuCAD ×3 for P-2 + gate diff; one same-seed replay pair for the
    lineage edge). All seed-pinned = every record replayable
    bit-exact. lib/demoArchive.ts imports via buildRunRecord on first
    visit only (flag `quda-demo-decided`, empty-archive guard, lazy
    chunk), rebases created_at, lands the visitor on the Multiverse
    board. Honesty: `demo: true` flag, per-row chip, banner with
    "Clear demo data" on Multiverse + History. Tour slide 1 tagline
    reframed to the evidence story.

## Shipped, sixth push (Wave I — anytime evidence steering)

19. **Batched sampled fidelity with a replay-stable seed schedule** —
    sampled fidelity always executes as B = min(8, max(2, shots//128))
    batches (2048 → 8×256); batch i's Aer seed =
    sha256(f"{node_seed}:batch:{i}")[:4] % 2^31 (same construction as
    per-node seeds), so the first k draws are identical no matter
    where any previous run stopped — optional stopping cannot corrupt
    replays by construction. Wilson CI recomputed over ALL shots after
    every batch; qlib carries a deliberate duplicate of the app-layer
    Wilson fn (layering: qlib never imports app.*) pinned equal by a
    unit test. `meta.seed_scheme = "batch-sha256-v1"` marks payloads
    from the new schedule. BREAKING for pre-Wave-I archives: a single
    2048-shot draw with the node seed is a different random variable
    than 8 seeded 256-shot draws — the bundled demo archive was
    re-recorded against the live Space (scripts/rerecord_demo_archive
    .py preserves run_ids/lineage/created_at, swaps responses;
    RESUMABLE — walks records, caching each via the pinned step cache,
    exits on a per-record timeout so the sandbox's ~40 s process cap
    can't truncate a long batch). Migration status: COMPLETE
    (Wave J session, 2026-07-05) — the 3 vqc_2q_small records were
    finished with the fire-and-repoll pattern (first request warms the
    now-memoized noise model server-side and times out client-side;
    the re-request hits the pinned step cache instantly). All 17
    records now carry per-batch traces (bell 512 → 4 batches, bell
    2048 / vqc 1024 → 8), every trace's last frame equals the
    distribution totals, and the same-seed replay pair is bit-
    identical. Archive 110 KB.
20. **SSE progress protocol** — during a sampled step the stream
    interleaves `{"step_progress": {node_id, batch_i, n_batches,
    shots_done, successes, point, ci95}}` events between StepResults
    (batch_i is 1-based = batches completed). Executor mechanics: a
    plain callback can't make a generator yield, so in streaming mode
    ONLY (`emit_progress=True`) the fidelity dispatch runs on a worker
    thread whose `ctx["_progress_cb"]` feeds a queue that the executor
    drains and yields live; eager run_pipeline never sees progress.
    `_progress_cb`/`_precision_target` are injected around dispatch
    and popped like node_seed — never in cached ctx snapshots.
21. **Server-honoured optional stopping** — RunRequest gains
    `precision_target: float|None ∈ (0, 0.5]` (95%-CI half-width,
    absolute fidelity units; half-width = (hi−lo)/2 because Wilson is
    asymmetric near 0/1). The batching loop stops once the target is
    met, but never before 2 batches (a 1-batch "CI" is fake
    precision) and never flags a stop that only lands on the final
    batch. Honoured in BOTH endpoints (it's a stopping rule, not a
    rendering concern). distribution gains shots_requested /
    stopped_early / precision_target / n_batches / trace (the full
    cumulative per-batch CI trajectory — the funnel is provenance,
    not an animation). `distribution.shots` = shots actually
    EXECUTED, so every downstream CI comparison stays honest
    automatically. Precomputed-cache bypass when a target is set;
    pinned step-cache salt includes the target (same seed + different
    target = different numbers). Known limitation (disclosed in the
    code and the tooltip): width-based data-dependent stopping
    perturbs the exact nominal coverage of the final fixed-n 95%
    interval — second-order for width-keyed rules, and anytime-valid
    confidence sequences are the rigorous alternative (future work).
22. **Live narrowing UI + evidence funnel** — toolbar select
    "target: off|±5pp|±2pp|±1pp" (marker `precision-target`) next to
    the replicate selector, visible under a pinned seed because the
    target is part of what gets replayed. While a run streams,
    `liveProgress` (zustand) holds the latest frame per node and the
    QNode face renders a live-narrowing 0-1-scale CI band (CSS
    left/width transition = narrowing reads as motion) with a
    shots/batch counter stated in shots, not percent-done — "done" is
    the user's call. The fidelity card's UncertaintyBlock renders the
    **evidence funnel** (marker/class `evidence-funnel`): one thin
    line per batch on the same fixed 0-1 scale, oldest at top and
    most transparent (linear opacity ramp 0.14→0.55), narrowing into
    the main interval bar — the signature visual of the wave; it
    renders identically for live, archived and replayed runs because
    it reads the persisted trace. Target renders as two warn-colored
    ticks at point±target; early stop shows "⏹ stopped at N of M
    shots — target ±Xpp reached" plus a ⏹-chip with the shot count on
    the node face.
23. **Provenance of stopping** — RunRecord persists precision_target
    + stopped_early; restore/replay writes the target back into the
    toolbar (a replay without it would run all shots and reproduce
    nothing); history rows show a ⏹ marker for early-stopped runs
    (fewer shots — the wider CI already encodes that honestly).

Unit lane now 77 green (+ test_anytime_evidence 20: twin-Wilson pin,
batch-seed/plan determinism, accumulation==totals, early-stop trace is
a bit-exact PREFIX of the full run's trace, min-2-batches guard,
1/√n narrowing, stream-vs-eager bit-equality, pipeline-level
early-stop replay).

Live regression (deployed build, bell_state on FakeFez): a streamed
2048-shot run with no target delivered 8 step_progress frames arriving
BEFORE the fidelity StepResult (widths 0.122→0.086→0.070→… narrowing
monotonically across batches, ~14 s apart while sampling), final
distribution.shots == 2048, trace length 8; the replayed record's
per-batch (shots_done, successes) matched the live frames bit-for-bit
[(256,125),(512,255),(768,375),…]. A precision_target=0.05 run stopped
at 512/2048 shots (2/8 batches, half-width 0.0430 ≤ 0.05, point
0.4648); its pinned replay AND an independent recomputation under a
0.048 target both reproduced point 0.4648 / 238 successes / 512 shots
and the identical batch trace — optional stopping is bit-exactly
replayable.

## Shipped, seventh push (Wave J — uncertainty-in-provenance)

Premise: provenance visualizations everywhere assume deterministic
states; our lineage nodes ARE distributions. Wave J makes the archive
views answer "how did certainty accumulate over the session?" —
minimal honest version, no decoration without a task.

24. **Evidence mass in the lineage** (marker/class `evidence-mass`,
    RunHistory.tsx) — node dot AREA ∝ √(total shots the run's
    stochastic steps actually EXECUTED), radius 3–7 px against a
    FIXED 2048-shot reference (not view-normalized, same stability
    argument as the hash→hue mapping: a run keeps its weight across
    sessions and figures). Area not radius because dots read as
    quantities; √shots so one 4096-shot run cannot visually swallow
    eight 512s; runs with no sampled step keep the 3 px floor
    (absence of evidence, not zero size). Because
    `distribution.shots` records EXECUTED shots, an early-stopped run
    is automatically lighter than a full one — optional stopping is
    now legible in the provenance record itself. Ring (pinned), 
    hollow+slash (error), fork-edge endpoints and the hover target
    all track the radius. Tooltip gains "N shots of evidence".
25. **Replicate-group certainty funnel** (RunHistory.tsx) — alongside
    each contiguous replicate band, two thin polylines mirrored
    around the lane spine: at each run's row, the POOLED Wilson CI
    half-width of the band's binomial counts accumulated up to and
    including that run (oldest at the bottom ⇒ the funnel narrows
    upward ≈ 1/√N). Pooling = Σsuccesses/Σshots + one Wilson
    interval, valid because a config_hash group is replicates of ONE
    configuration ⇒ same underlying p (rationale comment in
    lib/stats.ts). Normalized per group (widest row → ±10 px): the
    task is the SHAPE of across-run accumulation; absolute numbers
    live in the tooltip ("pooled ±X.Xpp after n runs / N shots").
    Deliberately the same visual vocabulary as Wave I's within-run
    evidence funnel — one motif, two contexts: shots accumulating
    inside a run, runs accumulating inside a group. Only drawn when
    the band has ≥2 binomial runs.
26. **Pooled intervals where replicates aggregate** (lib/stats.ts new;
    MultiverseBoard.tsx, results/cards.tsx ReplicateStrip) —
    `wilson95` is a cited port of the backend's
    app/services/stats.py::wilson_interval (unit-anchor comments pin
    it to the live-regression numbers, e.g. wilson95(238,512) →
    ±0.0430); `runEvidence` sums a run's binomial payloads;
    `poolEvidence` pools runs. Multiverse cards with ≥2 binomial runs
    show "pooled μ x.x% ±y.ypp over N shots" plus a FILLED BAND on
    the 0-1 outcome strip — a deliberately different mark than the
    per-run dots (dots = single draws, band = the interval the pooled
    counts support). The Δ-vs-baseline line switches to comparing
    POOLED means when both sides have pools, and the "(n small)"
    suffix keys on pooled shots: ≥2048 on BOTH sides (worst-case
    Wilson half-width ≤ ±2.2pp = one full default budget per side) ⇒
    suffix off; otherwise the old replicate-count heuristic stands.
    The fidelity card's across-runs ReplicateStrip carries the same
    pooled summary line. Frontend-only: no server change, archived
    responses already carry the counts.

## Novelty roadmap (full-system review, 2026-07-05)

Honest standing: the shipped five (multiverse, lineage, signatures+gate
diff, interval comparison, ribbon canvas) are a strong design-study
core but individually assemble known vocabulary. Two more waves carry
genuinely unnamed ideas; both DEEPEN the existing narrative
(stochastic+costly evidence) rather than widening it:

* **Wave I — Anytime evidence steering** (SHIPPED — see items 19-23):
  sampled steps stream shot batches; CIs narrow LIVE on node faces
  and cards; a target-precision affordance ("stop at ±2pp") makes
  optional stopping a visual interaction. Sequential-analysis
  steering has no prior art in VIS. Pinned replay stays bit-exact via
  per-batch seeds derived from node_seed.
* **Wave J — Uncertainty-in-provenance** (SHIPPED — see items 24-26):
  lineage nodes ARE distributions; evidence mass as node weight,
  pooled-certainty funnels along replicate bands, pooled Wilson
  intervals wherever replicates aggregate. Minimal honest version —
  no decoration without a task.
* Wave K (paper discussion, not build): difference-of-differences
  ("did more shots help bell more than vqc?") as future work.

Audit bar for every wave: tsc+build+77 tests, live seeded regression,
pinned-replay bit-exactness, fresh-visitor first paint, encoding
rationale comments, this doc updated.

## Wave P — paper-first reorientation (SHIPPED 2026-07-05)

The system now serves the PAPER, not a product. Figures come from
here. Reviewers are vis people, not quantum people. Status per item:

1. **De-product — shipped.** Removed: WelcomeTour + tour/ slides,
   AuthButton/session UI (all auth effects stripped from App.tsx;
   backend HF OAuth routes remain but no frontend surface renders
   login), SupportPopover (NSF), PapersPopover, DevelopersPopover,
   Lab header link, UploadPluginModal + its palette trigger. The
   plugin protocol itself stays a live claim: manifests are still
   fetched, plugin blocks still render and execute — uploads happen
   via the API (`POST /api/plugins/upload`), which is how the paper
   exercises the protocol anyway. Kept: theme switcher, share links,
   Export .py. Header is now name + tagline + qiskit/torch chip +
   live-calibration toggle + theme. index.html title/meta and the
   PWA manifest are neutral (no lab branding in any mode).
2. **Figure export mode — shipped** (`lib/figureExport.ts`,
   `components/FigureExportButton.tsx`; camera buttons on the canvas
   toolbar, the Multiverse board header, and the Evidence pane
   header). Two serialization paths: TRUE-SVG when the target is an
   `<svg>` (lineage gutter, strips, glyphs, ribbon layer); HYBRID for
   HTML-heavy composites (canvas / board / evidence pane) —
   foreignObject SVG (vector text; some renderers can't rasterize
   foreignObject, hence…) PLUS a 2.5× PNG rendered through canvas as
   the always-works fallback. Paper transform on a cloned subtree
   with all computed styles inlined: forced white/light theme, fonts
   ×1.25, interactive chrome stripped (buttons, inputs, RF
   controls/minimap/attribution, tooltips, toasts, TipIcons).
   **Provenance-backed figures (the novelty twist):** every SVG
   embeds a `<metadata id="provenance">` JSON — app version, export
   ISO time, run_ids + root_seeds + config_hashes of every run
   visible in the view, and the canvas SharePayload — and a
   `.provenance.json` sidecar ships alongside for the PNG. A figure
   in the paper is therefore bit-exactly regenerable from the file
   itself: rebuild the graph from the payload, pin the recorded
   seed, replay.
3. **Scenario loader — shipped** (`lib/scenarios.ts`; boot hook in
   App.tsx). `?scenario=F0..F7` (F0 added with the Evidence Theater
   wave, see its own section below): F1 ribbon canvas post-run (QuCAD on
   vqc_2q_small, seed 336157917, auto-run), F2 multiverse board over
   the bundled archive, F3 evidence funnel with ±2pp optional stop
   (bell_state, 4096 shots, seed 424242, auto-run, early stop
   at 2,560 of 4096 shots — bell's sampled point sits near 0.49), F4 lineage with the archived fork+replay, F5 QuCAD
   card with the gate diff booted open (auto-run), F6 interval
   comparison of the two most-replicated archive configurations.
   Auto-run is sequenced through pendingRestore.autoRunAfter → the
   store's pendingAutoRun, consumed by FlowCanvas only when the
   scenario's expected circuit is loaded (ref-guarded against
   double-fire). Archive-backed scenarios force-import the bundled
   demo archive when its records are absent (idempotent).
4. **Non-quantum-reader pass — shipped.** `lib/glossary.ts` is the
   single source of plain-language gloss strings (shots, fidelity,
   backend, seed, intervals, replicate, configuration, …); node
   catalog descriptions/hints, results-card captions, toolbar
   titles, the Evidence seed chip and the Multiverse header now use
   task language with TipIcon glosses where a domain term must stay.
5. **Double-anonymous mode — shipped** (`lib/anon.ts`). Build-time
   `VITE_ANON=1` (the submission path) statically folds identifying
   strings OUT of the bundle: app name → "EvidenceQ", neutral
   tagline/title/manifest (vite plugin rewrites index.html + the PWA
   manifest), paper/bibtex metadata dead-code-eliminated from the
   node catalog, GMU theme dropped. Runtime fallback `?anon=1`
   (persisted in localStorage, `?anon=0` clears) hides the same
   surfaces on a normal build for review purposes. Audit result on
   the VITE_ANON=1 dist: zero user-visible identifying strings; the
   only case-insensitive grep hits are internal storage keys
   ("quda.*", IndexedDB "quda-provenance") and CSS/localStorage
   theme-key comparisons — never rendered, and renaming them would
   orphan returning users' persisted state. NOTE: the regular
   Space's URL is itself identifying — the submission deploys a
   FRESH anonymous Space built with VITE_ANON=1; the flag removes
   in-app identifiers only.
6. Re-audit of every view against "does this pixel serve a paper
   claim or figure?" — the removals above are the outcome; remaining
   surfaces (canvas+ribbons, multiverse, funnel, lineage, compare,
   share/export) each back a claim.

Both leftovers from before Wave P are now closed: the demo archive
re-record is complete (see item 19) and Wave J shipped (items 24-26).

## Adversarial audit fixes (2026-07-05)

A red-team audit of the deployed system (cache identity, scenario
lineage, statistical honesty, anonymity, encoding disclosures) found
1 critical + 3 medium + a batch of minor findings. All resolved:

* **C1 (critical) — pinned cache identity includes node ids.**
  `_prefix_hash` hashed only {type, data} per node while per-node
  seeds derive from sha256(root_seed:node_id): two id-renamed but
  structurally identical graphs under the same pinned seed shared
  cache entries yet owe different draws — live-demonstrated
  cross-graph poisoning (run B served run A's seeded numbers). Fixed
  by folding each node's id into the per-node hash payload in the
  salted (seed-pinned) regime ONLY; the fresh regime stays id-free so
  the precomputed/prewarm namespace is untouched (fresh runs never
  cache stochastic steps, so id-blind sharing is sound there).
  Regression tests: pinned hash id-sensitivity, fresh hash
  id-blindness, and an executor-level a1-vs-b1 same-seed test
  asserting B executes with its OWN derived seed and replays from its
  own cache entry. Unit lane now 80 green.
* **M1 — F1/F5 scenario graph now IS the archived graph.** The
  scenario loader rebuilt the QuCAD pipeline with ids s1..s5 and
  statevector fidelity while the bundled vqc demo records use n1..n5
  and sampled — so scenario runs neither grouped with the demo cards
  (different config_hash) nor reproduced the archived numbers under
  the borrowed pinned seed (node ids are seed identity). QUCAD_GRAPH
  is now a literal copy of demo record 5c2a6a71a7a4's graph (ids,
  params, positions); pinned seed 336157917 replays the archived
  fidelity 0.974609375 (998/1024) bit-exactly and groups with the
  demo replicates.
* **M2 — optional-stopping coverage limitation disclosed.** Width-
  based data-dependent stopping perturbs the exact nominal coverage
  of the final fixed-n 95% interval (second-order for width-keyed
  rules; confidence sequences are the rigorous alternative — future
  work). Stated in three places: the stopping-rule implementation
  (qlib/qiskit_utils.py), the Wave I section above, and the
  precision-target tooltip ("interval coverage is approximate under
  early stopping").
* **M3 — anon bundle fully scrubbed of the branded theme.** The
  VITE_ANON build now (a) strips the `[data-theme=gmu]` block from
  the emitted stylesheet (generateBundle hook) and (b) dead-code-
  eliminates the stored-preference fallback's key literal
  (`!ANON &&` gate in theme.ts, runtime behavior unchanged: ?anon=1
  still falls back to light). Post-fix audit of the anon dist:
  zero "gmu"/"Mason" hits anywhere; the only remaining internal
  identifiers are the documented "quda.*" storage keys and the
  "quda-provenance" IndexedDB name (never rendered; renaming would
  orphan returning users' persisted state).
* **Minors (disclosure honesty + dead code).** Delta-strip: outward
  arrowhead at the bar tip when |Δ/before| ≥ 100% (the cap used to
  saturate silently). Lineage legend: evidence-mass clause gains
  "(floor ≤69, cap 2048)" and the funnel clause "(per-group scale)".
  Ribbon legend: "(√gates, clamped)". Removed: the producer-less
  auth client block in api.ts, the pendingQuickStart store bridge +
  FlowCanvas consumer (its TrySlide producer died in Wave P), and
  stale tour comments.

## Evidence Theater (teaser view) — shipped 2026-07-05

Diagnosis: anytime evidence steering (Wave I) is the system's most
novel contribution, yet visually it was the SMALLEST element on
screen — a thin funnel strip inside a side-panel card, a 3-px live
band on a node face — while ordinary views owned the pixels. The
theater makes steering the visual protagonist: a dedicated, large,
self-explanatory view (`components/EvidenceTheater.tsx`, marker/class
`evidence-theater`) that the paper's teaser figure and the demo video
open with.

Mechanics: overlay over the center column (same pattern as the
Multiverse board, z-30 above its z-20 so it also works from the
board), auto-opens on the FIRST `step_progress` frame of a run —
i.e. the moment a sampled step starts streaming — dismissable, with a
"don't auto-open" preference persisted in localStorage
(`quda.theaterAutoOpen`, toggled inside the theater) and a toolbar
Theater button (marker `evidence-theater-open`) plus an "open
theater ↗" affordance on the fidelity card's uncertainty block to
reopen it. The store retains per-node progress frames WITH client
arrival timestamps (`theaterTraces`) from run start until the next
run starts, so the theater keeps the full live trace (including
timing) after the step completes; `theaterRun` records the streaming
run's config hash (computed at Run-click) and its run_id/root_seed
(delivered live by a new `onMeta` hook on `api.runStream`, fired on
the stream's opening run_meta event).

Encoding rationale (full version in the component's module comment):

* **X = shots executed, 0 → shots_requested, linear.** Shots are the
  costly resource; evidence bought reads as horizontal distance, and
  an early stop leaves visibly unspent axis (lightly tinted region +
  "N shots not spent") — the reward for steering stated in the cost
  currency. Batch-index or log axes would hide exactly that.
* **Y = fidelity estimate, auto-zoomed** to the first batch's point ±
  3× its half-width (extended to cover every interval, the target
  corridor and the archive band; clamped [0,1]). The cards' fixed 0-1
  scale is right for cross-run comparison but wrong for the
  protagonist view (a ±2pp target is ~4 px there). Anchoring the zoom
  on the FIRST interval keeps the axis stable while frames stream.
* **Funnel = per-batch Wilson CIs as vertical intervals** at their
  cumulative-shots x (opacity ramping toward now), connected by a
  shaded convergence envelope + a thin point-estimate path. Live runs
  grow it frame by frame; archived/replayed runs render the identical
  drawing instantly from the persisted `distribution.trace` — the
  trace IS provenance, so the figure never depends on having watched
  the run.
* **Target corridor** = two dashed warn-colored lines at point ±
  target with an early-stop vertical annotation ("⏹ stopped here —
  target reached at N of M shots"); with no target set, a ghost line
  of copy points at the toolbar affordance.
* **Cost axis** = secondary tick row under the X axis with the
  wall-clock gap between consecutive batch arrivals (CLIENT-side
  Date.now() at SSE arrival — server compute + network jitter, honest
  as a price tag, not a benchmark; first batch unlabeled because its
  gap includes worker spin-up), plus "evidence spent: N shots · T s"
  (total prefers the server's own step duration once the step
  completes).
* **Context strip** (inside the SVG so exports carry it): circuit
  label, config-hash chip (archive hue), root-seed chip — live from
  run_meta — and the pooled archive band: the Wilson interval this
  exact configuration has ALREADY accumulated (runs archived before
  this run started; pooling valid per lib/stats.ts; drawn only for
  single-sampled-node runs because `runEvidence` pools a whole run's
  counts). The streaming run visibly adds to a body of evidence.
* **Color**: accent/blue solid = this run's evidence; warn/amber
  dashed = the stopping rule; accent4/green filled band = archived
  evidence. Every hue doubled by a mark-type difference (colorblind
  safety). Multiple sampled nodes stack as ~250-px small multiples
  (scroll past 3).

The whole chart is ONE `<svg>` (context header included), so the
figure-export camera on the theater takes the TRUE-SVG path: vector
output with the provenance `<metadata>` embedded, correct under the
forced-light paper transform. Export view key: `evidence-theater`.

**F0 — the teaser scenario** (`?scenario=F0`): bell_state on FakeFez,
4096 requested shots (8×512 batches), sampled fidelity, target ±2pp,
seed pinned to **2026**, auto-run with the theater booted open (the
explicit open matters: a pinned replay can be served from cache with
no progress frames, in which case the theater renders from the
persisted trace). Seed choice, probed live 2026-07-05: at bell's
p≈0.47-0.50 the width trajectory is effectively seed-independent
(±4.31 → ±1.93pp over batches 1→5) so every candidate stops at 2,560
of 4,096 shots; candidates differed only in point-path jitter — seed
7: 1.01pp max inter-batch jump, 42: 1.17pp, 99: 1.33pp, 31415: 2.93pp
(jagged), 2026: **0.34pp** (path 0.4902, 0.4893, 0.4909, 0.4878,
0.4844 — a clean symmetric convergence). Pinned result: 1240/2560
ideal, point 0.484375, final half-width ±1.934pp ≤ ±2pp, 1,536 shots
unspent. The F0 theater export is the intended teaser figure.

## Wave Q — paper figure pipeline (SHIPPED 2026-07-05)

IEEE VIS is double-anonymous and reviewers judge FIGURES first, the
video second, a live demo rarely. This wave makes the export pipeline
publication-grade: Illustrator-editable vector output, exact
interaction SEQUENCES (filmstrips), and print-resolution rasters —
all still provenance-backed and bit-reproducible.

### Trace scrubbing in the Evidence Theater (filmstrips)

Once a run's trace is fully known — replayed or archived, i.e. NOT
streaming — the theater grows a scrubber row (marker `trace-scrub`):
slider + ‹/› steppers + "batch k of B", where B counts EXECUTED
batches (the persisted `distribution.trace`). Scrubbing to k renders
the chart AS OF batch k: intervals 1..k only, envelope truncated, the
panel title switches to "replay @ batch k of B — so far: N shots ·
point ±w", the bottom line reads "evidence spent: N of M shots", and
the ⏹ stop annotation appears only when the stop batch itself is
reached (the target corridor stays visible throughout — the RULE is
known from run start; live streaming draws it too). The live-run path
is untouched: the scrubber never appears while `running`, and a new
run resets the scrub. Multi-node small multiples clamp k per panel.

The derivation is pure (`scrubSeries` slices the same persisted
trace), so scrubbed figures are bit-reproducible: same trace + same k
⇒ same SVG. (One honesty note: a run you just watched live retains
its client-arrival wall-time row, truncated to batch k — that row is
arrival-time dependent by design. Pinned replays served from the step
cache carry no client timing, so the F0 recipe's panels are
bit-identical across machines and sessions.) The camera in a scrubbed
state exports exactly that state, embeds `trace_position: k` in the
provenance JSON, and suffixes filenames with `_batchK`.

**F0 filmstrip recipe** (also in lib/scenarios.ts next to F0; widths
live-verified 2026-07-05, seed 2026): boot `?scenario=F0`, wait for
the run to finish, then export three states —

| panel | scrub | shows | exact numbers |
|---|---|---|---|
| 1 | batch 2 of 5 | wide interval, corridor unmet | 1,024 shots, point 0.4893, ±3.06pp |
| 2 | batch 4 of 5 | funnel narrowing, still outside ±2pp | 2,048 shots, point 0.4878, ±2.16pp |
| 3 | final | ⏹ stop + unspent budget | 2,560 of 4,096 shots, point 0.484375, ±1.93pp ≤ target |

Files land as `evidence-theater_F0_batch2.svg`, `_batch4.svg`,
`evidence-theater_F0.svg` — each regenerable from its own embedded
provenance (scenario key + seed + trace_position).

### Illustrator-grade true-SVG export

Adobe Illustrator cannot resolve CSS custom properties, ignores
`<style>` blocks with classes, and mishandles `currentColor`. The
TRUE-SVG path (taken when the camera's target IS an `<svg>`) now
produces AI-editable files:

* **All presentation inlined as literal attributes.** The clone
  walker (`cloneSvgForPaper` in lib/figureExport.ts) reads every
  whitelisted property from the SOURCE element's `getComputedStyle`
  (var()/currentColor already resolved by the browser, under the
  forced light theme) and writes it as a presentation attribute.
  Whitelist: fill, stroke, stroke-width, stroke-dasharray,
  stroke-linecap, stroke-linejoin, opacity, fill-opacity,
  stroke-opacity, font-family, font-size, font-weight, font-style,
  text-anchor, dominant-baseline, letter-spacing, stop-color,
  stop-opacity. Defaults are omitted (lean files) except `fill`,
  always written on paintable elements so every element is
  self-describing. class/style attributes are dropped; SVG `<title>`
  tooltip elements (interactive chrome) are stripped.
* **Real `<text>` with concrete font stacks.** All theater/lineage/
  glyph SVG labels are genuine `<text>`/`<tspan>` (audited — no
  foreignObject/HTML text in any SVG subtree). Computed families
  (ui-sans-serif/system-ui) are mapped to "Helvetica, Arial,
  sans-serif"; mono (hashes, seeds) to "Menlo, Consolas, 'Courier
  New', monospace". Font sizes carry the ×1.25 paper bump (same
  factor as the hybrid path).
* **Sizing.** viewBox preserved + explicit width/height in pt
  (1px = 0.75pt), computed FROM THE VIEWBOX, not the rendered
  bounding rect — exports are independent of the browser window
  (a filmstrip's panels are the same size regardless of when/where
  they were captured). Standalone XML declaration prepended.
* **Verification.** The decision logic is pure
  (`lib/svgPaper.ts`) and unit-tested in plain node —
  `node --experimental-strip-types scripts/check_svg_paper.test.ts`
  — covering var()-resolution pass-through, px normalization, font
  mapping, the fill="none" survival case, and the string finalizer.
  `auditIllustratorSafety()` additionally greps every exported file
  for `var(`, `currentColor`, `class="`, `<style` at export time and
  console-warns on violations (never blocks the download); expected
  count in exports: zero of each.

The HYBRID (foreignObject) path is NOT Illustrator-editable by
nature — AI won't rasterize foreignObject — which is exactly why the
PNG ships alongside; the hybrid SVG also gets the XML header and
class-stripping (styles are fully inlined cssText).

### Print-resolution raster + export scale

The hybrid PNG uses EXPLICIT pixel dimensions: canvas width/height =
css px × scale, never multiplied by devicePixelRatio — a 2.5× export
is 2.5× on every machine. Default 2.5×; **4× print-resolution via
alt/⌥-click or press-and-hold (≥550 ms) on any camera button**.

File naming ties every artifact to its regeneration recipe:
`<view>_<scenario|runid>[_batchK]` as the base —
`<base>.svg`, `<base>_<scale>x.png`, `<base>.provenance.json`
(e.g. `multiverse_F2_4x.png`, `evidence-theater_F0_batch2.svg`).
The slug prefers the active scenario key (now recorded by the
scenario loader and embedded as `provenance.scenario`), falling back
to the first visible run_id.

### Figure planning: vector-safe vs raster-only (per camera)

| camera / view | export path | print guidance |
|---|---|---|
| Evidence Theater (`evidence-theater`) | TRUE-SVG — AI-editable vector | use the SVG directly; teaser + filmstrips |
| Canvas (`canvas`, React Flow + ribbons + glyph faces) | HYBRID | use the PNG (4× for full-width figures) |
| Multiverse board (`multiverse`) | HYBRID | use the PNG |
| Evidence pane (`evidence-current/history/compare` — cards, lineage gutter, funnel strips, signature glyphs, gate-diff chips) | HYBRID | use the PNG |

Nuance for planning: the lineage gutter, outcome/pipeline strips and
signature glyphs ARE self-contained SVG subtrees (real `<text>`,
whitelisted presentation) and would take the true-SVG path if a
camera ever targeted them directly — candidates for dedicated
cameras if a figure needs them vector. The gate-diff chips and
evidence cards are HTML (raster-only forever); the canvas is a React
Flow HTML/SVG composite (raster-only as a whole).

### AI-editability guarantees (what a figure file promises)

1. Opens in Illustrator with editable text objects (concrete font
   stacks, no webfont/classes dependency).
2. Every color literal at export time under the print (light) theme —
   zero `var(`/`currentColor`/`class=`/`<style` (audited per export).
3. Sized in pt from the viewBox — window-independent, so re-exports
   are geometrically identical.
4. Provenance `<metadata id="provenance">` embedded (app version,
   export time, scenario key, run_ids/root_seeds/config_hashes,
   SharePayload graph, trace_position when scrubbed) + the
   `.provenance.json` sidecar for raster-only use. Note: Illustrator
   may drop `<metadata>` on re-save — the sidecar is the durable
   copy; keep it next to the .ai file.

## UX comprehension + polish wave (SHIPPED 2026-07-06)

Reviewers see the paper, not the site — double-blind treatment of the
SITE is no longer needed, so onboarding affordances returned. VITE_ANON
machinery stays fully working for possible future use (the tour brands
itself only via APP_NAME, so anon builds show the neutral codename).

1. **Welcome tour restored** (`components/WelcomeTour.tsx`, single
   file). The Wave-P-deleted modal shell was resurrected from git and
   ALL content rewritten for the current system — five slides:
   (1) what this is: seeded/archived/replayable experiments,
   "evidence, not just output"; (2) compose & run: ribbons = circuit
   flow, node faces = delta strip + CI bar; (3) evidence accumulates:
   ×N replicates, lineage (hue = configuration, dot area = shots),
   funnel, precision-target stopping; (4) compare & explore:
   multiverse + honest A/B ("overlap ≠ evidence"); (5) try it: demo-
   archive first moves, an "Open Multiverse" button, ?scenario=F0
   pointer. Copy ≤~60 words/slide, task language, TipIcon glosses
   from lib/glossary.ts, one theme-token SVG per slide. Auto-opens on
   first visit (flag `quda-tour-seen-v2`) EXCEPT under ?scenario=
   boots (figure states must not be covered); a TopBar "Tour" button
   reopens it. Keyboard: Esc / ← →.
2. **GMU theme removed entirely** — theme.ts (ThemeKey = light|dark),
   index.css token block, vite.config.ts %THEME_KEYS% (now always
   ["dark"]) and the anon CSS-stripping generateBundle hook (nothing
   left to strip). A stored "gmu" preference migrates to the light
   default; the migration comment is the only residual mention of the
   key in the codebase.
3. **Comprehension audit** — walked every interactive element; fixed:
   ×N selector now discloses prefix-caching, precision-target selector
   discloses that the target is archived + replayed, Evidence tabs
   gained title tooltips, the two funnels cross-reference each other
   (one motif: shot batches within a run / runs within a group),
   the multiverse card key moved into the always-visible header
   TipIcon (was lg-only), EmptyCanvas closes the drag → Run →
   evidence loop.
4. **UI conventions written down** — index.css carries a
   UI-conventions comment block (type scale with a 9px floor, label
   casing rules, chip paddings + deliberate exceptions, percent/pp
   decimal rules, mono/tabular-nums for numbers). Drift fixed: two
   8px labels → 9px, one section label missing tracking-wider, one
   mixed-decimal summary line.

Known remaining first-contact rough edges (copy alone won't fix;
candidates for a future wave): (a) the first-visit Multiverse landing
relies on the tour + demo banner for orientation — the board itself
has no empty-state-style intro once cards exist. Items (b) restore
silence and (c) Compare reachability were fixed in the
leftover-clearing wave below.

## Leftover-clearing wave (SHIPPED 2026-07-06)

Six known leftovers closed. Verification bar per change: tsc + build,
backend unit lane green, live checks where the server is involved.

1. **Precomputed disk cache: schema gate + regeneration (the critical
   one).** The 36 shipped cache entries predated the provenance rework
   — no transformation/distribution/seed fields — yet still VALIDATED
   as RunResponses (new fields default to None), so a hit would have
   served a first-time visitor a run with no ribbons, glyphs or CIs.
   Investigation found something better and worse at once: every key
   had silently gone UNREACHABLE, because the cache key hashes the
   circuit's QPY bytes and a qiskit upgrade (now 2.3.0 on the Space)
   changed them — AND the script's preset mirror had drifted from the
   frontend's defaultData (`rho: 500.0` vs the `500` a JS number
   serializes to; missing fidelity `method`/`unbound_param_policy`).
   So nobody was being served stale schema — everyone was paying full
   price for every preset run. Fixes, layered:
   * `run_cache.py` stamps `cache_schema: 2` on write and treats any
     entry without the CURRENT stamp as a miss (logged once per key
     per process). Writes also scrub the envelope (run_id/seed_mode/
     root_seed = null): the disk cache is seed-free by design — the
     serving route advertises root_seed=None ("no seed drawn" chip
     tooltip, verified present in ResultsPane) because cached numbers
     were not produced with the requester's draw. Per-step `seed_used`
     stays: it is the honest record of how the numbers were produced.
     Unit lane: tests/test_run_cache.py (6 tests — legacy shape is a
     miss, wrong stamp is a miss, roundtrip serves, stamp+scrub on
     write, corrupt file, log-once).
   * The 36 dead files are deleted; the cache is regenerated from the
     LIVE API by `scripts/regenerate_precomputed_cache_live.py`:
     responses recorded fresh-mode (no seed) against the deployed
     runtime, keys computed locally with `compute_cache_key`, and the
     script REFUSES to run unless local qiskit == live
     /api/health qiskit (the only way keys can match; a
     `--system-site-packages` venv with `pip install --no-deps
     qiskit==<live>` suffices). Resumable (`--budget-seconds`, skips
     existing files) for the sandbox's ~40 s process cap.
   * Coverage decision: only the torch-light presets are cached —
     qucad + compvqc × all 9 samples (18 entries, each a deterministic
     statevector pipeline, 1-10 s live). qubound / qshot / full stay
     absent ON PURPOSE: the schema gate makes them run fresh, and a
     slow true answer beats an instant stale one (their LSTM/GNN runs
     are also poor cache citizens: one training draw frozen forever).
   * `precompute_preset_results.py`'s preset mirror is fixed to match
     the frontend byte-for-byte, with a comment naming both silent-
     miss traps (JS integer serialization; QPY qiskit-version drift).
2. **TipIcon tooltip portal.** The CSS-only bubble clipped inside
   every overflow ancestor (Evidence pane scroll body). Now
   `createPortal` to document.body, `position: fixed` from the
   trigger's getBoundingClientRect, measured-then-placed (one hidden
   layout pass), flips above/below by viewport space, clamps
   horizontally, closes on any scroll (capture) or resize. Hover +
   focus/blur still drive it; the trigger keeps an sr-only copy of
   the hint (accessible name unchanged), the bubble is aria-hidden +
   pointer-events-none. Figure export safety: trigger keeps
   `data-export-strip`, and the bubble lives on document.body —
   outside every subtree a camera clones. No new deps.
3. **Restore/replay canvas pulse.** When the provenance bridge applies
   a pendingRestore (History restore/replay AND scenario boots — same
   code path), every restored node gets a `.restore-pulse` class:
   one 1.2 s accent box-shadow ring swelling out and fading
   (index.css), class stripped after 1.4 s via a functional setNodes
   so drags inside the window aren't clobbered and the next restore
   re-triggers. Rationale in-code: the canvas swap happens behind the
   pane the user clicked in; a silent mutation disorients. The global
   prefers-reduced-motion rule collapses the animation.
4. **Compare reachability (one hop from where the question arises).**
   (a) RunHistory: while exactly ONE compare checkbox is ticked, a
   status chip at the panel top says "1 of 2 picked — tick one more
   run to compare, or A/B a card in Multiverse" (the first tick used
   to feed only a tab badge the user may never look at). (b) Fidelity
   card: when the archive holds ≥2 runs of the current configuration,
   the across-runs strip grows a "compare vs previous run of this
   configuration ↗" link (marker `compare-vs-previous`) that sets
   compareIds to the two latest run_ids via the new store action
   `setCompareIds` — the Evidence pane's existing length===2
   auto-switch does the rest.
5. **Small-panel legibility.** (a) EvidenceTheater: the three right-
   margin readouts (final/so-far, target ±, archive pool) now go
   through `dodgeMarginLabels` — anchors sorted, tops pushed ≥12 px
   apart (more for 2-line blocks), clamped to the plot — but ONLY in
   the multi-node small-multiple layout (panelH 250): the single-panel
   F0 teaser/filmstrip exports are recorded bit-exact SVGs and keep
   their original anchors (including the old pool-vs-final nudge,
   which the dodge subsumes where active). SUPERSEDED 2026-07-06:
   the multi-node-only restriction was the wrong call — see "Theater
   margin labels: universal dodge pass" below. (b) Multiverse
   PipelineStrip node cap 14 → 11 (+k overflow chip): 14 squares are
   233 px and overflow the 240 px card floor's ~210 px content box;
   11 + "+k" fits, so long pipelines degrade to an explicit count
   instead of an invisible crop.
6. **QuBound/Qshot distribution payloads — decided: NO payload.**
   The criterion that separates them from sampled fidelity: a
   within-run distribution payload is honest when the step's own
   computation already CONTAINS replication (1024 shots → binomial
   counts for free). Both of these consume their stochasticity in a
   single draw per run — QuBound trains one LSTM and emits one bound
   (k restarts would cost minutes each; training-loss residuals are
   not a sampling distribution of the prediction), Qshot runs one
   seeded pilot → one fit → one inverted shot count (bootstrap
   re-fits would be needed for a real interval; fit residuals measure
   curve misfit, not decision uncertainty — and the pilot points
   already render in the card as the "where the curve came from"
   chart). For single-draw-per-run steps the honest uncertainty view
   is ACROSS runs: fresh seeds make replicates independent draws, and
   the archive's replicate machinery (history strips, multiverse
   outcome strips) is the correct representation. Known limitation,
   recorded not hidden: those strips key on the FIDELITY headline and
   a fixed 0-1 scale, so a QuBound-preset pipeline (no fidelity node)
   accumulates replicate rows without a value strip; giving decision
   metrics their own scales is a separate design question, opened
   only if a case study needs it. Decision comments live in both
   handlers.

## Theater margin labels: universal dodge pass (SHIPPED 2026-07-06)

The leftover-wave item 5(a) above scoped `dodgeMarginLabels` to the
multi-node small-multiple layout to keep the recorded F0 exports
bit-exact. That was the wrong trade: the collision it prevents hits
hardest in the DEFAULT single-panel hero view, in the most common
success case. A run that stops at its precision target has, by the
stopping rule itself, final half-width ≈ target — so y(final point)
and y(point + target) are inherently about one text line apart and
the blue "final: …" readout overprints the amber "target ±" tag.
The old single-panel stand-in (nudge final up 24 px when the archive
pool label was within 30 px) made it deterministic: at typical zoom
the ±target corridor offset is ≈ 24 px, so the nudge landed final
EXACTLY on the target tag (user-reported with a screenshot: jumbled
orange/blue text, green archive block just beneath).

Now (EvidenceTheater.tsx, layout-contract comment in `Panel`): the
right margin is one readout column and ALL its blocks — final/so-far
(2 lines), target tag (1 line), archive pool (2 lines) — run through
`dodgeMarginLabels` in every layout: anchors sorted by data y, tops
separated by ≥ max(12, blockHeight+2) px (2-line blocks reserve
~28 px), clamped into the plot band. The ad-hoc pool nudge is
deleted — the dodge subsumes it (pool near final ⇒ pool pushed below
final, both legible). In-plot annotations can't collide with the
column by construction: the no-target ghost hint ends at the plot
edge, and when the non-flipped ⏹ stop text extends into the column's
x-range (late stops; F0 itself does at stopX ≈ 520 → text ends
≈ 858) the column's top clamp drops below the stop's two lines. The
pass is two linear sweeps — terminates unconditionally; on a band
shorter than the pile it preserves separations and lets the pile rise
rather than overprint or loop.

Consequence for recorded figures: F0/F3 theater exports (teaser +
filmstrip panels) shift slightly — when no archive pool is present
the anchors are unchanged, but any panel where a pool band or a
target-stop collision was in play now lays out differently, and the
export SVG no longer matches byte-for-byte what was recorded before
this change. **Previously exported theater figures must be
re-exported.** That is the designed cost: every export is
provenance-backed (scenario key + pinned seed + trace_position) and
bit-exactly regenerable from the live app, so re-export is a replay,
not a re-measurement. Data, seeds, traces, and every number in the
F0/F3 recipes are untouched.

## History lineage: always-visible legend key (SHIPPED 2026-07-10)

The lineage view fronts five visual channels (dot hue = configuration,
dot area = shots of evidence, ring = pinned seed, band = replicate
group, curved edge = fork lineage — plus the distribution strip and
the certainty funnel), but its only decoding aids were hover tooltips,
a one-line footer legend below the scroll, and a skippable tour slide.
That failed the owner test: even the project owner had to ask what the
circles and lines mean.

Now (`LineageLegend` in RunHistory.tsx, marker class
`lineage-legend`): a compact, always-visible key pinned at the TOP of
the History tab body, above the demo banner — one wrap-row of six
items, each a mini SVG replica of the real mark (24×14, accent-toned
so no specific configuration hue is implied) beside a 2–4 word label:
color = configuration · size = shots · ring = pinned seed · band =
replicates · curve = forked from · strip = results + mean. Same
pattern as the canvas RibbonLegend (teach by resemblance, localStorage
dismissal — `quda.lineageLegendDismissed`) plus the affordance that
one lacks: after dismissal a small "key" chip stays in the same top
strip and brings the legend back — a key you can lose forever is
barely better than none.

The old one-line footer legend is deleted — one source of truth. Its
disclosure clauses moved into the key items' tooltips: the
evidence-radius floor/cap (≤69 shots read as the 3px floor, ≥2048 as
the cap) on the size item, hollow+slash = error on the color item,
and the funnel's per-group normalization (compare widths within a
band, not across bands) on the band item. The ⚲/∿ seed-glyph row
tooltip now also decodes the glyph per mode (⚲ pinned = deterministic
replay; ∿ fresh = drawn at random and recorded); the ⏹ stopped-early
tooltip was verified descriptive as-is. The standalone (collapsible)
RunHistory hosting mode shares the same body, so it gets the key for
free — though it is currently unmounted (ResultsPane's History tab is
the only usage). Since the key renders inside the panel body it is
captured by figure export while visible — figure-makers keep it,
daily users dismiss it once (the RibbonLegend contract).

## Improvement wave (SHIPPED 2026-07-10)

Seven items in one pass: two honesty/consistency fixes, one designed-
but-never-built promise closed, one new figure capability, the last
open UX item, the repo front door, and a reader-orientation overlay.

1. **Export script threads precision_target (honesty fix).** Item 12's
   claim ("the exported script reproduces the archived run's exact
   draw") overstated for early-stopped runs: the export emitted
   `_derive_seed` + the seed but NOT the stopping rule, so the script
   ran ALL requested shots. `ExportProvenance` now carries
   `precisionTarget`, read server-authoritatively from the sampled
   step's `distribution.precision_target` (never the toolbar's current
   selection); the generated `sampledFidelityEstimator` call re-sends
   `precision_target=` and the header stamps `stop_target`. The claim
   in item 12 is updated to now-true. Shape verification lane:
   `frontend/scripts/check_export_python.test.ts` (exportPython pulls
   in anon.ts's module-scope `import.meta.env`, so it runs as an
   esbuild bundle + node — command in the header; 5 assertion groups
   covering seed+target threading and the absence cases).
2. **Health version alignment.** `/api/health` (and the FastAPI
   OpenAPI metadata) hardcoded 0.1.0 while every run stamps
   app_version from `app/_version.py` — the liveness probe disagreed
   with the provenance stamp about which build was serving. Both now
   import APP_VERSION from the single source of truth.
3. **Archive export/import** (marker `archive-io`). runStore's header
   promised cross-device archive hand-off; now implemented.
   `exportArchive(runIds?)` downloads `{schema: 1, exported_at,
   records}` (oldest first, ancestors before forks);
   `importArchive(file)` validates the top-level shape, re-normalizes
   EVERY record through buildRunRecord (the file's config_hash /
   headline / derived fields are never trusted — same path a live run
   takes), preserves created_at + the demo flag verbatim, skips
   run_id collisions, reports {imported, skipped, invalid}, bumps
   historyVersion once. UI: an archive-io strip under the History
   tab's legend key ("export archive" / "import" + a report line);
   import is also reachable in the zero-runs empty state (a fresh
   device is exactly where a handed-off file arrives). This is the
   user-study data-collection channel: the server is stateless by
   design, so a participant's evidence lives only in their browser
   until exported.
4. **Theater overlay comparison** (marker `theater-overlay`) + **F7**.
   When two archived runs share a config_hash and both persisted
   per-batch traces, the Compare tab offers "overlay in theater ↗":
   the theater renders both funnels on ONE axis pair — run A
   accent/blue, run B warn/amber, envelopes at .07 alpha, constant
   ∓3.5 px x-dodge on the shared batch grid (sub-batch-width,
   identical per batch, so convergence shapes compare honestly),
   per-run stop annotations in stacked top-band rows, a shared target
   corridor ONLY when both runs executed the same rule (anchored at
   the midpoint of the two final points — the corridor states the
   rule's width, not two rules), per-run id+seed legend in the
   context strip, tagline "two replays of one configuration — same
   rule, different draws". The scrubber drives both series in
   lockstep (per-series clamp). Store: `theaterOverlayIds`; closing
   the theater or starting a new run exits; deleting either record
   mid-view exits instead of rendering a stale pair. Export takes the
   true-SVG path as `evidence-theater-overlay_<slug>.svg`; provenance
   carries both run_ids/root_seeds (runsForView branch).
   `?scenario=F7`: deterministic picker (largest traced budget with
   ≥2 ok replicates = the bundled bell-2048 config), A =
   0b485ca23b88 (983/2048, 48.00% ±2.16pp, seed 1892016523), B =
   ca3a5193e0f1 (1032/2048, 50.39% ±2.16pp, seed 2072686634), both
   8-batch traces ±6.1pp → ±2.16pp; final intervals overlap —
   consistent with one underlying configuration. Expected visuals
   documented at the scenario definition. Multi-sampled-node
   pipelines overlay their first sampled step only (paired panels are
   the honest extension if a case study needs it).
5. **Multiverse orientation strip** (marker `multiverse-hint`) — the
   last open UX item from the comprehension wave. A slim dismissable
   one-liner pinned above the grid ("Each card is one configuration —
   its pipeline, its outcome distribution, Δ vs the baseline card.
   Open rebuilds it; A/B sends two cards to Compare."), localStorage
   `quda.multiverseHintDismissed`, reopened via a small "?" in the
   board header — the lineage-legend recoverability contract.
6. **README rewrite.** The repo front door now describes the evidence
   workbench (claims, docker quickstart, F0–F7 scenario table,
   pointer here, test lanes, deployment); HF Space YAML frontmatter
   kept intact. The old product-era copy (upload button, sign-in,
   mirrors) is gone.
7. **Claims→features map** (marker `claims-map`). A static overlay
   next to the TopBar Tour button: one row per paper claim → where to
   see it → the ?scenario= URL that boots its figure state. Content
   mirrors this doc's shipped list.

Verification bar met per change: tsc + build (+ VITE_ANON=1 build),
backend unit lane 86 green (test_provenance_phase0 27, gate_diff 14,
anytime_evidence 20, workflow_helpers 11, seed_coverage 8,
run_cache 6), export-script shape lane, live marker checks after
deploy (archive-io, theater-overlay, multiverse-hint, claims-map) +
/api/health version + F7 code-path review over the bundled archive.

## Difference funnel — the third funnel scale (SHIPPED 2026-07-10)

Marker: `difference-funnel` (Compare tab, below the two-run interval
bars). Scenario: `?scenario=F8`. Lane:
`node --experimental-strip-types scripts/check_difference_funnel.test.ts`.

The system now speaks "funnel" at three scales:

1. **Within one run** — the Evidence Theater: a Wilson interval
   narrowing over shot batches as a single run buys evidence.
2. **Across runs of one configuration** — the lineage/multiverse
   pooled bands: replicates pool to a 1/√N-tighter interval.
3. **Between two configurations** — the difference funnel: the 95%
   interval of the DIFFERENCE Δ(B−A) narrowing as replicates of both
   configurations accumulate chronologically.

Rationale: comparing two configurations honestly means watching the
confidence interval of the difference — not eyeballing two separate
CIs. The Compare view has called interval overlap "a conservative
screen, not a hypothesis test" since Wave J; the difference interval
is the actual inferential object, and plotting it against total shots
consumed turns the Compare tab from a display into a
sequential-inference instrument: what is the current A-vs-B verdict,
what did it cost, and did an early "significant" excursion survive
further evidence.

### Math (frontend/src/lib/stats.ts — pure, node-testable)

* `newcombe95(k1,n1,k2,n2)` — Newcombe's method-10 hybrid score
  interval for p1−p2 (Newcombe 1998, *Statistics in Medicine*
  17:873–890): each side's Wilson bounds combined in quadrature
  (lo = d − √((p1−l1)² + (u2−p2)²), hi = d + √((u1−p1)² + (p2−l2)²)).
  Chosen over the naive Wald difference for the same reason Wilson
  replaced Wald everywhere else here: sampled fidelities sit near the
  [0,1] edges and pooled counts are small early in a trace, where
  Wald collapses to zero width or escapes the parameter range.
  Anchor: `newcombe95(56,70,48,80) → [0.0524, 0.3339]` — the worked
  example in the paper itself.
* `dedupeDraws(runs)` — drops exact-replay duplicates before pooling:
  a pinned replay reproduces its ancestor's draw bit-exactly (same
  root seed ⇒ same per-node seeds ⇒ same counts — the replay
  guarantee), so it is the SAME evidence recorded twice, and a
  sequential inference must not pool it twice. The bundled archive
  contains exactly this case (bell-512 run 7e401b5270b9 replays
  f0cb7403bbae, seed 815033775, 247/512 twice). UNIFORM RULE (Deep
  audit 2026-07-10 closed the former "known looseness"): every
  pooling surface now applies this dedupe — the difference funnel,
  the theater's archive band (which also excludes scenario-tagged
  records), the multiverse pooled band and pooled line, the fidelity
  card's replicate strip, and the lineage certainty funnel — and each
  label/tooltip says "exact replays counted once".
* `differenceTrace(runsA, runsB)` — chronological accumulation: sort
  each side by created_at, dedupe, then step t pools each side's
  first min(t, len) runs and puts a Newcombe interval on Δ(B−A) (sign
  convention identical to the Compare view's "Δ(B−A)" text). Unequal
  run counts are fine (the shorter side stops growing); unequal
  shots-per-run are fine (pooling is on raw counts — a 512-shot side
  and a 2048-shot side each weigh exactly the shots they executed).
* `differenceVerdict(steps)` — first-established step, first
  re-inclusion step, `sustained` flag.

### Encoding (frontend/src/components/DifferenceFunnel.tsx)

X = cumulative shots consumed by BOTH sides, linear from 0 — the
theater's "evidence bought" axis philosophy; certainty about a
difference is purchased on both sides at once, so the honest
x-quantity is the sum (ticks abbreviated: 2.5k, 5k…). Y = Δ fidelity
(B−A) in pp, auto-fit to the trace but ALWAYS including the dashed
neutral zero line labeled "no difference" (the question must never be
croppable). Per-step vertical Newcombe intervals + shaded convergence
envelope + point path in accent — the theater's funnel grammar
verbatim. Config identities ride in an in-SVG legend strip (config
hues via hashHue + run/shot counts), so exports self-identify.

Honesty affordances:

* "difference established at N shots — Δx.xpp [lo, hi]" vertical
  annotation at the FIRST step whose interval excludes 0 — green only
  if the exclusion survives through the last step; if a later step
  re-includes 0, that step gets a warn annotation "re-includes 0 at
  M shots — not sustained, treat as inconclusive". MULTIPLE-LOOKS
  CAVEAT: re-checking a 95% interval at every accumulation step
  inflates type-I error — the same limitation family as the theater's
  optional stopping (M2 disclosure above); the glossary entries
  (`differenceInterval`, `established`) carry the caveat into every
  tooltip surface.
* Never-excluded traces end in a plain readout ("not established
  after N shots · Δ ±w pp") — a null result stated as a result.
* Same-configuration pairs get no funnel (Δ of a config against
  itself is vacuous); that pair's instrument is the theater overlay
  (F7). <2 unique draws on either side → task-language hint ("run
  each configuration a few more times…").
* CompareView's verdict line defers to the funnel whenever it
  renders ("see the difference funnel below — the honest verdict
  accumulates across all archived replicates"); the old
  overlap/separated wording survives only when the funnel cannot
  render.

### Provenance

The Evidence-pane camera captures the funnel inside the hybrid
Compare-tab figure, and the funnel carries its own camera for the
true-SVG path. `evidence-compare` provenance now lists the two
selected runs PLUS every archived replicate whose counts the funnel
pooled (store.differenceRunIds → figureExport.runsForView), so both
config hashes and all contributing run_ids ride in every export.

### Scenario F8 — and why the demo is (honestly) a null result

`?scenario=F8` opens the Compare tab over the bundled archive's two
most-replicated configurations — the two bell-state fidelity configs,
which differ ONLY in the fake_backend shots param (512 vs 2048). The
funnel therefore answers a real tuning question: "did raising shots
change the measured fidelity?" Expected end state (derived from
src/data/demoArchive.json by the lane, pinned in the F8 comment):

* A = bell-512: 9 records → 8 unique draws (one pinned replay
  deduped), pooling 1,952/4,096 (47.66%).
* B = bell-2048: 5 records, 5,065/10,240 (49.46%).
* Trace: established at 5,120 shots (Δ+3.93pp [+0.51, +7.32]), holds
  through 12,800 shots, re-includes 0 at 13,312 shots, final
  Δ+1.81pp [−0.00, +3.62] over 14,336 shots — NOT established.

The honest answer is "no — shots buy precision, not a different
value", and the trace demonstrates the multiple-looks trap on real
draws: an early look at 5,120 shots would have claimed a win that
accumulated evidence withdrew. Choosing a null(ish) result as the
headline demo is deliberate: the instrument's value is preventing
false wins, not manufacturing dramatic ones.

Also fixed in this wave: the F2/F6 scenario comments still described
the demo archive as "bell ×14" / "bell vs vqc+QuCAD" — stale since
the structural config hash started separating the shots param. The
top-two configs are bell-512 (×9) and bell-2048 (×5); comments and
F6's expect string now match reality (F6's picker behavior was always
deterministic and unchanged).

## Narrative-alignment restructuring (SHIPPED 2026-07-10)

Premise: the system had grown cluttered because its structure no
longer mirrored the research narrative. This wave makes structure =
narrative ("one grammar, three scales") and installs the skeleton at
the top of this doc as the test every future pixel must pass.

1. **Evidence tabs = the three scales.** Labels renamed to "This run"
   / "This configuration" / "Between configurations" with one-line
   scale tooltips; internal ids (current/history/compare) frozen —
   scenario uiState, the pendingEvidenceTab bridge and figure-export
   provenance key on them (mapping pinned in ResultsPane +
   scenarios.ts comments). The toolbar Theater button is gone: the
   theater is This-run's expanded mode, entered from the funnel
   card's "expand · theater" affordance (marker open-theater;
   auto-open on streaming unchanged). This-configuration opens with a
   one-line scale statement above the legend key. All user-visible
   cross-references updated (seed-chip tooltip, compare empty state,
   multiverse hint, compare-vs-previous link, tour, claims map).
2. **Toolbar calm-down.** Two clusters: LEFT authoring (toggle,
   counters, preset, Auto-connect, camera, Clear, ⋯ menu), RIGHT
   evidence (pinned seed, ×N, precision target, cost chip, Run)
   behind a md-gated divider + faint "evidence" group label. Share
   and Export .py demoted into the ⋯ MoreMenu at EVERY width
   (Auto-connect/Clear menu rows are md:hidden, so each action has
   exactly one reachable copy at any width). Net chrome: −3 buttons
   (Share, Export .py, Theater).
3. **Visual calm pass.** RibbonLegend auto-fades 20 s after its
   first-run mount (dismissal still the only persisted state);
   guidance strips capped at ONE per view with demo banner > hint
   (multiverse hint collapses to its "?", the archive-io strip to an
   "archive…" chip, both reopenable = explicit intent); Evidence
   header chips capped at two (seed chip absorbs cached as "cached ·
   no seed"); node-tile post-run strip audited ≤ glyph + 2 rows and
   the layout contract documented at RunResultStrip.
4. **Doc = paper skeleton.** This file now opens with the narrative,
   C1/C2/C3 (each with where-in-system + which-figure), the F0–F8
   figure plan (+ planned filmstrips), tightened related-work
   positioning, and the system=paper structure map; backlog +
   conventions follow; everything older lives verbatim under
   "— wave history —".
5. **Tour + claims map alignment.** Slide 3 = scales 1&2, slide 4 =
   scale 3 (both name the tabs; slide 4 adds the difference funnel);
   claims map reorganized under C1/C2/C3 headers and gains the
   missing F8 row.

Verification: tsc + build + VITE_ANON build green; backend 86 green;
svg_paper / export_python (esbuild recipe) / difference_funnel node
lanes green; F0–F8 scenario tab keys resolve unchanged (ids frozen);
live bundle markers checked after deploy.

## IA inversion — board = home (SHIPPED 2026-07-10)

The last structural residue of the old product removed: the app was
still canvas-centric (boot → pipeline editor; evidence in side
surfaces) while the narrative said configurations are the objects.
Four moves, one inversion (see §1.1 for the position statement):

1. **Board is home.** Store default `workspaceMode: "multiverse"`;
   last mode persisted per device (`quda.workspaceMode`) and read
   synchronously at store creation, so returning users boot straight
   into their mode and a first visit paints the board from the first
   frame — the demo-import landing in App.tsx became redundant and was
   removed (one path). Scenario boots write the store field directly
   (`useApp.setState`) so scripted figure states never overwrite the
   preference. Labels renamed, ids frozen: "Evidence board"
   (`multiverse`) / "Pipeline editor" (`compose`); mapping pinned in
   WorkspaceToggle + store comments; board segment now renders first.
   Every user-visible Multiverse/Compose string updated (board header,
   hint, empty state, tour slides 2/4/5, claims map, history
   compare-nudge, fidelity-card pooled tooltip).
2. **Cards expand in place** (marker `card-expand`). Chevron or the
   strip area expands a card (span 2 columns when the grid measures
   ≥2; one card at a time) into an inline scale-2 summary: newest-12
   run-dots timeline on the SHARED evidence-mass encoding (lifted from
   RunHistory into lib/evidenceMass.ts — dot area ∝ √shots, ring =
   pinned seed, hollow slash = errored), the pooled Wilson interval as
   a labeled line, and quick actions — ▷ replay latest (pins the seed,
   auto-runs), +3 replicates (fresh draws via a one-shot
   replicateOnce on the restore bridge — the global toolbar
   replicateCount is never touched; the bridge clears any stale pin),
   open in editor, A/B. Replay/replicates stay ON the
   board: the covered canvas consumes the same pendingRestore/
   pendingAutoRun bridge scenarios ride (the auto-run guard now
   re-arms after each consumed request), the theater overlays the
   board while streaming, and the archive bump repaints the card.
3. **Editor framed as definition view** (marker `config-context`).
   Entering from a card or the board's New-configuration button (new:
   clears canvas + stale pin + fork parentage via the newConfigRequest
   bridge) raises a slim bar above the toolbar: "Defining
   configuration #hash — circuit · runs archived: N · back to board".
   The structural config hash of the CURRENT canvas is recomputed
   (250 ms debounce) with the exact computeConfigHash archiving uses;
   divergence renders "edited: will archive as a new configuration
   #newhash" — or names the EXISTING configuration it now matches,
   with its archived count (live via historyVersion). editorContext
   is never set by scenario boots or plain toggles, so F0–F8 figure
   states render pixel-identically without the bar.
4. **Docs + tour speak board-first.** §1.1 above; the related-work
   paragraph carries the design position (editor-centric node-wire
   tools vs our evidence-centric inversion); tour slide 2 introduces
   authoring as "from the Evidence board (home), open the Pipeline
   editor to define a configuration"; slide 5's button is "Go to the
   Evidence board" (same behavior).

Verification: tsc + build + VITE_ANON build green; backend tests
green; svg_paper / export_python (esbuild recipe) / difference_funnel
node lanes green; scenario modes re-checked (editor scenarios land in
the editor with the theater; F2 board unchanged); live bundle carries
the new labels + `card-expand` + `config-context` markers.

## Deep audit 2026-07-10 — Wave 1 fixes (SHIPPED 2026-07-10)

S1 / provenance-corruption findings: each made the system lie about
provenance or reproducibility. One line per fix:

1. **False fork lineage / stale provenance state** — clearGraph and
   loadPreset now clear restoredFrom / pinnedSeed / precisionTarget /
   editorContext (the New-configuration bridge also clears
   precisionTarget); restoredFrom is consumed after the FIRST
   post-restore run archives; the restore consumer writes the pin
   unconditionally, so board "Open" (pinSeed null) clears a stale
   unrelated pin.
2. **Board "+3 replicates" no longer mutates global state** — a
   one-shot `replicateOnce` rides pendingRestore → pendingAutoRun →
   runPipeline; the toolbar replicateCount is never written.
3. **Gauge fill renders** — results/viz color tokens are RGB triplets;
   every `var(--color-*)` fill is now `rgb(var(--color-*))`.
4. **Preflight agrees with the backend on QuCAD** — no-backend-upstream
   is severity "error": "QuCAD needs a backend node upstream — it will
   error at run time" (aligned with autoConnect and _handle_qucad).
5. **exportPython reproducibility is real** — sample runs emit a
   working QPY loader against `/api/circuits/samples/<key>/download`;
   uploaded-circuit runs emit a `sys.exit` guard before the
   placeholder; fake-provider imports switched to
   `qiskit_ibm_runtime.fake_provider` (backend parity); QuCAD emitter
   drops the dead `qc_bound` and mirrors _handle_qucad; plugin steps
   are announced as "not exportable" comments; export_python lane
   asserts all of it.
6. **Palette-add keeps hand wiring** — adding blocks appends nodes
   only; when edges exist the user is told to wire manually or press
   Auto-connect; setEdges/setNotice hoisted out of the setNodes
   updater (StrictMode).
7. **Archive pollution + pool double-count closed** — scenario
   auto-runs archive with a `scenario` tag and are excluded from the
   theater prior-evidence pool and the F7 overlay picker; dedupeDraws
   ("exact replays counted once") now applies to the theater archive
   band, the replicate strip, the multiverse pooled band/line and the
   lineage certainty funnel, with labels updated.
8. **timesTrusted misattribution** — an id-less displayed run is only
   trusted while streaming; restored cache-served runs no longer
   inherit the previous run's seed / config chips / wall-times.
9. **SSE parser** — decoder flushed after the read loop and the
   remaining buffer parsed (no lost final event); unknown JSON events
   are treated as StepResults only when `node_id` is a string.

## Deep audit 2026-07-10 — Wave 2 fixes (SHIPPED 2026-07-11)

S2 findings: run-lifecycle races, dead affordances, dishonest empties,
and export text-metric drift. Deferred S3 polish lives in
docs/AUDIT_BACKLOG.md. One line per fix:

Run-lifecycle guards (FlowCanvas):

1. **Restore queues behind a running pipeline** — the pendingRestore
   consumer refuses to swap the canvas while `running` (warn notice);
   the request stays in the store and applies when the run ends.
2. **pendingAutoRun expires** — cleared by the restore consumer,
   loadPreset and clearGraph, so a superseded request can never fire a
   surprise run minutes later.
3. **Restore-path loadSample staleness guard** — shares the preset
   path's generation counter (one `sampleGenRef` for both paths), so
   the two paths supersede each other.
4. **Replicate-loop partial honesty** — completed count tracked; a
   failed step (or mid-loop transport error) reports "stopped after i
   of N", never the unconditional success toast.
5. **Loop cancel affordance** — while a ×N loop runs, Run (toolbar +
   mobile FAB) becomes "Stop after this run"; a ref checked between
   iterations stops the loop after the current run archives.
6. **Boot sample-load failure speaks** — warn notice + "No circuit
   loaded — pick one on the left" title on the disabled Run buttons.
7. **Authoring locked during runs** — param editors, node delete ×,
   preset picker and circuit picks disable while `running` (toolbar
   selects already did), each with a "locked while a run is in
   progress" title.

Pickers / palette:

8. **BlockPicker badges are live** — FlowCanvas publishes canvasKinds
   to the store; on-canvas defaults are no longer pre-checked (no more
   duplicate input/output per Add-blocks round-trip) and the "on
   canvas" badges render.
9. **Palette zero-state accounts for the family filter** — plus a
   "Show all families" escape hatch.
10. **Upload input resets + shows busy** — same file re-uploads after
    a failure; the `__upload__` spinner renders.

Evidence pane:

11. **Compare auto-switch keys on identity** — pair replacement
    re-fires the tab switch (was `.length`, which never changes 2→2).
12. **compareIds lifecycle** — pruned after Clear demo data / archive
    import (`pruneCompareSelection`); setCompareIds dedupes;
    CompareView explains "runs no longer archived" instead of a silent
    blank.
13. **Interval-bar point markers clamp at 0/1** — cards (clipped by
    overflow-hidden) and CompareView twins (overhung).
14. **Uploaded-circuit records tell the truth in history** —
    restore/replay titles say "re-upload to reproduce" when
    sample_key is null (board wording).
15. **PluginFigures empty bar stub** — `data: []` renders a message
    instead of crashing the whole pane on the reduce.
16. **Lineage window is named** — footer "showing the 50 most recent
    of N archived runs" when the archive exceeds the window.

Board / theater / infra:

17. **Connecting overlay z-50** — paints over board/theater/header.
18. **No band double-overlay** — the run-start effect skips the band
    Evidence overlay when the theater will auto-open.
19. **F2 exports drop guidance chrome** — data-export-strip on
    DemoArchiveBanner and the board hint strip/"?" button.
20. **Scenario force-reimport honesty** — after a forced demo import
    on a browser that had cleared demo data, the banner says
    "re-imported for this figure scenario"; the Clear tooltip no
    longer claims "never".
21. **Export text metrics share one estimator** —
    svgPaper.estimateTextW budgets the ×1.25 PAPER_FONT_BUMP in the
    theater's stop-label flip/intrusion, panel title-dx and the
    cost-anchor line (which splits into two tspans when the bumped
    width would clip; the svg gains bottom pad for the second line).
22. **DifferenceFunnel pane scale** — two-tier viewBox width:
    container-derived in the pane (text ≥9px effective, legend wraps),
    documented 760px kept for exports via a hidden twin the funnel's
    export button targets.
23. **F6/F8 pair picker reproduces documented figures** — excludes
    scenario-tagged records (F7's Wave-1 guard verified) and prefers
    demo-flagged records when present.
24. **config-context bar never flashes a stale hash** — liveHash
    resets on editorContext change and renders "computing identity…"
    while null (empty canvas keeps its own wording).
25. **qshot preset lints clean** — ships with its output sink.

## Deep audit 2026-07-10 — Wave 3 sweep (SHIPPED 2026-07-11)

The S3 deferred-polish backlog (docs/AUDIT_BACKLOG.md) was worked top
to bottom: 71 of 76 bullets fixed across three commits (canvas
728039f, evidence 64aa288, infra cab6fcb), 5 deferred with reasons in
the backlog file (global-toast idiom, plugin-default rehydration at
boot, sticky lineage legend / guidance-strip budget, CircuitDiff
shared scroll container, export triple-download packaging). Highlights:
the four listRuns caps consolidated into runStore.ARCHIVE_WINDOW (200)
with countRuns()/countRunsByConfig() behind every displayed total and
unbounded scans on one-shot paths (archive export, demo scan, scenario
pickers, provenance id lookups); dedupeDraws upgraded (approved) to
key on (root_seed, shots, successes) so an early-stopped replay counts
as new evidence — node-lane assertions added and the documented F8
numbers verified unchanged; post-run canvas encodings dim when the
live structural hash diverges from the run's; preflight gained
cycle/duplicate-input/duplicate-backend checks worded from the
runner's actual semantics; the theater's y-axis stopped re-zooming
mid-stream; figure provenance names F0..F8 and derives the live run's
hash from theaterRun; svgPaper's class-strip can no longer edit the
embedded provenance JSON (lane-asserted); plus ~40 smaller honesty,
a11y and stale-comment repairs. All gates green: tsc, vite build
(default and VITE_ANON=1), backend pytest, svg_paper / export_python /
difference_funnel node lanes.
