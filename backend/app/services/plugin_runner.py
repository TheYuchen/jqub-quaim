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
import math
import os
import re
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
    #   - figures: list of typed visual outputs (markdown/table/bar/
    #     svg/image), each validated + size-capped, see _scrub_figures.
    output: dict[str, Any] = {
        "summary": _scrub_dict(result.get("summary") or {}),
        "scalars": _scrub_scalars(result.get("scalars") or {}),
        "duration_s": duration,
    }
    figures = _scrub_figures(result.get("figures"))
    if figures:
        output["figures"] = figures
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
    blocks to choke on.

    NaN and ±Inf are rejected: standard JSON has no representation for
    them, ``model_dump_json`` would emit ``NaN`` / ``Infinity`` (which
    JSON.parse() refuses on the frontend), and the value is almost
    certainly meaningless to downstream metrics anyway."""
    out: dict[str, Any] = {}
    for k, v in d.items():
        if not isinstance(k, str) or not k:
            continue
        if isinstance(v, bool) or isinstance(v, (int, str)) or v is None:
            out[k] = v
        elif isinstance(v, float):
            if math.isfinite(v):
                out[k] = v
            # Drop NaN/Inf silently — plugin author's responsibility.
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
    if v is None or isinstance(v, bool) or isinstance(v, (int, str)):
        return v
    if isinstance(v, float):
        # Same rationale as _scrub_scalars: NaN/Inf break JSON.parse on
        # the frontend, so coerce them to None instead.
        return v if math.isfinite(v) else None
    if isinstance(v, dict):
        return _scrub_dict(v)
    if isinstance(v, (list, tuple)):
        return [_scrub_value(x) for x in v]
    # Numpy scalar / Python decimal / etc — fall back to float, then
    # repr. The finite check catches numpy.nan and numpy.inf as well.
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return str(v)


# ---- Figures validation -----------------------------------------------
#
# Plugins can return a `figures` list of typed visual outputs. Each
# entry is a dict with a `type` field; per-type rules are below.
# Anything that doesn't match — wrong shape, oversize, unsafe markup —
# is dropped silently and the rest of the list still renders. We log
# at INFO so plugin authors can debug via the Space logs.

MAX_FIGURES = 10
MAX_TITLE_CHARS = 120
MAX_MARKDOWN_CHARS = 16 * 1024          # 16 KB of source markdown
MAX_TABLE_ROWS = 100
MAX_TABLE_COLS = 12
MAX_BAR_BARS = 50
MAX_SVG_CHARS = 256 * 1024              # 256 KB of source SVG
MAX_PNG_BYTES = 1 * 1024 * 1024         # 1 MB decoded image
_SVG_BAD_PATTERNS = (
    "<script",
    "javascript:",
    "<foreignobject",
    "<iframe",
    "<object",
    "<embed",
)


def _safe_str(s: Any, max_chars: int) -> str | None:
    """Coerce to a stripped str within max_chars, or None if not stringy."""
    if not isinstance(s, str):
        return None
    s2 = s.strip()
    if not s2 or len(s2) > max_chars:
        return None
    return s2


def _scrub_one_figure(fig: Any) -> dict[str, Any] | None:
    """Validate + sanitise a single figure dict. Returns the cleaned
    object or None if it fails any rule (silently dropped)."""
    if not isinstance(fig, dict):
        return None
    ftype = fig.get("type")
    if not isinstance(ftype, str):
        return None

    title = fig.get("title")
    if title is not None:
        title = _safe_str(title, MAX_TITLE_CHARS)

    if ftype == "markdown":
        content = _safe_str(fig.get("content"), MAX_MARKDOWN_CHARS)
        if content is None:
            return None
        # Refuse anything that looks like an embedded HTML element —
        # the frontend uses a tiny safe markdown renderer that ignores
        # raw HTML anyway, but rejecting here gives the author a
        # signal that <…> won't render.
        if re.search(r"<\s*[a-zA-Z]", content):
            logger.info("Plugin figure: markdown dropped (contains raw HTML)")
            return None
        return {"type": "markdown", "title": title, "content": content}

    if ftype == "table":
        headers = fig.get("headers")
        rows = fig.get("rows")
        if not isinstance(headers, list) or not isinstance(rows, list):
            return None
        if len(headers) > MAX_TABLE_COLS or len(rows) > MAX_TABLE_ROWS:
            logger.info(
                "Plugin figure: table dropped (cols=%d > %d or rows=%d > %d)",
                len(headers), MAX_TABLE_COLS, len(rows), MAX_TABLE_ROWS,
            )
            return None
        clean_headers = [str(h)[:50] for h in headers]
        clean_rows = []
        for r in rows:
            if not isinstance(r, list):
                return None
            if len(r) != len(headers):
                return None
            cleaned = [_scrub_value(c) for c in r]
            clean_rows.append(cleaned)
        return {
            "type": "table",
            "title": title,
            "headers": clean_headers,
            "rows": clean_rows,
        }

    if ftype == "bar":
        data = fig.get("data")
        if not isinstance(data, list) or len(data) > MAX_BAR_BARS or not data:
            return None
        clean_bars = []
        for item in data:
            if not isinstance(item, dict):
                return None
            label = _safe_str(item.get("label"), 40)
            raw_val = item.get("value")
            if label is None:
                return None
            if not isinstance(raw_val, (int, float)) or isinstance(raw_val, bool):
                return None
            if not math.isfinite(float(raw_val)):
                return None
            clean_bars.append({"label": label, "value": float(raw_val)})
        return {
            "type": "bar",
            "title": title,
            "x_label": _safe_str(fig.get("x_label"), 40),
            "y_label": _safe_str(fig.get("y_label"), 40),
            "data": clean_bars,
        }

    if ftype == "svg":
        content = _safe_str(fig.get("content"), MAX_SVG_CHARS)
        if content is None:
            return None
        lowered = content.lower()
        for bad in _SVG_BAD_PATTERNS:
            if bad in lowered:
                logger.info("Plugin figure: svg dropped (matched %r)", bad)
                return None
        # Reject inline event handlers like onclick="…"
        if re.search(r"\son[a-z]+\s*=", lowered):
            logger.info("Plugin figure: svg dropped (event handler attr)")
            return None
        return {"type": "svg", "title": title, "content": content}

    if ftype == "image_png_b64":
        content = fig.get("content")
        if not isinstance(content, str) or not content:
            return None
        # Heuristic size cap on the encoded form (4 b64 chars = 3 raw).
        if len(content) > int(MAX_PNG_BYTES * 4 / 3) + 4:
            logger.info("Plugin figure: png dropped (oversize b64)")
            return None
        try:
            raw = base64.b64decode(content, validate=True)
        except Exception:
            return None
        if len(raw) > MAX_PNG_BYTES:
            return None
        # PNG magic: 89 50 4E 47 0D 0A 1A 0A
        if raw[:8] != b"\x89PNG\r\n\x1a\n":
            logger.info("Plugin figure: png dropped (wrong magic bytes)")
            return None
        return {"type": "image_png_b64", "title": title, "content": content}

    return None  # unknown type


def _scrub_figures(raw: Any) -> list[dict[str, Any]]:
    """Top-level cleanup for a plugin's figures field. Drops the whole
    list to [] if not a list; drops individual entries that fail
    validation."""
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for fig in raw[:MAX_FIGURES]:
        cleaned = _scrub_one_figure(fig)
        if cleaned is not None:
            out.append(cleaned)
    return out
