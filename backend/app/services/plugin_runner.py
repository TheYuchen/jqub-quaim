"""Run a user-uploaded plugin in an isolated subprocess.

Why subprocess? The plugin is user-uploaded Python code. We can't trust
it not to crash, loop forever, exhaust memory, or read environment
variables it shouldn't. Running it in a fresh subprocess lets us:

  * Hard-timeout via ``subprocess.run(timeout=...)``.
  * Cap memory with ``resource.setrlimit(RLIMIT_AS, ...)`` in
    preexec_fn (Linux only — fine, HF Space is Linux).
  * Strip sensitive env vars (notably ``IBM_QUANTUM_TOKEN``) so
    plugins can't exfiltrate them.
  * Chdir to the plugin's own directory so relative file I/O stays
    contained.
  * Survive a crashing plugin without taking down FastAPI.

Wire protocol (stdin/stdout, JSON line-delimited):

  parent → child:  one JSON object with {"inputs": {...}, "params": {...}}
  child  → parent: one JSON object with {"ok": bool, ...result fields}

The child runs a small wrapper script (``_plugin_subprocess.py``) we
ship alongside this file.  Binary blobs (circuit QPY) are base64-
encoded inside the JSON so we don't have to multiplex frames.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import resource
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---- Resource limits ---------------------------------------------------

PLUGIN_TIMEOUT_SECONDS = 600  # 10 minutes hard cap
PLUGIN_MAX_RSS_BYTES = 1 * 1024 * 1024 * 1024  # 1 GB
PLUGIN_MAX_STDOUT_BYTES = 10 * 1024 * 1024  # 10 MB
PLUGIN_MAX_STDERR_BYTES = 64 * 1024  # 64 KB

# Environment whitelist — anything not in this set is dropped before
# the subprocess starts.  In particular this drops IBM_QUANTUM_TOKEN
# and anything else the operator may have set in the Space's secrets.
_ENV_ALLOWLIST = {
    "PATH",
    "PYTHONPATH",
    "HOME",
    "TMPDIR",
    "LANG",
    "LC_ALL",
    "LD_LIBRARY_PATH",
}


class PluginRunError(Exception):
    """Raised when subprocess execution fails for any reason. The
    workflow handler catches this and surfaces it in the StepResult."""


# ---- Public entry point ------------------------------------------------

def run_plugin(
    *,
    handler_dir: Path,
    inputs: dict[str, Any],
    params: dict[str, Any],
    timeout_seconds: int = PLUGIN_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Execute ``handler_dir/handler.py``'s ``run(inputs, params)``
    in a subprocess and return the (validated) result dict.

    inputs may contain:
      - circuit_qpy_bytes: bytes (will be base64-encoded over the wire)
      - backend_name: str | None
      - scalars: dict of plain ctx values (fidelity, qubound_value, …)

    Returns the same shape (with circuit_qpy_bytes decoded back to bytes).
    """
    handler_py = handler_dir / "handler.py"
    if not handler_py.exists():
        # Don't leak the full /tmp/quda_plugins/<user>/<kind>/ path —
        # the user already knows their plugin kind, that's enough.
        raise PluginRunError("Plugin handler.py is missing.")

    wrapper = Path(__file__).resolve().parent / "_plugin_subprocess.py"
    if not wrapper.exists():
        raise PluginRunError("Plugin subprocess wrapper missing from backend.")

    # Encode binary blobs.
    payload_inputs: dict[str, Any] = {
        "scalars": inputs.get("scalars", {}) or {},
        "backend_name": inputs.get("backend_name"),
    }
    circuit_bytes = inputs.get("circuit_qpy_bytes")
    if circuit_bytes is not None:
        payload_inputs["circuit_qpy_b64"] = base64.b64encode(circuit_bytes).decode("ascii")
    payload = {"inputs": payload_inputs, "params": params or {}}

    # Build a stripped env. Plugins still get PATH so they can import,
    # but no IBM token or other secrets.
    env = {k: v for k, v in os.environ.items() if k in _ENV_ALLOWLIST}
    env.setdefault("PYTHONUNBUFFERED", "1")
    env.setdefault("HOME", str(handler_dir))

    t0 = time.monotonic()
    try:
        proc = subprocess.run(
            [sys.executable, str(wrapper), str(handler_py)],
            input=json.dumps(payload).encode("utf-8"),
            capture_output=True,
            timeout=timeout_seconds,
            cwd=str(handler_dir),
            env=env,
            preexec_fn=_set_resource_limits,  # Linux-only; fine on HF
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise PluginRunError(
            f"Plugin exceeded the {timeout_seconds}s timeout. The process was killed."
        ) from None
    except FileNotFoundError as exc:
        raise PluginRunError(f"Could not spawn subprocess: {exc}") from None
    duration = time.monotonic() - t0
    logger.info(
        "Plugin %s exited rc=%s after %.2fs (stdout=%d, stderr=%d)",
        handler_dir.name,
        proc.returncode,
        duration,
        len(proc.stdout),
        len(proc.stderr),
    )

    if len(proc.stdout) > PLUGIN_MAX_STDOUT_BYTES:
        raise PluginRunError(
            f"Plugin emitted {len(proc.stdout)} bytes (max {PLUGIN_MAX_STDOUT_BYTES})."
        )

    stderr_snippet = proc.stderr.decode("utf-8", errors="replace")[:PLUGIN_MAX_STDERR_BYTES]

    if proc.returncode != 0:
        raise PluginRunError(
            f"Plugin exited with code {proc.returncode}.\n\nstderr:\n{stderr_snippet}"
        )

    # Parse stdout — expect a single JSON object on the LAST line so
    # plugin print()s don't break the protocol.
    out_text = proc.stdout.decode("utf-8", errors="replace").strip()
    if not out_text:
        raise PluginRunError(
            f"Plugin produced no output.\n\nstderr:\n{stderr_snippet}"
        )
    last_line = out_text.rsplit("\n", 1)[-1]
    try:
        result = json.loads(last_line)
    except json.JSONDecodeError as exc:
        raise PluginRunError(
            f"Plugin output last line was not JSON ({exc}).\n\n"
            f"Last line: {last_line[:500]!r}\n\nstderr:\n{stderr_snippet}"
        ) from None

    if not isinstance(result, dict):
        raise PluginRunError(
            f"Plugin output was {type(result).__name__}, expected dict."
        )

    if result.get("error"):
        raise PluginRunError(f"Plugin reported error: {result['error']}")

    # Sanitize / decode output. Plugins can return:
    #   - summary: dict of JSON-serializable values (shown in card)
    #   - circuit_qpy_b64: optional base64 of new circuit bytes
    #   - backend_name: optional string (must be in known list)
    #   - scalars: optional dict of {key: float|int|str|bool}
    output: dict[str, Any] = {
        "summary": _scrub_dict(result.get("summary") or {}),
        "scalars": _scrub_scalars(result.get("scalars") or {}),
        "duration_s": duration,
    }
    if "circuit_qpy_b64" in result:
        try:
            output["circuit_qpy_bytes"] = base64.b64decode(result["circuit_qpy_b64"])
        except Exception as exc:
            raise PluginRunError(f"circuit_qpy_b64 was not valid base64: {exc}") from None
    if "backend_name" in result and result["backend_name"]:
        output["backend_name"] = str(result["backend_name"])
    return output


# ---- Internals ---------------------------------------------------------

def _set_resource_limits() -> None:
    """preexec_fn — caps virtual memory in the child."""
    try:
        resource.setrlimit(
            resource.RLIMIT_AS,
            (PLUGIN_MAX_RSS_BYTES, PLUGIN_MAX_RSS_BYTES),
        )
    except (ValueError, OSError):
        # Some kernels don't allow lowering past the inherited cap; not
        # fatal — the timeout still bounds badness.
        pass
    try:
        # CPU time cap — 11 minutes (a touch above our wall clock 10
        # min so the wall-clock timeout fires first with a clearer
        # message).
        resource.setrlimit(resource.RLIMIT_CPU, (660, 660))
    except (ValueError, OSError):
        pass
    # Lower priority so a busy plugin doesn't starve the FastAPI process.
    try:
        os.nice(10)
    except OSError:
        pass


def _scrub_scalars(d: dict[str, Any]) -> dict[str, Any]:
    """Restrict scalar values to JSON-friendly primitive types so we
    don't accidentally pickle exotic objects into ctx for downstream
    blocks to choke on."""
    out: dict[str, Any] = {}
    for k, v in d.items():
        if not isinstance(k, str) or not k:
            continue
        if isinstance(v, (int, float, str, bool)) or v is None:
            out[k] = v
    return out


def _scrub_dict(d: dict[str, Any]) -> dict[str, Any]:
    """Make a dict JSON-safe by recursively coercing odd types. Plugins
    sometimes return numpy floats/arrays; we want to surface those as
    plain Python so Pydantic's model_dump_json doesn't choke."""
    out: dict[str, Any] = {}
    for k, v in d.items():
        if not isinstance(k, str):
            continue
        out[k] = _scrub_value(v)
    return out


def _scrub_value(v: Any) -> Any:
    if v is None or isinstance(v, (bool, int, float, str)):
        return v
    if isinstance(v, dict):
        return _scrub_dict(v)
    if isinstance(v, (list, tuple)):
        return [_scrub_value(x) for x in v]
    # Numpy scalar / Python decimal / etc — fall back to repr.
    try:
        return float(v)
    except (TypeError, ValueError):
        return str(v)
