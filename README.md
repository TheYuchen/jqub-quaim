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

# QuDA Studio

Interactive workflows for quantum system deployment, from the
[JQub lab](https://jqub.ece.gmu.edu/) at George Mason University.
Currently includes QuCAD, QuBound, CompressVQC, and Qshot on
configurable quantum pipelines.

## What it does

Drag-and-drop visual pipeline over research algorithms from the JQub lab —
currently QuCAD, QuBound, CompressVQC, and Qshot, with more to come —
applied to a quantum circuit of your choice (upload a `.qpy` or `.qasm`
or pick a built-in sample). Each block in the graph becomes a stage of
the pipeline; the run order is topologically sorted from the
React-Flow edges.

- **QuCAD**: ADMM-regularized, noise-aware VQC sparsification.
- **QuBound**: LSTM over 14 days of real `ibm_fez` calibration data
  predicts today's error bound for your circuit. The calibration history
  is bundled with the demo so it runs offline; no IBM account needed.
- **CompressVQC**: QAOA-optimized lookup table for folding redundant
  parametric rotations on Heron-family hardware.
- **Qshot**: noise-aware shot-count recommender. Matches your circuit
  against ~3k simulator-measured fidelity curves (under bundled IBM noise
  snapshots) to find the smallest shot count that achieves a target
  fidelity bound. Falls back to a dual-graph GNN when no cluster
  matches — typically for circuits outside the 5–8 qubit training range.

Default preset × sample combinations are precomputed and served from
cache, so the demo returns instantly on first click. A cold QuBound run
(LSTM training) or Qshot run (HDBSCAN warmup + pilot measurements) on
the shared HF CPU takes 1–3 min; QuCAD and CompressVQC are sub-second
on small circuits.

## Custom blocks (plugins)

Drop a `.zip` (manifest.json + handler.py) onto the **Upload** button
next to "Add blocks" to add your own source / backend / algorithm /
metric / sink block to the catalog. Each plugin runs in an isolated
sandbox with a 10-minute wall-clock cap and a 1 GB memory cap.

**Sign in with Hugging Face** (top-right of the app) and your uploaded
plugins persist across container restarts and follow you to any device
you sign in on. Without signing in, plugins live only in this browser
and disappear when the Space restarts (~24 h) or you clear browser
data. Each user is capped at 5 plugins; each plugin .zip is capped at
1 MB.

See [`PLUGIN_SDK.md`](./PLUGIN_SDK.md) for the manifest schema, the
`run(inputs, params)` contract, per-family conventions, and the
limits table. Worked examples live in `example_plugins/`.

## Two mirrors

The app is served at:

- https://qudastudio-app.hf.space
- https://jqub21-quaim.hf.space

Both run the same code and share the same plugin backing store, so a
signed-in user sees the same plugins on either URL. (Sessions are
per-domain — you'll sign in on each mirror once.)

---

Operator setup notes live in [`OPERATIONS.md`](./OPERATIONS.md).
Repository on GitHub: <https://github.com/TheYuchen/jqub-quaim>.
