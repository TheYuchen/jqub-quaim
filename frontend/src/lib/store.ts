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
  authStatus: null,
  setAuthStatus: (s) => set({ authStatus: s }),
  session: null,
  setSession: (u) => set({ session: u }),
}));
