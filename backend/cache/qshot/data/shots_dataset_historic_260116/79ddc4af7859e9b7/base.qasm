OPENQASM 3.0;
include "stdgates.inc";
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
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
qubit[8] q;
cx q[5], q[1];
u1(4.802094279636504) q[2];
sx q[7];
ccz q[3], q[6], q[4];
U(1.469658047092549, 2.0150228266603913, 6.100965927853691) q[0];
rccx q[2], q[5], q[1];
sdg q[7];
rccx q[6], q[4], q[3];
x q[0];
tdg q[0];
tdg q[2];
rccx q[5], q[1], q[6];
ccx q[3], q[4], q[7];
cu(3.4277460014822756, 5.068215875006432, 2.025222729096525, 2.793573940505481) q[4], q[7];
sx q[0];
y q[6];
rccx q[1], q[2], q[5];
u2(1.489262542430135, 5.303561775233594) q[3];
cswap q[6], q[7], q[1];
cswap q[0], q[4], q[5];
r(2.668531642206209, 2.694232019285844) q[3];
x q[2];
