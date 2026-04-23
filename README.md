---
title: JQub Quantum Flow
emoji: ⚛️
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
short_description: Interactive quantum circuit workflow builder for JQub lab.
---

# JQub Quantum Flow

Interactive web demo for the [JQub lab](https://jqub.ece.gmu.edu/) at
George Mason University, showcasing QuCAD, QuBound, and CompressVQC on
configurable quantum pipelines.

## What it does

Drag-and-drop visual pipeline over three research algorithms from the JQub
lab — QuCAD, QuBound, CompressVQC — applied to a quantum circuit of your
choice (upload a `.qpy` or pick a built-in sample). Each block in the graph
becomes a stage of a FastAPI-side pipeline; run order is topologically
sorted from the React-Flow edges.

- **QuCAD**: ADMM-regularized, noise-aware VQC sparsification.
- **QuBound**: LSTM trained on 14 days of real `ibm_fez` calibration data
  predicts today's error bound for your circuit. Ships with a pickled cache
  of the calibration history, so the demo runs offline (~60 s LSTM training
  on CPU). If an IBM Quantum Platform token is configured, it fetches fresh
  noise history instead.
- **CompressVQC**: QAOA-optimized lookup table for folding redundant
  parametric rotations on Heron-family hardware.

## Stack

- **Backend**: FastAPI + Qiskit 2.4 + qiskit-aer + qiskit-optimization +
  PyTorch (CPU wheel). Serves the JSON API under `/api/*` and the built
  React bundle under `/`.
- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS + `@xyflow/react`
  (React Flow v12) + Zustand.
- **Deployment**: Single Docker image (two-stage build) on Hugging Face
  Spaces.

## Local development

```bash
# 1. backend
cd backend
pip install -r requirements.txt
pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 7860

# 2. frontend (in another shell)
cd frontend
npm install
npm run dev                 # Vite dev on :5173 proxies /api to :7860
```

## Environment variables

| name | default | purpose |
|---|---|---|
| `IBM_QUANTUM_TOKEN` | _unset_ | enables live IBM noise fetches |
| `ALLOW_LIVE_IBM` | `false` | gate for live calls (requires token) |
| `CORS_ALLOW_ORIGINS` | `http://localhost:5173` | comma-separated list |
| `LOG_LEVEL` | `INFO` | FastAPI log level |

When neither env var is set the app silently falls back to the offline
14-day calibration cache in `backend/cache/ibm_history/ibm_fez.pkl`.

## Refreshing the offline noise cache

```bash
IBM_QUANTUM_TOKEN=... python scripts/fetch_ibm_history.py --backend ibm_fez --days 14
```

## Credits

Quantum algorithms (`backend/qlib/`) by Jovin Antony Maria (JQub).
Web refactor and pipeline scaffold by Yuchen Yuan.
