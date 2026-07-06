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
   via the API (`POST /api/plugins`), which is how the paper
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
   App.tsx). `?scenario=F0..F6` (F0 added with the Evidence Theater
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
