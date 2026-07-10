// Global UI state — circuit selection, recent runs, preset pipelines.
// Graph state (nodes/edges) lives inside the FlowCanvas component via React Flow hooks.

import { create } from "zustand";
import type {
  CircuitInfo,
  HealthResponse,
  PluginManifest,
  RunResponse,
  StepProgress,
} from "./api";
import type { NodeKind } from "./nodeCatalog";
import type { SharePayload } from "./share";

const LS_USE_LIVE_IBM = "quda.useLiveIbm";
const LS_THEATER_AUTO_OPEN = "quda.theaterAutoOpen";

/** Evidence-theater auto-open preference (default ON). Read lazily on
 *  every progress frame instead of cached in the store so a toggle in
 *  one tab is honoured by the next run without a reload. */
export function theaterAutoOpenEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(LS_THEATER_AUTO_OPEN) !== "0";
  } catch {
    return true;
  }
}

export function setTheaterAutoOpenEnabled(v: boolean): void {
  try {
    window.localStorage.setItem(LS_THEATER_AUTO_OPEN, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** One anytime-evidence progress frame plus its client arrival time.
 *  `at` (Date.now()) is what the theater's cost axis is built from —
 *  client-side arrival, not server compute time (see EvidenceTheater
 *  for the caveat). */
export interface TheaterFrame extends StepProgress {
  at: number;
}

function loadUseLiveIbm(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_USE_LIVE_IBM) === "1";
  } catch {
    return false;
  }
}

interface AppState {
  /**
   * Which workspace fills the center column. "compose" = the React
   * Flow canvas (edit/run one pipeline). "multiverse" = the
   * MultiverseBoard (all archived configurations as small multiples).
   * Deliberately NOT persisted: a fresh visit should always open on
   * the canvas, where the empty-state guidance lives.
   */
  workspaceMode: "compose" | "multiverse";
  setWorkspaceMode: (m: "compose" | "multiverse") => void;

  circuit: CircuitInfo | null;
  setCircuit: (c: CircuitInfo | null) => void;

  /**
   * Which sample circuit is currently loaded. `null` means the user
   * uploaded their own file (which we can't share, since the recipient
   * doesn't have that upload).
   *
   * Tracked alongside `circuit` so the Share-link builder can record
   * "which sample to reload on the recipient's side". Without this we'd
   * have to fuzzy-match on `circuit.name`, which breaks if we ever rename
   * a sample's display name.
   */
  sampleKey: string | null;
  setSampleKey: (k: string | null) => void;

  run: RunResponse | null;
  setRun: (r: RunResponse | null) => void;

  /**
   * Provenance bridge. historyVersion bumps after every archived run
   * so IndexedDB readers (timeline, replicate distributions) refetch.
   * pinnedSeed, when set, is sent as RunRequest.seed — the UI shows a
   * chip next to Run so the user knows draws are frozen. lastConfigHash
   * identifies the configuration of the most recent run so result
   * cards can pull that configuration's replicate history.
   */
  historyVersion: number;
  bumpHistoryVersion: () => void;
  pinnedSeed: number | null;
  setPinnedSeed: (v: number | null) => void;
  replicateCount: number;
  setReplicateCount: (n: number) => void;
  /**
   * Anytime evidence steering. precisionTarget is the optional-
   * stopping rule sent as RunRequest.precision_target (null = run
   * every shot); it is part of the run's provenance, so restore /
   * replay writes the archived run's value back here. liveProgress
   * holds the latest per-batch progress frame per node while a run
   * streams (null between runs) — the canvas node faces render their
   * live-narrowing CI from it; the post-run evidence funnel instead
   * reads the full trace persisted in the step's distribution.
   */
  precisionTarget: number | null;
  setPrecisionTarget: (v: number | null) => void;
  liveProgress: Record<string, StepProgress> | null;
  updateLiveProgress: (p: StepProgress) => void;
  clearLiveProgress: () => void;

  /**
   * Evidence theater (the steering view). theaterOpen mounts the
   * center-column overlay; it auto-opens on the FIRST progress frame
   * of a run (i.e. the moment a sampled step starts streaming) unless
   * the user disabled auto-open (localStorage, toggled inside the
   * theater). theaterTraces retains EVERY progress frame per node —
   * with client arrival timestamps — from run start until the NEXT
   * run starts, so the theater can keep showing the full live trace
   * (including its timing) after the step completes, when
   * liveProgress has already been cleared. theaterRun records which
   * run the traces belong to (config hash for the archive-pool band,
   * run_id/root_seed from the stream's run_meta event, startedAt for
   * "evidence archived before this run" cutoffs).
   */
  theaterOpen: boolean;
  setTheaterOpen: (v: boolean) => void;
  /**
   * Theater overlay comparison (marker: theater-overlay). When two
   * archived runs of the SAME configuration both carry sampled traces,
   * the Compare tab can stage them in the theater overlaid on one
   * axis pair — two replays of one rule, different draws. Non-null
   * switches the theater to comparison mode (and opens it); closing
   * the theater or starting a new run clears it.
   */
  theaterOverlayIds: [string, string] | null;
  setTheaterOverlay: (ids: [string, string] | null) => void;
  theaterTraces: Record<string, TheaterFrame[]>;
  theaterRun: {
    configHash: string | null;
    startedAt: number;
    runId: string | null;
    rootSeed: number | null;
  } | null;
  beginTheaterRun: (configHash: string | null) => void;
  setTheaterRunMeta: (m: {
    runId?: string | null;
    rootSeed?: number | null;
  }) => void;
  lastConfigHash: string | null;
  setLastConfigHash: (h: string | null) => void;

  /**
   * Restore bridge (a pending-intent field FlowCanvas consumes): the timeline
   * panel pushes an archived run here; FlowCanvas watches it, rebuilds
   * the canvas from the stored SharePayload, reloads the sample
   * circuit, and optionally pins the run's seed for exact replay.
   * restoredFrom threads the source run_id into the NEXT archived run
   * as forked_from — that is what makes lineage reconstructable.
   */
  pendingRestore: {
    graph: SharePayload;
    sampleKey: string | null;
    pinSeed: number | null;
    /** run_id the restore descends from (threads into the next run's
     *  forked_from). null for scenario boots — a scripted figure state
     *  is not a fork of any archived run. */
    sourceRunId: string | null;
    /** Archived run's optional-stopping target. Restored alongside
     *  the graph — without it a pinned replay of an early-stopped
     *  run would run all shots and reproduce nothing. undefined =
     *  record predates Wave I (treated as null). */
    precisionTarget?: number | null;
    /** Scenario boots: request an automatic run AFTER the sample
     *  circuit finishes loading (sequenced inside FlowCanvas's
     *  restore consumer, so it can't race the boot-time default-
     *  circuit load). */
    autoRunAfter?: boolean;
  } | null;
  requestRestore: (r: NonNullable<AppState["pendingRestore"]>) => void;
  clearRestore: () => void;
  restoredFrom: string | null;
  setRestoredFrom: (v: string | null) => void;

  /**
   * Comparison selection: up to two archived run_ids. When two are
   * chosen the CompareView panel renders them side by side. Toggling
   * a third id replaces the older selection (keep-latest-two).
   */
  compareIds: string[];
  toggleCompare: (runId: string) => void;
  /** Replace the selection wholesale (max 2 kept). Used by one-hop
   *  affordances that KNOW both runs — e.g. the fidelity card's
   *  "compare vs previous run of this configuration" link — so the
   *  user doesn't have to find and tick two checkboxes. Setting two
   *  ids triggers the Evidence pane's auto-switch to Compare. */
  setCompareIds: (ids: string[]) => void;
  clearCompare: () => void;

  health: HealthResponse | null;
  setHealth: (h: HealthResponse | null) => void;

  running: boolean;
  setRunning: (v: boolean) => void;

  /**
   * User opt-in for live IBM calibration (QuBound + the `ibm_backend`
   * block). Defaults off — the demo uses the shipped 14-day cache even
   * when the server is capable of going live, so that repeat users see
   * deterministic numbers and we don't chew IBM API rate limits. The
   * TopBar only surfaces the toggle when the server also allows live.
   */
  useLiveIbm: boolean;
  setUseLiveIbm: (v: boolean) => void;

  /**
   * Cross-component bridge: NodePalette pushes block kinds here when the
   * user checks blocks and clicks "Add to canvas". FlowCanvas watches
   * this via useEffect, creates the nodes, auto-connects, and clears.
   */
  pendingBlockKinds: NodeKind[];
  addBlocksToCanvas: (kinds: NodeKind[]) => void;
  clearPendingBlocks: () => void;

  /**
   * Hint flag set by FlowCanvas error paths: tells App.tsx to open
   * the left CircuitPicker pane (desktop: expand; mobile: open
   * drawer) so the user can see where to pick a circuit.
   */
  hintExpandLeftPane: number;  // counter so consecutive triggers re-fire
  bumpHintExpandLeftPane: () => void;

  /** Plugin manifests this user has uploaded. Refreshed on app boot
   *  and after every upload/delete. NodePalette + BlockPicker merge
   *  these into the canonical NodeCatalog so they appear alongside
   *  built-in blocks. */
  plugins: PluginManifest[];
  setPlugins: (p: PluginManifest[]) => void;

  /**
   * Touch-drag bridge between NodePalette (where the touch starts)
   * and FlowCanvas (which renders the floating preview, computes the
   * edge under the finger, and ultimately commits the drop).
   *
   *   touchDrag       — non-null while a touch drag is active. The
   *                     palette tile updates x/y on every pointermove.
   *                     The canvas reads x/y to render a floating
   *                     preview and to compute which edge to splice.
   *   pendingTouchDrop — set once by the palette on pointerup. The
   *                     canvas's useEffect commits the drop (splice
   *                     into the closest edge OR add at the cursor
   *                     position) and clears it.
   *
   * Why a separate "pending" signal instead of just one field: the
   * preview state should disappear immediately on release, but the
   * actual node creation needs the cursor's final coordinates AND
   * needs to fire from FlowCanvas (which owns the React Flow nodes).
   */
  touchDrag: { kind: NodeKind; x: number; y: number } | null;
  setTouchDrag: (
    v: { kind: NodeKind; x: number; y: number } | null,
  ) => void;
  pendingTouchDrop: { kind: NodeKind; x: number; y: number } | null;
  setPendingTouchDrop: (
    v: { kind: NodeKind; x: number; y: number } | null,
  ) => void;

  /**
   * Scenario bridge (Wave P): a scenario boot (?scenario=Fn) can ask
   * FlowCanvas to run the pipeline automatically once the restored
   * graph AND its sample circuit are both in place. `sampleKey` is the
   * circuit the scenario expects — the consumer must not fire while the
   * boot-time default circuit is still loaded (restore's sample load is
   * async and races the default bell_state auto-load).
   */
  pendingAutoRun: { sampleKey: string | null } | null;
  requestAutoRun: (sampleKey: string | null) => void;
  clearAutoRun: () => void;

  /** Scenario bridge: which Evidence tab ResultsPane should switch to.
   *  Consumed (reset to null) by ResultsPane. */
  pendingEvidenceTab: "current" | "history" | "compare" | null;
  setPendingEvidenceTab: (
    t: "current" | "history" | "compare" | null,
  ) => void;

  /** Counter twin of hintExpandLeftPane, for the Evidence pane. */
  hintExpandRightPane: number;
  bumpHintExpandRightPane: () => void;

  /** Scenario F5: render gate-level circuit diffs expanded by default
   *  on QuCAD cards (the <details> boots open). Not consumed/cleared —
   *  deterministic for the whole scenario session. */
  gateDiffDefaultOpen: boolean;
  setGateDiffDefaultOpen: (v: boolean) => void;
}

export const useApp = create<AppState>((set) => ({
  workspaceMode: "compose",
  setWorkspaceMode: (m) => set({ workspaceMode: m }),
  circuit: null,
  setCircuit: (c) => set({ circuit: c }),
  sampleKey: null,
  setSampleKey: (k) => set({ sampleKey: k }),
  run: null,
  setRun: (r) => set({ run: r }),
  historyVersion: 0,
  bumpHistoryVersion: () =>
    set((s) => ({ historyVersion: s.historyVersion + 1 })),
  pinnedSeed: null,
  setPinnedSeed: (v) => set({ pinnedSeed: v }),
  replicateCount: 1,
  setReplicateCount: (n) => set({ replicateCount: n }),
  precisionTarget: null,
  setPrecisionTarget: (v) => set({ precisionTarget: v }),
  liveProgress: null,
  updateLiveProgress: (p) =>
    set((s) => {
      const at = Date.now();
      const prev = s.theaterTraces[p.node_id] ?? [];
      const last = prev.length > 0 ? prev[prev.length - 1] : null;
      // A batch index that fails to advance means a NEW run's first
      // frame for this node (replicate loops reuse node ids without
      // passing through beginTheaterRun) — restart that node's trace.
      const frames =
        last && p.batch_i <= last.batch_i
          ? [{ ...p, at }]
          : [...prev, { ...p, at }];
      // Auto-open exactly once per run: on the very first frame of
      // the run (theaterTraces was empty), unless the user opted out.
      // After that first frame a dismissal sticks for the whole run.
      const hadAny = Object.values(s.theaterTraces).some(
        (f) => f.length > 0,
      );
      const autoOpen = !hadAny && !s.theaterOpen && theaterAutoOpenEnabled();
      return {
        liveProgress: { ...(s.liveProgress ?? {}), [p.node_id]: p },
        theaterTraces: { ...s.theaterTraces, [p.node_id]: frames },
        ...(autoOpen ? { theaterOpen: true } : {}),
      };
    }),
  clearLiveProgress: () => set({ liveProgress: null }),
  theaterOpen: false,
  // Closing the theater also exits overlay mode: reopening from the
  // toolbar should show the current run's stage, not a stale pair.
  setTheaterOpen: (v) =>
    set({
      theaterOpen: v,
      ...(v ? {} : { theaterOverlayIds: null }),
    }),
  theaterOverlayIds: null,
  setTheaterOverlay: (ids) =>
    set({ theaterOverlayIds: ids, ...(ids ? { theaterOpen: true } : {}) }),
  theaterTraces: {},
  theaterRun: null,
  beginTheaterRun: (configHash) =>
    set({
      theaterTraces: {},
      liveProgress: null,
      // A new run reclaims the stage — live streaming beats a replayed pair.
      theaterOverlayIds: null,
      theaterRun: {
        configHash,
        startedAt: Date.now(),
        runId: null,
        rootSeed: null,
      },
    }),
  setTheaterRunMeta: (m) =>
    set((s) => ({
      theaterRun: s.theaterRun
        ? {
            ...s.theaterRun,
            ...(m.runId !== undefined ? { runId: m.runId } : {}),
            ...(m.rootSeed !== undefined ? { rootSeed: m.rootSeed } : {}),
          }
        : s.theaterRun,
    })),
  lastConfigHash: null,
  setLastConfigHash: (h) => set({ lastConfigHash: h }),
  pendingRestore: null,
  requestRestore: (r) => set({ pendingRestore: r }),
  clearRestore: () => set({ pendingRestore: null }),
  restoredFrom: null,
  setRestoredFrom: (v) => set({ restoredFrom: v }),
  compareIds: [],
  toggleCompare: (runId) =>
    set((s) => {
      if (s.compareIds.includes(runId))
        return { compareIds: s.compareIds.filter((x) => x !== runId) };
      return { compareIds: [...s.compareIds, runId].slice(-2) };
    }),
  setCompareIds: (ids) => set({ compareIds: ids.slice(-2) }),
  clearCompare: () => set({ compareIds: [] }),
  health: null,
  setHealth: (h) => set({ health: h }),
  running: false,
  setRunning: (v) => set({ running: v }),
  useLiveIbm: loadUseLiveIbm(),
  setUseLiveIbm: (v) => {
    try {
      window.localStorage.setItem(LS_USE_LIVE_IBM, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ useLiveIbm: v });
  },
  pendingBlockKinds: [],
  addBlocksToCanvas: (kinds) => set({ pendingBlockKinds: kinds }),
  clearPendingBlocks: () => set({ pendingBlockKinds: [] }),
  hintExpandLeftPane: 0,
  bumpHintExpandLeftPane: () =>
    set((s) => ({ hintExpandLeftPane: s.hintExpandLeftPane + 1 })),
  plugins: [],
  setPlugins: (p) => set({ plugins: p }),
  touchDrag: null,
  setTouchDrag: (v) => set({ touchDrag: v }),
  pendingTouchDrop: null,
  setPendingTouchDrop: (v) => set({ pendingTouchDrop: v }),
  pendingAutoRun: null,
  requestAutoRun: (sampleKey) => set({ pendingAutoRun: { sampleKey } }),
  clearAutoRun: () => set({ pendingAutoRun: null }),
  pendingEvidenceTab: null,
  setPendingEvidenceTab: (t) => set({ pendingEvidenceTab: t }),
  hintExpandRightPane: 0,
  bumpHintExpandRightPane: () =>
    set((s) => ({ hintExpandRightPane: s.hintExpandRightPane + 1 })),
  gateDiffDefaultOpen: false,
  setGateDiffDefaultOpen: (v) => set({ gateDiffDefaultOpen: v }),
}));
