OPENQASM 3.0;
include "stdgates.inc";
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
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
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
qubit[6] q;
ch q[1], q[4];
ecr q[2], q[3];
swap q[0], q[5];
ry(4.278357631691787) q[5];
z q[4];
csx q[1], q[2];
U(3.5508526009510146, 2.611438477330331, 2.954363790688434) q[3];
y q[0];
p(5.491325493777305) q[0];
r(4.3310765458990135, 5.624395023676728) q[4];
x q[2];
sxdg q[1];
rz(2.535125456943992) q[5];
sx q[3];
u1(1.6144665723252687) q[3];
x q[5];
cu1(4.610959154957602) q[1], q[2];
u2(4.004104612688817, 5.528115660328351) q[0];
cp(3.088589623982684) q[5], q[2];
cu1(1.8493070225259918) q[0], q[4];
cx q[1], q[3];
