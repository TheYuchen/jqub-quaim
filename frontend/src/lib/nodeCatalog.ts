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
import { NOISE_SNAPSHOTS } from "./qshotSnapshots";

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

/** Schema describing one editable parameter on a node.
 *
 *  Drives `<NodeParamEditor>` — when a `NodeSpec` lists `params`, the
 *  block on the canvas renders an inline editor instead of a static
 *  read-out of `defaultData`. Keep this list narrow on purpose: only
 *  expose the knobs the algorithm's author considered user-tunable in
 *  the original code (the function arguments of `predict()` /
 *  `run_qucad_*` etc., NOT the module-level constants used during
 *  training). Touching the latter would invalidate bundled state.
 */
export type NodeParamSpec =
  | {
      key: string;
      label: string;
      type: "select";
      options: { value: string; label: string }[];
      /** Optional one-line hint shown under the field. */
      hint?: string;
    }
  | {
      key: string;
      label: string;
      type: "number" | "int";
      min?: number;
      max?: number;
      step?: number;
      /** Decimals shown in the inline current-value chip. Defaults to
       *  2 for `number`, 0 for `int`. */
      displayPrecision?: number;
      hint?: string;
    };

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
  /** When present, the canvas node renders an inline editor in place of
   *  the static param read-out. Order matters — params render top-to-
   *  bottom in the order listed here. */
  params?: NodeParamSpec[];
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
    // Backend handler in workflow_service supports three Heron-family
    // fakes (FakeFez / FakeMarrakesh / FakeTorino). Adding more requires
    // extending `_load_fake_backend` in tandem.
    params: [
      {
        key: "backend_name",
        label: "Fake backend",
        type: "select",
        options: [
          { value: "FakeFez", label: "FakeFez · 156q (Heron r2)" },
          { value: "FakeMarrakesh", label: "FakeMarrakesh · 156q (Heron r2)" },
          { value: "FakeTorino", label: "FakeTorino · 133q (Heron r1)" },
        ],
        hint: "Each option is a simulated copy of a real IBM chip. The choice mainly affects which gate-error rates and qubit connectivity the noise model uses.",
      },
    ],
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
    // ADMM hyperparameters from the QuCAD paper: more iterations and a
    // higher λ tend to push weights more aggressively to zero (sparser
    // circuit) at the cost of training time; ρ is the standard ADMM
    // penalty weight. Defaults match the original training script.
    params: [
      {
        key: "iterations",
        label: "ADMM iterations",
        type: "int",
        min: 1,
        max: 20,
        step: 1,
        hint: "More iterations → tighter convergence, slower run.",
      },
      {
        key: "lam",
        label: "Regularisation λ",
        type: "number",
        min: 0.0001,
        max: 0.05,
        step: 0.001,
        displayPrecision: 4,
        hint: "Larger λ → more aggressive pruning (fewer surviving gates).",
      },
      {
        key: "rho",
        label: "ADMM penalty ρ",
        type: "number",
        min: 10,
        max: 5000,
        step: 10,
        displayPrecision: 0,
        hint: "Internal penalty weight for the ADMM solver; default is usually fine.",
      },
    ],
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
      "Noise-aware shot-count recommender. Predicts the smallest shot count that meets a target fidelity bound (with statistical confidence, z=1.645) on a chosen IBM calibration snapshot. Self-contained — no upstream backend required.",
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
    // The two user-facing knobs of QshotRecommender.predict(). Other
    // arguments (k_struct / k_pf / pilot_points / pilot_reps) are model
    // hyperparameters the author tuned during training; touching them
    // would invalidate the bundled clusters, so they're deliberately
    // not exposed.
    params: [
      {
        key: "noise_snapshot",
        label: "Noise snapshot",
        type: "select",
        options: NOISE_SNAPSHOTS.map((s) => ({
          value: s.key,
          label: s.label,
        })),
        hint: "A real IBM chip's calibration captured on a specific date — different days have different noise levels, so the recommended shot count shifts too.",
      },
      {
        key: "alpha",
        label: "Target fidelity α",
        type: "number",
        min: 0.5,
        max: 0.99,
        step: 0.01,
        displayPrecision: 2,
        hint: "Fraction of the best-possible accuracy you want. 0.95 = aim for 95% — higher means stricter and more shots.",
      },
    ],
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
