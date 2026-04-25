// Frontend mirror of backend `qlib/qshot/__init__.py::NOISE_SNAPSHOTS`.
//
// Six bundled IBM calibration snapshots — the same registry the backend
// uses to resolve `noise_snapshot` keys to actual JSON files. Kept in
// sync by hand: when you add a snapshot under
// `backend/cache/qshot/data/noise_json/`, register it on the backend
// AND add an entry here so the Qshot node's dropdown picks it up.
//
// Listed in the order the dropdown should render. `DEFAULT_SNAPSHOT_KEY`
// matches the author's `example_usage.py` default.

export interface NoiseSnapshot {
  /** Stable short key used as node-data value and on the wire. */
  key: string;
  /** Backend the snapshot was pulled from. */
  backend: "ibm_pittsburgh" | "ibm_marrakesh";
  /** ISO date the calibration was captured. */
  date: string;
  /** Human-readable label shown in the dropdown. */
  label: string;
}

export const NOISE_SNAPSHOTS: NoiseSnapshot[] = [
  { key: "pittsburgh_1", backend: "ibm_pittsburgh", date: "2025-06-11", label: "IBM Pittsburgh · 2025-06-11" },
  { key: "pittsburgh_3", backend: "ibm_pittsburgh", date: "2025-11-26", label: "IBM Pittsburgh · 2025-11-26" },
  { key: "pittsburgh_5", backend: "ibm_pittsburgh", date: "2025-07-24", label: "IBM Pittsburgh · 2025-07-24" },
  { key: "marrakesh_1",  backend: "ibm_marrakesh",  date: "2025-05-06", label: "IBM Marrakesh · 2025-05-06" },
  { key: "marrakesh_2",  backend: "ibm_marrakesh",  date: "2026-01-16", label: "IBM Marrakesh · 2026-01-16" },
  { key: "marrakesh_5",  backend: "ibm_marrakesh",  date: "2025-01-13", label: "IBM Marrakesh · 2025-01-13" },
];

export const DEFAULT_SNAPSHOT_KEY = "pittsburgh_1";
