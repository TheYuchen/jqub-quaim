import torch
from torch import nn
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from qiskit_ibm_runtime import QiskitRuntimeService, QiskitRuntimeService as QRS
from qiskit import QuantumCircuit, transpile, qpy
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel
from scipy.stats import norm
import statsmodels.api as sm
from matplotlib import pyplot as plt
from qiskit_ibm_runtime.fake_provider import FakeFez
import streamlit as st

# --- Model Definition ---
class QuPred(nn.Module):
    def __init__(self, input_features, hidden_dim, output_dim):
        super().__init__()
        self.lstm = nn.LSTM(input_features, hidden_dim, batch_first=True)
        self.fc1 = nn.Linear(hidden_dim, 64)
        self.relu = nn.LeakyReLU()
        self.fc2 = nn.Linear(64, output_dim)

    def forward(self, x):
        _, (h_n, _) = self.lstm(x)
        out = self.relu(self.fc1(h_n[-1]))
        return self.fc2(out)

# --- Utility Functions ---
def get_gate_name_for_pair(properties, qubits):
    target_qubits = list(qubits)
    for gate_info in properties.gates:
        if gate_info.qubits == target_qubits:
            return gate_info.gate
    return None

def look_back_window_ForError(backend, date_selected=None):
    if date_selected is None:
        date_selected = datetime.now()
    
    look_back_days = 14
    historical_data = []
    print(f"Collecting 14 days of historical noise data...")

    for i in range(look_back_days, 0, -1):
        target_date = date_selected - timedelta(days=i)
        try:
            props = backend.properties(datetime=target_date)
            if props:
                historical_data.append({"date": target_date.strftime("%Y-%m-%d"), "properties": props})
        except Exception as e:
            continue # Quietly skip missing dates
            
    return historical_data

def get_labels_fromNoise(qc, historic_data, backend, max_output_dim=16):
    print(f"Generating labels for circuit with {qc.num_qubits} qubits...")
    qc_meas = qc.copy()
    qc_meas.measure_all()
    transpiled_qc = transpile(qc_meas, backend, optimization_level=3)

    labels = []
    shots = 1024 # Reduced for speed

    for history in historic_data:
        noise_model = NoiseModel.from_backend(backend, history['properties'])
        sim = AerSimulator(noise_model=noise_model)
        
        # Bind parameters if the circuit has any
        if transpiled_qc.num_parameters > 0:
            param_values = np.zeros(transpiled_qc.num_parameters)
            bound_qc = transpiled_qc.assign_parameters(param_values)
            counts = sim.run(bound_qc, shots=shots).result().get_counts()
        else:
            counts = sim.run(transpiled_qc, shots=shots).result().get_counts()
        
        # Prevent 2^N memory error using modulo-indexing
        probs = np.zeros(max_output_dim)
        for bitstring, count in counts.items():
            idx = int(bitstring, 2) % max_output_dim
            probs[idx] += count / shots
        labels.append(probs)

    return torch.tensor(np.array(labels), dtype=torch.float32)

def extract_time_series_from_historic(historical_data, qubit_indices=[0, 1], gate_pairs=[(0, 1)]):
    extracted_data = []
    for history in historical_data:
        props = history['properties']
        row = {'date': history['date']}
        for i in qubit_indices:
            try:
                row[f'q{i}_t1'] = props.t1(i)
                row[f'q{i}_readout_err'] = props.readout_error(i)
            except:
                row[f'q{i}_t1'], row[f'q{i}_readout_err'] = 0, 0
        extracted_data.append(row)
    return pd.DataFrame(extracted_data).set_index('date')

def decompose_noise(df):
    trend_list, seasonal_list, residual_list = [], [], []
    for col in df.columns:
        if df[col].std() == 0:
            trend_list.append(df[col])
            seasonal_list.append(pd.Series(0, index=df.index))
            residual_list.append(pd.Series(0, index=df.index))
            continue
        res = sm.tsa.seasonal_decompose(df[col], model='additive', period=min(7, len(df)//2), extrapolate_trend='freq')
        trend_list.append(res.trend)
        seasonal_list.append(res.seasonal)
        residual_list.append(res.resid)
    return pd.concat(trend_list, axis=1), pd.concat(seasonal_list, axis=1), pd.concat(residual_list, axis=1)

def train_loop(x_train, y_train):
    model = QuPred(input_features=x_train.shape[2], hidden_dim=32, output_dim=y_train.shape[1])
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    criterion = nn.MSELoss() 

    for epoch in range(51): # Reduced epochs for faster testing
        model.train()
        optimizer.zero_grad()
        preds = model(x_train)
        loss = criterion(preds, y_train)
        loss.backward()
        optimizer.step()
    return model

# --- Core QuBound Function ---
def call_QuBound(qc, fake_backend, token=st.secrets["YOUR_TOKEN"]):
    try:
        # Initialize service with provided token or saved credentials
        if token:
            service = QiskitRuntimeService(channel="ibm_quantum_platform", token=token)
        else:
            service = QiskitRuntimeService() # Tries to load default saved account
            
        real_backend = service.backend("ibm_fez")
    except Exception as e:
        print(f"Auth Error: {e}. Try running service.save_account(token='...') once.")
        return None

    # Data Processing
    historic_data = look_back_window_ForError(real_backend)
    df = extract_time_series_from_historic(historic_data)
    t, s, r = decompose_noise(df)
    
    combined = pd.concat([t, s, r], axis=1).fillna(0)
    normalized = (combined - combined.mean()) / (combined.std() + 1e-9)
    
    # Feature Windows
    window_size = 5
    data_val = normalized.values
    x_seq = [data_val[i: i + window_size] for i in range(len(data_val) - window_size)]
    x_train = torch.tensor(np.array(x_seq), dtype=torch.float32)
    
    # Labels
    y_train = get_labels_fromNoise(qc, historic_data, fake_backend)
    y_train = y_train[window_size:] 
    
    # Model Execution
    model = train_loop(x_train, y_train)
    model.eval()
    
    with torch.no_grad():
        latest_noise = x_train[-1].unsqueeze(0)
        pred = model(latest_noise).numpy()[0]
        z = norm.ppf(0.975) 
        std = np.std(pred) + 1e-6
        
        result = {
            "prediction": pred,
            "upper": pred + z * std,
            "lower": pred - z * std
        }
        print("Final Bounds Calculated.")
        return result, model

if __name__ == '__main__':
    # REPLACE WITH YOUR TOKEN OR SAVE ACCOUNT BEFORE RUNNING
    MY_TOKEN = st.secrets["YOUR_TOKEN"]
    
    # Optional: Save account once to fix the AccountNotFoundError forever on this PC
    # QiskitRuntimeService.save_account(channel="ibm_quantum_platform", token=MY_TOKEN, overwrite=True)

    circuit_path = r'C:\Users\jovin\Desktop\streamlit\QRE\trained_circuit_3.qpy'
    
    try:
        with open(circuit_path, 'rb') as file:
            qc = qpy.load(file)[0]
        
        # Execute
        result = call_QuBound(qc, FakeFez(), token=MY_TOKEN)
        if result is not None:
            bounds, trained_model = result
            print(f"Prediction Sample: {bounds['prediction'][:3]}...")
        else:
            print("QuBound execution failed. Check authentication.")
    except FileNotFoundError:
        print(f"Error: Could not find circuit file at {circuit_path}")