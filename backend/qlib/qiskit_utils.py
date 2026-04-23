import io
import qiskit
from qiskit import QuantumCircuit
from qiskit import qasm2, qasm3, qpy
from qiskit_ibm_runtime.fake_provider import FakeFez, FakeMarrakesh, FakeTorino
from qiskit import transpile
from qiskit.quantum_info import Statevector, state_fidelity

def display_circuit(qc: QuantumCircuit):
    return qc.draw("mpl")

def qasmFile_toCircuit(file):
    """Load a Qiskit QPY or QASM file-like object into a QuantumCircuit."""
    try:
        if isinstance(file, (bytes, bytearray)):
            file_obj = io.BytesIO(file)
        else:
            file_obj = file
            if hasattr(file_obj, "seek"):
                file_obj.seek(0)

        qc = qpy.load(file_obj)[0]
        return qc
    except Exception as exc:
        if hasattr(file, "seek"):
            file.seek(0)
        raise RuntimeError(f"Could not load uploaded circuit file: {exc}") from exc
    
def transpile_optim(qc, backend, optim):
    optim_qc = transpile(qc, backend=backend, optimization_level=optim,basis_gates=['sx', 'rz', 'cx', 'id'])
    return optim_qc

def simpleFidelityEstimator(qc):

    # qc = QuantumCircuit(2)
    # qc.h(0)
    # qc.cx(0, 1)
    # print(qc)

    qc = qc.remove_final_measurements(inplace=False) # remove the measurements since statevector doesnt do measurements
    print(qc)

    final_state = Statevector.from_instruction(qc)

    # Define the target state (e.g., (|00> + |11>)/sqrt(2))
    target_state = Statevector.from_label('0' * qc.num_qubits) 
    #Calculate fidelity
    fidelity = state_fidelity(final_state, target_state)
    print(f"Fidelity: {fidelity}")
    return fidelity
