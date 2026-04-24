OPENQASM 3.0;
include "stdgates.inc";
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p2 + 0.5*p1) _gate_q_0;
  p(0.5*p2 - 0.5*p1) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
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
cswap q[5], q[0], q[2];
ccz q[1], q[3], q[4];
ccx q[4], q[3], q[0];
ccx q[2], q[1], q[5];
sx q[0];
cswap q[2], q[4], q[5];
cu3(3.1225821404712133, 5.678870525728919, 0.8904753191860714) q[1], q[3];
ccx q[1], q[4], q[0];
rccx q[2], q[3], q[5];
ccz q[4], q[3], q[2];
ccx q[1], q[5], q[0];
ccz q[1], q[2], q[5];
ccx q[0], q[3], q[4];
rccx q[1], q[4], q[5];
ccz q[0], q[2], q[3];
p(4.94455138018455) q[3];
ccx q[5], q[0], q[2];
u2(0.7168069095802947, 0.7296441798214709) q[1];
rz(3.354733630221981) q[4];
