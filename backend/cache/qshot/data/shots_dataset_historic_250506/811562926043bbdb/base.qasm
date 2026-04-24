OPENQASM 3.0;
include "stdgates.inc";
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
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
qubit[8] q;
ccx q[7], q[2], q[5];
rccx q[6], q[1], q[4];
cp(0.09239063497564547) q[0], q[3];
rccx q[0], q[2], q[6];
ccx q[7], q[4], q[1];
sxdg q[3];
ry(0.49562310974051704) q[5];
dcx q[7], q[1];
ry(6.178097970794372) q[4];
rccx q[5], q[0], q[6];
ccx q[3], q[5], q[6];
ccz q[1], q[7], q[2];
tdg q[0];
u1(2.239029362028227) q[2];
ccz q[7], q[3], q[5];
rz(1.0791919998219472) q[0];
rccx q[1], q[6], q[4];
