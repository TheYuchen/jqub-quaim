OPENQASM 3.0;
include "stdgates.inc";
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
qubit[7] q;
ccx q[2], q[1], q[6];
sdg q[4];
cswap q[0], q[3], q[5];
z q[5];
cswap q[2], q[3], q[0];
ccx q[1], q[6], q[4];
ccz q[0], q[1], q[5];
ccz q[2], q[6], q[4];
