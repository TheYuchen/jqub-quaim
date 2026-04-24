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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
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
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
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
qubit[8] q;
rccx q[3], q[6], q[4];
rccx q[7], q[0], q[5];
dcx q[2], q[1];
rccx q[7], q[5], q[4];
cz q[0], q[1];
rccx q[6], q[2], q[3];
rccx q[5], q[0], q[3];
csx q[1], q[7];
ccz q[6], q[4], q[2];
rzz(3.2773513159810155) q[0], q[4];
ryy(0.9080961858791448) q[3], q[1];
rx(1.2541919869242557) q[6];
ccx q[2], q[7], q[5];
rccx q[5], q[7], q[3];
sxdg q[2];
ry(2.6403722129884724) q[1];
cswap q[4], q[6], q[0];
cswap q[6], q[5], q[1];
rx(2.468949490483748) q[0];
sxdg q[4];
sxdg q[2];
rccx q[5], q[1], q[0];
cswap q[7], q[3], q[6];
sxdg q[2];
rccx q[3], q[1], q[4];
ccx q[2], q[6], q[5];
rx(4.398784751695231) q[0];
z q[3];
cswap q[2], q[4], q[0];
cswap q[7], q[5], q[1];
x q[6];
ccz q[4], q[1], q[7];
z q[2];
p(2.631780759115507) q[0];
rccx q[5], q[3], q[6];
