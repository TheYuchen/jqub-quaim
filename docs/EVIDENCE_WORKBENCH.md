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
* **Welcome/tour copy** — still demo-oriented; reposition toward the
  evidence workbench once features stabilize.
* **Formative study** — interview protocol before locking the task
  taxonomy (Meyer-Dykes INFORMED). Blocked on user's go-ahead.

## Conventions

Push to `github` + `hf` (jqub21/quaim) only; qudastudio/app is a
mirror synced ONLY on explicit request. After push: ~2-4 min rebuild,
smoke = /api/health + a pinned-seed run. Unit lane:
backend/tests/*.py runnable directly, no torch needed
(29 tests green as of d105dc7).
