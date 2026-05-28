"""Per-user plugin block storage + manifest validation.

Plugins are uploaded as `.zip` archives. Each archive must contain:

  - manifest.json — describes the block (kind, label, family, params, ...)
  - handler.py    — Python module exposing `run(inputs, params) -> dict`

Plugins live under ``/tmp/quda_plugins/<user_id>/<kind>/`` so they're
naturally scoped per browser (each browser tab gets its own
``user_id`` UUID stored in localStorage) and naturally garbage-
collected when the HF Space restarts (``/tmp`` is wiped). The user
can also explicitly delete plugins via the API.

This module is execution-free — it only validates and stores plugin
archives. The actual subprocess invocation lives in plugin_runner.py.
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import zipfile
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError, field_validator

logger = logging.getLogger(__name__)

# ---- Configuration -----------------------------------------------------

PLUGIN_ROOT = Path("/tmp/quda_plugins")
MAX_PLUGINS_PER_USER = 5
MAX_ZIP_BYTES = 1 * 1024 * 1024  # 1 MB
MAX_FILES_IN_ZIP = 50
MAX_FILE_BYTES = 512 * 1024  # 512 KB per file inside the zip
# Allowed file extensions inside the zip. Keep narrow — plugins should
# be tiny Python modules, not data dumps.
ALLOWED_ZIP_EXTENSIONS = {".py", ".json", ".txt", ".md"}

# user_id must look like a UUID-ish token; constrains the directory
# structure we'll create on disk.
_USER_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{8,64}$")
_KIND_RE = re.compile(r"^[a-z][a-z0-9_]{1,30}$")

# Reserved kinds collide with built-in NodeType — refuse to let a
# plugin shadow them.
RESERVED_KINDS = {
    "input_circuit",
    "ibm_backend",
    "fake_backend",
    "qucad",
    "qubound",
    "compvqc",
    "qshot",
    "fidelity",
    "output",
}

PluginFamily = Literal["source", "backend", "algorithm", "metric", "sink"]


# ---- Manifest schema ---------------------------------------------------

class PluginParamSpec(BaseModel):
    """One tunable parameter on the plugin's block. Mirrors the
    front-end NodeParamSpec format, with the same supported types."""

    key: str = Field(..., min_length=1, max_length=40)
    label: str = Field(..., min_length=1, max_length=80)
    type: Literal["number", "int", "select"]
    # number/int
    min: float | int | None = None
    max: float | int | None = None
    step: float | int | None = None
    displayPrecision: int | None = None
    # select
    options: list[dict[str, str]] | None = None
    # shared
    hint: str | None = Field(default=None, max_length=300)

    @field_validator("key")
    @classmethod
    def _key_format(cls, v: str) -> str:
        if not re.fullmatch(r"[a-zA-Z_][a-zA-Z0-9_]*", v):
            raise ValueError("param key must be a valid Python identifier")
        return v


class PluginManifest(BaseModel):
    """User-facing plugin metadata. Stored as manifest.json inside the
    plugin zip, and surfaced via /api/plugins so the front-end can
    render the block tile and the param editor."""

    kind: str = Field(..., min_length=2, max_length=32)
    label: str = Field(..., min_length=1, max_length=40)
    family: PluginFamily
    tagline: str = Field(default="custom user block", max_length=80)
    description: str = Field(default="", max_length=400)
    color: str = Field(default="#6b7280")
    params: list[PluginParamSpec] = Field(default_factory=list)
    # Author can declare which keys their plugin writes back to ctx so
    # downstream blocks can pick them up.  Documentation only — the
    # plugin is free to write anything its handler returns.
    writes: list[str] = Field(default_factory=list)
    # Author info shown in the result card footer.  Optional.
    author: str | None = Field(default=None, max_length=80)

    @field_validator("kind")
    @classmethod
    def _kind_format(cls, v: str) -> str:
        if not _KIND_RE.fullmatch(v):
            raise ValueError(
                "kind must be lowercase letters/digits/underscores, starting "
                "with a letter, 2-31 chars"
            )
        if v in RESERVED_KINDS:
            raise ValueError(f"kind {v!r} collides with a built-in block")
        return v

    @field_validator("color")
    @classmethod
    def _color_format(cls, v: str) -> str:
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", v):
            raise ValueError("color must be #rrggbb hex")
        return v

    @field_validator("params")
    @classmethod
    def _unique_param_keys(cls, v: list[PluginParamSpec]) -> list[PluginParamSpec]:
        keys = [p.key for p in v]
        if len(keys) != len(set(keys)):
            raise ValueError("param keys must be unique")
        if len(v) > 20:
            raise ValueError("at most 20 params per plugin")
        return v


# ---- Storage helpers ---------------------------------------------------

class PluginError(Exception):
    """Raised by upload/validation paths. Caller maps to HTTP 4xx."""


def validate_user_id(user_id: str) -> str:
    """Return user_id unchanged if it matches our format, else raise."""
    if not user_id or not _USER_ID_RE.fullmatch(user_id):
        raise PluginError("Invalid user_id format.")
    return user_id


def user_plugin_dir(user_id: str) -> Path:
    """Absolute path to ``/tmp/quda_plugins/<user_id>/``. Created
    on first access; never returns paths above PLUGIN_ROOT."""
    validate_user_id(user_id)
    d = PLUGIN_ROOT / user_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def plugin_dir(user_id: str, kind: str) -> Path:
    if not _KIND_RE.fullmatch(kind):
        raise PluginError(f"Invalid plugin kind {kind!r}.")
    return user_plugin_dir(user_id) / kind


def list_user_plugins(user_id: str) -> list[PluginManifest]:
    """Return manifests of every plugin the user currently has installed."""
    base = user_plugin_dir(user_id)
    out: list[PluginManifest] = []
    for sub in sorted(base.iterdir()):
        if not sub.is_dir():
            continue
        manifest_path = sub / "manifest.json"
        if not manifest_path.exists():
            continue
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
            out.append(PluginManifest.model_validate(data))
        except Exception as exc:
            logger.warning("Skipping broken plugin %s: %s", sub, exc)
            continue
    return out


def find_plugin(user_id: str, kind: str) -> tuple[PluginManifest, Path] | None:
    """Look up a single plugin by (user_id, kind). Returns the manifest
    plus the plugin's directory path (containing ``handler.py``), or
    ``None`` if not found."""
    d = plugin_dir(user_id, kind)
    manifest_path = d / "manifest.json"
    if not manifest_path.exists():
        return None
    try:
        manifest = PluginManifest.model_validate_json(
            manifest_path.read_text(encoding="utf-8")
        )
    except (ValidationError, json.JSONDecodeError) as exc:
        logger.warning("Plugin %s/%s has broken manifest: %s", user_id, kind, exc)
        return None
    return manifest, d


def delete_plugin(user_id: str, kind: str) -> bool:
    """Remove the given plugin from this user's namespace. Returns
    True if something was removed, False if it didn't exist."""
    d = plugin_dir(user_id, kind)
    if not d.exists():
        return False
    shutil.rmtree(d, ignore_errors=True)
    return True


# ---- Upload + validation -----------------------------------------------

def install_plugin_zip(user_id: str, zip_bytes: bytes) -> PluginManifest:
    """Validate and install a plugin .zip for the given user. Raises
    :class:`PluginError` with a human-readable message if anything
    goes wrong; the caller maps to HTTP 400."""
    validate_user_id(user_id)

    # Hard size cap up front.
    if len(zip_bytes) > MAX_ZIP_BYTES:
        raise PluginError(
            f"Zip is {len(zip_bytes)} bytes; max allowed is {MAX_ZIP_BYTES}."
        )

    # Per-user plugin count cap. Reject before extracting anything.
    existing = list_user_plugins(user_id)
    if len(existing) >= MAX_PLUGINS_PER_USER:
        raise PluginError(
            f"You already have {len(existing)} plugins (max "
            f"{MAX_PLUGINS_PER_USER}). Delete one before uploading a new one."
        )

    # Parse the zip.
    import io
    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile as exc:
        raise PluginError(f"Not a valid zip file: {exc}") from None

    # Inspect entries before extracting. We refuse paths with .. or
    # leading /, refuse non-allowed extensions, refuse over-large files
    # or too many entries.
    members = zf.infolist()
    if len(members) > MAX_FILES_IN_ZIP:
        raise PluginError(
            f"Zip has {len(members)} files; max allowed is {MAX_FILES_IN_ZIP}."
        )
    manifest_member = None
    handler_member = None
    for m in members:
        # Reject any path that tries to escape the destination.
        if m.is_dir():
            continue
        name = m.filename
        # Defence-in-depth: reject path-traversal in multiple flavours.
        # On Linux the .. check below is sufficient, but we also reject
        # backslash separators (Windows-style) and leading dots so a
        # crafted zip can't end up writing to unexpected paths if this
        # codebase is ever deployed on another OS.
        if (
            name.startswith("/")
            or name.startswith("\\")
            or "\\" in name
            or ".." in Path(name).parts
            or Path(name).is_absolute()
        ):
            raise PluginError(f"Suspicious zip entry path: {name!r}.")
        # Reject extensions outside the allowlist.
        ext = Path(name).suffix.lower()
        if ext not in ALLOWED_ZIP_EXTENSIONS:
            raise PluginError(
                f"File {name!r} has disallowed extension {ext!r}. Allowed: "
                + ", ".join(sorted(ALLOWED_ZIP_EXTENSIONS))
            )
        if m.file_size > MAX_FILE_BYTES:
            raise PluginError(
                f"File {name!r} is {m.file_size} bytes; max per-file is {MAX_FILE_BYTES}."
            )
        # Capture the required files.  Some zips put everything at the
        # top level; some nest under a single folder. Accept either by
        # matching the basename.
        base = Path(name).name
        if base == "manifest.json":
            manifest_member = m
        elif base == "handler.py":
            handler_member = m

    if manifest_member is None:
        raise PluginError("Zip is missing manifest.json at the top level.")
    if handler_member is None:
        raise PluginError("Zip is missing handler.py at the top level.")

    # Parse + validate the manifest before writing anything to disk.
    try:
        manifest_raw = zf.read(manifest_member).decode("utf-8")
    except UnicodeDecodeError:
        raise PluginError("manifest.json is not valid UTF-8.") from None
    try:
        manifest_data = json.loads(manifest_raw)
    except json.JSONDecodeError as exc:
        raise PluginError(f"manifest.json is not valid JSON: {exc}") from None
    try:
        manifest = PluginManifest.model_validate(manifest_data)
    except ValidationError as exc:
        # Pull the first error message to keep the UX friendly.
        first = exc.errors()[0]
        path = ".".join(str(p) for p in first.get("loc", []))
        msg = first.get("msg", "validation failed")
        raise PluginError(f"manifest.{path}: {msg}") from None

    # Refuse if this user already has a plugin with the same kind.
    target_dir = plugin_dir(user_id, manifest.kind)
    if target_dir.exists():
        raise PluginError(
            f"You already have a plugin with kind={manifest.kind!r}. "
            "Delete it first or use a different kind."
        )

    # All checks passed — extract into a flat layout: <plugin_dir>/
    # contains manifest.json + handler.py + any extras directly.
    target_dir.mkdir(parents=True, exist_ok=False)
    try:
        # Write manifest.json (already validated).
        (target_dir / "manifest.json").write_text(manifest_raw, encoding="utf-8")
        # Extract every other allowed file. Use the basename so a
        # nested-in-folder zip and a flat zip end up identical on disk.
        seen = set()
        for m in members:
            if m.is_dir():
                continue
            base = Path(m.filename).name
            if base == "manifest.json":
                continue
            if base in seen:
                raise PluginError(
                    f"Duplicate file basename {base!r} in zip; flatten the layout."
                )
            seen.add(base)
            dest = target_dir / base
            with zf.open(m) as src, open(dest, "wb") as dst:
                # Copy in chunks so we don't load huge files in memory.
                while True:
                    chunk = src.read(64 * 1024)
                    if not chunk:
                        break
                    dst.write(chunk)
    except Exception:
        # Roll back on partial extraction so the user isn't stuck with
        # a corrupted plugin.
        shutil.rmtree(target_dir, ignore_errors=True)
        raise

    logger.info("Installed plugin %s/%s", user_id, manifest.kind)
    return manifest


def get_plugin_handler_path(user_id: str, kind: str) -> Path | None:
    """Resolve to the handler.py for a (user, kind) plugin, or None."""
    d = plugin_dir(user_id, kind)
    handler = d / "handler.py"
    if not handler.exists():
        return None
    return handler


# ---- Helper exposed to the frontend ------------------------------------

def manifest_to_frontend(m: PluginManifest) -> dict[str, Any]:
    """Shape the manifest into the JSON the front-end expects (mirrors
    the NodeSpec fields in frontend/src/lib/nodeCatalog.ts)."""
    return {
        "kind": m.kind,
        "label": m.label,
        "family": m.family,
        "tagline": m.tagline,
        "description": m.description,
        "color": m.color,
        "params": [p.model_dump(exclude_none=True) for p in m.params],
        "writes": m.writes,
        "author": m.author,
        "is_plugin": True,
    }
