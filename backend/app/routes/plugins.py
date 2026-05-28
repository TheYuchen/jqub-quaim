"""/api/plugins — per-user plugin block upload / list / delete.

All endpoints are scoped to a ``user_id`` query parameter — an
anonymous UUID the browser generates on first visit and stores in
localStorage. Plugins uploaded by one user are visible only to that
user. No global registry, no admin approval.

Storage is process-local under ``/tmp/quda_plugins/<user_id>/`` so
plugins die when the HF Space container restarts. Users can re-upload
their .zip if they want them back.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.services import plugin_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/plugins")
def list_plugins(user_id: str = Query(...)) -> list[dict]:
    """List all plugins this browser has uploaded. Frontend merges
    these into the NodeCatalog so they appear in the BlockPicker."""
    try:
        plugin_service.validate_user_id(user_id)
    except plugin_service.PluginError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    manifests = plugin_service.list_user_plugins(user_id)
    return [plugin_service.manifest_to_frontend(m) for m in manifests]


@router.post("/plugins/upload")
async def upload_plugin(
    user_id: str = Query(...),
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
    try:
        plugin_service.validate_user_id(user_id)
    except plugin_service.PluginError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None

    # Read the upload — FastAPI streams it but we want it in memory
    # so we can size-check before doing anything else. The size cap
    # in plugin_service will reject if it's >1 MB.
    blob = await file.read()
    try:
        manifest = plugin_service.install_plugin_zip(user_id, blob)
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
def delete_plugin(kind: str, user_id: str = Query(...)) -> dict:
    """Remove a plugin from this user's namespace."""
    try:
        plugin_service.validate_user_id(user_id)
    except plugin_service.PluginError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    removed = plugin_service.delete_plugin(user_id, kind)
    if not removed:
        raise HTTPException(status_code=404, detail=f"No plugin with kind={kind!r}.")
    return {"removed": True, "kind": kind}
