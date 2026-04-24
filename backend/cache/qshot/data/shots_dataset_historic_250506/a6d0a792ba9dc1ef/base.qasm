OPENQASM 3.0;
include "stdgates.inc";
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
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
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
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[7] q;
cry(5.880913695472703) q[1], q[4];
iswap q[5], q[6];
cy q[2], q[0];
id q[3];
dcx q[5], q[6];
xx_minus_yy(1.9088281946975538, 1.0874360650041692) q[2], q[3];
cz q[1], q[4];
iswap q[0], q[6];
cu1(0.3134009473416653) q[5], q[1];
iswap q[3], q[2];
cp(3.3944511764667045) q[5], q[2];
dcx q[3], q[1];
cu3(2.428807221250736, 2.4738049316632904, 4.9371489802473585) q[6], q[4];
rxx(2.680571575500336) q[0], q[6];
cu(2.6709278336618376, 5.380889999903939, 3.8523569063617558, 0.8491647279448862) q[3], q[5];
cx q[1], q[2];
crz(5.437742759409134) q[1], q[0];
cry(5.91100048927519) q[2], q[5];
cs q[6], q[4];
cs q[2], q[3];
cp(4.784252416342442) q[1], q[0];
cs q[5], q[6];
crz(2.546392509889385) q[4], q[2];
crx(3.11606945767729) q[5], q[0];
crx(4.672219031135804) q[3], q[6];
z q[1];
cp(2.0937407885020476) q[5], q[3];
swap q[2], q[1];
csx q[6], q[4];
csx q[0], q[1];
cu(0.6439048254642055, 5.589217976753341, 3.1801419584250383, 1.4176742235854036) q[2], q[4];
cy q[5], q[6];
ryy(0.8624927343658674) q[1], q[5];
cz q[4], q[2];
dcx q[6], q[0];
rxx(2.569975321021787) q[4], q[3];
xx_minus_yy(1.4354986075032163, 6.024192155631876) q[1], q[2];
id q[5];
swap q[6], q[0];
id q[3];
cp(2.01446040627826) q[1], q[0];
t q[5];
cp(6.206684407751711) q[2], q[4];
ch q[4], q[6];
ch q[2], q[1];
cu1(1.4112769720664222) q[5], q[3];
iswap q[2], q[4];
csdg q[1], q[3];
rzx(3.3272081630484225) q[6], q[0];
