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
  Target,
  Waypoints,
} from "lucide-react";

export type NodeKind =
  | "input_circuit"
  | "ibm_backend"
  | "fake_backend"
  | "qucad"
  | "qubound"
  | "compvqc"
  | "qshot"
  | "fidelity"
  | "output";

export interface NodeSpec {
  kind: NodeKind;
  label: string;
  family: "source" | "backend" | "algorithm" | "metric" | "sink";
  /** Short human-friendly caption (~3-5 words) shown under the label. */
  tagline: string;
  /** Long-form description: hover tooltip on the palette tile and
   *  subtitle text on the canvas node. */
  description: string;
  icon: LucideIcon;
  accent: string;       // tailwind text color
  accentRing: string;   // tailwind ring/border color
  defaultData?: Record<string, unknown>;
  defaultCount?: 0 | 1; // how many copies are auto-placed on canvas reset
  /** Optional link to the paper this block implements. Surfaces as a small
   *  external-link icon on the node card and palette tile.
   *
   *  `bibtex` is the copy-to-clipboard string for the Papers popover.
   *  Keep the author list up-to-date here — this is what visitors will
   *  paste into their .bib file.
   */
  paper?: {
    url: string;
    title: string;
    venue: string;
    bibtex: string;
  };
}

export const NODE_CATALOG: NodeSpec[] = [
  {
    kind: "input_circuit",
    label: "Input circuit",
    family: "source",
    tagline: "your quantum program",
    description: "Parameterized QuantumCircuit (uploaded .qpy or a demo sample).",
    icon: Atom,
    accent: "text-accent",
    accentRing: "border-accent/50",
    defaultCount: 1,
  },
  {
    kind: "fake_backend",
    label: "Noisy simulator",
    family: "backend",
    tagline: "local IBM-chip simulator",
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
    tagline: "fresh IBM calibration",
    description: "Fresh calibration from the IBM Quantum Platform (requires token). Circuits still run on the local noisy simulator — this block only refreshes the noise model.",
    icon: Cpu,
    accent: "text-warn",
    accentRing: "border-warn/40",
    defaultData: { backend_name: "ibm_fez" },
  },
  {
    kind: "qucad",
    label: "QuCAD",
    family: "algorithm",
    tagline: "noise-aware pruning",
    description: "ADMM-based noise-aware VQC sparsification (weights pushed to 0 under target noise).",
    icon: Waypoints,
    accent: "text-accent2",
    accentRing: "border-accent2/50",
    defaultData: { iterations: 3, lam: 0.005, rho: 500.0 },
    paper: {
      url: "https://arxiv.org/abs/2304.04666",
      title:
        "Battle Against Fluctuating Quantum Noise: Compression-Aided Framework to Enable Robust Quantum Neural Network",
      venue: "ICCAD 2023",
      bibtex: `@inproceedings{qucad2023,
  title     = {Battle Against Fluctuating Quantum Noise: Compression-Aided Framework to Enable Robust Quantum Neural Network},
  author    = {Antony Maria, Jovin and Jiang, Weiwen},
  booktitle = {2023 IEEE/ACM International Conference on Computer-Aided Design (ICCAD)},
  year      = {2023},
  eprint    = {2304.04666},
  archivePrefix = {arXiv},
}`,
    },
  },
  {
    kind: "qubound",
    label: "QuBound",
    family: "algorithm",
    tagline: "predict today's error bound",
    description: "LSTM over 14 days of calibration history; predicts today's error bound.",
    icon: LineChart,
    accent: "text-accent3",
    accentRing: "border-accent3/50",
    defaultData: { cache_backend: "ibm_fez" },
    paper: {
      url: "https://arxiv.org/abs/2507.17043",
      title:
        "Computational Performance Bounds Prediction in Quantum Computing with Unstable Noise",
      venue: "IEEE TCAD 2025",
      bibtex: `@article{qubound2025,
  title   = {Computational Performance Bounds Prediction in Quantum Computing with Unstable Noise},
  author  = {Antony Maria, Jovin and Jiang, Weiwen},
  journal = {IEEE Transactions on Computer-Aided Design of Integrated Circuits and Systems},
  year    = {2025},
  eprint  = {2507.17043},
  archivePrefix = {arXiv},
}`,
    },
  },
  {
    kind: "compvqc",
    label: "CompressVQC",
    family: "algorithm",
    tagline: "fold redundant gates",
    description: "QAOA-optimized lookup table that folds redundant parametric gates.",
    icon: Shrink,
    accent: "text-accent4",
    accentRing: "border-accent4/50",
    paper: {
      url: "https://arxiv.org/abs/2207.01578",
      title: "Quantum Neural Network Compression",
      venue: "ICCAD 2022",
      bibtex: `@inproceedings{compressvqc2022,
  title     = {Quantum Neural Network Compression},
  author    = {Hu, Zhirui and Dong, Peiyan and Wang, Zhepeng and Lin, Youzuo and Wang, Yanzhi and Jiang, Weiwen},
  booktitle = {2022 IEEE/ACM International Conference on Computer-Aided Design (ICCAD)},
  year      = {2022},
  eprint    = {2207.01578},
  archivePrefix = {arXiv},
}`,
    },
  },
  {
    kind: "qshot",
    label: "Qshot",
    family: "algorithm",
    tagline: "recommend shot count",
    description:
      "Noise-aware shot-count recommender. Predicts the minimum number of measurement shots your circuit needs to reach a target fidelity on a chosen IBM calibration snapshot. Self-contained — no upstream backend required.",
    icon: Target,
    accent: "text-warn",
    accentRing: "border-warn/40",
    // Default: pittsburgh_1 snapshot + 95% of converged fidelity, matches
    // the author's example_usage.py defaults. Users can tweak either from
    // the block's parameter panel.
    defaultData: {
      noise_snapshot: "pittsburgh_1",
      alpha: 0.95,
    },
  },
  {
    kind: "fidelity",
    label: "Fidelity",
    family: "metric",
    tagline: "statevector vs noisy",
    description: "Quick statevector-vs-noisy fidelity estimate (bound-parameter circuits only).",
    icon: Gauge,
    accent: "text-ok",
    accentRing: "border-ok/40",
  },
  {
    kind: "output",
    label: "Output",
    family: "sink",
    tagline: "final metrics & diagram",
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
