---
title: QuDA Studio
emoji: ⚛️
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
short_description: Quantum Design Automation Studio
hf_oauth: true
hf_oauth_expiration_minutes: 480
---

# QuDA Studio — an evidence workbench for stochastic quantum pipelines

Live at <https://jqub21-quaim.hf.space/>. From the
[JQub lab](https://jqub.ece.gmu.edu/) at George Mason University.

Quantum pipeline runs are stochastic (shot noise, training randomness)
and costly (every shot and every minute of simulator time is paid
for), yet the usual tooling treats a run as a scalar that overwrites
the last one. QuDA Studio treats every run as **evidence**: composed
visually from research blocks (QuCAD, QuBound, CompressVQC, Qshot,
plus user plugins over a documented SDK), executed with recorded
seeds, archived in the browser with full provenance, and rendered as
distributions and intervals rather than point values. The composition
itself — not any single algorithm — is the object of analysis.

## The claims it embodies

**Seeded replay.** Every run draws and records a root seed; per-node
seeds derive from it, so any archived run — including one that stopped
early — replays bit-exactly, and the exported Python script reproduces
the same draw. **Anytime evidence steering.** Sampled fidelity streams
shot batches; the 95% interval narrows live, and an optional precision
target ("stop at ±2pp") makes optional stopping a visual interaction
with a replay-stable seed schedule. **A transformation vocabulary.**
Every step reports a uniform before→after structural signature (depth/
gates/params/qubits delta glyphs, gate-level circuit diff), identical
for built-ins and plugins. **Provenance-backed figures.** Every
exported figure embeds the run ids, seeds, config hashes and graph
needed to regenerate it bit-exactly; paper figures are scripted as
one-URL scenarios. **Honest comparison.** Replicates pool into Wilson
intervals; overlapping intervals are called out as "not evidence".

## Quickstart

```sh
docker build -t quda . && docker run -p 7860:7860 quda
```

Then open `http://localhost:7860/` — or skip straight to a scripted
figure state on the live Space (each URL boots the exact seeded state
the paper's figure is exported from):

| URL | shows |
|---|---|
| `/?scenario=F0` | Evidence theater teaser: live CI funnel, ±2pp stop |
| `/?scenario=F1` | Ribbon canvas after a QuCAD run |
| `/?scenario=F2` | Multiverse board over the bundled archive |
| `/?scenario=F3` | Evidence funnel with early stop |
| `/?scenario=F4` | Provenance lineage (forks, replicate bands) |
| `/?scenario=F5` | Gate-level circuit diff |
| `/?scenario=F6` | Interval comparison of two configurations |
| `/?scenario=F7` | Theater overlay: two replays of one configuration |

Design rationale, encoding decisions and the full rework log live in
[`docs/EVIDENCE_WORKBENCH.md`](./docs/EVIDENCE_WORKBENCH.md) — read
that first if you are here for the research system. Plugin authoring:
[`PLUGIN_SDK.md`](./PLUGIN_SDK.md). Operator setup:
[`OPERATIONS.md`](./OPERATIONS.md).

## Test lanes

- Backend unit lane (no torch needed): `cd backend && python3 tests/test_<name>.py`
  per file — provenance, gate diff, seed coverage, anytime evidence,
  run cache, workflow helpers.
- Frontend: `cd frontend && npx tsc --noEmit && npm run build`; pure-logic
  checks run in plain node/esbuild (`frontend/scripts/check_svg_paper.test.ts`,
  `check_export_python.test.ts` — commands in each header).
- Anonymous-build audit: `VITE_ANON=1 npm run build` strips identifying
  strings for double-anonymous review.

## Deployment

One Docker image serves the FastAPI backend and the prebuilt React
bundle on port 7860 (the HF Space config is this file's frontmatter —
keep it intact). The server is stateless by design: run history lives
in the browser's IndexedDB, exportable/importable as a JSON archive
from the History tab. Pushes go to `github` and `hf` remotes; the
Space rebuilds in ~2–4 min, smoke test = `/api/health` + one
pinned-seed run.
