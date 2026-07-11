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

/** Anytime-evidence progress frame, streamed by the run-stream SSE
 *  endpoint after every completed shot batch of a sampled-fidelity
 *  step. `batch_i` is 1-based (= batches completed); `ci95` is the
 *  Wilson interval over ALL shots so far, so a sequence of these
 *  frames IS the live-narrowing evidence funnel. */
export interface StepProgress {
  node_id: string;
  batch_i: number;
  n_batches: number;
  shots_done: number;
  successes: number;
  point: number;
  ci95: [number, number];
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
  /** Seed actually consumed by this step's stochastic computation.
   *  null/absent for deterministic steps. Recorded even in "fresh"
   *  seed mode, which is what makes every historical run replayable. */
  seed_used?: number | null;
  /** Structured uncertainty payload for stochastic results. null for
   *  deterministic steps. Sampled fidelity: {kind: "binomial", shots,
   *  successes, point, ci95: [lo, hi], counts_top, distinct_outcomes}. */
  distribution?: Record<string, unknown> | null;
  /** Uniform circuit-transformation payload captured by the executor:
   *  before/after structural snapshots + shape delta + per-op count
   *  delta. Same vocabulary for every block type. null when no
   *  circuit was in scope; changed=false marks pass-through steps. */
  transformation?: Record<string, unknown> | null;
}

export interface RunResponse {
  circuit_id: string;
  ok: boolean;
  from_cache: boolean;
  steps: StepResult[];
  final_metrics: Record<string, unknown>;
  /** Provenance envelope (server-stamped). run_id is an opaque handle;
   *  seed_mode/root_seed let the client replay this exact run later;
   *  app_version records which build produced the numbers. */
  run_id?: string | null;
  seed_mode?: "fresh" | "pinned" | null;
  root_seed?: number | null;
  app_version?: string | null;
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
  /** Pin the run's root seed to replay a historical run exactly.
   *  Omit for a fresh draw — the server reports the drawn seed back
   *  in RunResponse.root_seed either way. */
  seed?: number | null;
  /** Optional stopping: target 95%-CI half-width for sampled-fidelity
   *  steps, in absolute fidelity units (0.02 = "stop at ±2pp"). The
   *  server stops paying for shots once the evidence is this precise
   *  (min 2 batches). Part of the run's provenance — replaying an
   *  early-stopped run re-sends it to reproduce the stopping point. */
  precision_target?: number | null;
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

  // (The auth client block was removed with the Wave P de-product
  // pass: no frontend surface renders login any more, so the
  // /api/auth/* wrappers were producer-less dead code. The backend
  // routes still exist for API users.)

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
   * Errors surface through `onError` — there is NO silent fallback to
   * the non-streaming endpoint (an older build had one; the docstring
   * outlived it — audit S3).
   */
  runStream: async (
    body: RunRequest,
    onStep: (step: StepResult, stepIndex: number) => void,
    onDone: (response: RunResponse) => void,
    onError: (err: Error) => void,
    onProgress?: (progress: StepProgress) => void,
    /** Called as soon as the stream's opening run_meta event lands —
     *  hands the run's identity (run_id / root_seed) to live views
     *  (the evidence theater) BEFORE the run finishes. */
    onMeta?: (meta: Partial<RunResponse>) => void,
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
      let runMeta: Partial<RunResponse> | null = null;

      // One parser for every SSE line: "data: {...}\n\n".
      const handleLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]" || payload === "[CACHED]") return;
        try {
          const parsed = JSON.parse(payload);
          // Run-level provenance envelope, sent as the first event.
          if (parsed.run_meta) {
            runMeta = parsed.run_meta as Partial<RunResponse>;
            onMeta?.(runMeta);
            return;
          }
          // Anytime-evidence frame: a shot batch landed mid-step.
          if (parsed.step_progress) {
            onProgress?.(parsed.step_progress as StepProgress);
            return;
          }
          // Cache hit sends a full RunResponse object (has .steps array)
          if (Array.isArray(parsed.steps)) {
            cachedResponse = parsed as RunResponse;
          } else if (typeof parsed.node_id === "string") {
            // Individual StepResult — only an object carrying node_id
            // is one. An unknown future event type must NOT masquerade
            // as a pipeline step in the assembled RunResponse.
            steps.push(parsed as StepResult);
            onStep(parsed as StepResult, steps.length - 1);
          }
        } catch {
          // Ignore malformed lines
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      }
      // Flush: a final event without a trailing newline — or a multi-
      // byte character split across the last chunk, still held inside
      // the streaming decoder — would otherwise be dropped, losing the
      // last step (or the whole cached response).
      buffer += decoder.decode();
      for (const line of buffer.split("\n")) handleLine(line);

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
        ...(runMeta ?? {}),
      });
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  },
};
