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
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
qubit[7] q;
rx(2.133847340993421) q[6];
rccx q[3], q[4], q[0];
ry(1.4399188930822255) q[2];
rx(1.3877311636114942) q[5];
ecr q[2], q[6];
rx(1.1910937041933785) q[0];
h q[3];
ccx q[4], q[1], q[5];
t q[1];
y q[5];
cswap q[0], q[4], q[6];
ry(2.8693576869618935) q[2];
z q[3];
cu(3.8803784251233235, 1.5246652387376503, 3.8739309065239214, 4.234440778957768) q[6], q[3];
ccx q[1], q[5], q[0];
u2(0.7585803544914498, 6.063842934840185) q[4];
ccx q[6], q[5], q[4];
rccx q[0], q[3], q[2];
sxdg q[2];
y q[1];
s q[0];
cswap q[6], q[5], q[4];
sx q[3];
ccx q[2], q[1], q[4];
rx(0.10688046272079382) q[6];
cswap q[3], q[0], q[5];
cswap q[6], q[5], q[0];
sdg q[2];
ccx q[1], q[3], q[4];
