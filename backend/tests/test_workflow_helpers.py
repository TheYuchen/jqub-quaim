"""Unit tests for the cheap, side-effect-free helpers in
``app/services/workflow_service.py``.

We don't yet have a full pytest harness; this file is also runnable as
``python -m backend.tests.test_workflow_helpers`` for quick local sanity
checks without installing pytest. The deeper, qiskit-dependent tests
(handler dispatch, cache + circuit interaction) live in the live HF
Space integration probes — running them in CI would require pulling
torch + qiskit-aer + hdbscan, which is too heavy for a unit lane.

Covered here:

  * ``_format_exception_for_user`` — class + sanitised first-line shape,
    path scrubbing, length cap, multi-line handling, empty message.
  * ``invalidate_step_cache_for_node_type`` + the ``_step_cache_node_types``
    sidecar — surgical eviction by kind, no-op for unknown kinds, LRU
    pressure keeps sidecar in sync with the main cache.
  * ``topological_order`` — happy path, cycle detection.

The sampled-fidelity nondeterminism propagation and the CompressVQC
scale-guard live behind heavy imports; they're exercised by the live
test scripts under scripts/ instead.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

# Allow running the file directly (python tests/test_workflow_helpers.py)
# from inside backend/ as well as via pytest from the repo root.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.schemas import FlowEdge, FlowNode, StepResult  # noqa: E402
from app.services import workflow_service as ws  # noqa: E402


class FormatExceptionForUserTests(unittest.TestCase):
    """`_format_exception_for_user` is the seam between server-side
    stack traces and what the user sees in a StepResult.message. It
    must:
      * always include the class name,
      * keep only the first line of str(exc),
      * scrub absolute /paths/ that look like server filesystem,
      * truncate long messages with an ellipsis."""

    def test_simple_value_error(self) -> None:
        got = ws._format_exception_for_user(ValueError("bad input"))
        self.assertEqual(got, "ValueError: bad input")

    def test_path_sanitisation(self) -> None:
        exc = FileNotFoundError("[Errno 2] No such file: /app/cache/foo.pkl")
        got = ws._format_exception_for_user(exc)
        self.assertIn("<path>", got)
        self.assertNotIn("/app/cache/foo.pkl", got)

    def test_only_first_line(self) -> None:
        got = ws._format_exception_for_user(RuntimeError("first\nsecond\nthird"))
        self.assertEqual(got, "RuntimeError: first")

    def test_empty_message(self) -> None:
        got = ws._format_exception_for_user(RuntimeError())
        self.assertEqual(got, "RuntimeError")

    def test_long_message_truncated(self) -> None:
        long = "x" * 300
        got = ws._format_exception_for_user(RuntimeError(long))
        # Ellipsis appended; not all 300 x's shown.
        self.assertTrue(got.endswith("…"), got)
        self.assertLess(len(got), 300, got)


class StepCacheInvalidationTests(unittest.TestCase):
    """Sidecar map + plugin-reinstall eviction."""

    def setUp(self) -> None:
        ws._step_cache.clear()
        ws._step_cache_node_types.clear()
        # Restore the production LRU cap after any earlier test fiddled.
        ws._STEP_CACHE_MAX = 200

    def _step(self, node_id: str, node_type: str) -> StepResult:
        return StepResult(
            node_id=node_id, node_type=node_type, label="x",
            status="ok", started_at=0.0, finished_at=0.0, summary={},
        )

    def test_evicts_only_entries_covering_kind(self) -> None:
        ws._cache_put("h1", self._step("a", "input_circuit"), {},
                      {"input_circuit"})
        ws._cache_put("h2", self._step("b", "fake_backend"), {},
                      {"input_circuit", "fake_backend"})
        ws._cache_put("h3", self._step("c", "my_plugin"), {},
                      {"input_circuit", "fake_backend", "my_plugin"})
        ws._cache_put("h4", self._step("d", "fidelity"), {},
                      {"input_circuit", "fidelity"})

        evicted = ws.invalidate_step_cache_for_node_type("my_plugin")
        self.assertEqual(evicted, 1)
        self.assertNotIn("h3", ws._step_cache)
        self.assertIn("h1", ws._step_cache)
        self.assertIn("h2", ws._step_cache)
        self.assertIn("h4", ws._step_cache)
        # Sidecar map also pruned.
        self.assertNotIn("h3", ws._step_cache_node_types)

    def test_no_match_returns_zero(self) -> None:
        ws._cache_put("h1", self._step("a", "input_circuit"), {},
                      {"input_circuit"})
        evicted = ws.invalidate_step_cache_for_node_type("does_not_exist")
        self.assertEqual(evicted, 0)
        self.assertIn("h1", ws._step_cache)

    def test_lru_eviction_keeps_sidecar_in_sync(self) -> None:
        ws._STEP_CACHE_MAX = 3
        for i in range(6):
            ws._cache_put(f"k{i}", self._step(f"n{i}", "foo"), {}, {"foo"})
        self.assertEqual(len(ws._step_cache), 3)
        # Every surviving cache key must be present in the sidecar too.
        for k in ws._step_cache:
            self.assertIn(k, ws._step_cache_node_types,
                          f"sidecar dropped {k}")
        # Evicted keys must NOT linger in the sidecar.
        self.assertLessEqual(len(ws._step_cache_node_types),
                             len(ws._step_cache))


class TopologicalOrderTests(unittest.TestCase):

    def _node(self, nid: str) -> FlowNode:
        return FlowNode(id=nid, type="input_circuit", data={})

    def _edge(self, src: str, tgt: str) -> FlowEdge:
        return FlowEdge(id=f"{src}-{tgt}", source=src, target=tgt)

    def test_linear_chain(self) -> None:
        nodes = [self._node("a"), self._node("b"), self._node("c")]
        edges = [self._edge("a", "b"), self._edge("b", "c")]
        order = [n.id for n in ws.topological_order(nodes, edges)]
        self.assertEqual(order, ["a", "b", "c"])

    def test_cycle_raises(self) -> None:
        nodes = [self._node("a"), self._node("b")]
        edges = [self._edge("a", "b"), self._edge("b", "a")]
        with self.assertRaises(ValueError):
            ws.topological_order(nodes, edges)

    def test_empty_inputs(self) -> None:
        self.assertEqual(ws.topological_order([], []), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
