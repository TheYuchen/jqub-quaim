"""Unit tests for the Phase-0 provenance core: per-node seed
derivation, the Wilson interval helper, seed-salted cache namespaces,
schema backward-compatibility, and (when qiskit-aer is importable)
pinned-seed reproducibility of the sampled fidelity estimator.

Runnable directly (``python3 tests/test_provenance_phase0.py`` from
``backend/``) or via pytest.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.schemas import FlowNode, StepResult  # noqa: E402
from app.services import workflow_service as ws  # noqa: E402
from app.services.stats import wilson_interval  # noqa: E402

try:  # heavy optional dep — integration tests skip without it
    import qiskit_aer  # noqa: F401
    HAVE_AER = True
except Exception:
    HAVE_AER = False


class DeriveNodeSeedTests(unittest.TestCase):
    """derive_node_seed must be stable, 31-bit, and sensitive to both
    the root seed and the node id — but to nothing else."""

    def test_stable(self) -> None:
        self.assertEqual(
            ws.derive_node_seed(12345, "n3"),
            ws.derive_node_seed(12345, "n3"),
        )

    def test_range_31bit(self) -> None:
        for root in (0, 1, 2**31 - 1):
            for nid in ("n1", "fidelity-2", ""):
                s = ws.derive_node_seed(root, nid)
                self.assertGreaterEqual(s, 0)
                self.assertLess(s, 2**31)

    def test_sensitive_to_node_id(self) -> None:
        self.assertNotEqual(
            ws.derive_node_seed(7, "n1"), ws.derive_node_seed(7, "n2"),
        )

    def test_sensitive_to_root_seed(self) -> None:
        self.assertNotEqual(
            ws.derive_node_seed(7, "n1"), ws.derive_node_seed(8, "n1"),
        )

    def test_no_separator_collision(self) -> None:
        # "1:23" vs "12:3" style collisions must not happen because the
        # root seed is an int and the separator is fixed.
        self.assertNotEqual(
            ws.derive_node_seed(1, "23"), ws.derive_node_seed(12, "3"),
        )


class WilsonIntervalTests(unittest.TestCase):
    def test_degenerate_n_zero(self) -> None:
        self.assertEqual(wilson_interval(0, 0), (0.0, 1.0))

    def test_all_failures_lower_edge(self) -> None:
        lo, hi = wilson_interval(0, 100)
        self.assertLess(lo, 1e-12)  # 0 up to float residue
        self.assertLess(hi, 0.05)

    def test_all_successes_upper_edge(self) -> None:
        lo, hi = wilson_interval(100, 100)
        self.assertGreater(lo, 0.95)
        self.assertAlmostEqual(hi, 1.0, places=6)

    def test_midpoint_symmetric(self) -> None:
        lo, hi = wilson_interval(500, 1000)
        self.assertAlmostEqual((lo + hi) / 2, 0.5, places=6)
        self.assertAlmostEqual(hi - lo, 0.0619, places=3)

    def test_monotone_in_successes(self) -> None:
        prev_lo = -1.0
        for k in (0, 10, 50, 90, 100):
            lo, _ = wilson_interval(k, 100)
            self.assertGreaterEqual(lo, prev_lo)
            prev_lo = lo

    def test_clamps_out_of_range_successes(self) -> None:
        self.assertEqual(wilson_interval(200, 100), wilson_interval(100, 100))
        self.assertEqual(wilson_interval(-5, 100), wilson_interval(0, 100))


class SeedSaltedPrefixTests(unittest.TestCase):
    """Seed-pinned runs must live in their own cache namespace; fresh
    runs must keep the legacy (unsalted) one so precomputed entries
    stay reachable."""

    NODES = [FlowNode(id="n1", type="fake_backend", data={"name": "FakeFez"})]

    def test_salt_changes_hash(self) -> None:
        base = ws._prefix_hash(b"qpy", self.NODES)
        salted = ws._prefix_hash(b"qpy", self.NODES, salt="seed:42")
        self.assertNotEqual(base, salted)

    def test_empty_salt_is_legacy(self) -> None:
        self.assertEqual(
            ws._prefix_hash(b"qpy", self.NODES),
            ws._prefix_hash(b"qpy", self.NODES, salt=""),
        )

    def test_distinct_seeds_distinct_namespaces(self) -> None:
        self.assertNotEqual(
            ws._prefix_hash(b"qpy", self.NODES, salt="seed:1"),
            ws._prefix_hash(b"qpy", self.NODES, salt="seed:2"),
        )


class SchemaBackwardCompatTests(unittest.TestCase):
    """Old cached JSON responses (precomputed_runs/*.json) predate the
    provenance fields; pydantic must default them, not reject them."""

    LEGACY = {
        "node_id": "n1", "node_type": "fidelity", "label": "Fidelity",
        "status": "ok", "started_at": 1.0, "finished_at": 2.0,
        "summary": {"fidelity": 0.5},
    }

    def test_legacy_step_parses(self) -> None:
        step = StepResult.model_validate(self.LEGACY)
        self.assertIsNone(step.seed_used)
        self.assertIsNone(step.distribution)
        self.assertFalse(step.nondeterministic)


@unittest.skipUnless(HAVE_AER, "qiskit-aer not installed")
class SampledReproducibilityTests(unittest.TestCase):
    """The scientific core of Phase 0: a pinned seed makes the sampled
    fidelity draw exactly reproducible; a fresh (None) seed leaves it
    stochastic; the handler surfaces the distribution payload."""

    def _bell(self):
        from qiskit import QuantumCircuit
        qc = QuantumCircuit(2)
        qc.h(0)
        qc.cx(0, 1)
        return qc

    def test_same_seed_same_draw(self) -> None:
        from qlib.qiskit_utils import sampledFidelityEstimator
        f1, m1 = sampledFidelityEstimator(self._bell(), None, 256, seed=42)
        f2, m2 = sampledFidelityEstimator(self._bell(), None, 256, seed=42)
        self.assertEqual(f1, f2)
        self.assertEqual(m1["counts_top"], m2["counts_top"])
        self.assertEqual(m1["seed"], 42)

    def test_meta_carries_histogram_material(self) -> None:
        from qlib.qiskit_utils import sampledFidelityEstimator
        _, meta = sampledFidelityEstimator(self._bell(), None, 256, seed=7)
        self.assertIn("counts_top", meta)
        self.assertIn("distinct_outcomes", meta)
        self.assertEqual(
            sum(meta["counts_top"].values()) if meta["distinct_outcomes"] <= 16 else 256,
            256,
        )

    def test_handler_distribution_payload(self) -> None:
        # shots comes from the upstream backend node via ctx (that is
        # where _set_backend_ctx puts it), not from the fidelity node.
        node = FlowNode(id="f1", type="fidelity", data={"method": "sampled"})
        ctx = {"circuit": self._bell(), "node_seed": 42, "shots": 256}
        step = ws._handle_fidelity(node, ctx, None)
        self.assertEqual(step.status, "ok")
        self.assertTrue(step.nondeterministic)
        self.assertEqual(step.seed_used, 42)
        d = step.distribution
        self.assertIsNotNone(d)
        assert d is not None
        self.assertEqual(d["kind"], "binomial")
        self.assertEqual(d["shots"], 256)
        lo, hi = d["ci95"]
        self.assertLessEqual(lo, d["point"])
        self.assertGreaterEqual(hi, d["point"])
        # Bell |00⟩ probability is 0.5 — the CI must straddle it.
        self.assertLess(lo, 0.62)
        self.assertGreater(hi, 0.38)

    def test_handler_statevector_stays_deterministic(self) -> None:
        node = FlowNode(id="f2", type="fidelity", data={})
        ctx = {"circuit": self._bell(), "node_seed": 42}
        step = ws._handle_fidelity(node, ctx, None)
        self.assertEqual(step.status, "ok")
        self.assertFalse(step.nondeterministic)
        self.assertIsNone(step.seed_used)
        self.assertIsNone(step.distribution)


if __name__ == "__main__":
    unittest.main(verbosity=2)
