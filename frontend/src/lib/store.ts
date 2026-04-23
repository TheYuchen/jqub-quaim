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
