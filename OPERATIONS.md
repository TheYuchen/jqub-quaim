# QuDA Studio — Operations

Operator-only setup notes. End-user docs live in [`README.md`](./README.md).

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
| `IBM_QUANTUM_TOKEN` | _unset_ | enables live IBM noise fetches for QuBound |
| `ALLOW_LIVE_IBM` | `false` | gate for live IBM calls (also requires token) |
| `CORS_ALLOW_ORIGINS` | `http://localhost:5173` | comma-separated list; `*` is stripped if combined with cookies |
| `LOG_LEVEL` | `INFO` | FastAPI log level |
| `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET` | _set by HF_ | populated automatically when `hf_oauth: true` is in the Space frontmatter |
| `OPENID_PROVIDER_URL` | `https://huggingface.co` | OIDC issuer |
| `SPACE_HOST` | _set by HF_ | used to compute OAuth `redirect_uri` |
| `SESSION_SECRET` | random per-process in dev | HF Space secret; signs the session cookie |
| `HF_TOKEN` | _unset_ | HF Space secret with write access to the dataset repo; enables plugin persistence |
| `USER_DATA_REPO` | `qudastudio/quda-user-data` | Dataset repo where logged-in users' plugins are mirrored |

When the IBM env vars are unset the app falls back to the offline
14-day calibration cache in `backend/cache/ibm_history/ibm_fez.pkl`.

When `HF_TOKEN` or `OAUTH_CLIENT_ID` are unset, the affected features
(persistence, OAuth) degrade gracefully — the UI hides the sign-in
button and treats every browser as a guest.

## Refreshing the offline noise cache

```bash
IBM_QUANTUM_TOKEN=... python scripts/fetch_ibm_history.py --backend ibm_fez --days 14
```

## Deploying a new Space mirror

To deploy the same code to another HF Space (e.g. an additional
mirror behind a different domain reputation):

1. Push the repo to `hf-spaces/<org>/<name>`.
2. In the HF Space's Settings → Variables and Secrets:
   - `HF_TOKEN` — a token with write access to the same dataset repo
     so users get shared persistence across mirrors.
   - `SESSION_SECRET` — fresh random string (e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"`).
   - `USER_DATA_REPO` — `qudastudio/quda-user-data` (or whatever
     mirror you want to share).
3. The `hf_oauth: true` line in README frontmatter triggers HF to
   auto-create a per-Space OAuth client; no manual config needed.

## Stack

- **Backend**: FastAPI + Qiskit 2.3 + qiskit-aer + qiskit-optimization +
  PyTorch (CPU wheel) + torch-geometric + hdbscan. Serves the JSON API
  under `/api/*` and the built React bundle under `/`.
- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS + `@xyflow/react`
  (React Flow v12) + Zustand.
- **Deployment**: Single Docker image (two-stage build) on Hugging Face
  Spaces.
- **Persistence**: HF Datasets (one private repo with per-user folders).
- **Auth**: HF OAuth (OpenID Connect) via the Space's built-in flow.
