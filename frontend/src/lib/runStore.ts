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
import { useApp } from "./store";

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
  /** Scenario key ("F0".."F8") when this run was executed by a
   *  scenario boot's auto-run — a scripted figure state, not user
   *  evidence. Scenario-tagged records are excluded from the theater's
   *  prior-evidence pool and the F7 overlay picker (lib/scenarios.ts
   *  documents the pollution this prevents). */
  scenario?: string | null;
  /** Optional-stopping target the run was executed with (absolute
   *  fidelity units), or null/absent. Part of provenance: replay
   *  must re-send it or an early-stopped run is not reproducible. */
  precision_target?: number | null;
  /** True when any sampled step stopped before its requested shots
   *  because the precision target was reached. Early-stopped runs
   *  carry fewer shots — their (wider) CI already encodes that; this
   *  flag only drives the small ⏹ marker in history rows. */
  stopped_early?: boolean;
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

/** Drop compare selections whose records no longer resolve (bulk
 *  deletions: Clear demo data, archive replacement). Row-level deletes
 *  prune inline; this is the sweep for everything else (audit S2).
 *  At most two getRun lookups — cheap enough to call after any bulk
 *  archive mutation. */
export async function pruneCompareSelection(): Promise<void> {
  const s = useApp.getState();
  if (s.compareIds.length === 0) return;
  try {
    const alive: string[] = [];
    for (const id of s.compareIds) {
      if (await getRun(id)) alive.push(id);
    }
    if (alive.length !== s.compareIds.length) s.setCompareIds(alive);
  } catch {
    /* archive unreadable — CompareView's missing-record state covers it */
  }
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
  /** Optional-stopping target the request was sent with. */
  precisionTarget?: number | null;
  /** Scenario key when this run is a scenario boot's auto-run. */
  scenario?: string | null;
}): RunRecord {
  const { response } = args;
  const headline = extractHeadline(response.steps);
  // Server-authoritative early-stop flag: any sampled step whose
  // distribution says it stopped before the requested shots.
  const stoppedEarly = response.steps.some(
    (s) =>
      (s.distribution as { stopped_early?: boolean } | null | undefined)
        ?.stopped_early === true,
  );
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
    scenario: args.scenario ?? null,
    precision_target: args.precisionTarget ?? null,
    stopped_early: stoppedEarly,
    ok: response.ok,
    headline_label: headline.label,
    headline_value: headline.value,
    n_steps: response.steps.length,
    response,
  };
}

// ---------------------------------------------------------------------------
// Archive export / import (marker: archive-io)
// ---------------------------------------------------------------------------
//
// The header above promises "Export/import of archives covers
// cross-device hand-off" — this is that channel. It is also the
// USER-STUDY DATA-COLLECTION channel: the server is stateless by
// design, so a participant's session evidence lives only in their
// browser; "export archive" turns it into a JSON file they can hand
// to the study team, and "import" lets an analyst rebuild the exact
// archive (lineage, seeds, traces and all) on their own machine.
//
// Trust boundary: the file's derived fields (config_hash, headline,
// stopped_early, run_id synthesis) are NOT trusted — every imported
// record is re-normalized through buildRunRecord, the same code path
// a live run takes, so a tampered or stale-schema file cannot plant
// wrong grouping keys. Verbatim payloads (response, graph, seeds) are
// carried as-is: they ARE the data.

/** Version stamp of the archive-file format. Bump on breaking shape
 *  changes; import refuses unknown majors instead of guessing. */
export const ARCHIVE_SCHEMA = 1;

export interface ArchiveFile {
  schema: number;
  exported_at: string; // ISO
  records: RunRecord[];
}

/** Serialize archived runs (all by default, or a run_id subset) and
 *  trigger a browser download. Returns the number of records written. */
export async function exportArchive(runIds?: string[]): Promise<number> {
  let records = await listRuns(1000);
  if (runIds && runIds.length > 0) {
    const want = new Set(runIds);
    records = records.filter((r) => want.has(r.run_id));
  }
  // Oldest first: replaying the file top-to-bottom re-creates the
  // archive in its original order (forked_from ancestors precede
  // children, matching how the lineage was laid down).
  records.sort((a, b) => a.created_at - b.created_at);
  const payload: ArchiveFile = {
    schema: ARCHIVE_SCHEMA,
    exported_at: new Date().toISOString(),
    records,
  };
  const blob = new Blob([JSON.stringify(payload)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quda-archive_${new Date().toISOString().slice(0, 10)}_${records.length}runs.json`;
  a.click();
  URL.revokeObjectURL(url);
  return records.length;
}

/** Minimal structural gate for one imported record. Everything the
 *  re-normalization DERIVES may be absent/wrong in the file; what it
 *  carries verbatim must at least be shaped right. */
function isImportableRecord(r: unknown): r is RunRecord {
  if (typeof r !== "object" || r === null) return false;
  const rec = r as Record<string, unknown>;
  const resp = rec.response as Record<string, unknown> | undefined;
  const graph = rec.graph as Record<string, unknown> | undefined;
  return (
    typeof resp === "object" &&
    resp !== null &&
    Array.isArray(resp.steps) &&
    typeof graph === "object" &&
    graph !== null &&
    Array.isArray(graph.n) &&
    Array.isArray(graph.e)
  );
}

export interface ImportReport {
  imported: number;
  /** run_id collisions with records already in this archive. */
  skipped: number;
  /** Entries that failed the structural gate. */
  invalid: number;
}

/** Import an archive file produced by exportArchive. Re-derives every
 *  derived field via buildRunRecord (never trusts the file's hashes),
 *  skips run_id collisions, bumps historyVersion once at the end. */
export async function importArchive(file: File): Promise<ImportReport> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("not a JSON file");
  }
  const top = parsed as Partial<ArchiveFile> | null;
  if (
    typeof top !== "object" ||
    top === null ||
    top.schema !== ARCHIVE_SCHEMA ||
    !Array.isArray(top.records)
  ) {
    throw new Error(
      `not a run-archive file (expected {schema: ${ARCHIVE_SCHEMA}, records: [...]})`,
    );
  }
  const report: ImportReport = { imported: 0, skipped: 0, invalid: 0 };
  for (const entry of top.records) {
    if (!isImportableRecord(entry)) {
      report.invalid += 1;
      continue;
    }
    // Same normalization path as a live run and the demo archive:
    // config_hash / headline / stopped_early / run_id all fall out of
    // buildRunRecord from the verbatim response + graph.
    const rec = buildRunRecord({
      response: entry.response,
      graph: entry.graph as SharePayload,
      sampleKey: typeof entry.sample_key === "string" ? entry.sample_key : null,
      circuitName:
        typeof entry.circuit_name === "string" ? entry.circuit_name : null,
      circuitId: typeof entry.circuit_id === "string" ? entry.circuit_id : "",
      useLiveIbm: entry.use_live_ibm === true,
      forkedFrom:
        typeof entry.forked_from === "string" ? entry.forked_from : null,
      precisionTarget:
        typeof entry.precision_target === "number"
          ? entry.precision_target
          : null,
      scenario: typeof entry.scenario === "string" ? entry.scenario : null,
    });
    // Preserved verbatim: the original archive timestamp (the lineage
    // layout orders by it) and the demo honesty flag.
    if (Number.isFinite(entry.created_at)) rec.created_at = entry.created_at;
    if (entry.demo === true) rec.demo = true;
    const existing = await getRun(rec.run_id);
    if (existing) {
      report.skipped += 1;
      continue;
    }
    await saveRun(rec);
    report.imported += 1;
  }
  if (report.imported > 0) useApp.getState().bumpHistoryVersion();
  await pruneCompareSelection();
  return report;
}
