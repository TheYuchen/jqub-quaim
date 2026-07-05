// Client-side provenance archive.
//
// Design decision: the server stays stateless (the HF Space disk is
// ephemeral and multi-user state was deliberately removed in the
// original rewrite), so the browser owns the run history. Every
// completed run is archived here in IndexedDB; the timeline panel,
// replicate distributions, and (later) the composition-comparison
// view all read from this store. Export/import of archives covers
// cross-device hand-off.
//
// A RunRecord is immutable once written: it captures the graph (same
// SharePayload serialization the share links use), the full server
// response (per-step results incl. distribution payloads and seeds),
// and the provenance envelope (run_id / seed_mode / root_seed /
// app_version). Because the backend draws-and-records a root seed
// even for "fresh" runs, ANY archived run can be replayed exactly by
// pinning its recorded seed.

import type { RunResponse, StepResult } from "./api";
import type { SharePayload } from "./share";

export interface RunRecord {
  run_id: string;
  created_at: number; // Date.now()
  /** Sample circuit key. null = user-uploaded circuit; the graph is
   *  still restorable but the circuit must be re-uploaded by hand. */
  sample_key: string | null;
  circuit_name: string | null;
  /** Server-side circuit handle. Ephemeral — valid only while the
   *  server process that issued it lives. Kept for debugging, never
   *  relied on for restore. */
  circuit_id: string;
  graph: SharePayload;
  use_live_ibm: boolean;
  seed_mode: "fresh" | "pinned" | null;
  root_seed: number | null;
  app_version: string | null;
  /** Structural configuration hash: same circuit + same graph shape
   *  + same params ⇒ same hash, regardless of node ids or layout.
   *  Groups replicates of one configuration into one distribution. */
  config_hash: string;
  /** run_id of the archived run this one was restored/forked from. */
  forked_from: string | null;
  /** True for records imported from the bundled first-visit demo
   *  archive (real seeded runs recorded against the live backend).
   *  Lets the UI label them honestly and clear them in one click. */
  demo?: boolean;
  ok: boolean;
  /** Cheap display fields for the timeline (avoid loading the full
   *  response just to paint a list row). */
  headline_label: string | null;
  headline_value: number | null;
  n_steps: number;
  response: RunResponse;
}

const DB_NAME = "quda-provenance";
const DB_VERSION = 1;
const STORE = "runs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "run_id" });
        store.createIndex("created_at", "created_at");
        store.createIndex("config_hash", "config_hash");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export function saveRun(record: RunRecord): Promise<unknown> {
  return tx("readwrite", (s) => s.put(record));
}

export function deleteRun(runId: string): Promise<unknown> {
  return tx("readwrite", (s) => s.delete(runId));
}

export function clearRuns(): Promise<unknown> {
  return tx("readwrite", (s) => s.clear());
}

export function getRun(runId: string): Promise<RunRecord | undefined> {
  return tx("readonly", (s) => s.get(runId)) as Promise<RunRecord | undefined>;
}

/** Archive size without materializing records — IDBObjectStore.count.
 *  Cheap enough to call on every historyVersion bump (badge material
 *  for the Evidence pane's History tab). */
export function countRuns(): Promise<number> {
  return tx("readonly", (s) => s.count());
}

/** Newest-first list. Uses the created_at index with a reverse cursor
 *  so we never materialize more than `limit` records. */
export function listRuns(limit = 100): Promise<RunRecord[]> {
  return openDb().then(
    (db) =>
      new Promise<RunRecord[]>((resolve, reject) => {
        const out: RunRecord[] = [];
        const t = db.transaction(STORE, "readonly");
        const idx = t.objectStore(STORE).index("created_at");
        const cur = idx.openCursor(null, "prev");
        cur.onsuccess = () => {
          const c = cur.result;
          if (c && out.length < limit) {
            out.push(c.value as RunRecord);
            c.continue();
          } else {
            resolve(out);
            db.close();
          }
        };
        cur.onerror = () => reject(cur.error);
      }),
  );
}

/** All archived runs of one configuration, oldest first (natural
 *  order for convergence displays). */
export function listRunsByConfig(
  configHash: string,
  limit = 200,
): Promise<RunRecord[]> {
  return openDb().then(
    (db) =>
      new Promise<RunRecord[]>((resolve, reject) => {
        const out: RunRecord[] = [];
        const t = db.transaction(STORE, "readonly");
        const idx = t.objectStore(STORE).index("config_hash");
        const cur = idx.openCursor(IDBKeyRange.only(configHash));
        cur.onsuccess = () => {
          const c = cur.result;
          if (c && out.length < limit) {
            out.push(c.value as RunRecord);
            c.continue();
          } else {
            out.sort((a, b) => a.created_at - b.created_at);
            resolve(out);
            db.close();
          }
        };
        cur.onerror = () => reject(cur.error);
      }),
  );
}

// ---------------------------------------------------------------------------
// Configuration hashing
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit — tiny, fast, good enough for grouping keys (this is
 *  a bucketing hash, not a security boundary). */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Structural hash of (circuit, graph). Node ids and canvas layout are
 * deliberately excluded: two graphs that a human would call "the same
 * pipeline with the same settings" must collide, or replicate
 * accumulation breaks the moment the user rebuilds the canvas.
 *
 * Canonicalization: each node becomes `kind|sorted-params-json`; nodes
 * are sorted; ids in edges are replaced by each endpoint's index in
 * that sorted node list (stable because ties in sorting also tie in
 * canvas semantics — two identical nodes are interchangeable).
 */
export function computeConfigHash(
  sampleKey: string | null,
  circuitName: string | null,
  graph: SharePayload,
  useLiveIbm: boolean,
): string {
  const canonNode = (p: Record<string, unknown> | undefined, kind: string) => {
    const params = p ?? {};
    const keys = Object.keys(params).sort();
    const kv = keys.map((k) => `${k}=${JSON.stringify(params[k])}`).join(",");
    return `${kind}|${kv}`;
  };
  const nodesCanon = graph.n.map((n) => ({
    id: n.i,
    canon: canonNode(n.p, n.k),
  }));
  const sorted = [...nodesCanon].sort((a, b) =>
    a.canon < b.canon ? -1 : a.canon > b.canon ? 1 : 0,
  );
  const indexOf = new Map<string, number>();
  sorted.forEach((n, i) => indexOf.set(n.id, i));
  const edgesCanon = graph.e
    .map((e) => `${indexOf.get(e.s) ?? -1}>${indexOf.get(e.t) ?? -1}`)
    .sort()
    .join(";");
  const circuitTag = sampleKey ?? `upload:${circuitName ?? "?"}`;
  const payload = `${circuitTag}||live:${useLiveIbm}||${sorted
    .map((n) => n.canon)
    .join(";;")}||${edgesCanon}`;
  return fnv1a(payload);
}

// ---------------------------------------------------------------------------
// Record construction
// ---------------------------------------------------------------------------

/** Pull a timeline-friendly headline out of a finished response: the
 *  last fidelity value if present, else the last numeric summary
 *  metric of the output step, else nothing. */
function extractHeadline(
  steps: StepResult[],
): { label: string | null; value: number | null } {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.node_type === "fidelity" && s.status === "ok") {
      const v = s.summary["fidelity"];
      if (typeof v === "number") return { label: "fidelity", value: v };
    }
  }
  return { label: null, value: null };
}

export function buildRunRecord(args: {
  response: RunResponse;
  graph: SharePayload;
  sampleKey: string | null;
  circuitName: string | null;
  circuitId: string;
  useLiveIbm: boolean;
  forkedFrom: string | null;
}): RunRecord {
  const { response } = args;
  const headline = extractHeadline(response.steps);
  return {
    run_id:
      response.run_id ??
      // Extremely old server build (or dev proxy hiccup): synthesize a
      // client id so the archive still works. Marked so it's greppable.
      `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: Date.now(),
    sample_key: args.sampleKey,
    circuit_name: args.circuitName,
    circuit_id: args.circuitId,
    graph: args.graph,
    use_live_ibm: args.useLiveIbm,
    seed_mode: response.seed_mode ?? null,
    root_seed: response.root_seed ?? null,
    app_version: response.app_version ?? null,
    config_hash: computeConfigHash(
      args.sampleKey,
      args.circuitName,
      args.graph,
      args.useLiveIbm,
    ),
    forked_from: args.forkedFrom,
    ok: response.ok,
    headline_label: headline.label,
    headline_value: headline.value,
    n_steps: response.steps.length,
    response,
  };
}
