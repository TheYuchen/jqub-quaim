"""CompressVQC implementation (refactored from Jovin Antony Maria's original).

Removes the sys.path / `qiskit_circuit_general` wildcard import used in the
Streamlit version and replaces it with explicit imports.
"""

from qiskit.circuit import QuantumCircuit, Parameter, ParameterExpression
from qiskit import qpy, qasm3, transpile

from qiskit_optimization.algorithms import MinimumEigenOptimizer
from qiskit_optimization.problems import QuadraticProgram
from qiskit_optimization.converters import QuadraticProgramToQubo

from qiskit_algorithms import QAOA
from qiskit_algorithms.optimizers import COBYLA
from qiskit.primitives import StatevectorSampler

from qiskit_ibm_runtime.fake_provider import FakeFez

import numpy as np
from types import SimpleNamespace


##### STEP 1: -------------------------
##### Implement LUT (Look-Up Table) using transpiled circuit depth


def get_gates_to_map(qc):
    gates_to_map = set()
    vqc_gate_types = ['ry', 'rx', 'rz', 'p']

    for instruction in qc.data:
        gate = instruction.operation
        if gate.name in vqc_gate_types:
            gates_to_map.add(gate.name)

    print(f"Targeting gates: {list(gates_to_map)}")
    return gates_to_map


def get_LUT(qc, backend):
    theta_values = [0, np.pi/2, np.pi, 3*np.pi/2, 2*np.pi]

    gates_to_map = get_gates_to_map(qc)
    lut = {}

    for gate in gates_to_map:
        lut[gate] = {}

        for theta in theta_values:
            test_qc = QuantumCircuit(2)

            if gate == 'rx':
                test_qc.rx(theta, 0)
            elif gate == 'ry':
                test_qc.ry(theta, 0)
            elif gate == 'rz':
                test_qc.rz(theta, 0)
            elif gate == 'p':
                test_qc.p(theta, 0)
            elif gate == 'cx':
                test_qc.cx(0, 1)

            transpiled_qc = transpile(test_qc, backend=backend, optimization_level=1)

            theta_rounded = round(theta, 3)
            lut[gate][theta_rounded] = transpiled_qc.depth()

    print(lut)
    return lut


##### STEP 2: -------------------------
##### Convert LUT into QuadraticProgram


def qaoa_callback(eval_count, parameters, value, metadata):
    print(f"  QAOA Eval {eval_count}: Energy {value:.6f}", end="\r")


def quadraticProgram_luttoqp(qc, lut):
    qp = QuadraticProgram("CompressVQC")
    lambda_param = 0.1
    obj_dict = {}

    for i, instruction in enumerate(qc.data):
        gate = instruction.operation

        if gate.name in lut:
            p_val = gate.params[0]
            original_val = float(p_val) if not isinstance(p_val, (Parameter, ParameterExpression)) else 0.5

            gate_var_names = []

            for theta_lut, depth in lut[gate.name].items():
                theta_id = int(round(theta_lut * 1000))  # FIXED: stable integer ID

                var_name = f"gate_{i}_{gate.name}_{theta_id}"
                qp.binary_var(name=var_name)

                gate_var_names.append(var_name)

                cost = (theta_lut - original_val) ** 2 + (lambda_param * depth)
                obj_dict[var_name] = cost

            qp.linear_constraint(
                linear={name: 1 for name in gate_var_names},
                sense="==",
                rhs=1
            )

    qp.minimize(linear=obj_dict)
    return qp


##### STEP 3: -------------------------
##### Solve QP using QAOA (convert to QUBO first)




def admmOptimizedCompVQC(qp):
    sampler = StatevectorSampler()
    optimizer = COBYLA(maxiter=4)

    qaoa = QAOA(
        sampler=sampler,
        optimizer=optimizer,
        callback=qaoa_callback
    )

    conv = QuadraticProgramToQubo()
    qubo = conv.convert(qp)

    minEigen = MinimumEigenOptimizer(qaoa)
    result = minEigen.solve(qubo)

    # for k, v in result.variables_dict.items():
    #     if v > 0.5:
    #         print("CHOSEN:", k, v)


    # Convert QUBO solution back into original variable space
    original_x = conv.interpret(result.x)

    # Build variables_dict manually
    variables_dict = {}
    for i, var in enumerate(qp.variables):
        variables_dict[var.name] = original_x[i]

    # Return object that behaves like OptimizationResult
    interpreted_result = SimpleNamespace(variables_dict=variables_dict)

    return interpreted_result


##### STEP 4: -------------------------
##### Build compressed VQC from optimization results


from qiskit import QuantumCircuit, transpile
from qiskit.circuit.library import RYGate

def resultsCompressVQC(result, original_qc):

    # start from the same initial qc and then apply the compressed changes
    compressed_qc = QuantumCircuit(*original_qc.qregs, *original_qc.cregs)

    for i, instr in enumerate(original_qc.data):
        # even gate and their instruction
        gate = instr.operation
        qargs = instr.qubits
        cargs = instr.clbits

        new_gate = gate

        if gate.name == "ry":
            for var_name, var_value in result.variables_dict.items():

                # only variables> 0.5, will exist after pruning
                if var_value > 0.5 and var_name.startswith(f"gate_{i}_ry_"):
                    theta_id = int(var_name.split("_")[-1])
                    new_theta = theta_id / 1000.0
                    new_gate = RYGate(new_theta)

        # recreate the compressed qc from the compressed gates
        compressed_qc.append(new_gate, qargs, cargs)

    # return transpile(
    #     compressed_qc,
    #     basis_gates=['sx', 'rz', 'cx', 'id'],
    #     optimization_level=3
    # )

    return compressed_qc


##### Example circuit generator


def gen_example_vqc(out_path=None):
    """Build a tiny 2-qubit example VQC. If ``out_path`` is given, dump it as QASM3."""
    qc = QuantumCircuit(2)

    theta_0 = Parameter('theta_0')
    theta_1 = Parameter('theta_1')

    qc.ry(theta_0, 0)
    qc.ry(theta_1, 1)
    qc.cx(0, 1)

    if out_path is not None:
        with open(out_path, "w") as f:
            qasm3.dump(qc, f)
        print(f"Success! {out_path} created with symbolic parameters.")
    return qc


##### Main runner


if __name__ == "__main__":
    # Minimal CLI entry for ad-hoc testing outside the web app.
    # Expects one environment variable:
    #   COMPVQC_QPY_FILE  - path to a .qpy file holding the VQC to compress
    import os

    qpy_path = os.environ["COMPVQC_QPY_FILE"]
    with open(qpy_path, "rb") as f:
        qc = qpy.load(f)[0]

    print(qc)

    backend = FakeFez()

    lut = get_LUT(qc, backend)
    qp = quadraticProgram_luttoqp(qc, lut)
    result = admmOptimizedCompVQC(qp)
    compressed_qc = resultsCompressVQC(result, qc)

    print("\n==== COMPRESSED CIRCUIT ====")
    print(compressed_qc)
