OPENQASM 3.0;
include "stdgates.inc";
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate xx_plus_yy(p0, p1) _gate_q_0, _gate_q_1 {
  rz(p1) _gate_q_0;
  sdg _gate_q_1;
  sx _gate_q_1;
  s _gate_q_1;
  s _gate_q_0;
  cx _gate_q_1, _gate_q_0;
  ry((-0.5)*p0) _gate_q_1;
  ry((-0.5)*p0) _gate_q_0;
  cx _gate_q_1, _gate_q_0;
  sdg _gate_q_0;
  sdg _gate_q_1;
  sxdg _gate_q_1;
  s _gate_q_1;
  rz(-p1) _gate_q_0;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
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
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[8] q;
sdg q[6];
u2(6.009249480848388, 4.038968187538246) q[2];
y q[5];
r(2.7564755370005787, 0.1277663963283735) q[3];
crz(4.314574090758572) q[0], q[1];
crz(4.866768923764846) q[4], q[7];
cp(1.5053442295197812) q[0], q[3];
ecr q[1], q[4];
iswap q[6], q[7];
cp(2.467359838862497) q[5], q[2];
rz(5.800650490413971) q[5];
y q[4];
dcx q[1], q[0];
cp(3.6360669768264042) q[3], q[6];
cry(4.766934725572776) q[7], q[2];
xx_plus_yy(3.2204260958034525, 2.55140453116281) q[2], q[3];
cy q[0], q[6];
u1(5.602732649359759) q[1];
id q[7];
tdg q[4];
id q[5];
x q[1];
csdg q[7], q[0];
rx(3.6821947050650756) q[5];
cu1(0.7830005654999425) q[3], q[6];
csx q[4], q[2];
cx q[4], q[0];
rzx(0.37036909705205934) q[2], q[6];
rzx(1.2849117395761283) q[5], q[3];
s q[1];
sx q[7];
csx q[6], q[0];
x q[2];
p(5.149965376662082) q[4];
csx q[5], q[3];
crx(1.091048138614242) q[1], q[7];
z q[0];
xx_plus_yy(1.089008051514859, 1.1232652398998757) q[5], q[7];
cx q[1], q[2];
ry(1.1277610374365494) q[3];
ecr q[4], q[6];
