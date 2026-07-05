"""Unit tests for Wave I — anytime evidence steering.

Covers the replay contract of batched sampled fidelity: batch-seed
derivation, the batch plan, twin Wilson implementations pinned to each
other, batched-accumulation determinism, prefix-stability of early
stops (an early-stopped run's trace is a bit-exact prefix of the full
run's trace under the same seed), the 1/sqrt(n) narrowing of the
interval, the min-2-batches stopping guard, and the executor's
interleaving of step_progress events in streaming mode only.

Runnable directly (``python3 tests/test_anytime_evidence.py`` from
``backend/``) or via pytest. Uses the noiseless Aer fallback (backend
None) throughout, so no Fake* noise-model builds slow the lane down.
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
from qlib.qiskit_utils import (  # noqa: E402
    derive_batch_seed,
    plan_batches,
    wilson_interval_95,
)

try:  # heavy optional dep — sampling tests skip without it
    import qiskit_aer  # noqa: F401
    HAVE_AER = True
except Exception:
    HAVE_AER = False


def _bell():
    from qiskit import QuantumCircuit
    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)
    return qc


class WilsonTwinTests(unittest.TestCase):
    """qlib duplicates the app-layer Wilson helper to avoid a
    qlib -> app import. This pin is what keeps the twins honest."""

    def test_agrees_with_app_layer_on_grid(self) -> None:
        for n in (1, 2, 7, 128, 1024, 4096):
            for k in {0, 1, n // 3, n // 2, n - 1, n}:
                self.assertEqual(
                    wilson_interval_95(k, n), wilson_interval(k, n),
                    msg=f"twins disagree at k={k}, n={n}",
                )

    def test_degenerate_n(self) -> None:
        self.assertEqual(wilson_interval_95(0, 0), (0.0, 1.0))


class BatchSeedTests(unittest.TestCase):
    def test_deterministic(self) -> None:
        self.assertEqual(derive_batch_seed(12345, 3), derive_batch_seed(12345, 3))

    def test_distinct_across_batches_and_seeds(self) -> None:
        seeds = {derive_batch_seed(999, i) for i in range(8)}
        self.assertEqual(len(seeds), 8)
        self.assertNotEqual(derive_batch_seed(1, 0), derive_batch_seed(2, 0))

    def test_31bit_range(self) -> None:
        for s in (0, 7, 2**31 - 1):
            for i in (0, 7):
                v = derive_batch_seed(s, i)
                self.assertGreaterEqual(v, 0)
                self.assertLess(v, 2**31)

    def test_independent_of_batch_count(self) -> None:
        # The seed for batch i must not encode how many batches exist:
        # this is the "replay is exact regardless of where a previous
        # run stopped" property, verified at the derivation level.
        self.assertEqual(derive_batch_seed(42, 0), derive_batch_seed(42, 0))
        # (trivially true given the signature takes no batch count —
        # the assertion documents the contract for future editors)


class PlanBatchesTests(unittest.TestCase):
    def test_sum_and_count(self) -> None:
        for shots in (1, 2, 100, 255, 256, 1000, 1024, 2048, 10_000):
            plan = plan_batches(shots)
            self.assertEqual(sum(plan), shots)
            expected_b = max(1, min(min(8, max(2, shots // 128)), shots))
            self.assertEqual(len(plan), expected_b)
            self.assertTrue(all(b > 0 for b in plan), plan)
            self.assertLessEqual(max(plan) - min(plan), 1)

    def test_formula_landmarks(self) -> None:
        self.assertEqual(plan_batches(2048), [256] * 8)   # cap at 8
        self.assertEqual(plan_batches(100), [50, 50])     # floor at 2
        self.assertEqual(plan_batches(1), [1])            # never a 0-shot batch
        self.assertEqual(plan_batches(0), [])

    def test_deterministic_in_shots_alone(self) -> None:
        self.assertEqual(plan_batches(1337), plan_batches(1337))


@unittest.skipUnless(HAVE_AER, "qiskit-aer not importable")
class BatchedEstimatorTests(unittest.TestCase):
    def _run(self, shots=1024, seed=42, **kw):
        from qlib.qiskit_utils import sampledFidelityEstimator
        return sampledFidelityEstimator(_bell(), None, shots, seed=seed, **kw)

    def test_pinned_seed_bit_exact(self) -> None:
        fid1, meta1 = self._run()
        fid2, meta2 = self._run()
        self.assertEqual(fid1, fid2)
        self.assertEqual(meta1["observed_zero_counts"], meta2["observed_zero_counts"])
        self.assertEqual(meta1["counts_top"], meta2["counts_top"])
        self.assertEqual(meta1["batch_trace"], meta2["batch_trace"])

    def test_accumulation_equals_totals(self) -> None:
        _, meta = self._run(shots=1024, seed=7)
        trace = meta["batch_trace"]
        self.assertEqual(len(trace), meta["n_batches_done"])
        self.assertEqual(trace[-1]["shots_done"], 1024)
        self.assertEqual(meta["shots"], 1024)
        self.assertEqual(trace[-1]["successes"], meta["observed_zero_counts"])
        # counts_top totals must equal the shots executed (2q circuit:
        # at most 4 outcomes, all inside the top-16 cap)
        self.assertEqual(sum(meta["counts_top"].values()), 1024)
        # shots_done strictly increases; ci95 stays a valid interval
        for a, b in zip(trace, trace[1:]):
            self.assertLess(a["shots_done"], b["shots_done"])
        for t in trace:
            self.assertLessEqual(t["ci95"][0], t["point"])
            self.assertGreaterEqual(t["ci95"][1], t["point"])

    def test_progress_cb_receives_every_batch(self) -> None:
        got: list[dict] = []
        _, meta = self._run(shots=1024, seed=7, progress_cb=got.append)
        self.assertEqual(got, meta["batch_trace"])
        self.assertEqual(len(got), meta["n_batches_planned"])
        self.assertEqual([g["batch_i"] for g in got],
                         list(range(1, len(got) + 1)))

    def test_early_stop_trace_is_prefix_of_full_run(self) -> None:
        # THE replay contract: stop early under a target, then run the
        # same seed without one — the stopped run's evidence trajectory
        # must be a bit-exact prefix of the full run's.
        _, meta_full = self._run(shots=2048, seed=99)
        _, meta_stop = self._run(shots=2048, seed=99, precision_target=0.05)
        self.assertTrue(meta_stop["stopped_early"])
        k = meta_stop["n_batches_done"]
        self.assertLess(k, meta_full["n_batches_done"])
        self.assertEqual(meta_stop["batch_trace"], meta_full["batch_trace"][:k])
        self.assertLess(meta_stop["shots"], 2048)
        self.assertEqual(meta_stop["shots_requested"], 2048)

    def test_early_stop_honours_min_two_batches(self) -> None:
        # A target so loose it is met after batch 1 must still wait
        # for batch 2 (a one-batch "CI" is fake precision).
        _, meta = self._run(shots=2048, seed=5, precision_target=0.49)
        self.assertTrue(meta["stopped_early"])
        self.assertEqual(meta["n_batches_done"], 2)
        self.assertEqual(meta["shots"], 512)  # 2 of 8 x 256 batches

    def test_target_met_only_on_final_batch_is_not_early(self) -> None:
        # Target narrower than anything 2048 shots can reach: never
        # binds, runs to completion, stopped_early stays False.
        _, meta = self._run(shots=2048, seed=5, precision_target=0.001)
        self.assertFalse(meta["stopped_early"])
        self.assertEqual(meta["shots"], 2048)
        self.assertEqual(meta["n_batches_done"], meta["n_batches_planned"])

    def test_wilson_narrowing_one_over_sqrt_n(self) -> None:
        # Statistical shape check with synthetic counts (p fixed at
        # 0.5): width shrinks ~1/sqrt(n), so doubling n gives a ratio
        # near 1/sqrt(2) ~ 0.7071. Wilson's +z^2 correction perturbs
        # this at small n, hence the generous tolerance.
        widths = []
        for n in (256, 512, 1024, 2048, 4096):
            lo, hi = wilson_interval_95(n // 2, n)
            widths.append(hi - lo)
        for w_n, w_2n in zip(widths, widths[1:]):
            self.assertLess(w_2n, w_n)  # monotone narrowing
            self.assertAlmostEqual(w_2n / w_n, 2 ** -0.5, delta=0.02)


@unittest.skipUnless(HAVE_AER, "qiskit-aer not importable")
class ExecutorProgressTests(unittest.TestCase):
    NODES = [FlowNode(id="f1", type="fidelity", data={"method": "sampled"})]

    def _stream(self, **kw):
        return list(ws.run_pipeline_stream(
            circuit=_bell(), nodes=self.NODES, edges=[],
            settings=None, root_seed=1234, seed_pinned=True, **kw,
        ))

    def test_stream_interleaves_progress_before_step(self) -> None:
        items = self._stream()
        progress = [i for i in items if isinstance(i, dict)]
        steps = [i for i in items if isinstance(i, StepResult)]
        self.assertGreaterEqual(len(progress), 2)
        self.assertEqual(len(steps), 1)
        # every progress frame arrives BEFORE the StepResult
        self.assertIsInstance(items[-1], StepResult)
        self.assertTrue(all(isinstance(i, dict) for i in items[:-1]))
        for p in progress:
            sp = p["step_progress"]
            self.assertEqual(sp["node_id"], "f1")
            for key in ("batch_i", "n_batches", "shots_done",
                        "successes", "point", "ci95"):
                self.assertIn(key, sp)
        d = steps[0].distribution
        assert d is not None
        self.assertEqual(d["shots"], 1024)  # ctx default, no backend node
        self.assertFalse(d["stopped_early"])
        self.assertEqual(len(d["trace"]), d["n_batches"])

    def test_eager_run_emits_no_progress(self) -> None:
        steps = ws.run_pipeline(
            circuit=_bell(), nodes=self.NODES, edges=[],
            settings=None, root_seed=1234, seed_pinned=True,
        )
        self.assertTrue(all(isinstance(s, StepResult) for s in steps))
        self.assertEqual(len(steps), 1)

    def test_stream_and_eager_agree_bit_exact(self) -> None:
        stream_step = [i for i in self._stream() if isinstance(i, StepResult)][0]
        eager_step = ws.run_pipeline(
            circuit=_bell(), nodes=self.NODES, edges=[],
            settings=None, root_seed=1234, seed_pinned=True,
        )[0]
        assert stream_step.distribution and eager_step.distribution
        self.assertEqual(stream_step.distribution["point"],
                         eager_step.distribution["point"])
        self.assertEqual(stream_step.distribution["successes"],
                         eager_step.distribution["successes"])

    def test_early_stop_replay_bit_exact_through_pipeline(self) -> None:
        run = lambda: ws.run_pipeline(  # noqa: E731
            circuit=_bell(), nodes=self.NODES, edges=[],
            settings=None, root_seed=777, seed_pinned=True,
            precision_target=0.05,
        )[0].distribution
        d1, d2 = run(), run()
        assert d1 is not None and d2 is not None
        self.assertTrue(d1["stopped_early"])
        self.assertLess(d1["shots"], 1024)
        self.assertEqual(d1["precision_target"], 0.05)
        self.assertEqual(d1["point"], d2["point"])
        self.assertEqual(d1["trace"], d2["trace"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
