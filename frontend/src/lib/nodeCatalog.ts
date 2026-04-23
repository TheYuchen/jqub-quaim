// Single source of truth for what kinds of nodes exist in the pipeline.
// Backend types must stay in sync with backend/app/schemas.py NodeType.

import type { LucideIcon } from "lucide-react";
import {
  Atom,
  Cpu,
  Gauge,
  LineChart,
  PackageCheck,
  Server,
  Shrink,
  Waypoints,
} from "lucide-react";

export type NodeKind =
  | "input_circuit"
  | "ibm_backend"
  | "fake_backend"
  | "qucad"
  | "qubound"
  | "compvqc"
  | "fidelity"
  | "output";

export interface NodeSpec {
  kind: NodeKind;
  label: string;
  family: "source" | "backend" | "algorithm" | "metric" | "sink";
  description: string;
  icon: LucideIcon;
  accent: string;       // tailwind text color
  accentRing: string;   // tailwind ring/border color
  defaultData?: Record<string, unknown>;
  defaultCount?: 0 | 1; // how many copies are auto-placed on canvas reset
}

export const NODE_CATALOG: NodeSpec[] = [
  {
    kind: "input_circuit",
    label: "Circuit",
    family: "source",
    description: "Parameterized QuantumCircuit — uploaded .qpy or a demo sample.",
    icon: Atom,
    accent: "text-accent",
    accentRing: "border-accent/50",
    defaultCount: 1,
  },
  {
    kind: "fake_backend",
    label: "Noisy simulator",
    family: "backend",
    description:
      "Simulates a real IBM quantum chip with its measured noise. Runs locally, no IBM account needed.",
    icon: Server,
    accent: "text-accent",
    accentRing: "border-accent/40",
    defaultData: { backend_name: "FakeFez" },
    defaultCount: 1,
  },
  {
    kind: "ibm_backend",
    label: "IBM live backend",
    family: "backend",
    description: "Fresh calibration from the IBM Quantum Platform (requires token).",
    icon: Cpu,
    accent: "text-warn",
    accentRing: "border-warn/40",
    defaultData: { backend_name: "ibm_fez" },
  },
  {
    kind: "qucad",
    label: "QuCAD",
    family: "algorithm",
    description: "ADMM-based noise-aware VQC sparsification (weights → 0 under target noise).",
    icon: Waypoints,
    accent: "text-accent2",
    accentRing: "border-accent2/50",
    defaultData: { iterations: 3, lam: 0.005, rho: 500.0 },
  },
  {
    kind: "qubound",
    label: "QuBound",
    family: "algorithm",
    description: "LSTM over 14-day calibration history → predicts today's error bound.",
    icon: LineChart,
    accent: "text-accent3",
    accentRing: "border-accent3/50",
    defaultData: { cache_backend: "ibm_fez" },
  },
  {
    kind: "compvqc",
    label: "CompressVQC",
    family: "algorithm",
    description: "QAOA-optimized lookup table that folds redundant parametric gates.",
    icon: Shrink,
    accent: "text-accent4",
    accentRing: "border-accent4/50",
  },
  {
    kind: "fidelity",
    label: "Fidelity",
    family: "metric",
    description: "Quick statevector-vs-noisy fidelity estimate (bound-parameter circuits only).",
    icon: Gauge,
    accent: "text-ok",
    accentRing: "border-ok/40",
  },
  {
    kind: "output",
    label: "Output",
    family: "sink",
    description: "Final circuit, transpiled gate counts, and aggregated metrics.",
    icon: PackageCheck,
    accent: "text-ink",
    accentRing: "border-mute/40",
    defaultCount: 1,
  },
];

export const NODE_BY_KIND = Object.fromEntries(
  NODE_CATALOG.map((n) => [n.kind, n]),
) as Record<NodeKind, NodeSpec>;
