// Per-family one-liner explanations. Shared between QNode (tile tooltip),
// the BlockPicker (multi-select hint chips), and UploadPluginModal (the
// family pill on each example row).

import type { NodeSpec } from "./nodeCatalog";

export const FAMILY_HINTS: Record<NodeSpec["family"], string> = {
  source:
    "Where the pipeline starts — feeds your quantum circuit to the rest of the graph.",
  backend:
    "Provides a noise model. Algorithm blocks downstream use it to simulate hardware behaviour.",
  algorithm:
    "A research algorithm. Reads the circuit (and noise) from upstream, may transform the circuit or attach a metric.",
  metric:
    "Computes a quantitative score on the current circuit (e.g. fidelity).",
  sink:
    "Where the pipeline ends — aggregates final metrics and the resulting circuit.",
};
