OPENQASM 3.0;
include "stdgates.inc";
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
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
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
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
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
qubit[7] q;
h q[4];
xx_plus_yy(6.176900717002468, 6.0056210514223425) q[6], q[3];
U(0.36363876702986886, 5.912770791442592, 2.3362796573849347) q[5];
dcx q[1], q[0];
tdg q[2];
rzx(5.370542769796845) q[3], q[1];
iswap q[4], q[2];
cx q[6], q[5];
crz(2.1622749126314798) q[5], q[1];
cp(0.5798352760013747) q[2], q[4];
ch q[3], q[0];
u2(1.6787912491550598, 0.4983883668119138) q[6];
cp(1.5594829128676706) q[5], q[3];
ch q[4], q[1];
rzz(2.63984859716707) q[0], q[2];
u2(4.811150651012385, 4.138545017437199) q[6];
r(4.778263149921594, 5.2458436637386905) q[1];
u1(3.0511220894091675) q[6];
cz q[5], q[3];
sx q[4];
csx q[0], q[2];
cry(0.8493255292207487) q[2], q[4];
cu3(4.773511005186394, 6.042844264114263, 2.9449624014277975) q[3], q[6];
crz(3.9725355261955513) q[5], q[1];
ryy(3.4435172215757555) q[6], q[4];
rxx(6.107170049831922) q[3], q[5];
crx(1.086424321466231) q[0], q[1];
y q[2];
rxx(0.1487466735291124) q[5], q[0];
swap q[2], q[6];
r(5.567888904984818, 3.830256586337486) q[4];
csdg q[3], q[1];
cu3(0.18799132470866511, 4.177786862254782, 5.166253226480537) q[6], q[1];
csx q[2], q[0];
swap q[3], q[5];
t q[4];
cry(1.477393190404842) q[0], q[6];
z q[4];
ryy(4.307890003498686) q[1], q[3];
swap q[2], q[5];
crx(4.234961536022445) q[6], q[4];
cx q[3], q[5];
swap q[2], q[1];
y q[0];
cry(4.47580143158702) q[0], q[4];
sxdg q[6];
cu1(5.417601216007471) q[1], q[5];
cx q[3], q[2];
iswap q[1], q[2];
ry(0.2712469798494403) q[5];
rzx(5.5663353829333335) q[4], q[0];
rx(3.620746007969594) q[3];
p(0.3918717501530154) q[6];
rzx(4.571247476358073) q[6], q[0];
sx q[5];
cz q[4], q[1];
iswap q[3], q[2];
cry(1.6600083357310835) q[1], q[0];
swap q[5], q[4];
sx q[3];
cry(0.1287033377444057) q[6], q[2];
