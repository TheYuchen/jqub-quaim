// Global UI state — circuit selection, recent runs, preset pipelines.
// Graph state (nodes/edges) lives inside the FlowCanvas component via React Flow hooks.

import { create } from "zustand";
import type { CircuitInfo, RunResponse, HealthResponse } from "./api";

const LS_USE_LIVE_IBM = "jqub.useLiveIbm";

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
}));
