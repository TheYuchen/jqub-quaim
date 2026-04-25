"""Qshot — Noise-aware shot-count recommender.

Packaged version of the JQub lab's Qshot reference code (author: Tong
Li). Wraps `QshotRecommender` with a lazy-loaded singleton and a stable
registry of bundled noise snapshots so the backend's workflow service
can request a recommendation without worrying about paths or
construction cost.

Integration notes
-----------------

* Dataset dirs and the GNN checkpoint live under `backend/cache/qshot/`.
  `_default_dataset_dirs()` / `_default_gnn_ckpt()` resolve those paths
  relative to this file so the package is relocatable.

* `get_recommender()` returns a process-wide singleton. Construction is
  expensive (~30–40s to load ~3k records, build HDBSCAN clusters, and
  register the GNN checkpoint), so the first request after process
  start pays that cost; all subsequent `.predict()` calls reuse the
  same object.

* `NOISE_SNAPSHOTS` is the source-of-truth list of bundled calibration
  snapshots. The frontend's Qshot node uses the same keys for its
  `noise_snapshot` parameter dropdown. Add a new snapshot here when you
  add a JSON under `backend/cache/qshot/data/noise_json/`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Optional

from .recommend_shots_v4 import QshotRecommender  # re-export

__all__ = [
    "QshotRecommender",
    "NOISE_SNAPSHOTS",
    "NoiseSnapshot",
    "get_recommender",
    "resolve_noise_snapshot",
]

logger = logging.getLogger(__name__)

# Anchor for data/checkpoint lookup: repo root + backend/cache/qshot/.
# This package sits at backend/qlib/qshot/, so the cache is two levels up.
_QLIB_DIR = Path(__file__).resolve().parent.parent
_BACKEND_DIR = _QLIB_DIR.parent                           # backend/
_QSHOT_CACHE_DIR = _BACKEND_DIR / "cache" / "qshot"
_QSHOT_DATA_DIR = _QSHOT_CACHE_DIR / "data"
_QSHOT_CHECKPOINT = _QSHOT_CACHE_DIR / "checkpoint" / "best_model.pt"

# Dataset directory names — hard-coded to match what
# `recommend_shots_v4._DATASET_DIR_NAMES` expects. If you add a new
# dataset version, register it in both places.
_DATASET_DIR_NAMES = (
    "shots_dataset_historic_250113",
    "shots_dataset_historic_250506",
    "shots_dataset_historic_260116",
    "shots_dataset_historic2_250611",
    "shots_dataset_historic2_250724",
    "shots_dataset_historic2_251126",
    "shots_dataset_historic_qaoa_250113",
    "shots_dataset_historic_qaoa_250506",
    "shots_dataset_historic_qaoa_260116",
    "shots_dataset_historic2_qaoa_250611",
    "shots_dataset_historic2_qaoa_250724",
    "shots_dataset_historic2_qaoa_251126",
)


@dataclass(frozen=True)
class NoiseSnapshot:
    """Metadata for one bundled IBM calibration snapshot."""

    key: str          # stable short key used as node-data / API value
    backend: str      # "ibm_marrakesh" | "ibm_pittsburgh"
    date: str         # "2025-06-11"
    label: str        # human-readable, shown in the UI dropdown
    filename: str     # basename under data/noise_json/


# Ordered registry — default (pittsburgh_1) is first. The frontend
# dropdown should render them in this order.
NOISE_SNAPSHOTS: tuple[NoiseSnapshot, ...] = (
    NoiseSnapshot(
        key="pittsburgh_1",
        backend="ibm_pittsburgh",
        date="2025-06-11",
        label="IBM Pittsburgh · 2025-06-11",
        filename="ibm_pittsburgh_representative_1_2025-06-11T00_00_00_00_00.json",
    ),
    NoiseSnapshot(
        key="pittsburgh_3",
        backend="ibm_pittsburgh",
        date="2025-11-26",
        label="IBM Pittsburgh · 2025-11-26",
        filename="ibm_pittsburgh_representative_3_2025-11-26T00_00_00_00_00.json",
    ),
    NoiseSnapshot(
        key="pittsburgh_5",
        backend="ibm_pittsburgh",
        date="2025-07-24",
        label="IBM Pittsburgh · 2025-07-24",
        filename="ibm_pittsburgh_representative_5_2025-07-24T00_00_00_00_00.json",
    ),
    NoiseSnapshot(
        key="marrakesh_1",
        backend="ibm_marrakesh",
        date="2025-05-06",
        label="IBM Marrakesh · 2025-05-06",
        filename="ibm_marrakesh_representative_1_2025-05-06T00_00_00_00_00.json",
    ),
    NoiseSnapshot(
        key="marrakesh_2",
        backend="ibm_marrakesh",
        date="2026-01-16",
        label="IBM Marrakesh · 2026-01-16",
        filename="ibm_marrakesh_representative_2_2026-01-16T00_00_00_00_00.json",
    ),
    NoiseSnapshot(
        key="marrakesh_5",
        backend="ibm_marrakesh",
        date="2025-01-13",
        label="IBM Marrakesh · 2025-01-13",
        filename="ibm_marrakesh_representative_5_2025-01-13T00_00_00_00_00.json",
    ),
)

DEFAULT_SNAPSHOT_KEY = "pittsburgh_1"

_SNAPSHOTS_BY_KEY: dict[str, NoiseSnapshot] = {s.key: s for s in NOISE_SNAPSHOTS}


def resolve_noise_snapshot(key: Optional[str]) -> Path:
    """Look up a bundled noise snapshot by its short key and return the
    absolute path to its JSON file. Falls back to DEFAULT_SNAPSHOT_KEY
    on a missing / unknown key so the pipeline still runs instead of
    raising mid-request.
    """
    if not key or key not in _SNAPSHOTS_BY_KEY:
        logger.warning(
            "Qshot: unknown noise snapshot key %r; falling back to %r",
            key, DEFAULT_SNAPSHOT_KEY,
        )
        key = DEFAULT_SNAPSHOT_KEY
    return _QSHOT_DATA_DIR / "noise_json" / _SNAPSHOTS_BY_KEY[key].filename


def _default_dataset_dirs() -> list[Path]:
    """Absolute paths to the 12 bundled shots_dataset_historic* dirs."""
    return [_QSHOT_DATA_DIR / name for name in _DATASET_DIR_NAMES]


def _default_gnn_ckpt() -> Optional[Path]:
    return _QSHOT_CHECKPOINT if _QSHOT_CHECKPOINT.is_file() else None


# ---- process-wide lazy singleton -----------------------------------

_recommender: Optional[QshotRecommender] = None
_recommender_lock = Lock()


def get_recommender() -> QshotRecommender:
    """Return a lazily-constructed `QshotRecommender` singleton.

    Thread-safe: the lock guarantees exactly one construction even if
    two requests race. Construction is expensive (~30–40s), so only the
    first caller pays for it; everyone else gets the cached instance.
    """
    global _recommender
    if _recommender is None:
        with _recommender_lock:
            if _recommender is None:
                logger.info("Qshot: initialising recommender singleton "
                            "(expect ~30-40s first-time cost)")
                _recommender = QshotRecommender(
                    dataset_dirs=_default_dataset_dirs(),
                    gnn_ckpt=_default_gnn_ckpt(),
                    verbose=False,
                )
                logger.info("Qshot: recommender ready")
    return _recommender
