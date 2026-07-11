# Deep audit 2026-07-10 — S3 backlog (deferred polish)

S1 shipped in Wave 1, S2 in Wave 2, and the S3 sweep shipped in Wave 3
(2026-07-11) — see the corresponding sections in
docs/EVIDENCE_WORKBENCH.md. Everything fixable without a design
decision was fixed and its line deleted from this file. What remains
below is the honest residue: items that need a real design call or a
layout restructure, kept one bullet each with the reason they were
deferred.

## FlowCanvas


## Evidence

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
