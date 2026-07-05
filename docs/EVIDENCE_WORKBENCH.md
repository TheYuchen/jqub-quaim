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

## Not done yet (ordered backlog)

* **Phase 2.5** — gate-level circuit diff (qubit-lane aligned,
  changed gates highlighted) in the signature card. Demo scale only
  (≤10q); big circuits → cite Quantivine as the scaling story.
* **Phase 3.5** — comparison upgrades: pick-which-fidelity-node,
  dual-canvas visual diff, >2-way comparison table.
* **Phase 4** — cost preview (per-node runtime estimates, replicate
  budget), reproducibility export (manifest + runnable script,
  extend exportPython with seed), opt-in interaction logging
  (schema first — needed for the user study).
* **Seeding audit** — QuBound LSTM training and Qshot pilot runs are
  stochastic but not yet seed-plumbed; only sampled fidelity is.
  Their distribution payloads are also missing.
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
