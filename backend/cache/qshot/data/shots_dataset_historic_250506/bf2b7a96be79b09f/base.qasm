OPENQASM 3.0;
include "stdgates.inc";
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate xx_minus_yy(p0, p1) _gate_q_0, _gate_q_1 {
  rz(-p1) _gate_q_1;
  sdg _gate_q_0;
  sx _gate_q_0;
  s _gate_q_0;
  s _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  ry(0.5*p0) _gate_q_0;
  ry((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sdg _gate_q_1;
  sdg _gate_q_0;
  sxdg _gate_q_0;
  s _gate_q_0;
  rz(p1) _gate_q_1;
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
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
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
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[7] q;
xx_minus_yy(6.173204924119293, 6.100284509171638) q[0], q[4];
cy q[1], q[2];
ccx q[5], q[3], q[6];
rccx q[2], q[3], q[5];
ccx q[6], q[1], q[0];
sdg q[4];
cswap q[2], q[3], q[6];
csdg q[5], q[0];
xx_minus_yy(3.6550222702866697, 0.7498821614786128) q[4], q[1];
ccz q[1], q[6], q[2];
rccx q[5], q[3], q[4];
u1(2.70286531263829) q[0];
ccz q[5], q[4], q[6];
crz(1.3856989848866363) q[0], q[2];
rzx(1.1639887074332007) q[3], q[1];
z q[0];
cp(3.1608504557646313) q[3], q[2];
ccx q[6], q[5], q[1];
cz q[5], q[3];
rccx q[1], q[2], q[6];
cs q[0], q[4];
cs q[5], q[4];
iswap q[6], q[3];
cy q[1], q[2];
rz(4.450371631023834) q[0];
rccx q[2], q[5], q[0];
cswap q[1], q[4], q[3];
csx q[0], q[1];
rccx q[4], q[2], q[3];
crz(4.454853185060068) q[6], q[5];
ccx q[5], q[6], q[3];
cs q[2], q[1];
ccx q[5], q[3], q[2];
xx_minus_yy(6.026999362227136, 2.8155133475753216) q[0], q[6];
iswap q[4], q[1];
p(2.5357673696640073) q[0];
cswap q[3], q[4], q[2];
rzx(5.387081566143469) q[1], q[5];
cp(2.0486939896336325) q[4], q[5];
ccz q[1], q[3], q[0];
cs q[2], q[6];
rccx q[4], q[3], q[6];
rccx q[1], q[5], q[2];
