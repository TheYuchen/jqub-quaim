OPENQASM 3.0;
include "stdgates.inc";
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
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
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
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[8] q;
rzx(5.769396301304691) q[4], q[5];
xx_plus_yy(2.3718357399760652, 1.2081607275005344) q[3], q[1];
crz(4.78066064756461) q[0], q[7];
cu1(0.6181722522095385) q[2], q[6];
crz(2.652074326860536) q[4], q[2];
cu1(4.8307457363190185) q[5], q[1];
xx_plus_yy(5.019739136087502, 1.2974911183343385) q[7], q[6];
cu(0.020363179078304927, 3.1425609541742223, 2.6215182468074474, 2.752835871114642) q[0], q[3];
xx_plus_yy(0.05966000218262931, 5.806279999389498) q[4], q[2];
cs q[0], q[6];
ecr q[5], q[1];
x q[3];
ecr q[6], q[1];
cu(2.0935211284353183, 0.041162668855071874, 4.051519382010861, 3.361594580117651) q[5], q[2];
ecr q[0], q[7];
cu1(4.615856444696903) q[4], q[3];
ecr q[3], q[4];
cu3(6.219321673655094, 3.9185917853779557, 1.5069217734738358) q[5], q[6];
cu3(3.599285825926068, 5.25123642524398, 1.9856205195577243) q[0], q[1];
crx(0.6610447305817341) q[7], q[2];
rzx(3.9395885724763353) q[4], q[5];
iswap q[0], q[3];
cy q[1], q[2];
rxx(1.5303749014446257) q[7], q[6];
csx q[2], q[1];
cp(5.760796455505157) q[0], q[3];
ecr q[5], q[6];
iswap q[7], q[4];
swap q[3], q[1];
swap q[7], q[0];
rxx(0.3141270638986835) q[2], q[4];
cu3(4.13063848072964, 2.70941470950703, 6.170307644317677) q[5], q[6];
