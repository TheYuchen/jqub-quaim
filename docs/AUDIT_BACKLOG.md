# Deep audit 2026-07-10 — S3 backlog (deferred polish)

S1 shipped in Wave 1, S2 in Wave 2, and the S3 sweep shipped in Wave 3
(2026-07-11) — see the corresponding sections in
docs/EVIDENCE_WORKBENCH.md. Everything fixable without a design
decision was fixed and its line deleted from this file. What remains
below is the honest residue: items that need a real design call or a
layout restructure, kept one bullet each with the reason they were
deferred.

## FlowCanvas

- NodePalette alert()/confirm() inconsistent with the toast idiom
  [deferred — needs a global toast channel; the canvas Notice is
  FlowCanvas-local state, and inventing a cross-component notification
  bridge is a design decision. The search aria-label half of the
  original finding was fixed in Wave 3; window.confirm stays as the
  blocking guard for destructive plugin deletes.]
- share-hash boot ignores plugin defaults [deferred — plugin manifests
  load async AFTER buildInitialGraph runs, so the boot path cannot
  resolve plugin defaultData; merging them retroactively needs a
  rehydration pass over already-mounted nodes.]

## Evidence

- lineage legend not sticky + four guidance strips can stack on a
  fresh device [deferred — the legend sits inside a panel-alt with
  overflow-hidden, which breaks position:sticky against the Evidence
  pane's scroll container; unsticking requires restructuring the
  panel layout. The strip-budget question (which of banner / hint /
  legend / archive-io yields on a fresh device) is a guidance-design
  pass, not a one-liner.]
- CircuitDiff per-lane scrollbars desync [deferred — the honest fix is
  one shared horizontal scroll container for all qubit lanes, which
  restructures the per-lane DOM; explicitly out of scope for this
  sweep.]

## Infra

- figure export triple-download can be popup-blocked (SVG + PNG +
  provenance sidecar are three programmatic downloads from one click)
  [deferred — needs a packaging decision: zip the three artifacts
  (new dependency), drop to two downloads, or stage sequential
  prompts. Each changes the documented export contract.]
