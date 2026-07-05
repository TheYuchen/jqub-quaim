"""Gate-level circuit diff: per-qubit lane token sequences + LCS
alignment between a before/after circuit pair.

This powers the "what exactly did this step prune/fold?" view in the
transformation signature card. The channel strip (depth/gates/params/
qubits deltas) says HOW MUCH changed; this module says precisely
WHICH gates, on WHICH qubit lanes.

Design notes
------------
* Tokens are structural fingerprints, not object identities: op name
  + rounded params (3 dp; unbound parameters keep their symbol name)
  + a role tag for multi-qubit gates ("cx·c" on the control lane,
  "cx·t" on the target; symmetric ops like cz/swap need no role).
  Two gates with the same fingerprint are considered "the same gate"
  for alignment purposes — exactly the right granularity for pruning
  (QuCAD) and folding (CompVQC) stories.
* Measures ARE included: the historical QuBound bug (measure_all
  mutating the shared circuit in place) is precisely the kind of
  change this diff exists to surface. Barriers are skipped — they
  are visual/scheduling hints, not computation.
* Alignment is a per-lane longest-common-subsequence diff, the same
  algorithm as text diff: merged order, each token stamped
  kept/removed/added. Counters double-count multi-qubit gates (once
  per lane they touch) by design — the view is lane-centric.
* Hard cap: combined size > 600 ops or > 12 qubits returns a
  truncated marker instead of lanes (demo-scale guarantee; big
  circuits are Quantivine's problem, cited in the paper).

No module-level qiskit import needed — everything is duck-typed off
the QuantumCircuit API (data / find_bit / size / num_qubits).
"""

from __future__ import annotations

MAX_TOTAL_OPS = 600
MAX_QUBITS = 12

# Multi-qubit ops whose qubit order carries no control/target meaning:
# one undecorated token per lane.
_SYMMETRIC_OPS = {"cz", "swap", "iswap", "rzz", "rxx", "ryy", "cp", "cphase"}


def _fmt_param(p) -> str:
    """3-dp rounded numeric fingerprint; unbound ParameterExpressions
    fall back to their symbolic name (float() raises on those)."""
    try:
        v = float(p)
    except (TypeError, ValueError):
        return str(p)
    r = round(v, 3)
    if r == 0:  # normalize -0.0
        r = 0.0
    return f"{r:g}"


def _token_base(op) -> str:
    params = getattr(op, "params", None) or []
    if not params:
        return op.name
    return f"{op.name}({','.join(_fmt_param(p) for p in params)})"


def lane_sequences(qc) -> dict[int, list[str]]:
    """Ordered gate-token list per qubit index.

    Multi-qubit gates appear in EVERY lane they touch, with a role
    suffix on asymmetric ops (·c control / ·t target from the
    instruction's qubit ordering; positional ·0/·1/… for asymmetric
    non-controlled gates). Barriers skipped; measures kept.
    """
    lanes: dict[int, list[str]] = {i: [] for i in range(qc.num_qubits)}
    for inst in qc.data:
        op = inst.operation
        if op.name == "barrier":
            continue
        qidx = [qc.find_bit(q).index for q in inst.qubits]
        base = _token_base(op)
        if len(qidx) == 1:
            lanes[qidx[0]].append(base)
            continue
        if op.name in _SYMMETRIC_OPS:
            for qi in qidx:
                lanes[qi].append(base)
            continue
        n_ctrl = int(getattr(op, "num_ctrl_qubits", 0) or 0)
        for pos, qi in enumerate(qidx):
            if n_ctrl > 0:
                role = "·c" if pos < n_ctrl else "·t"
            else:
                role = f"·{pos}"
            lanes[qi].append(f"{base}{role}")
    return lanes


def _lcs_diff(a: list[str], b: list[str]) -> list[dict]:
    """Standard LCS alignment: merged-order op list, each entry
    stamped kept / removed (only in `a`) / added (only in `b`)."""
    n, m = len(a), len(b)
    # dp[i][j] = LCS length of a[i:], b[j:]
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        row, nxt = dp[i], dp[i + 1]
        for j in range(m - 1, -1, -1):
            if a[i] == b[j]:
                row[j] = nxt[j + 1] + 1
            else:
                row[j] = nxt[j] if nxt[j] >= row[j + 1] else row[j + 1]
    out: list[dict] = []
    i = j = 0
    while i < n and j < m:
        if a[i] == b[j]:
            out.append({"op": a[i], "s": "kept"})
            i += 1
            j += 1
        elif dp[i + 1][j] >= dp[i][j + 1]:
            out.append({"op": a[i], "s": "removed"})
            i += 1
        else:
            out.append({"op": b[j], "s": "added"})
            j += 1
    for k in range(i, n):
        out.append({"op": a[k], "s": "removed"})
    for k in range(j, m):
        out.append({"op": b[k], "s": "added"})
    return out


def diff_lanes(before_qc, after_qc) -> dict:
    """Per-qubit LCS diff payload between two circuits.

    Shape: {"qubits": {"0": [{"op", "s"}, ...], ...},
            "n_kept": int, "n_removed": int, "n_added": int,
            "truncated": False}
    or, over the size cap:
            {"truncated": True, "reason": str}.
    Qubit lanes present on only one side diff against an empty lane,
    i.e. come out wholly removed/added.
    """
    total = int(before_qc.size()) + int(after_qc.size())
    n_qubits = max(int(before_qc.num_qubits), int(after_qc.num_qubits))
    if total > MAX_TOTAL_OPS or n_qubits > MAX_QUBITS:
        return {
            "truncated": True,
            "reason": (
                f"circuit too large for gate-level diff "
                f"({n_qubits} qubits, {total} combined ops; "
                f"cap {MAX_QUBITS} qubits / {MAX_TOTAL_OPS} ops)"
            ),
        }
    before_lanes = lane_sequences(before_qc)
    after_lanes = lane_sequences(after_qc)
    qubits: dict[str, list[dict]] = {}
    n_kept = n_removed = n_added = 0
    for qi in sorted(set(before_lanes) | set(after_lanes)):
        ops = _lcs_diff(before_lanes.get(qi, []), after_lanes.get(qi, []))
        for e in ops:
            if e["s"] == "kept":
                n_kept += 1
            elif e["s"] == "removed":
                n_removed += 1
            else:
                n_added += 1
        qubits[str(qi)] = ops
    return {
        "qubits": qubits,
        "n_kept": n_kept,
        "n_removed": n_removed,
        "n_added": n_added,
        "truncated": False,
    }
