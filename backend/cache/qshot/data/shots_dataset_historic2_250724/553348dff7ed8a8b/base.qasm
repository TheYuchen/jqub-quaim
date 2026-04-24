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
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p2 + 0.5*p1) _gate_q_0;
  p(0.5*p2 - 0.5*p1) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
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
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
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
gate rxx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_0;
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
  h _gate_q_0;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
qubit[5] q;
rccx q[1], q[3], q[2];
cry(0.7478368491129372) q[0], q[4];
csx q[2], q[3];
cu3(0.9184197426465678, 3.634636378891501, 5.867471810180344) q[1], q[0];
t q[4];
z q[4];
rzz(4.296392598488727) q[2], q[0];
rzx(0.9036428350071737) q[3], q[1];
rzx(5.065429608807253) q[2], q[0];
crx(5.026951810191427) q[3], q[4];
r(6.144796875151066, 4.876292631479091) q[1];
ryy(3.815350612660072) q[1], q[4];
crx(2.7464353031045863) q[3], q[2];
sdg q[0];
x q[3];
iswap q[4], q[0];
tdg q[1];
u2(5.9533237256972695, 3.1819309299474976) q[2];
crz(6.064548530179723) q[4], q[1];
x q[3];
xx_minus_yy(5.008786564329326, 1.3780748006625239) q[2], q[0];
x q[3];
rxx(5.831093195225948) q[2], q[1];
z q[0];
z q[0];
rx(2.428563435989958) q[3];
cz q[4], q[1];
rz(3.386345104146321) q[3];
ecr q[4], q[2];
cy q[1], q[0];
y q[3];
ryy(1.5535233320986925) q[2], q[0];
cu3(2.8537219813779395, 0.5280669077729818, 2.8891318130284316) q[1], q[4];
x q[3];
cu(4.993151252183008, 3.234569646061244, 1.9601559868296818, 3.531827723448244) q[0], q[4];
rzz(1.1736381967645808) q[1], q[2];
xx_minus_yy(5.715943613217593, 3.644914497468182) q[2], q[3];
y q[0];
crx(3.5614792674480906) q[1], q[4];
swap q[0], q[2];
cu(1.9473605388883166, 1.2597643785061874, 1.7784301648849161, 2.998438875831982) q[3], q[1];
crz(4.284296367289215) q[2], q[4];
cu1(3.8865158095562715) q[0], q[1];
rx(5.2650170363682465) q[3];
