"""/api/plugins — per-user plugin block upload / list / delete.

All endpoints are scoped to a ``user_id`` query parameter — an
anonymous UUID the browser generates on first visit and stores in
localStorage. Plugins uploaded by one user are visible only to that
user. No global registry, no admin approval.

Storage is process-local under ``/tmp/quda_plugins/<user_id>/`` so
plugins die when the HF Space container restarts. Users can re-upload
their .zip if they want them back.

The /api/plugins/examples endpoints are read-only and serve bundled
sample .zip files so users can try the upload flow end-to-end without
writing a plugin from scratch.
"""

from __future__ import annotations

import json
import logging
import re
import zipfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response

from app.services import auth_service, plugin_service

logger = logging.getLogger(__name__)
router = APIRouter()


# Path to the bundled example_plugins/ directory. Lives at the repo
# root (sibling of backend/), which becomes /home/user/app/example_plugins
# in the Docker image (see Dockerfile COPY). In dev mode (uvicorn run
# from backend/), the same parents[3] path resolves to the project root.
_EXAMPLES_DIR = Path(__file__).resolve().parents[3] / "example_plugins"

# Match safe filenames: lowercase identifier, no path separators.
_SAFE_NAME_RE = re.compile(r"^[a-z][a-z0-9_]{0,30}$")


def _effective_user_id(request: Request, query_user_id: str | None) -> str:
    """Resolve which namespace this request operates on.

    Precedence:
      1. Session-derived ``hf_<username>`` (cookie present + valid).
         The server always wins — a logged-in user can't spoof someone
         else's namespace by passing a different ``user_id`` query.
      2. The client-supplied anon UUID for non-logged-in browsers. We
         REFUSE any query value starting with ``hf_`` because that
         prefix is reserved for authenticated users; without this
         check an anonymous client could squat on a real HF username's
         namespace, polluting their plugin list on next login.
    """
    user = auth_service.decode_session(
        request.cookies.get(auth_service.SESSION_COOKIE)
    )
    if user is not None:
        return auth_service.hf_user_id(user.username)
    if not query_user_id:
        raise HTTPException(
            status_code=400,
            detail="No session cookie and no user_id query parameter.",
        )
    if query_user_id.startswith("hf_"):
        raise HTTPException(
            status_code=400,
            detail=(
                "The hf_ user_id prefix is reserved for authenticated "
                "sessions. Sign in with Hugging Face or use a non-prefixed id."
            ),
        )
    try:
        plugin_service.validate_user_id(query_user_id)
    except plugin_service.PluginError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    return query_user_id


@router.get("/plugins")
def list_plugins(request: Request, user_id: str | None = Query(None)) -> list[dict]:
    """List all plugins this browser/account has uploaded."""
    effective = _effective_user_id(request, user_id)
    # For logged-in users whose /tmp was wiped by a container restart,
    # hydrate from the HF Datasets backing store before listing.
    plugin_service.hydrate_from_dataset_if_needed(effective)
    manifests = plugin_service.list_user_plugins(effective)
    return [plugin_service.manifest_to_frontend(m) for m in manifests]


@router.post("/plugins/upload")
async def upload_plugin(
    request: Request,
    user_id: str | None = Query(None),
    file: UploadFile = File(...),
) -> dict:
    """Upload a plugin .zip. Returns the validated manifest on success.

    Validation enforces:
      * zip ≤ 1 MB, ≤ 50 entries, each entry ≤ 512 KB
      * only .py / .json / .txt / .md extensions inside
      * a manifest.json at top level with a valid PluginManifest
      * a handler.py at top level
      * kind doesn't collide with built-ins or existing plugins
      * user is under their 5-plugin cap
    """
    effective = _effective_user_id(request, user_id)
    # For logged-in users on a restarted Space, hydrate the namespace
    # before the cap check so we don't let them exceed the 5-plugin cap
    # by uploading a 6th while their dataset-persisted plugins are
    # waiting to be pulled in.
    plugin_service.hydrate_from_dataset_if_needed(effective)

    # Read the upload — FastAPI streams it but we want it in memory
    # so we can size-check before doing anything else. The size cap
    # in plugin_service will reject if it's >1 MB.
    blob = await file.read()
    try:
        manifest = plugin_service.install_plugin_zip(effective, blob)
    except plugin_service.PluginError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    except Exception as exc:
        logger.exception("Plugin install failed unexpectedly")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error installing plugin: {exc}",
        ) from None
    return plugin_service.manifest_to_frontend(manifest)


@router.delete("/plugins/{kind}")
def delete_plugin(
    kind: str, request: Request, user_id: str | None = Query(None)
) -> dict:
    """Remove a plugin from this user's namespace."""
    effective = _effective_user_id(request, user_id)
    plugin_service.hydrate_from_dataset_if_needed(effective)
    removed = plugin_service.delete_plugin(effective, kind)
    if not removed:
        raise HTTPException(status_code=404, detail=f"No plugin with kind={kind!r}.")
    return {"removed": True, "kind": kind}


# ---- Example plugins ---------------------------------------------------
#
# Two read-only endpoints that expose the bundled example_plugins/*.zip
# files so users can try the upload flow without writing one from scratch.
# The catalog endpoint reads each zip's manifest.json so the modal can
# show a meaningful label/tagline next to the download link.
#
# Note on route ordering: the only DELETE route above uses /plugins/{kind},
# which is a different HTTP method from these GETs — no collision today.
# If a future GET /plugins/{kind} is added (e.g. a detail endpoint),
# move the /plugins/examples routes ABOVE it so FastAPI matches the
# literal path first. Both /plugins/examples and /plugins/examples/{name}.zip
# would otherwise be shadowed by the path-parameter route.


_MAX_MANIFEST_READ = 64 * 1024  # 64 KB is way more than any sensible manifest


def _read_manifest_from_zip(zip_path: Path) -> dict | None:
    """Open a bundled .zip and pull out the manifest.json contents.

    Returns None if anything looks wrong — we don't want a malformed
    bundled example to take down the whole catalog endpoint. The read
    is capped at _MAX_MANIFEST_READ bytes as defence in depth even
    though these zips are repo-controlled."""
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            if "manifest.json" not in zf.namelist():
                return None
            with zf.open("manifest.json") as fh:
                raw = fh.read(_MAX_MANIFEST_READ + 1)
                if len(raw) > _MAX_MANIFEST_READ:
                    return None
                return json.loads(raw.decode("utf-8"))
    except (zipfile.BadZipFile, json.JSONDecodeError, OSError, UnicodeDecodeError):
        return None


@router.get("/plugins/examples")
def list_example_plugins() -> list[dict]:
    """List the bundled example plugin .zip files (read-only catalog).

    Returns minimal metadata sourced from each zip's manifest.json so
    the upload modal can show the user a friendly card per example.
    """
    if not _EXAMPLES_DIR.is_dir():
        # Not shipped — empty catalog rather than 500.
        return []
    out: list[dict] = []
    for zip_path in sorted(_EXAMPLES_DIR.glob("*.zip")):
        name = zip_path.stem
        if not _SAFE_NAME_RE.match(name):
            continue  # Skip anything with a suspicious filename
        manifest = _read_manifest_from_zip(zip_path)
        if manifest is None:
            continue
        try:
            size = zip_path.stat().st_size
        except OSError:
            continue
        out.append(
            {
                "name": name,
                "label": str(manifest.get("label", name)),
                "family": str(manifest.get("family", "algorithm")),
                "tagline": str(manifest.get("tagline", "")),
                "color": str(manifest.get("color", "#9333ea")),
                "size_bytes": size,
            }
        )
    return out


@router.get("/plugins/examples/{name}.zip")
def download_example_plugin(name: str) -> Response:
    """Return the raw .zip bytes for one of the bundled examples.

    Validation:
      * ``name`` is restricted by ``_SAFE_NAME_RE`` (no path separators).
      * Resolved path must stay inside ``_EXAMPLES_DIR`` (defence in
        depth against symlink shenanigans).
    """
    if not _SAFE_NAME_RE.match(name):
        raise HTTPException(status_code=400, detail="Invalid example name.")
    target = _EXAMPLES_DIR / f"{name}.zip"
    try:
        resolved = target.resolve(strict=True)
    except (OSError, RuntimeError):
        raise HTTPException(status_code=404, detail="No such example.") from None
    # Guard against the resolved path escaping the examples dir.
    if _EXAMPLES_DIR.resolve() not in resolved.parents:
        raise HTTPException(status_code=404, detail="No such example.")
    try:
        data = resolved.read_bytes()
    except OSError:
        raise HTTPException(status_code=404, detail="No such example.") from None
    return Response(
        content=data,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{name}.zip"',
            "Cache-Control": "public, max-age=3600",
        },
    )
