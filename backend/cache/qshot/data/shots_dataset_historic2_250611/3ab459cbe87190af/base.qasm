OPENQASM 3.0;
include "stdgates.inc";
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
gate rccx _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  t _gate_q_2;
  cx _gate_q_1, _gate_q_2;
  tdg _gate_q_2;
  cx _gate_q_0, _gate_q_2;
  t _gate_q_2;
  cx _gate_q_1, _gate_q_2;
  tdg _gate_q_2;
  h _gate_q_2;
}
qubit[6] q;
U(3.310710017403394, 0.7921146470181811, 2.2151355721056314) q[4];
cswap q[0], q[5], q[3];
csx q[2], q[1];
cs q[2], q[4];
ccz q[5], q[0], q[3];
p(5.773047576688166) q[1];
rx(2.1177424805707394) q[5];
ry(5.259670836422683) q[4];
ccx q[1], q[3], q[0];
rccx q[2], q[4], q[1];
z q[0];
id q[3];
ccz q[1], q[0], q[5];
cswap q[2], q[3], q[4];
