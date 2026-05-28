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
  kind: "fake" | "live";
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
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body || "(no body)"}`);
  }
  return res.json();
}

export const api = {
  health: () => fetch(`${BASE}/health`).then((r) => json<HealthResponse>(r)),

  backends: () => fetch(`${BASE}/backends`).then((r) => json<BackendInfo[]>(r)),

  listSamples: () => fetch(`${BASE}/circuits/samples`).then((r) => json<SampleCircuit[]>(r)),

  loadSample: (key: string) =>
    fetch(`${BASE}/circuits/samples/${encodeURIComponent(key)}`, { method: "POST" }).then(
      (r) => json<CircuitInfo>(r),
    ),

  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${BASE}/circuits/upload`, { method: "POST", body: fd }).then(
      (r) => json<CircuitInfo>(r),
    );
  },

  getCircuit: (circuit_id: string) =>
    fetch(`${BASE}/circuits/${encodeURIComponent(circuit_id)}`).then(
      (r) => json<CircuitInfo>(r),
    ),

  run: (body: RunRequest) =>
    fetch(`${BASE}/workflow/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<RunResponse>(r)),

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
      const res = await fetch(`${BASE}/workflow/run-stream`, {
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
