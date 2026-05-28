"""Persist authenticated users' plugins to an HF Dataset repo.

Design summary

The HF Space's /tmp is wiped on container restart. Logged-in users
expect their uploaded plugins to outlive that — they identified
themselves via OAuth and the whole point of an account is persistence
across sessions/devices/restarts. We use a private HF Dataset repo as
the backing store:

  qudastudio/quda-user-data/
    users/
      hf_<username>/
        <kind>.zip                 ← the original uploaded plugin zip
        ...

Only the HF Space (with HF_TOKEN as a Space secret) has write access.
Other HF users CANNOT browse this dataset because it's private. The
dataset is therefore a shared trust boundary between us (the JQub lab,
who operate the Space) and our users — same trust model as any SaaS.

Anonymous (anon_*) users do NOT sync to the dataset. Their plugins
remain volatile, which matches what they implicitly consented to by
not logging in. The mirroring functions silently no-op for anon users.

Failure model

  * Sync errors are LOGGED, not RAISED. The user's plugin is already
    on disk and working; whether it's been mirrored is a secondary
    concern they can recover from by re-uploading after a restart.
  * Hydration uses a per-process lock to avoid two concurrent requests
    each downloading the same files.

Threats

  * The dataset token has org-wide write scope (current limitation).
    A future improvement is a fine-grained token with access only to
    this one repo. Subprocess env stripping already prevents plugins
    from reading HF_TOKEN.
  * Filename inside the repo is `<kind>.zip` where ``kind`` matches
    ``[a-z][a-z0-9_]{1,30}``, and the user_id is ``hf_<username>``
    where username matches HF's own regex. No path traversal surface.
"""

from __future__ import annotations

import io
import logging
import threading
import time
import zipfile
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)


# Per-process hydration lock map. Keyed on user_id; each user's
# hydration runs at most once concurrently across request handlers.
# (FastAPI within a single uvicorn worker is single-process, multi
# threaded for sync handlers and singletask for async — this lock
# serialises any of them.)
_hydration_locks: dict[str, threading.Lock] = {}
_hydration_locks_guard = threading.Lock()

# Per-user "we recently checked the dataset for this user" timestamp.
# Without it, every /api/plugins request from a logged-in user makes a
# list_repo_files round trip to HF — sub-second but completely wasted
# work after the first hit. 30 s is short enough that "I just deleted
# a plugin from another device" lands within human-noticeable time.
_HYDRATE_FRESHNESS_SECONDS = 30.0
_last_hydrate_at: dict[str, float] = {}


def _is_authenticated_user(user_id: str) -> bool:
    """Anon users (anon_*) get no persistence. Logged-in users
    (hf_*) get the full dataset sync."""
    return user_id.startswith("hf_")


def _hf_api():
    """Build an HfApi client with our write token. Returns None if
    persistence is disabled (no token configured)."""
    settings = get_settings()
    if not settings.persistence_enabled:
        return None
    # Late import — huggingface_hub is a heavyweight dep; we want it
    # only when actually used. (~150 ms saved at import time during
    # tests that don't touch persistence.)
    from huggingface_hub import HfApi

    return HfApi(token=settings.hf_token)


def _repo_id() -> str:
    return get_settings().user_data_repo


def _path_in_repo(user_id: str, kind: str) -> str:
    """Layout: users/<user_id>/<kind>.zip"""
    return f"users/{user_id}/{kind}.zip"


def _user_prefix(user_id: str) -> str:
    return f"users/{user_id}/"


# ---- Public API ---------------------------------------------------------

def push_plugin(user_id: str, kind: str, zip_bytes: bytes) -> bool:
    """Upload one user's plugin .zip to the dataset repo. Returns True
    on success, False if persistence is off / user is anon / upload
    failed. Never raises — install path stays alive even if the
    backing store is down."""
    if not _is_authenticated_user(user_id):
        return False
    api = _hf_api()
    if api is None:
        return False
    try:
        api.upload_file(
            path_or_fileobj=zip_bytes,
            path_in_repo=_path_in_repo(user_id, kind),
            repo_id=_repo_id(),
            repo_type="dataset",
            commit_message=f"upload {user_id}/{kind}",
        )
        logger.info("Mirrored plugin %s/%s to dataset", user_id, kind)
        return True
    except Exception:
        logger.exception(
            "Failed to mirror plugin %s/%s to dataset (continuing)", user_id, kind
        )
        return False


def remove_plugin(user_id: str, kind: str) -> bool:
    """Remove one plugin from the dataset repo. Returns True on
    success, False on no-op or failure. Never raises."""
    if not _is_authenticated_user(user_id):
        return False
    api = _hf_api()
    if api is None:
        return False
    try:
        api.delete_file(
            path_in_repo=_path_in_repo(user_id, kind),
            repo_id=_repo_id(),
            repo_type="dataset",
            commit_message=f"delete {user_id}/{kind}",
        )
        logger.info("Removed plugin %s/%s from dataset", user_id, kind)
        return True
    except Exception:
        logger.exception(
            "Failed to remove %s/%s from dataset (continuing)", user_id, kind
        )
        return False


def list_remote_kinds(user_id: str) -> list[str]:
    """Return the kinds this user has plugins for in the dataset. Empty
    list on any failure."""
    if not _is_authenticated_user(user_id):
        return []
    api = _hf_api()
    if api is None:
        return []
    try:
        files = api.list_repo_files(
            repo_id=_repo_id(), repo_type="dataset"
        )
    except Exception:
        logger.exception(
            "Failed to list dataset files for %s (continuing with empty list)",
            user_id,
        )
        return []
    prefix = _user_prefix(user_id)
    kinds = []
    for path in files:
        if not path.startswith(prefix) or not path.endswith(".zip"):
            continue
        kind = path[len(prefix) : -len(".zip")]
        # Sanity: kind matches our regex, no nested path
        if "/" in kind or not kind:
            continue
        kinds.append(kind)
    return kinds


def hydrate_into_tmp(
    user_id: str, target_root: Path, install_plugin_zip_fn
) -> int:
    """Idempotent: for every plugin this user has in the dataset that
    isn't already on disk under target_root, download it and re-install
    via install_plugin_zip_fn (so it goes through the same validation
    + extraction path as a fresh user upload).

    target_root is the parent dir under which plugin_dir(user_id, kind)
    sits (i.e. /tmp/quda_plugins/<user_id>/).

    Returns the number of plugins newly hydrated. Anon users always
    return 0.
    """
    if not _is_authenticated_user(user_id):
        return 0
    api = _hf_api()
    if api is None:
        return 0

    # Per-user lock so concurrent /api/plugins requests don't both try
    # to hydrate the same user's data.
    with _hydration_locks_guard:
        lock = _hydration_locks.setdefault(user_id, threading.Lock())
    with lock:
        # Short freshness cache so a logged-in user listing/uploading/
        # deleting in quick succession doesn't hit the HF API on every
        # call. The cache is per-process and short enough that
        # cross-device deletes still land within ~30 s.
        now = time.monotonic()
        if now - _last_hydrate_at.get(user_id, 0.0) < _HYDRATE_FRESHNESS_SECONDS:
            return 0
        try:
            remote_kinds = list_remote_kinds(user_id)
        except Exception:
            logger.exception("Hydration list failed for %s", user_id)
            return 0
        # Mark as fresh BEFORE the per-file work — if a download
        # partially fails we still don't want to re-list immediately;
        # the user can retry the request.
        _last_hydrate_at[user_id] = now

        new_count = 0
        for kind in remote_kinds:
            local_dir = target_root / kind
            if local_dir.exists():
                continue
            try:
                local_path = api.hf_hub_download(
                    repo_id=_repo_id(),
                    repo_type="dataset",
                    filename=_path_in_repo(user_id, kind),
                )
            except Exception:
                logger.exception(
                    "Could not download %s/%s from dataset", user_id, kind
                )
                continue
            try:
                zip_bytes = Path(local_path).read_bytes()
            except OSError:
                logger.exception("Could not read downloaded %s/%s", user_id, kind)
                continue
            try:
                install_plugin_zip_fn(user_id, zip_bytes, _skip_dataset_sync=True)
                new_count += 1
            except Exception:
                logger.exception(
                    "Re-install failed for hydrated %s/%s — skipping",
                    user_id,
                    kind,
                )
        if new_count:
            logger.info("Hydrated %d plugin(s) for %s from dataset", new_count, user_id)
        return new_count


def is_zip_intact(zip_bytes: bytes) -> bool:
    """Lightweight sanity for hydration — if the downloaded blob fails
    to parse as a zip we skip it rather than 500."""
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            return zf.testzip() is None
    except zipfile.BadZipFile:
        return False
