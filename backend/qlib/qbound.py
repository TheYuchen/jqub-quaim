"""QuBound implementation (refactored from Jovin Antony Maria's original).

Original algorithm preserved; the wrapper `call_QuBound(...)` now takes an
explicit `token` argument instead of reading from `st.secrets`, so this
module is usable outside Streamlit.
"""

from qiskit_ibm_runtime import QiskitRuntimeService
from qiskit import QuantumCircuit
from qiskit_aer.noise import NoiseModel
from qiskit_aer import AerSimulator
from qiskit.quantum_info import hellinger_distance  # state_fidelity and total variation distance are used for simple Fidelity calculations
from qiskit import transpile
from qiskit_ibm_runtime.fake_provider import FakeFez
from qiskit import qpy

import torch
from torch import nn

from datetime import datetime, timedelta
import numpy as np
import pandas as pd

def get_gate_name_for_pair(properties, qubits):
    target_qubits = list(qubits)
    
    for gate_info in properties.gates:
        if gate_info.qubits == target_qubits:
            return gate_info.gate
            
    return None

# function to get the necessary noise data from ibm_cloud 
# gets the properties object for each day of the 14 day window
def look_back_window_ForError(backend, date_selected = datetime.now()):
    look_back_days = 14
    historical_data = []

    if date_selected is None:
        date_selected = datetime.now()

    print(f"Starting data collection")

    for i in range(look_back_days, 0, -1):
        # target_date = datetime.now() - timedelta(days = i) # 
        target_date = date_selected - timedelta(days = i)
        # print(target_date)

        properties = backend.properties(datetime = target_date)

        historical_data.append({
                "date": target_date.strftime("%Y-%m-%d"),
                "properties": properties
            })
        if i % 7 == 0:
            print("Half way done...") 
    return historical_data


# uses the properties generated to replicated the noise into a noise model 
# then use that to generate effective labels/outputs with noise 
# and work on it without noise
def get_labels_fromNoise(qc, historic_data, backend):
    print("Getting error prediction labels from circuit nonoise and noise values")

    labels = []  # the error we want to predict

    # create a temp circuit, This was done in the q_adapt implementaiton, and compressVQC
    # qc = QuantumCircuit(2)
    # qc.h(0)
    # qc.cx(0, 1)
    qc.measure_all()
    # print(qc)

    qc = transpile(qc, backend, optimization_level=3)
    simulator = AerSimulator()
    # noise_model = NoiseModel
    nonoise_value = simulator.run(qc, shots = 2048).result().get_counts()

    for history in historic_data:
        properties = history['properties']
        noise_model = NoiseModel.from_backend(backend, properties)  # get the noise signature to replicate
        noisy_simulator = AerSimulator(noise_model = noise_model)
        noise_value = noisy_simulator.run(qc, shots = 2048).result().get_counts()

        # using true metric to calculate difference between probability distributions
        error = hellinger_distance(nonoise_value, noise_value)
        labels.append(error)

    return torch.tensor(labels, dtype = torch.float32)   # must convertt to tensor so it can be used in LSTm

# this uses the output form the previous funciton to get the 
# T1, Tw, Readout and gate errors
def extract_time_series_from_historic(historical_data, qubit_indices = [0], gate_qubit = [(0,1)]):
    print("Starting Error values Extraction from historic data.")
    extracted_data = []

    for history in historical_data:
        date = history['date']
        properties = history['properties']

        row = {'date':date}


        # get the respective T1, T2, readout errors
        for i in qubit_indices:
            row[f'q{i}_t1'] = properties.t1(i)
            row[f'q{i}_t2'] = properties.t2(i)
            row[f'q{i}_readout_err'] = properties.readout_error(i)

        # getting the gate errors
        for g in gate_qubit:
            gate_name = get_gate_name_for_pair(properties, g)
            row[f'gate_err_{g[0]}_{g[1]}'] = properties.gate_error(gate_name, g)

        extracted_data.append(row)

    df  = pd.DataFrame(extracted_data).set_index('date')
    return df


# ---------- Perform QuDeCOM

def decompose_noise(df):
    print("breaking extracted df in to trend and residue.")
    trend = df.rolling(window=3, min_periods=1).mean()  # return the mean for the 3 rows and then the next following rows 
                                                        # then subtract form the df to get the residual
                                                        # essentially do 1d conolution with a window of 3
    residual = df - trend

    # extract the prdictable drift and unpredictable fluctuations, according to the paper
    return trend, residual 



#------------- encoding the drift and fluctuations, 
# into a feature vector for the LSTM
# lstm takes into consideratino of a sequence, hence this is necessary
def create_sequences(df, window_size=5):
    print("preprocessing lstm data ==")
    data = df.values
    sequences = []
    for i in range(len(data) - window_size):
        window = data[i : i + window_size]   # return the sequence/data form 0-5, 1-6, 2-7...
        sequences.append(window)
    return torch.tensor(np.array(sequences), dtype=torch.float32)   # convert to torch tensor, so that we can pass it to a lstm


#------------------------------
# Finally now that pre-processing is complete, 
# the LSTM model 
# or QuPRED
#--------------------------------
class QuPred(nn.Module):
    def __init__(self, input_features, blocks):
        super().__init__()
        self.lstm = nn.LSTM(input_features, blocks, batch_first=True)
        self.fc = nn.Linear(blocks, 1)

    def forward(self, x):
        _, (h_n, _) = self.lstm(x)
        return self.fc(h_n[-1])
    
# using stistical confidence for the loss to get the bound 
# for a bell curve to be with in the 95% of all the data, 
# that is the value should lie between 2 standard deviations of the mean
# taking the idea from the confidence table in the paper
# Statistical theory; we can be 95% sure that out data wont be away from the actual value
def loss_fn(preds, targets, confidence=0.95):
    errors = targets - preds
    return torch.max(confidence * errors, (confidence - 1) * errors).mean()

def train_loop(x_train, y_train):

    print("Entered Model training ...")
    # hyper parameters
    model = QuPred(input_features= 8, blocks = 16)
    optimizer = torch.optim.Adam(model.parameters(), lr = 0.01)
    epochs = 50

    # the actually training
    for epoch in range(epochs):
        model.train()
        model.zero_grad()

        predictions = model(x_train)  # remember that x train is of the size 9,5,4
        loss = loss_fn(predictions, y_train, confidence = 0.95)

        # calculate the gradients
        loss.backward()
        # make changes to the weights
        optimizer.step()

        if epoch % 10 == 0:
            print(f"Epoch {epoch} | Model Loss: {loss.item():.6f}")
    
    return model

def predict_vqc_bound(model, x_train):
    model.eval()
    with torch.no_grad():

        # model.eval()
        # with torch.no_grad():
        #     # Take the VERY LAST noise, which is today's noise to predict the performance
        #     latest_noise = x_train[-1].unsqueeze(0) 
        #     predicted_bound = model(latest_noise_sequence)
        #     print(f"The predicted error bound today: {predicted_bound.item():.4f}")

        latest_noise = x_train[-1].unsqueeze(0) 
        predicted_bound = model(latest_noise).item()
        
        return predicted_bound

def _train_and_predict(qc, historic_data, provider):
    """Shared QuBound pipeline once ``historic_data`` is available.

    Pulls the time-series features out of 14 days of BackendProperties,
    trains the LSTM on noise-aware labels from a Qiskit Aer simulation,
    and returns the predicted error bound for *today* plus the trained model.
    """
    extracted_df = extract_time_series_from_historic(historic_data)
    trend_df, residual_df = decompose_noise(extracted_df)

    combined_df = pd.concat([trend_df, residual_df], axis=1)
    combined_df = combined_df.fillna(0)
    normalized_df = (combined_df - combined_df.mean()) / combined_df.std()

    x_train = create_sequences(normalized_df, window_size=5)
    y_train = get_labels_fromNoise(qc, historic_data, provider)
    y_train = y_train[5:].unsqueeze(1)

    model = train_loop(x_train, y_train)
    final_bound = predict_vqc_bound(model, x_train)
    return final_bound, model


# provider is the fake backend that will be used for transpiling and other uses
# this is the function that will be called by the website to run the QuBound from scratch
def call_QuBound(qc, provider, token, date=None):
    """Run QuBound against the **live** IBM Quantum Platform API.

    Fetches 14 days of historical noise from ``ibm_fez`` and trains the LSTM.
    Slow (live fetch is ~15 s) and requires network + valid token.

    Parameters
    ----------
    qc : QuantumCircuit
    provider : qiskit backend (fake or real) used for labelling
    token : str  IBM Quantum Platform API token
    date : datetime or None  reference date; defaults to now
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


def call_QuBound_from_cache(qc, cached_history_path, reference_backend=None):
    """Run QuBound against a pickle of pre-fetched 14-day backend properties.

    Parameters
    ----------
    qc : QuantumCircuit
    cached_history_path : str | pathlib.Path
        Path to the pickle produced by ``scripts/fetch_ibm_history.py``.
    reference_backend : qiskit backend, optional
        Backend used for transpile + simulator construction. Defaults to
        ``FakeFez`` (matches the ibm_fez calibration in the cache).

    Returns
    -------
    (predicted_bound, model, metadata) : tuple
        ``metadata`` is a dict describing the cached data source.
    """
    import pickle

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





if __name__ == '__main__':
    # Minimal CLI entry for ad-hoc testing outside the web app.
    # Expects two environment variables:
    #   IBM_QUANTUM_TOKEN  - IBM Quantum Platform API token
    #   QBOUND_QPY_FILE    - path to a .qpy file holding the trained VQC
    import os

    token = os.environ["IBM_QUANTUM_TOKEN"]
    qpy_path = os.environ["QBOUND_QPY_FILE"]
    with open(qpy_path, "rb") as file:
        qc = qpy.load(file)[0]
    bound, _model = call_QuBound(qc, FakeFez(), token=token)
    print(f"Final bound: {bound}")
