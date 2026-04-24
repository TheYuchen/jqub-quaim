"""QuBound implementation (refactored from Jovin Antony Maria's original).

Algorithm overview: given a VQC plus 14 days of historical backend noise
calibration data, train an LSTM to predict the ``hellinger_distance``
between the noiseless circuit output and today's noisy output — i.e.
how much the output distribution will drift under the current hardware.

Two entry points:

* :func:`call_QuBound` — live path, fetches calibration history from
  IBM Quantum Platform (requires a valid token, slow, ~15 s).
* :func:`call_QuBound_from_cache` — offline path, reads a pickle
  produced by ``scripts/fetch_ibm_history.py``. Used by the HF Space
  demo so it can run without network or credentials.
"""

from __future__ import annotations

import logging
import pickle
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
from qiskit import QuantumCircuit, qpy, transpile
from qiskit.quantum_info import hellinger_distance
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel
from qiskit_ibm_runtime import QiskitRuntimeService
from qiskit_ibm_runtime.fake_provider import FakeFez
from torch import nn

logger = logging.getLogger(__name__)


# ---- Hyperparameters ---------------------------------------------------
# Exposed as module-level constants so future ablation studies don't need
# to hunt them down inside function bodies.

HISTORY_WINDOW_DAYS = 14
"""Number of past days of calibration snapshots to pull from a backend."""

PROGRESS_PRINT_INTERVAL = 7
"""Log a progress message every N days while fetching calibrations."""

SHOTS = 2048
"""Shots per Aer simulator run when producing noisy / noiseless labels."""

SEQUENCE_WINDOW_SIZE = 5
"""Sliding-window length fed into the LSTM (days of context per sample)."""

LSTM_INPUT_FEATURES = 8
"""Per-timestep feature count: T1/T2/readout (x1 qubit) + 1 gate error,
doubled once trend/residual are concatenated. Kept as a constant because
it is coupled to :func:`extract_time_series_from_historic` — changing
the feature extraction must update this value."""

LSTM_HIDDEN_BLOCKS = 16
"""LSTM hidden state size."""

LSTM_LEARNING_RATE = 0.01
LSTM_EPOCHS = 50
LSTM_LOG_EPOCH_INTERVAL = 10

CONFIDENCE_LEVEL = 0.95
"""Upper-quantile weight in the asymmetric pinball loss; predicts the
95th-percentile error bound."""


def get_gate_name_for_pair(
    properties: Any, qubits: tuple[int, int]
) -> str | None:
    """Return the two-qubit gate name (``cx``/``cz``/``ecr``) that acts
    on the given qubit pair, according to ``properties.gates``. Returns
    ``None`` if no gate targets exactly those qubits."""
    target_qubits = list(qubits)
    for gate_info in properties.gates:
        if gate_info.qubits == target_qubits:
            return gate_info.gate
    return None


def look_back_window_ForError(
    backend: Any, date_selected: datetime | None = None
) -> list[dict[str, Any]]:
    """Fetch ``HISTORY_WINDOW_DAYS`` days of ``BackendProperties``
    ending at ``date_selected`` (default: now).

    Returns a list of ``{"date": "YYYY-MM-DD", "properties": <obj>}``
    dicts ordered from oldest to most recent.
    """
    if date_selected is None:
        date_selected = datetime.now()

    logger.info("Starting calibration data collection over %d days", HISTORY_WINDOW_DAYS)

    historical_data: list[dict[str, Any]] = []
    for i in range(HISTORY_WINDOW_DAYS, 0, -1):
        target_date = date_selected - timedelta(days=i)
        properties = backend.properties(datetime=target_date)
        historical_data.append(
            {
                "date": target_date.strftime("%Y-%m-%d"),
                "properties": properties,
            }
        )
        if i % PROGRESS_PRINT_INTERVAL == 0:
            logger.info("Half way done...")
    return historical_data


def get_labels_fromNoise(
    qc: QuantumCircuit, historic_data: list[dict[str, Any]], backend: Any
) -> torch.Tensor:
    """For each historical day, compute the Hellinger distance between
    the noiseless counts and the noisy counts (noise model built from
    that day's properties). Returns a 1-D tensor of error labels, one
    per day, suitable as LSTM supervision."""
    logger.info("Computing error labels from circuit noiseless vs. noisy runs")

    # Mutation by design: attaches measurements so the Aer shots mean
    # something. Caller doesn't reuse ``qc`` after this point.
    qc.measure_all()
    qc = transpile(qc, backend, optimization_level=3)

    simulator = AerSimulator()
    nonoise_value = simulator.run(qc, shots=SHOTS).result().get_counts()

    labels: list[float] = []
    for history in historic_data:
        properties = history["properties"]
        noise_model = NoiseModel.from_backend(backend, properties)
        noisy_simulator = AerSimulator(noise_model=noise_model)
        noise_value = noisy_simulator.run(qc, shots=SHOTS).result().get_counts()

        # Hellinger is a proper metric on probability distributions,
        # bounded in [0, 1] — convenient for training.
        error = hellinger_distance(nonoise_value, noise_value)
        labels.append(error)

    return torch.tensor(labels, dtype=torch.float32)


def extract_time_series_from_historic(
    historical_data: list[dict[str, Any]],
    qubit_indices: list[int] | None = None,
    gate_qubit: list[tuple[int, int]] | None = None,
) -> pd.DataFrame:
    """Unpack T1 / T2 / readout error / two-qubit gate error into a
    tidy per-day DataFrame, indexed by date. Defaults to qubit 0 and
    the (0, 1) pair — the smallest circuit we ever exercise."""
    if qubit_indices is None:
        qubit_indices = [0]
    if gate_qubit is None:
        gate_qubit = [(0, 1)]

    logger.info("Extracting per-qubit error time series from historic data")

    extracted_data: list[dict[str, Any]] = []
    for history in historical_data:
        properties = history["properties"]
        row: dict[str, Any] = {"date": history["date"]}

        for i in qubit_indices:
            row[f"q{i}_t1"] = properties.t1(i)
            row[f"q{i}_t2"] = properties.t2(i)
            row[f"q{i}_readout_err"] = properties.readout_error(i)

        for g in gate_qubit:
            gate_name = get_gate_name_for_pair(properties, g)
            row[f"gate_err_{g[0]}_{g[1]}"] = properties.gate_error(gate_name, g)

        extracted_data.append(row)

    return pd.DataFrame(extracted_data).set_index("date")


# ---- QuDeCOM: trend / residual split -----------------------------------


def decompose_noise(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split a noise time series into a rolling-mean trend (predictable
    drift) and the residual (unpredictable fluctuations). Matches the
    decomposition described in the QuBound paper."""
    logger.info("Decomposing extracted time series into trend and residual")
    trend = df.rolling(window=3, min_periods=1).mean()
    residual = df - trend
    return trend, residual


# ---- LSTM forecaster ---------------------------------------------------


def create_sequences(df: pd.DataFrame, window_size: int = SEQUENCE_WINDOW_SIZE) -> torch.Tensor:
    """Turn a (days x features) DataFrame into overlapping windows of
    length ``window_size`` suitable as LSTM inputs."""
    logger.debug("Building LSTM input sequences with window=%d", window_size)
    data = df.values
    sequences = [data[i : i + window_size] for i in range(len(data) - window_size)]
    return torch.tensor(np.array(sequences), dtype=torch.float32)


class QuPred(nn.Module):
    """LSTM-based error-bound forecaster.

    One LSTM layer consumes the daily noise sequence; a final linear
    head projects the last hidden state onto a scalar predicted error.
    """

    def __init__(self, input_features: int, blocks: int) -> None:
        super().__init__()
        self.lstm = nn.LSTM(input_features, blocks, batch_first=True)
        self.fc = nn.Linear(blocks, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        _, (h_n, _) = self.lstm(x)
        return self.fc(h_n[-1])


def loss_fn(
    preds: torch.Tensor, targets: torch.Tensor, confidence: float = CONFIDENCE_LEVEL
) -> torch.Tensor:
    """Asymmetric pinball loss: penalises under-prediction at weight
    ``confidence`` and over-prediction at weight ``confidence - 1``,
    so minimising it recovers the ``confidence``-quantile of the error
    distribution (default 95%)."""
    errors = targets - preds
    return torch.max(confidence * errors, (confidence - 1) * errors).mean()


def train_loop(x_train: torch.Tensor, y_train: torch.Tensor) -> QuPred:
    """Train a fresh :class:`QuPred` for ``LSTM_EPOCHS`` epochs and
    return the trained model. Hyperparameters live as module-level
    constants above."""
    logger.info("Entering LSTM training loop")
    model = QuPred(input_features=LSTM_INPUT_FEATURES, blocks=LSTM_HIDDEN_BLOCKS)
    optimizer = torch.optim.Adam(model.parameters(), lr=LSTM_LEARNING_RATE)

    for epoch in range(LSTM_EPOCHS):
        model.train()
        model.zero_grad()

        predictions = model(x_train)
        loss = loss_fn(predictions, y_train, confidence=CONFIDENCE_LEVEL)
        loss.backward()
        optimizer.step()

        if epoch % LSTM_LOG_EPOCH_INTERVAL == 0:
            logger.info("Epoch %d | Loss: %.6f", epoch, loss.item())

    return model


def predict_vqc_bound(model: QuPred, x_train: torch.Tensor) -> float:
    """Evaluate the trained model on the most recent sequence (today's
    noise) and return its scalar error-bound prediction."""
    model.eval()
    with torch.no_grad():
        latest_noise = x_train[-1].unsqueeze(0)
        return float(model(latest_noise).item())


def _train_and_predict(
    qc: QuantumCircuit, historic_data: list[dict[str, Any]], provider: Any
) -> tuple[float, QuPred]:
    """Shared QuBound pipeline once ``historic_data`` is available.

    Pulls the time-series features out of the calibration snapshots,
    trains the LSTM on noise-aware labels from a Qiskit Aer simulation,
    and returns ``(predicted_error_bound_today, trained_model)``.
    """
    extracted_df = extract_time_series_from_historic(historic_data)
    trend_df, residual_df = decompose_noise(extracted_df)

    combined_df = pd.concat([trend_df, residual_df], axis=1).fillna(0)
    normalized_df = (combined_df - combined_df.mean()) / combined_df.std()

    x_train = create_sequences(normalized_df, window_size=SEQUENCE_WINDOW_SIZE)
    y_train = get_labels_fromNoise(qc, historic_data, provider)
    y_train = y_train[SEQUENCE_WINDOW_SIZE:].unsqueeze(1)

    model = train_loop(x_train, y_train)
    final_bound = predict_vqc_bound(model, x_train)
    return final_bound, model


def call_QuBound(
    qc: QuantumCircuit,
    provider: Any,
    token: str,
    date: datetime | None = None,
) -> tuple[float, QuPred]:
    """Run QuBound against the **live** IBM Quantum Platform API.

    Fetches ``HISTORY_WINDOW_DAYS`` days of historical noise from
    ``ibm_fez`` and trains the LSTM. Slow (live fetch is ~15 s) and
    requires network access plus a valid token.

    Parameters
    ----------
    qc : QuantumCircuit
    provider : qiskit backend (fake or real) used for transpile + Aer
        noise-model construction during label generation.
    token : IBM Quantum Platform API token.
    date : Reference date; defaults to now.
    """
    if date is None:
        date = datetime.now()
    service = QiskitRuntimeService(
        channel="ibm_quantum_platform",
        token=token,
        plans_preference=["open"],
    )
    backend = service.backend("ibm_fez")
    historic_data = look_back_window_ForError(backend, date)
    return _train_and_predict(qc, historic_data, provider)


def call_QuBound_from_cache(
    qc: QuantumCircuit,
    cached_history_path: str | Path,
    reference_backend: Any = None,
) -> tuple[float, QuPred, dict[str, Any]]:
    """Run QuBound against a pickle of pre-fetched 14-day backend
    properties.

    Parameters
    ----------
    qc : QuantumCircuit
    cached_history_path : Path to the pickle produced by
        ``scripts/fetch_ibm_history.py``.
    reference_backend : Backend used for transpile + simulator
        construction. Defaults to ``FakeFez`` (matches the ``ibm_fez``
        calibration in the cache).

    Returns
    -------
    (predicted_bound, model, metadata) : ``metadata`` is a dict
        describing the cached data source (backend name, fetch date,
        day count, date range).
    """
    with open(cached_history_path, "rb") as fh:
        payload = pickle.load(fh)

    historic_data = payload["days"]
    if not historic_data:
        raise ValueError(f"Cached history at {cached_history_path} has no days.")

    if reference_backend is None:
        reference_backend = FakeFez()

    bound, model = _train_and_predict(qc, historic_data, reference_backend)
    metadata = {
        "backend_name": payload.get("backend_name"),
        "fetched_at": payload.get("fetched_at"),
        "num_days": len(historic_data),
        "first_date": historic_data[0]["date"],
        "last_date": historic_data[-1]["date"],
    }
    return bound, model, metadata


if __name__ == "__main__":
    # Minimal CLI entry for ad-hoc testing outside the web app.
    # Expects two environment variables:
    #   IBM_QUANTUM_TOKEN  - IBM Quantum Platform API token
    #   QBOUND_QPY_FILE    - path to a .qpy file holding the trained VQC
    import os

    logging.basicConfig(level=logging.INFO)

    token = os.environ["IBM_QUANTUM_TOKEN"]
    qpy_path = os.environ["QBOUND_QPY_FILE"]
    with open(qpy_path, "rb") as file:
        qc = qpy.load(file)[0]
    bound, _model = call_QuBound(qc, FakeFez(), token=token)
    logger.info("Final bound: %s", bound)
