// Global UI state — circuit selection, recent runs, preset pipelines.
// Graph state (nodes/edges) lives inside the FlowCanvas component via React Flow hooks.

import { create } from "zustand";
import type {
  AuthStatus,
  CircuitInfo,
  HealthResponse,
  PluginManifest,
  RunResponse,
  SessionUser,
} from "./api";
import type { NodeKind } from "./nodeCatalog";
import type { SharePayload } from "./share";

const LS_USE_LIVE_IBM = "quda.useLiveIbm";

function loadUseLiveIbm(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_USE_LIVE_IBM) === "1";
  } catch {
    return false;
  }
}

interface AppState {
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
  lastConfigHash: string | null;
  setLastConfigHash: (h: string | null) => void;

  /**
   * Restore bridge (same pattern as pendingQuickStart): the timeline
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
    sourceRunId: string;
  } | null;
  requestRestore: (r: NonNullable<AppState["pendingRestore"]>) => void;
  clearRestore: () => void;
  restoredFrom: string | null;
  setRestoredFrom: (v: string | null) => void;

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
   * Quick-start trigger from TrySlide: load a preset + sample
   * combination in one action. FlowCanvas watches this and applies it.
   */
  pendingQuickStart: { presetKey: string; sampleKey: string } | null;
  triggerQuickStart: (presetKey: string, sampleKey: string) => void;
  clearQuickStart: () => void;

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
   * OAuth + persistence capability of this deployment. Probed once at
   * boot via /api/auth/status. When `oauth_enabled` is false (e.g.
   * local dev without HF_OAUTH metadata), the TopBar hides the Login
   * button entirely.
   */
  authStatus: AuthStatus | null;
  setAuthStatus: (s: AuthStatus | null) => void;

  /**
   * The current signed-in HF user, or null when running as guest.
   * Drives the avatar/dropdown in TopBar and propagates to userId.ts
   * so plugin requests use the hf_<username> namespace.
   */
  session: SessionUser | null;
  setSession: (u: SessionUser | null) => void;
}

export const useApp = create<AppState>((set) => ({
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
  lastConfigHash: null,
  setLastConfigHash: (h) => set({ lastConfigHash: h }),
  pendingRestore: null,
  requestRestore: (r) => set({ pendingRestore: r }),
  clearRestore: () => set({ pendingRestore: null }),
  restoredFrom: null,
  setRestoredFrom: (v) => set({ restoredFrom: v }),
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
  pendingQuickStart: null,
  triggerQuickStart: (presetKey, sampleKey) =>
    set({ pendingQuickStart: { presetKey, sampleKey } }),
  clearQuickStart: () => set({ pendingQuickStart: null }),
  hintExpandLeftPane: 0,
  bumpHintExpandLeftPane: () =>
    set((s) => ({ hintExpandLeftPane: s.hintExpandLeftPane + 1 })),
  plugins: [],
  setPlugins: (p) => set({ plugins: p }),
  touchDrag: null,
  setTouchDrag: (v) => set({ touchDrag: v }),
  pendingTouchDrop: null,
  setPendingTouchDrop: (v) => set({ pendingTouchDrop: v }),
  authStatus: null,
  setAuthStatus: (s) => set({ authStatus: s }),
  session: null,
  setSession: (u) => set({ session: u }),
}));
