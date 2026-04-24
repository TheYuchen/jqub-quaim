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
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
qubit[7] q;
rccx q[0], q[4], q[5];
u1(4.434558076952035) q[1];
ccz q[3], q[6], q[2];
ccz q[3], q[2], q[6];
rccx q[0], q[5], q[4];
id q[1];
ccz q[1], q[3], q[4];
ccx q[6], q[0], q[5];
t q[2];
z q[1];
sdg q[5];
rccx q[2], q[0], q[4];
h q[6];
r(4.4069305861082935, 3.7142620966966655) q[3];
ccx q[0], q[1], q[5];
rccx q[4], q[2], q[3];
p(2.1114483975218805) q[6];
