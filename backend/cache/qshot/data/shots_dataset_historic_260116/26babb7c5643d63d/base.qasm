OPENQASM 3.0;
include "stdgates.inc";
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
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
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
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
qubit[7] q;
rx(2.6800418889111635) q[4];
ccx q[0], q[6], q[1];
u1(5.3678445142591915) q[3];
u1(5.265460235497112) q[5];
cy q[1], q[4];
t q[6];
u1(0.6609413168691212) q[0];
rz(1.4251646284957844) q[3];
csdg q[2], q[5];
ccx q[1], q[2], q[3];
rccx q[4], q[6], q[0];
ccx q[6], q[2], q[5];
cswap q[0], q[3], q[4];
ry(1.5541705196379103) q[1];
ccx q[6], q[1], q[0];
ecr q[2], q[3];
rx(2.112754586557835) q[5];
z q[4];
ccx q[4], q[3], q[6];
ccz q[1], q[2], q[5];
z q[0];
cswap q[5], q[0], q[6];
rx(0.06848252913521685) q[2];
cswap q[4], q[3], q[1];
s q[1];
ccx q[5], q[4], q[3];
cswap q[2], q[0], q[6];
ccz q[3], q[0], q[4];
ccx q[5], q[1], q[6];
z q[2];
ccz q[2], q[3], q[4];
sx q[0];
ccz q[6], q[1], q[5];
r(3.8222659855378316, 3.699448476347238) q[4];
u2(2.905719023111842, 4.85131217381781) q[3];
ccx q[0], q[6], q[5];
rzx(4.807671847904582) q[2], q[1];
id q[1];
cswap q[2], q[5], q[0];
s q[4];
cry(0.18566766589231135) q[6], q[3];
u1(6.171502716189114) q[4];
ccx q[6], q[0], q[5];
ccx q[2], q[3], q[1];
cswap q[0], q[5], q[3];
h q[2];
ccz q[4], q[6], q[1];
z q[1];
cx q[3], q[4];
rccx q[2], q[5], q[0];
sxdg q[6];
