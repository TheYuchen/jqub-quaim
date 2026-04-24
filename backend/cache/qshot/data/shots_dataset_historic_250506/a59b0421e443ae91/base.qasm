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
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
}
qubit[6] q;
ccx q[4], q[2], q[1];
rccx q[0], q[3], q[5];
ccx q[2], q[0], q[4];
cswap q[3], q[5], q[1];
rccx q[3], q[4], q[0];
z q[1];
iswap q[5], q[2];
cswap q[4], q[0], q[3];
ccz q[1], q[2], q[5];
x q[0];
u2(0.3231046270116843, 3.020858811022412) q[1];
tdg q[2];
ccz q[5], q[3], q[4];
rzx(0.11962400908534995) q[0], q[5];
ccx q[3], q[1], q[4];
cswap q[4], q[5], q[1];
ccx q[2], q[0], q[3];
rccx q[3], q[1], q[2];
ry(4.272137994073586) q[4];
ryy(0.4532566170183468) q[0], q[5];
