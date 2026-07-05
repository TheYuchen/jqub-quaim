"""Small, dependency-free statistics helpers shared by handlers."""

from __future__ import annotations

import math


def wilson_interval(
    successes: int, n: int, z: float = 1.959963984540054,
) -> tuple[float, float]:
    """95% Wilson score interval for a binomial proportion.

    Chosen over the naive normal approximation because sampled-fidelity
    estimates routinely sit near 0 or 1 (Bell on a clean backend →
    p ≈ 0.5, deep circuits on a noisy one → p ≈ 0.02), where the normal
    interval collapses to zero width or escapes [0, 1]. Wilson stays
    honest at the edges and for small shot counts.
    """
    if n <= 0:
        return (0.0, 1.0)
    k = max(0, min(int(successes), int(n)))
    p = k / n
    z2 = z * z
    denom = 1.0 + z2 / n
    centre = (p + z2 / (2 * n)) / denom
    half = (z / denom) * math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))
    return (max(0.0, centre - half), min(1.0, centre + half))
