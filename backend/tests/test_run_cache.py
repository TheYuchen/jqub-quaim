"""Unit tests for the precomputed-run disk cache's schema gate.

Runnable directly (``python tests/test_run_cache.py`` from backend/)
like the rest of the unit lane — no pytest required, no torch.

Why the gate exists: the provenance rework taught the UI to expect
per-step ``transformation`` / ``distribution`` / ``seed_used``
payloads. A cache file written BEFORE that rework still validates as a
RunResponse (the new fields all default to None), so without an
explicit schema stamp a stale entry is served silently and the first
run a visitor sees renders with no ribbons, no glyphs and no CIs.
``load_cached_response`` must therefore treat any entry without the
current ``cache_schema`` stamp as a miss, and ``save_cached_response``
must stamp (and seed-scrub) everything it writes.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.schemas import RunResponse, StepResult  # noqa: E402
from app.services import run_cache  # noqa: E402


def _step(**overrides) -> StepResult:
    base = dict(
        node_id="n1",
        node_type="input_circuit",
        label="Input circuit",
        status="ok",
        started_at=1.0,
        finished_at=2.0,
        summary={"num_qubits": 2},
    )
    base.update(overrides)
    return StepResult(**base)


def _current_response() -> RunResponse:
    """A post-rework RunResponse: steps carry a transformation payload
    and the envelope carries a (to-be-scrubbed) seed."""
    return RunResponse(
        circuit_id="producer-uuid",
        ok=True,
        steps=[
            _step(
                transformation={
                    "before": {"num_qubits": 2, "depth": 2},
                    "after": {"num_qubits": 2, "depth": 2},
                    "ops_before": {"h": 1, "cx": 1},
                    "ops_after": {"h": 1, "cx": 1},
                }
            )
        ],
        final_metrics={},
        run_id="abc123",
        seed_mode="fresh",
        root_seed=424242,
        app_version="test",
    )


class SchemaGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._orig_dir = run_cache.CACHE_DIR
        run_cache.CACHE_DIR = Path(self._tmp.name)
        run_cache._stale_keys_logged.clear()

    def tearDown(self) -> None:
        run_cache.CACHE_DIR = self._orig_dir
        self._tmp.cleanup()

    def _write_raw(self, key: str, payload: dict) -> None:
        (run_cache.CACHE_DIR / f"{key}.json").write_text(
            json.dumps(payload), encoding="utf-8"
        )

    def test_legacy_entry_without_stamp_is_a_miss(self) -> None:
        """Pre-rework shape: no cache_schema, steps without
        transformation/seed/distribution. Must NOT be served."""
        legacy = {
            "circuit_id": "old",
            "ok": True,
            "from_cache": False,
            "steps": [
                {
                    "node_id": "n1",
                    "node_type": "input_circuit",
                    "label": "Input circuit",
                    "status": "ok",
                    "started_at": 1.0,
                    "finished_at": 2.0,
                    "summary": {"num_qubits": 2},
                    "message": None,
                }
            ],
            "final_metrics": {},
        }
        self._write_raw("deadbeef00000000", legacy)
        got = run_cache.load_cached_response(
            "deadbeef00000000", circuit_id="fresh-uuid"
        )
        self.assertIsNone(got)

    def test_wrong_stamp_is_a_miss(self) -> None:
        raw = json.loads(_current_response().model_dump_json())
        raw["cache_schema"] = run_cache.CACHE_SCHEMA - 1
        self._write_raw("deadbeef00000001", raw)
        self.assertIsNone(
            run_cache.load_cached_response(
                "deadbeef00000001", circuit_id="fresh-uuid"
            )
        )

    def test_current_entry_roundtrips_and_is_served(self) -> None:
        key = "feedface00000000"
        run_cache.save_cached_response(key, _current_response())
        got = run_cache.load_cached_response(key, circuit_id="fresh-uuid")
        self.assertIsNotNone(got)
        assert got is not None  # narrow for type-checkers
        self.assertTrue(got.from_cache)
        self.assertEqual(got.circuit_id, "fresh-uuid")
        # The rendering-critical payload survived the roundtrip.
        self.assertIsNotNone(got.steps[0].transformation)

    def test_save_stamps_schema_and_scrubs_seed_envelope(self) -> None:
        key = "feedface00000001"
        path = run_cache.save_cached_response(key, _current_response())
        raw = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(raw["cache_schema"], run_cache.CACHE_SCHEMA)
        # Seed-free by design: the producing run's envelope is scrubbed
        # (the serving route re-stamps run_id/app_version and
        # advertises root_seed=None anyway).
        self.assertIsNone(raw["run_id"])
        self.assertIsNone(raw["seed_mode"])
        self.assertIsNone(raw["root_seed"])

    def test_corrupt_json_is_a_miss(self) -> None:
        (run_cache.CACHE_DIR / "badbadbadbadbad0.json").write_text(
            "{not json", encoding="utf-8"
        )
        self.assertIsNone(
            run_cache.load_cached_response(
                "badbadbadbadbad0", circuit_id="x"
            )
        )

    def test_stale_key_logged_once(self) -> None:
        legacy = {"circuit_id": "old", "ok": True, "steps": [], "final_metrics": {}}
        self._write_raw("deadbeef00000002", legacy)
        with self.assertLogs("app.services.run_cache", level="WARNING") as cm:
            run_cache.load_cached_response("deadbeef00000002", circuit_id="x")
            run_cache.load_cached_response("deadbeef00000002", circuit_id="x")
        self.assertEqual(len(cm.output), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
