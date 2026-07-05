"""Unit tests for the stochastic-handler seeding added in the
seed-coverage wave (QuBound LSTM training, Qshot pilot measurements).

Deliberately torch-free: the unit lane runs on machines without torch,
so instead of executing the heavy handlers we test the seam they share
— ``_seed_stochastic_libs`` — plus a source-level wiring check that
both handlers actually consume it (cheap insurance against a refactor
silently dropping the call; the end-to-end behaviour is exercised by
the live-Space regression scripts).

Covered:

  * ``_seed_stochastic_libs(None)`` is a no-op (returns []).
  * random + numpy are seeded reproducibly; different seeds diverge.
  * torch absence does not crash (guarded lazy import).
  * 31-bit max seed is accepted (numpy's 2**32 ceiling respected).
  * wiring: _handle_qubound threads seed= into qlib and marks the
    result nondeterministic; _handle_qshot threads pilot_seed=.
"""

from __future__ import annotations

import inspect
import random
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services import workflow_service as ws  # noqa: E402

try:
    import numpy as np
except Exception:  # pragma: no cover
    np = None

try:
    import torch  # noqa: F401
    HAVE_TORCH = True
except Exception:
    HAVE_TORCH = False


class SeedStochasticLibsTests(unittest.TestCase):
    def test_none_seed_is_noop(self) -> None:
        self.assertEqual(ws._seed_stochastic_libs(None), [])

    def test_random_is_seeded_reproducibly(self) -> None:
        libs = ws._seed_stochastic_libs(12345)
        self.assertIn("random", libs)
        seq1 = [random.random() for _ in range(5)]
        ws._seed_stochastic_libs(12345)
        seq2 = [random.random() for _ in range(5)]
        self.assertEqual(seq1, seq2)

    def test_different_seeds_diverge(self) -> None:
        ws._seed_stochastic_libs(1)
        seq1 = [random.random() for _ in range(5)]
        ws._seed_stochastic_libs(2)
        seq2 = [random.random() for _ in range(5)]
        self.assertNotEqual(seq1, seq2)

    @unittest.skipIf(np is None, "numpy not installed")
    def test_numpy_is_seeded_reproducibly(self) -> None:
        libs = ws._seed_stochastic_libs(424242)
        self.assertIn("numpy", libs)
        a = np.random.rand(4).tolist()
        ws._seed_stochastic_libs(424242)
        b = np.random.rand(4).tolist()
        self.assertEqual(a, b)

    def test_torch_absence_does_not_crash(self) -> None:
        # On the torch-free unit lane this exercises the except branch;
        # with torch installed it asserts the seeding still reports it.
        libs = ws._seed_stochastic_libs(7)
        if HAVE_TORCH:
            self.assertIn("torch", libs)
        else:
            self.assertNotIn("torch", libs)
        self.assertIn("random", libs)

    def test_31bit_max_seed_accepted(self) -> None:
        # Executor-derived node seeds are 31-bit; numpy caps at 2**32.
        libs = ws._seed_stochastic_libs(2**31 - 1)
        self.assertIn("random", libs)
        if np is not None:
            self.assertIn("numpy", libs)


class HandlerWiringTests(unittest.TestCase):
    """Source-level wiring assertions. The handlers themselves need
    torch / hdbscan to execute, which the unit lane doesn't have, so we
    pin the contract textually: the seeding helper is called and the
    node seed is threaded into qlib. Brittle by design — if a refactor
    renames these seams, this test SHOULD fail and force a re-audit."""

    def test_qubound_seeds_and_threads(self) -> None:
        src = inspect.getsource(ws._handle_qubound)
        self.assertIn("_seed_stochastic_libs(node_seed)", src)
        self.assertIn("seed=node_seed", src)          # into qlib.qbound
        self.assertIn('"nondeterministic": True', src)
        self.assertIn("seed_used=node_seed", src)

    def test_qshot_seeds_and_threads(self) -> None:
        src = inspect.getsource(ws._handle_qshot)
        self.assertIn("_seed_stochastic_libs(node_seed)", src)
        self.assertIn("pilot_seed=node_seed", src)    # into qshot.predict
        self.assertIn("seed_used=node_seed", src)


if __name__ == "__main__":
    unittest.main(verbosity=2)
