"""Subprocess entry point for user-uploaded plugin handlers.

Invoked by plugin_runner.run_plugin() — never imported by FastAPI
itself. Communicates with the parent via stdin/stdout JSON:

  parent sends ONE JSON object on stdin:
    {"inputs": {...}, "params": {...}}

  child writes ONE JSON object on its LAST stdout line:
    {"summary": {...}, "scalars": {...},
     "circuit_qpy_b64": "<base64>",  # optional
     "backend_name": "...",          # optional
     "error": "..."}                 # if anything went wrong

The plugin's own ``handler.py`` is loaded via importlib so it doesn't
have to live on PYTHONPATH. Its single required hook is::

    def run(inputs: dict, params: dict) -> dict: ...

We catch every exception inside this wrapper so a plugin crash
surfaces to the parent as ``{"error": "..."}`` instead of a non-zero
return code with no info.
"""

from __future__ import annotations

import base64
import importlib.util
import json
import sys
import traceback
from pathlib import Path
from typing import Any


def _load_handler(handler_path: Path):
    """Import handler.py from an explicit path so we don't need to
    mutate sys.path or worry about package layouts."""
    spec = importlib.util.spec_from_file_location("user_plugin_handler", handler_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load handler from {handler_path}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _emit_error(msg: str) -> None:
    """Write a JSON error to stdout as the last line so the parent's
    line-based parser picks it up."""
    sys.stdout.write("\n" + json.dumps({"error": msg}) + "\n")
    sys.stdout.flush()


def main() -> int:
    if len(sys.argv) < 2:
        _emit_error("plugin subprocess: missing handler path argv")
        return 1
    handler_path = Path(sys.argv[1])

    # Read the whole stdin payload before doing anything else so the
    # parent can close its end. Hard cap at 50 MB so a runaway parent
    # (shouldn't happen, but defence in depth) can't exhaust memory
    # before the OS-level rlimit kicks in.
    MAX_STDIN_BYTES = 50 * 1024 * 1024
    try:
        raw = sys.stdin.buffer.read(MAX_STDIN_BYTES + 1)
    except Exception as exc:
        _emit_error(f"reading stdin failed: {exc}")
        return 1
    if len(raw) > MAX_STDIN_BYTES:
        _emit_error(
            f"stdin payload exceeded {MAX_STDIN_BYTES} bytes; refusing to load."
        )
        return 1
    try:
        raw = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        _emit_error(f"stdin is not valid UTF-8: {exc}")
        return 1
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        _emit_error(f"stdin was not valid JSON: {exc}")
        return 1
    if not isinstance(payload, dict):
        _emit_error("stdin payload must be a JSON object")
        return 1

    inputs_raw = payload.get("inputs", {}) or {}
    params = payload.get("params", {}) or {}

    # Decode circuit if upstream provided one.
    inputs: dict[str, Any] = {
        "scalars": inputs_raw.get("scalars", {}) or {},
        "backend_name": inputs_raw.get("backend_name"),
    }
    if "circuit_qpy_b64" in inputs_raw and inputs_raw["circuit_qpy_b64"]:
        try:
            inputs["circuit_qpy_bytes"] = base64.b64decode(inputs_raw["circuit_qpy_b64"])
        except Exception as exc:
            _emit_error(f"could not decode upstream circuit_qpy_b64: {exc}")
            return 1

    # Load and execute the plugin.
    try:
        mod = _load_handler(handler_path)
    except Exception:
        _emit_error("loading handler.py failed:\n" + traceback.format_exc())
        return 1

    run_fn = getattr(mod, "run", None)
    if run_fn is None or not callable(run_fn):
        _emit_error("handler.py must export a callable named `run`.")
        return 1

    try:
        result = run_fn(inputs, params)
    except Exception:
        _emit_error("plugin run() raised:\n" + traceback.format_exc())
        return 1

    if not isinstance(result, dict):
        _emit_error(
            f"plugin run() returned {type(result).__name__}; expected dict."
        )
        return 1

    # If the plugin returned bytes for a circuit, base64 it for transport.
    out: dict[str, Any] = {}
    for key in ("summary", "scalars", "backend_name", "error", "figures"):
        if key in result:
            out[key] = result[key]
    if "circuit_qpy_bytes" in result:
        cb = result["circuit_qpy_bytes"]
        if not isinstance(cb, (bytes, bytearray)):
            _emit_error(
                "plugin returned circuit_qpy_bytes that is not bytes "
                f"(got {type(cb).__name__})."
            )
            return 1
        out["circuit_qpy_b64"] = base64.b64encode(bytes(cb)).decode("ascii")

    # Final result on the LAST stdout line so the parent's line-based
    # parser picks it up even if the plugin printed debug output.
    sys.stdout.write("\n" + json.dumps(out) + "\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
