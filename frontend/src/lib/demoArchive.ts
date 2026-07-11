// Bundled first-visit demo archive.
//
// Why this exists: every evidence view (lineage timeline, multiverse
// board, replicate distributions, comparison) renders from the
// browser's IndexedDB run archive — which is empty on a first visit,
// so a new visitor would see none of it until they had run several
// pipelines themselves. Instead, the first visit imports a small
// curated archive of REAL runs recorded against the live backend, so
// the Evidence board — home since the IA inversion, and the store's
// default workspace — paints populated within the first seconds.
//
// What the data is (and is not): every record is a genuine
// RunResponse produced by the deployed API — real noisy-simulator
// draws, real Wilson intervals, real QuCAD transformations. The runs
// were recorded with pinned seeds (that is what makes each of them
// replayable bit-exact from its own record), drawn independently at
// archive-creation time, so replicate spread across records is real
// shot noise. Nothing is fabricated or hand-edited.
//
// Honesty rules: imported records carry `demo: true`, the History tab
// and the Multiverse board show a banner naming the data for what it
// is, and "Clear demo data" removes it all in one click. The decision
// flag means a visitor who cleared never gets re-seeded, and any
// visitor with runs of their own is never touched.

import type { RunResponse } from "./api";
import type { SharePayload } from "./share";
import {
  buildRunRecord,
  countRuns,
  deleteRun,
  listRuns,
  pruneCompareSelection,
  saveRun,
} from "./runStore";
import { useApp } from "./store";

/** Set once the demo question is settled — either because we imported
 *  the archive, because the visitor already had runs of their own, or
 *  because they clicked "Clear demo data". Never auto-import again. */
const DECIDED_FLAG = "quda-demo-decided";

/** Honesty flag (audit S2): true when the demo archive was re-imported
 *  by a scenario boot's `force` on a browser that had already decided
 *  (typically: the user CLEARED demo data, then opened a documented
 *  ?scenario= figure link). The demo banner turns this into an explicit
 *  "re-imported for this figure" notice instead of pretending the
 *  archive was there all along. Session-scoped by design. */
let scenarioReimported = false;
export function demoReimportedForScenario(): boolean {
  return scenarioReimported;
}

/** Shape of one entry in src/data/demoArchive.json (produced by the
 *  archive-generation script; see docs/EVIDENCE_WORKBENCH.md). */
interface DemoEntry {
  /** Verbatim RunResponse from the live API. */
  response: RunResponse;
  graph: SharePayload;
  sampleKey: string | null;
  circuitName: string | null;
  circuitId: string;
  useLiveIbm: boolean;
  /** Lineage: run_id of the demo record this one replayed. */
  forkedFrom: string | null;
  /** Epoch ms at recording time; rebased on import (see below). */
  created_at: number;
}

function isDecided(): boolean {
  try {
    return localStorage.getItem(DECIDED_FLAG) != null;
  } catch {
    // No localStorage (ancient browser / blocked storage): behave as
    // decided so we never import into a state we can't remember.
    return true;
  }
}

function markDecided(): void {
  try {
    localStorage.setItem(DECIDED_FLAG, "1");
  } catch {
    /* ignore */
  }
}

/**
 * First-visit hook: if this browser has never decided about demo data
 * AND its run archive is empty, import the bundled archive.
 * Returns true iff records were imported this call. (The IA inversion
 * made the board the default workspace, so the import no longer needs
 * to force a landing — the return value is informational.)
 */
export async function ensureDemoArchive(
  opts: {
    /** Scenario boots (?scenario=F2/F4/F6) pass true: those figures
     *  are rendered FROM the bundled archive, so it must be present
     *  even if this browser had previously cleared demo data. Still
     *  idempotent — if demo-flagged records already exist we never
     *  import twice. */
    force?: boolean;
  } = {},
): Promise<boolean> {
  const { force = false } = opts;
  const decidedBefore = isDecided();
  if (!force && decidedBefore) return false;
  try {
    if (force) {
      const existing = await listRuns(1000);
      if (existing.some((r) => r.demo)) return false;
    } else if ((await countRuns()) > 0) {
      // Existing evidence (e.g. pre-flag build): never mix demo runs
      // into a real archive.
      markDecided();
      return false;
    }
    // Dynamic import → separate chunk: returning visitors (flag set or
    // nonzero archive) never download the archive payload at all.
    const entries = (await import("../data/demoArchive.json"))
      .default as unknown as DemoEntry[];
    if (!Array.isArray(entries) || entries.length === 0) return false;

    // Rebase timestamps: keep the recorded stagger between runs but
    // anchor the newest one a few minutes before "now", so the
    // timeline's relative times read organically no matter when this
    // bundle is visited. Responses/seeds are untouched — only the
    // client-side archive timestamp (which buildRunRecord would have
    // set to Date.now() anyway) is adjusted.
    const newest = Math.max(...entries.map((e) => e.created_at));
    const shift = Date.now() - 10 * 60_000 - newest;

    for (const e of entries) {
      // Reuse buildRunRecord so config_hash / headline / run_id fall
      // out of the exact same code path as a live archived run —
      // nothing in the JSON is trusted to precompute them.
      const rec = buildRunRecord({
        response: e.response,
        graph: e.graph,
        sampleKey: e.sampleKey,
        circuitName: e.circuitName,
        circuitId: e.circuitId,
        useLiveIbm: e.useLiveIbm,
        forkedFrom: e.forkedFrom,
      });
      rec.created_at = e.created_at + shift;
      rec.demo = true;
      await saveRun(rec);
    }
    if (force && decidedBefore) scenarioReimported = true;
    markDecided();
    useApp.getState().bumpHistoryVersion();
    return true;
  } catch {
    // IndexedDB unavailable (private mode), chunk fetch failed, etc.
    // The app is fully functional without the demo archive.
    return false;
  }
}

/** Delete every demo-flagged record. The decided flag stays set, so
 *  clearing is permanent for this browser (no auto re-import). */
export async function clearDemoRuns(): Promise<void> {
  markDecided();
  scenarioReimported = false;
  try {
    const all = await listRuns(1000);
    for (const r of all) {
      if (r.demo) await deleteRun(r.run_id);
    }
  } catch {
    /* nothing to clear if the archive is unreadable */
  }
  // Deleted demo runs must not stay selected for comparison (audit S2).
  await pruneCompareSelection();
  useApp.getState().bumpHistoryVersion();
}
