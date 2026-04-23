// Global UI state — circuit selection, recent runs, preset pipelines.
// Graph state (nodes/edges) lives inside the FlowCanvas component via React Flow hooks.

import { create } from "zustand";
import type { CircuitInfo, RunResponse, HealthResponse } from "./api";

interface AppState {
  circuit: CircuitInfo | null;
  setCircuit: (c: CircuitInfo | null) => void;

  run: RunResponse | null;
  setRun: (r: RunResponse | null) => void;

  health: HealthResponse | null;
  setHealth: (h: HealthResponse | null) => void;

  running: boolean;
  setRunning: (v: boolean) => void;
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
}));
