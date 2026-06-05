// Thin REST client around the FastAPI backend.
// In dev, Vite proxies /api → http://127.0.0.1:7860/api. In prod the backend
// serves this bundle, so same-origin relative paths Just Work.

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

export interface HealthResponse {
  status: string;
  version: string;
  qiskit_version: string;
  torch_version: string;
  ibm_token_configured: boolean;
  live_ibm_allowed: boolean;
}

export interface BackendInfo {
  name: string;
  /** Matches the backend's Pydantic Literal["fake", "ibm"]. Was
   *  previously "fake" | "live" here, which silently never matched
   *  any server payload — fixed to keep frontend filters honest. */
  kind: "fake" | "ibm";
  num_qubits: number;
  description: string;
}

export interface SampleCircuit {
  key: string;
  display_name: string;
  description: string;
  num_qubits: number;
  depth: number;
  size: number;
  num_parameters: number;
  diagram_text: string;
  source: string;
}

export interface CircuitInfo {
  circuit_id: string;
  name: string;
  num_qubits: number;
  num_clbits: number;
  depth: number;
  size: number;
  num_parameters: number;
  ops: Record<string, number>;
  diagram_text: string;
}

export type StepStatus = "ok" | "skipped" | "error";

/** Post-step circuit shape, attached by the backend after each
 *  successful step. Drives the data-flow labels rendered on edges
 *  leaving this node. Null when the step ran without a circuit in
 *  context (e.g. a source plugin) or errored before computing one. */
export interface CircuitShape {
  num_qubits: number;
  depth: number;
  size: number;
  num_parameters: number;
}

export interface StepResult {
  node_id: string;
  node_type: string;
  label: string;
  status: StepStatus;
  started_at: number;
  finished_at: number;
  summary: Record<string, unknown>;
  message: string | null;
  /** True when this step was served from the per-node intermediate
   *  cache (pipeline prefix unchanged since last run). */
  from_step_cache?: boolean;
  /** Rich visual outputs emitted by user plugins. Backend has already
   *  validated + sanitised each entry (see plugin_runner._scrub_figures).
   *  null/absent when the step is a built-in block or a plugin that
   *  doesn't emit figures. */
  figures?: Array<Record<string, unknown>> | null;
  /** Shape of the circuit AFTER this step ran. */
  circuit_shape?: CircuitShape | null;
  /** True when this step's output is intentionally fresh-each-run
   *  (e.g. sampled fidelity with N shots). The streaming executor
   *  refuses to cache the result, and the UI can surface a small
   *  "Live each run" chip so users know what to expect. */
  nondeterministic?: boolean;
}

export interface RunResponse {
  circuit_id: string;
  ok: boolean;
  from_cache: boolean;
  steps: StepResult[];
  final_metrics: Record<string, unknown>;
}

export interface FlowNodePayload {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface FlowEdgePayload {
  id: string;
  source: string;
  target: string;
}

export interface RunRequest {
  circuit_id: string;
  nodes: FlowNodePayload[];
  edges: FlowEdgePayload[];
  /**
   * Opt-in: fetch fresh IBM Quantum Platform calibration instead of the
   * shipped 14-day cache. The backend still enforces that the server has
   * a token and ALLOW_LIVE_IBM=true; if not, passing `true` here will
   * return a 400 — UI should only offer the toggle when health indicates
   * both conditions are met.
   */
  use_live_ibm?: boolean;
  /** Anonymous browser id (see lib/userId.ts) so the server can look
   *  up the right user's uploaded plugins when dispatching nodes
   *  whose `type` isn't a built-in kind. */
  user_id?: string;
}

/** /api/auth/status — public capability probe. The frontend uses
 *  this to decide whether to render the Login button at all (e.g.
 *  hide it in local dev where OAuth isn't wired up). */
export interface AuthStatus {
  oauth_enabled: boolean;
  persistence_enabled: boolean;
  provider: string;
}

/** /api/auth/me payload (when logged in). */
export interface SessionUser {
  username: string;
  avatar_url: string | null;
  expires_at: number;
  persistence_enabled: boolean;
  user_data_repo: string | null;
}

/** Plugin manifest returned by the server. Mirrors PluginManifest in
 *  backend/app/services/plugin_service.py + a `is_plugin: true` flag
 *  the frontend uses to tell user-uploaded blocks apart from
 *  built-ins. */
export interface PluginManifest {
  kind: string;
  label: string;
  family: "source" | "backend" | "algorithm" | "metric" | "sink";
  tagline: string;
  description: string;
  color: string;
  params: Array<{
    key: string;
    label: string;
    type: "number" | "int" | "select";
    min?: number;
    max?: number;
    step?: number;
    displayPrecision?: number;
    options?: Array<{ value: string; label: string }>;
    hint?: string;
  }>;
  writes: string[];
  author: string | null;
  is_plugin: true;
}


async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body || "(no body)"}`);
  }
  return res.json();
}

/** Shorthand for fetch with credentials always included so the session
 *  cookie travels on the dev Vite proxy (5173 → 7860 is technically
 *  cross-origin even with proxy_pass). In prod same-origin this flag
 *  is a no-op. */
function authedFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { credentials: "include", ...init });
}

export const api = {
  health: () => authedFetch(`${BASE}/health`).then((r) => json<HealthResponse>(r)),

  backends: () => authedFetch(`${BASE}/backends`).then((r) => json<BackendInfo[]>(r)),

  listSamples: () =>
    authedFetch(`${BASE}/circuits/samples`).then((r) => json<SampleCircuit[]>(r)),

  loadSample: (key: string) =>
    authedFetch(`${BASE}/circuits/samples/${encodeURIComponent(key)}`, {
      method: "POST",
    }).then((r) => json<CircuitInfo>(r)),

  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return authedFetch(`${BASE}/circuits/upload`, { method: "POST", body: fd }).then(
      (r) => json<CircuitInfo>(r),
    );
  },

  getCircuit: (circuit_id: string) =>
    authedFetch(`${BASE}/circuits/${encodeURIComponent(circuit_id)}`).then(
      (r) => json<CircuitInfo>(r),
    ),

  run: (body: RunRequest) =>
    authedFetch(`${BASE}/workflow/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<RunResponse>(r)),

  // ---- auth ----

  /** Public capability probe: is OAuth wired up on this deployment? */
  authStatus: () =>
    authedFetch(`${BASE}/auth/status`).then((r) => json<AuthStatus>(r)),

  /** Current session or null if not logged in. */
  authMe: async (): Promise<SessionUser | null> => {
    const r = await authedFetch(`${BASE}/auth/me`);
    if (r.status === 401) return null;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },

  /** URL the browser should navigate to (full page navigation, NOT
   *  fetch) to start the OAuth dance. */
  authLoginUrl: () => `${BASE}/auth/login`,

  /** Clear the session cookie. */
  authLogout: () =>
    authedFetch(`${BASE}/auth/logout`, { method: "POST" }).then(
      (r) => json<{ ok: boolean }>(r),
    ),

  // ---- plugin endpoints ----

  /** List the plugin manifests this browser/account has uploaded.
   *  The server prefers the session cookie's hf_<username> over the
   *  query-string user_id; we still send the anon UUID for the case
   *  where there's no session. */
  listPlugins: (userId: string) =>
    authedFetch(`${BASE}/plugins?user_id=${encodeURIComponent(userId)}`)
      .then((r) => json<PluginManifest[]>(r)),

  /** Upload a plugin .zip. Resolves to the parsed manifest on success;
   *  rejects with an Error whose message is the backend's 400 detail. */
  uploadPlugin: async (userId: string, file: File): Promise<PluginManifest> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await authedFetch(
      `${BASE}/plugins/upload?user_id=${encodeURIComponent(userId)}`,
      { method: "POST", body: fd },
    );
    if (!res.ok) {
      let detail = "";
      try {
        const body = await res.json();
        detail = body?.detail ?? "";
      } catch {
        detail = await res.text().catch(() => "");
      }
      throw new Error(detail || `HTTP ${res.status}`);
    }
    return res.json();
  },

  /** Remove a plugin from this browser/account's namespace. */
  deletePlugin: (userId: string, kind: string) =>
    authedFetch(
      `${BASE}/plugins/${encodeURIComponent(kind)}?user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    ).then((r) => json<{ removed: boolean; kind: string }>(r)),

  /** Catalog of bundled example .zip plugins users can grab to test
   *  the upload flow. The server reads each manifest.json inside the
   *  zip and returns its label / family / tagline. */
  listExamplePlugins: () =>
    authedFetch(`${BASE}/plugins/examples`).then(
      (r) =>
        json<
          Array<{
            name: string;
            label: string;
            family: string;
            tagline: string;
            color: string;
            size_bytes: number;
          }>
        >(r),
    ),

  /** URL the browser can hit (or anchor `download` to) to fetch a
   *  bundled example plugin .zip. The browser saves it; the user then
   *  drops the same .zip back into the upload modal to install it. */
  exampleZipUrl: (name: string) =>
    `${BASE}/plugins/examples/${encodeURIComponent(name)}.zip`,

  /**
   * Stream pipeline execution via SSE. Calls `onStep` for each step as
   * it completes, then calls `onDone` with the assembled RunResponse.
   * Falls back to the non-streaming endpoint if the server errors.
   */
  runStream: async (
    body: RunRequest,
    onStep: (step: StepResult, stepIndex: number) => void,
    onDone: (response: RunResponse) => void,
    onError: (err: Error) => void,
  ) => {
    try {
      const res = await authedFetch(`${BASE}/workflow/run-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      const steps: StepResult[] = [];
      let cachedResponse: RunResponse | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines: "data: {...}\n\n"
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]" || payload === "[CACHED]") continue;
          try {
            const parsed = JSON.parse(payload);
            // Cache hit sends a full RunResponse object (has .steps array)
            if (Array.isArray(parsed.steps)) {
              cachedResponse = parsed as RunResponse;
            } else {
              // Individual StepResult
              steps.push(parsed as StepResult);
              onStep(parsed as StepResult, steps.length - 1);
            }
          } catch {
            // Ignore malformed lines
          }
        }
      }

      if (cachedResponse) {
        onDone(cachedResponse);
        return;
      }

      // Assemble the final RunResponse
      const ok = steps.every((s) => s.status !== "error");
      let finalMetrics: Record<string, unknown> = {};
      for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].node_type === "output" && steps[i].status === "ok") {
          finalMetrics = steps[i].summary;
          break;
        }
      }
      onDone({
        circuit_id: body.circuit_id,
        ok,
        from_cache: false,
        steps,
        final_metrics: finalMetrics,
      });
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  },
};
