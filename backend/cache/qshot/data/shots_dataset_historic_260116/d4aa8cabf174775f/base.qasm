OPENQASM 3.0;
include "stdgates.inc";
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
qubit[7] q;
swap q[3], q[0];
csdg q[6], q[1];
u3(2.3883481640137707, 5.016864650424107, 0.47206299441708993) q[2];
swap q[4], q[5];
s q[4];
s q[0];
r(0.6481416271767645, 1.5341800893048403) q[5];
u1(1.2963868238385332) q[6];
xx_plus_yy(0.9674425197841777, 4.0399700108891565) q[2], q[3];
u1(2.1877249737546496) q[0];
sxdg q[1];
u2(0.9084894725875148, 0.21034125048067603) q[4];
crx(1.615811733710645) q[3], q[5];
dcx q[6], q[2];
cp(5.195983844126287) q[5], q[3];
sdg q[6];
rx(2.351575566377056) q[1];
rzz(0.18057255109897286) q[2], q[4];
r(0.7895075149714751, 5.844889456424066) q[0];
cs q[6], q[4];
cry(1.7556282646057244) q[1], q[0];
U(3.196342411729338, 1.5949682727922094, 1.5072054320162145) q[3];
crx(5.481975393351815) q[2], q[5];
