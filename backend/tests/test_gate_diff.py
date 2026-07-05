"""Unit tests for the gate-level circuit diff (per-qubit lane token
sequences + LCS alignment) that feeds the transformation signature
card. No torch, no aer — pure qiskit circuit structure.

Runnable directly (``python3 tests/test_gate_diff.py`` from
``backend/``) or via pytest.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from qiskit import QuantumCircuit  # noqa: E402
from qiskit.circuit import Parameter  # noqa: E402

from app.services.circuit_diff import (  # noqa: E402
    MAX_QUBITS,
    MAX_TOTAL_OPS,
    diff_lanes,
    lane_sequences,
)


def bell() -> QuantumCircuit:
    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)
    return qc


class TestLaneSequences(unittest.TestCase):
    def test_two_qubit_gate_in_both_lanes_with_roles(self):
        lanes = lane_sequences(bell())
        self.assertEqual(lanes[0], ["h", "cx·c"])
        self.assertEqual(lanes[1], ["cx·t"])

    def test_symmetric_op_has_no_role_tag(self):
        qc = QuantumCircuit(2)
        qc.cz(0, 1)
        qc.swap(0, 1)
        lanes = lane_sequences(qc)
        self.assertEqual(lanes[0], ["cz", "swap"])
        self.assertEqual(lanes[1], ["cz", "swap"])

    def test_param_rounded_3dp(self):
        qc = QuantumCircuit(1)
        qc.ry(0.42, 0)
        qc.rz(1.23456, 0)
        lanes = lane_sequences(qc)
        self.assertEqual(lanes[0], ["ry(0.42)", "rz(1.235)"])

    def test_unbound_parameter_keeps_symbol_name(self):
        theta = Parameter("θ")
        qc = QuantumCircuit(1)
        qc.ry(theta, 0)
        lanes = lane_sequences(qc)
        self.assertEqual(lanes[0], ["ry(θ)"])

    def test_measures_included_barriers_skipped(self):
        # Measures matter — the historical QuBound measure_all
        # in-place mutation is exactly what this diff must surface.
        qc = QuantumCircuit(1, 1)
        qc.h(0)
        qc.barrier()
        qc.measure(0, 0)
        lanes = lane_sequences(qc)
        self.assertEqual(lanes[0], ["h", "measure"])


class TestDiffLanes(unittest.TestCase):
    def test_identical_circuits_all_kept(self):
        d = diff_lanes(bell(), bell())
        self.assertFalse(d["truncated"])
        self.assertEqual(d["n_removed"], 0)
        self.assertEqual(d["n_added"], 0)
        # h on q0, cx counted once per lane => 3 lane tokens kept
        self.assertEqual(d["n_kept"], 3)
        self.assertTrue(all(e["s"] == "kept" for e in d["qubits"]["0"]))
        self.assertTrue(all(e["s"] == "kept" for e in d["qubits"]["1"]))

    def test_removed_gate_lands_on_right_lane(self):
        after = QuantumCircuit(2)
        after.cx(0, 1)  # bell minus the h
        d = diff_lanes(bell(), after)
        q0 = d["qubits"]["0"]
        self.assertEqual(q0, [
            {"op": "h", "s": "removed"},
            {"op": "cx·c", "s": "kept"},
        ])
        self.assertEqual(d["qubits"]["1"], [{"op": "cx·t", "s": "kept"}])
        self.assertEqual(d["n_removed"], 1)
        self.assertEqual(d["n_added"], 0)
        self.assertEqual(d["n_kept"], 2)

    def test_removed_2q_gate_hits_both_lanes(self):
        before = bell()
        after = QuantumCircuit(2)
        after.h(0)
        d = diff_lanes(before, after)
        self.assertEqual(d["n_removed"], 2)  # cx·c on q0 + cx·t on q1
        self.assertIn({"op": "cx·c", "s": "removed"}, d["qubits"]["0"])
        self.assertEqual(d["qubits"]["1"], [{"op": "cx·t", "s": "removed"}])

    def test_param_change_is_removed_plus_added(self):
        before = QuantumCircuit(1)
        before.ry(0.1, 0)
        after = QuantumCircuit(1)
        after.ry(0.2, 0)
        d = diff_lanes(before, after)
        statuses = sorted(e["s"] for e in d["qubits"]["0"])
        self.assertEqual(statuses, ["added", "removed"])
        self.assertEqual(d["n_removed"], 1)
        self.assertEqual(d["n_added"], 1)
        self.assertEqual(d["n_kept"], 0)

    def test_qubit_only_on_one_side_is_whole_lane_removed(self):
        before = QuantumCircuit(3)
        before.h(0)
        before.h(2)
        after = QuantumCircuit(2)
        after.h(0)
        d = diff_lanes(before, after)
        self.assertEqual(d["qubits"]["2"], [{"op": "h", "s": "removed"}])

    def test_truncation_on_too_many_qubits(self):
        from qiskit.circuit.random import random_circuit
        big = random_circuit(MAX_QUBITS + 1, 20, seed=1)
        d = diff_lanes(big, big)
        self.assertTrue(d["truncated"])
        self.assertIn("reason", d)
        self.assertNotIn("qubits", d)

    def test_truncation_on_too_many_ops(self):
        qc = QuantumCircuit(1)
        for _ in range(MAX_TOTAL_OPS // 2 + 1):
            qc.x(0)
        d = diff_lanes(qc, qc)  # combined size 602 > 600
        self.assertTrue(d["truncated"])

    def test_payload_shape(self):
        d = diff_lanes(bell(), bell())
        self.assertEqual(
            set(d),
            {"qubits", "n_kept", "n_removed", "n_added", "truncated"},
        )
        for lane in d["qubits"].values():
            for e in lane:
                self.assertEqual(set(e), {"op", "s"})
                self.assertIn(e["s"], ("kept", "removed", "added"))


class TestExecutorWiring(unittest.TestCase):
    """The executor must stamp gate_diff even when a handler mutates
    the shared ctx circuit IN PLACE (the historical QuBound
    measure_all bug shape) — which only works because the executor
    copies the circuit BEFORE dispatch."""

    def test_in_place_mutation_still_diffs(self):
        from app.config import get_settings
        from app.schemas import FlowNode
        from app.services import workflow_service as ws

        def _mutating_handler(node, ctx, settings):
            # In-place mutation: drop the last instruction (the cx).
            ctx["circuit"].data.pop()
            return ws._make_step(node, "ok")

        ws._HANDLERS["_gate_diff_probe"] = _mutating_handler
        try:
            steps = ws.run_pipeline(
                circuit=bell(),
                nodes=[FlowNode(id="p1", type="_gate_diff_probe", data={})],
                edges=[],
                settings=get_settings(),
                user_id=None,
            )
        finally:
            del ws._HANDLERS["_gate_diff_probe"]
        self.assertEqual(len(steps), 1)
        t = steps[0].transformation
        self.assertIsNotNone(t)
        self.assertTrue(t["changed"])
        g = t.get("gate_diff")
        self.assertIsNotNone(g, "gate_diff missing from transformation")
        self.assertFalse(g["truncated"])
        # cx removed => one removed token on each lane
        self.assertEqual(g["n_removed"], 2)
        self.assertEqual(g["n_added"], 0)
        self.assertIn({"op": "cx·c", "s": "removed"}, g["qubits"]["0"])
        self.assertIn({"op": "cx·t", "s": "removed"}, g["qubits"]["1"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
