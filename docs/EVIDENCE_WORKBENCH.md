# Evidence Workbench — rework state & design rationale

Target: an IEEE VIS submission built around QuDA Studio. Framing under
consideration: **compositional algorithm analysis of stochastic,
costly computational experiments** (NISQ quantum pipelines as the
driving domain), with three contribution layers: (1) task
theory/taxonomy grounded in a formative study, (2) a uniform visual
vocabulary for pipeline transformations + distribution-first
provenance, (3) empirical evaluation (comparative study vs
Jupyter+Qiskit baseline, case studies, live deployment).

Positioning vs prior art: VACSEN (backend noise), Quantivine (large
circuits), QuantumEyes/VIOLET (circuit/QNN interpretability) are all
single-point; CHI'25 "Toward HQCI" is an interface-technique design
space; QCE tooling (QuBridge, CircInspect) is engineering without a
vis-research framing. Nobody treats the *composition* as the object
of analysis. Comparative + provenance layers of the quantum stack are
open in vis venues (verified via adversarial search, 2026-07).

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
    derivation, threaded into sampled fidelity as seed_simulator; the
    exported script reproduces the archived run's exact draw.

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
    can't truncate a long batch). Migration status at this commit:
    14/17 done (all bell_state 512+2048, the same-seed replay pair);
    the 3 vqc_2q_small records (QuCAD → sampled) still carry the old
    single-draw numbers — their sampled step lacks `trace`, so the
    loader simply omits the funnel and keeps the CI bar (verified
    graceful). Finish them with the script when the Space is idle:
    QuCAD's per-request noise-model build outlives a 40 s client
    window, so it needs an uninterrupted long-lived request. This is
    demo scaffolding, not a feature dependency — the live-run
    assertions below hold on the deployed build regardless.
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
    target = different numbers).
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

## Not done yet (ordered backlog)

* **Phase 3.5 leftovers** — pick-which-fidelity-node in comparison,
  dual-canvas visual diff, >2-way comparison.
* **Phase 4 leftovers** — opt-in interaction logging (schema first —
  needed for the user study). Reproducible export and the cost
  preview are DONE.
* **Gate-diff niceties** — pair remove+add of the same op with only a
  param change into a "modified" state; column-align lanes across
  qubits by circuit moment.
* **Distribution payloads for QuBound/Qshot** — seed-plumbed now
  (see 15), but they still emit scalar summaries only; no
  across-replicate distribution payload like sampled fidelity's.
* **Prewarm decision** — precomputed disk cache untouched and still
  served (fresh-mode namespace unchanged), but responses in it lack
  provenance/transformation fields. Either re-run
  scripts/precompute_preset_results.py against the new schema or
  accept cold first hits.
* **Welcome/tour copy** — slide 1 now tells the evidence story; the
  middle slides are still feature-tour-oriented.
* **Formative study** — interview protocol before locking the task
  taxonomy (Meyer-Dykes INFORMED). Blocked on user's go-ahead.

## Conventions

Push to `github` + `hf` (jqub21/quaim) only; qudastudio/app is a
mirror synced ONLY on explicit request. After push: ~2-4 min rebuild,
smoke = /api/health + a pinned-seed run. Unit lane:
backend/tests/*.py runnable directly, no torch needed
(29 tests green as of d105dc7).

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
* **Wave J — Uncertainty-in-provenance** (next session): lineage nodes
  ARE distributions; encode evidence mass (node weight) and its
  split/accumulation across forks. Minimal honest version only — no
  decoration without a task.
* Wave K (paper discussion, not build): difference-of-differences
  ("did more shots help bell more than vqc?") as future work.

Audit bar for every wave: tsc+build+77 tests, live seeded regression,
pinned-replay bit-exactness, fresh-visitor first paint, encoding
rationale comments, this doc updated.

## Wave P — paper-first reorientation (USER DIRECTIVE 2026-07-05, next session)

The system now serves the PAPER, not a product. Figures come from
here. Reviewers are vis people, not quantum people. Execute:

1. **De-product**: remove product legacy — welcome tour, sign-in/HF
   OAuth UI, Support/NSF popover, Lab/Papers/Developers header links,
   plugin upload marketing surfaces (keep the plugin protocol itself:
   it's a claim), marketing copy. Keep share links (reviewers use
   them). Mobile polish deprioritized.
2. **Figure export mode**: one-click paper styling for any view
   (canvas/multiverse/funnel/lineage/gate-diff/compare): white bg,
   enlarged fonts, colorblind-safe check, SVG (vector) export via DOM
   serialization + PNG fallback. Figures must not need Photoshop.
3. **Scenario loader**: scripted, seed-reproducible states for each
   planned figure (F1 ribbon mid-pipeline, F2 multiverse board, F3
   funnel + target stop, F4 lineage with fork/replay, F5 gate diff on
   QuCAD, F6 interval comparison). One URL/command each — regenerate
   any figure at any time bit-exactly.
4. **Non-quantum-reader pass**: plain-language tooltip/glossary for
   every quantum term; prefer task language (evidence, transformation,
   composition, replicate) over jargon in ALL UI copy; the demo must
   be followable by a vis reviewer with zero quantum background.
5. **Double-anonymous mode** (VIS is double-blind): env-flag that
   strips ALL identifying branding (GMU, JQub, names, lab links,
   NSF) for the review deployment; verify no identifying string in
   the served bundle. Consider a second anonymous Space for
   submission.
6. Re-audit every view against: "does this pixel serve a paper claim
   or figure?" Remove what doesn't.

Also finish: rerecord_demo_archive.py for the 3 vqc records; Wave J.
