# Deep audit 2026-07-10 — S3 backlog (deferred polish)

Deferred S3 findings from the 2026-07-10 deep audit. S1 (provenance
family) shipped in Wave 1; S2 shipped in Wave 2 (see
EVIDENCE_WORKBENCH.md). Everything below is real but low-stakes:
polish, wording, a11y nits, caps/consistency sweeps. One bullet each,
kept verbatim from the audit.

## FlowCanvas

- stale comments (FAB breakpoint sm→md; Notice sources; preflight memo claim; RibbonLegend session claim)
- restore-pulse timeout not cleared
- dropTargetEdgeId lingering on touch cancel
- node id collision same-ms
- four listRuns caps disagree (50/100/200/500) — consolidate
- preflight highlight promised but unimplemented
- preflight misses multi-backend/duplicate-input/cycle checks
- "ops" vs "gates" label drift on edge labels
- RibbonEdge aria without role=img + pass-through vs unknown conflation
- stale post-run encodings after edits (dim via liveHash divergence)
- EmptyCanvas names invisible controls in 768-1024 band
- ShareButton.tsx dead file
- NumberField clamps per keystroke + empty-field divergence
- param editor double border seam
- QNode hover-delete stale comment
- LiveEvidenceStrip shows prev replicate's final frame briefly
- CircuitPicker matches by display_name not key
- NodePalette alert/confirm inconsistent with toast idiom + search aria-label missing
- autoConnect replacedCount counts identical rewires
- ConfigContextBar truncation + button rhythm
- strip stacking height budget (preflight list needs max-h)
- BlockPicker z-40 vs siblings z-30 + PresetPicker stale header comment + MoreMenu mobile pin offset
- board openConfig silent no-ops need disabled+title
- board header height mirror claim stale
- exportPython precision comment toFixed(0)
- store addBlocksToCanvas replaces queue
- share-hash boot ignores plugin defaults
- useDismissOn mousedown-only + no focus restore
- PaneResizer mouse-only + role without keyboard
- replicate progress notice auto-fades during slow runs
- cost effect stale nodes ref

## Evidence

- Sparkline y-range ≥1 flattens sub-unit data
- QuBound NaN final_loss tile
- Qshot fidelity 0-1 4dp vs % convention
- CI line missing tabular-nums
- ReplicateStrip errored-run dots + float-equality highlight
- TransformationSignature tiny-negative op bar drawn on positive side
- CompareView divergence marker suppressed when prefixLen<2 + A/B chips date ambiguity + title-only tooltips on 2px markers
- lineage legend not sticky + four guidance strips stack on fresh device
- funnel "widest (oldest)" wording (not monotone)
- lineage dots keyboard-unreachable
- single-click no-undo delete of only-copy records
- IDB-unavailable indistinguishable from empty
- strip dots clipped at 0/1 extremes
- hashHue collision probability undisclosed
- dedupeDraws should key (root_seed,shots,successes)
- DifferenceFunnel EST_TEXT_W heuristic + no ticks when maxShots<100 + stale funnel during pair-switch fetch
- CircuitDiff per-lane scrollbars desync
- KvRow [object Object]
- PluginFigures formatCell tiny-nonzero→"0" + iframe theme tokens + bar label collisions
- ResultsPane tabs missing aria-controls/arrow keys
- export camera on empty tabs
- histogram top-6 no "+k more"
- dead exports (viz fmt, gateDiffOf)
- RunStatusChips 9px chip exception undocumented

## Infra

- api.ts fallback docstring stale
- store gateDiffDefaultOpen never cleared
- theater y-domain re-zoom during streaming (anchor on first point)
- unspent region 0.05 opacity vs doc "hatch"
- overlay stop annotation never flips
- scrub not reset on same-run re-restore
- React keys by f.shots
- runStore extractHeadline docstring drift + exportArchive 1000 cap + import synthesized-id duplicates + listRunsByConfig arbitrary subset past 200
- board listRuns(200) header count + FAMILY_FILL hardcoded hex + pooled band 1.5px sliver + empty-board "?" no-op
- App scenario mode flash + unknown scenario key silent + StrictMode double boot
- demoArchive force-scan 1000 cap + ensureDemoArchive swallows errors
- figureExport F0..F7 stale string + runsForView 500 cap + lastConfigHash stale for restored runs + triple-download blocking
- svgPaper class-strip regex touches metadata JSON
- FigureExportButton long-press flag leak
- WelcomeTour slide-5 overclaim + missing type=button
- ClaimsMap separator inside link
- ThemeSwitcher/TopBar aria nits
- band overlay no Esc
- localStorage key naming exceptions note
