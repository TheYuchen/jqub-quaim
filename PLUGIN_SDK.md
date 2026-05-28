# QuDA Studio — Plugin SDK

User-uploaded blocks let you extend QuDA Studio with your own quantum
algorithms (or any other Python code that consumes a circuit + params
and produces a result) without forking the repo. Drop a `.zip` into
the **Upload** button next to **Add blocks** in the toolbar and your
block appears in the catalog immediately, visible only to your
browser.

## What's in a plugin

Plugins are `.zip` archives containing exactly two top-level files:

```
my_plugin.zip
├── manifest.json   ← block metadata (label, family, params, color)
└── handler.py      ← Python module exposing `run(inputs, params)`
```

Both files must be at the top of the archive (no enclosing folder).

## manifest.json

```jsonc
{
  "kind": "my_block",              // unique id, lowercase identifier
  "label": "My Block",             // display name on the tile
  "family": "algorithm",           // source / backend / algorithm / metric / sink
  "tagline": "noise-aware widget folding",   // short caption
  "description": "...",            // optional long form, shown in tile tooltip
  "color": "#9333ea",              // hex, used for the colored badge
  "author": "Yuchen Yuan",         // optional, shown in card footer

  "params": [
    {
      "key": "threshold",
      "label": "Threshold",
      "type": "number",            // number / int / select
      "min": 0,
      "max": 1,
      "step": 0.01,
      "displayPrecision": 2,
      "hint": "Pruning threshold"
    },
    {
      "key": "method",
      "label": "Method",
      "type": "select",
      "options": [
        {"value": "fast", "label": "Fast"},
        {"value": "thorough", "label": "Thorough"}
      ]
    }
  ],

  "writes": ["my_metric"]          // optional docs of ctx keys you write
}
```

Constraints (the upload endpoint will reject otherwise):

- `kind` — 2–31 chars, `[a-z][a-z0-9_]+`, must not collide with built-ins (`qucad`, `qubound`, etc.)
- `family` — one of `source` / `backend` / `algorithm` / `metric` / `sink`
- `color` — `#rrggbb` hex
- `params` — up to 20 entries; param `key` must be a valid Python identifier; param `type` is `number` / `int` / `select`
- Total `.zip` ≤ 1 MB, ≤ 50 files, each file ≤ 512 KB, only `.py` / `.json` / `.txt` / `.md` allowed
- Each browser is capped at 5 plugins (delete one to upload another)

## handler.py

You must export a single function with this signature:

```python
def run(inputs: dict, params: dict) -> dict:
    """Called by QuDA Studio when the user runs a pipeline that
    includes this plugin block.

    `inputs`:
        "circuit_qpy_bytes": bytes | absent
            QPY-serialized current circuit (only absent for source plugins).
        "backend_name": str | None
            Name of the upstream fake backend (FakeFez/Marrakesh/Torino).
        "scalars": dict
            Scalar values already in ctx (e.g. {"fidelity": 0.95}).

    `params`:
        The user-set parameter values for this block. Keys match the
        `key` field of each entry in manifest.params.

    Return a dict. None of its fields are required. Recognised keys:

        "summary": dict
            JSON-serializable values shown in the result card.
        "circuit_qpy_bytes": bytes
            Replaces the downstream circuit. Skip if your block doesn't
            transform the circuit (metrics, sinks).
        "backend_name": str
            Selects a fake backend for downstream blocks. Must be one
            of FakeFez / FakeMarrakesh / FakeTorino.
        "scalars": dict
            JSON-friendly scalar values added to ctx. If you write
            "fidelity" or "qubound_value" they're also reflected in
            the Output block's summary.
        "error": str
            Surface a custom error message instead of finishing OK.
    """
    ...
```

## Minimum working example

```python
# handler.py
def run(inputs, params):
    from qiskit import QuantumCircuit, qpy
    import io

    # Decode upstream circuit
    qc = qpy.load(io.BytesIO(inputs["circuit_qpy_bytes"]))
    qc = qc[0] if isinstance(qc, list) else qc

    # Do something — e.g., count Hadamards
    h_count = qc.count_ops().get("h", 0)

    return {
        "summary": {
            "num_qubits": qc.num_qubits,
            "h_count": h_count,
            "user_threshold": params.get("threshold", 0.5),
        },
        "scalars": {"my_h_count": h_count},
    }
```

Pair with this manifest:

```json
{
  "kind": "h_counter",
  "label": "HCount",
  "family": "metric",
  "tagline": "counts Hadamard gates",
  "color": "#0ea5e9",
  "params": [
    {"key": "threshold", "label": "Threshold",
     "type": "number", "min": 0, "max": 1, "step": 0.1}
  ]
}
```

Zip the two files at the top level, drop onto the Upload panel, and
the block appears in your catalog.

## Execution environment

Your plugin runs in a fresh Python subprocess each invocation. Key
properties of that environment:

| Limit | Value | Notes |
|---|---|---|
| Wall-clock timeout | **10 min** | Process is `SIGKILL`-ed after 600 s |
| CPU time | 11 min | `RLIMIT_CPU` |
| Virtual memory | 1 GB | `RLIMIT_AS` |
| stdout cap | 10 MB | Output truncated → error |
| stderr cap | 64 KB | Truncated → error |
| Process priority | nice 10 | Don't starve the main FastAPI |
| Env vars | minimal | `IBM_QUANTUM_TOKEN` and other Space secrets are stripped |
| Working dir | your plugin's dir | Relative file ops stay contained |
| Available imports | full Python env | Everything the backend has (qiskit, numpy, torch, …) |

Anything you `print()` lands on stderr (parent shows it in the error
panel if your plugin fails). Only the LAST line of stdout is parsed
as JSON output; the wrapper takes care of this so you don't need to
worry about debug prints conflicting with the result.

## Per-family conventions

| Family | Typical inputs | Typical outputs |
|---|---|---|
| `source` | only `params` | `circuit_qpy_bytes` |
| `backend` | only `params` | `backend_name` (string) |
| `algorithm` | `circuit_qpy_bytes`, `backend_name?`, `scalars` | new `circuit_qpy_bytes` and/or `scalars` |
| `metric` | `circuit_qpy_bytes` | `scalars` (e.g. `{"fidelity": 0.95}`) |
| `sink` | everything in ctx | `summary` for display |

Pipelines validate that source plugins don't sit downstream of other
blocks (their input circuit would be discarded), and that sink
plugins don't have downstream neighbours. Otherwise QuDA Studio
treats plugins like built-in blocks: they participate in the per-
node intermediate cache, the auto-connect family-order chain, and
the SSE step-by-step result stream.

### Things to watch when returning a new `circuit_qpy_bytes`

A few downstream blocks have hard expectations about circuit shape;
violating them surfaces as a confusing error several steps later.

- **Qubit count** — QuBound and Qshot were trained on 5–8 qubit
  circuits. Returning a circuit with a wildly different qubit count
  works (they handle it gracefully), but the metric values may be
  outside the model's confident range. Don't silently expand qubits
  just to satisfy a downstream block.
- **Classical bits** — keep at least the classical registers needed
  for measurement; if you drop them, downstream `Output` will report
  empty counts.
- **Parameterized circuits** — CompressVQC assumes parametric RX/RY/RZ
  rotations. If your block fully binds the parameters into static
  numeric gates, CompressVQC will return zero compression.
- **Custom gates** — avoid `qc.append` of user-defined `Gate`
  subclasses unless you also include a decomposition; QPY may fail
  to deserialize them on the other end.

When in doubt, return the upstream circuit untouched plus your
result in `scalars` — that always composes safely.

## Where plugins live

Plugins are stored under `/tmp/quda_plugins/<your_user_id>/<kind>/`
on the server. The `user_id` is a 32-char hex string your browser
generates on first visit and keeps in `localStorage.quda.userId` —
it's your namespace, no one else sees your plugins.

`/tmp/` is wiped when the HF Space container restarts (every ~24 h
or so, or whenever the maintainers redeploy). You'll need to re-
upload your plugins after a restart. The `.zip` you uploaded never
left your local machine + the Space's container; copy it somewhere
durable if you want to keep it.

## Safety

Plugins are **per-browser** — your colleague won't see your blocks
and vice versa. Plugins **can't read** secrets like the IBM token
or other users' uploaded circuits. They **can crash** without
taking down the server (subprocess isolation). They **can hog**
CPU and memory up to the limits in the table above; HF Spaces has
its own outer limits and may restart the container if a plugin is
particularly abusive.

There is no review process. The lab trusts itself here. If you
deploy QuDA Studio publicly to thousands of users, the right next
step is per-user containerization, not validation rules — talk to
the maintainers.

## Example plugins

See `backend/example_plugins/` in the GitHub repo for a few worked
examples:

- `count_gates/` — a tiny metric plugin (algorithm-family, returns scalars only)
- `prefix_x/` — a circuit transformer (algorithm-family, returns new circuit)

## Troubleshooting

| Error | Likely cause |
|---|---|
| "Zip is X bytes; max is 1048576" | Trim debug data; the limit is intentional |
| "kind 'qucad' collides with a built-in block" | Pick a different `kind` value |
| "manifest.kind: kind must be lowercase letters/digits/underscores…" | `kind` regex is `^[a-z][a-z0-9_]{1,30}$` |
| "Plugin exceeded the 600s timeout" | Optimize, or split the work |
| "plugin run() returned X; expected dict" | Make sure `run()` returns a Python `dict` |
| "plugin run() raised: …" | Standard Python traceback in the message — fix the bug |
| Plugin doesn't appear after upload | HF Space might have restarted; re-upload |
