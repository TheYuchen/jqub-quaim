// Preset pipelines that populate the canvas on boot / on "Load preset".
//
// Each preset is described declaratively (what nodes and edges, no
// positions). `buildPresetGraph` turns that into React Flow node/edge
// objects with a simple left-to-right chain layout, so adding a new
// preset only requires editing this file.

import type { Edge, Node } from "@xyflow/react";
import type { NodeKind } from "./nodeCatalog";
import { NODE_BY_KIND } from "./nodeCatalog";
import type { QNodeData } from "../components/QNode";

export interface PresetNodeSpec {
  id: string;
  kind: NodeKind;
  /** Optional param overrides on top of the kind's `defaultData`. */
  params?: Record<string, unknown>;
}

export interface PresetEdgeSpec {
  source: string;
  target: string;
}

export interface PipelinePreset {
  key: string;
  label: string;
  /** One-line description shown in the preset dropdown. */
  tagline: string;
  nodes: PresetNodeSpec[];
  edges: PresetEdgeSpec[];
}

export const PIPELINE_PRESETS: PipelinePreset[] = [
  {
    key: "qubound",
    label: "QuBound",
    tagline: "Predict today's fidelity bound from calibration history",
    nodes: [
      { id: "n1", kind: "input_circuit" },
      { id: "n2", kind: "fake_backend" },
      { id: "n3", kind: "qubound" },
      { id: "n4", kind: "output" },
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
    ],
  },
  {
    key: "qucad",
    label: "QuCAD",
    tagline: "ADMM pruning on VQC weights, plus a fidelity check",
    nodes: [
      { id: "n1", kind: "input_circuit" },
      { id: "n2", kind: "fake_backend" },
      { id: "n3", kind: "qucad" },
      { id: "n4", kind: "fidelity" },
      { id: "n5", kind: "output" },
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
    ],
  },
  {
    key: "compvqc",
    label: "CompressVQC",
    tagline: "Fold redundant parametric gates, then check fidelity",
    nodes: [
      { id: "n1", kind: "input_circuit" },
      { id: "n2", kind: "fake_backend" },
      { id: "n3", kind: "compvqc" },
      { id: "n4", kind: "fidelity" },
      { id: "n5", kind: "output" },
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
    ],
  },
  {
    key: "full",
    label: "Full stack",
    tagline: "QuCAD + CompressVQC + QuBound + Fidelity, end-to-end",
    nodes: [
      { id: "n1", kind: "input_circuit" },
      { id: "n2", kind: "fake_backend" },
      { id: "n3", kind: "qucad" },
      { id: "n4", kind: "compvqc" },
      { id: "n5", kind: "qubound" },
      { id: "n6", kind: "fidelity" },
      { id: "n7", kind: "output" },
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
      { source: "n3", target: "n4" },
      { source: "n4", target: "n5" },
      { source: "n5", target: "n6" },
      { source: "n6", target: "n7" },
    ],
  },
];

export const DEFAULT_PRESET_KEY = "qubound";

export const PRESET_BY_KEY: Record<string, PipelinePreset> = Object.fromEntries(
  PIPELINE_PRESETS.map((p) => [p.key, p]),
);

/**
 * Convert a preset into React Flow nodes/edges, laid out as a simple
 * left-to-right chain with fixed horizontal spacing. Long chains just
 * extend further right — React Flow's fitView handles the zoom.
 */
export function buildPresetGraph(preset: PipelinePreset): {
  nodes: Node<QNodeData>[];
  edges: Edge[];
} {
  const START_X = 80;
  const SPACING_X = 260;
  const Y = 120;
  const nodes: Node<QNodeData>[] = preset.nodes.map((pn, i) => ({
    id: pn.id,
    type: "qnode",
    position: { x: START_X + i * SPACING_X, y: Y },
    data: {
      kind: pn.kind,
      params: {
        ...(NODE_BY_KIND[pn.kind].defaultData ?? {}),
        ...(pn.params ?? {}),
      },
    },
  }));
  const edges: Edge[] = preset.edges.map((pe, i) => ({
    id: `e${i + 1}`,
    source: pe.source,
    target: pe.target,
  }));
  return { nodes, edges };
}
