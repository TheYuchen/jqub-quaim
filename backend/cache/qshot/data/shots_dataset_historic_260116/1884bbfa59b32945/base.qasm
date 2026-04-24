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
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
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
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
qubit[7] q;
xx_minus_yy(1.245943508880315, 4.018952551356552) q[5], q[1];
swap q[2], q[0];
ry(3.0209616032680033) q[3];
U(4.425087440445796, 0.04209690806384064, 0.75747356681644) q[4];
rz(4.536381791726286) q[6];
xx_minus_yy(1.412327038153271, 0.4944318281288709) q[2], q[3];
r(6.223662233025298, 4.870467180966539) q[1];
cu1(3.3444131495864307) q[4], q[0];
cry(4.636061090307721) q[5], q[6];
s q[6];
sdg q[2];
csx q[1], q[5];
tdg q[4];
cz q[3], q[0];
csx q[1], q[4];
swap q[5], q[0];
t q[3];
t q[2];
sdg q[6];
rzx(3.81960669491373) q[4], q[1];
h q[5];
cry(5.327449441185202) q[0], q[2];
rzx(1.9391234694423995) q[3], q[6];
r(4.337712917958117, 4.934022870736059) q[5];
sdg q[1];
r(6.168166818054318, 0.7375702487774001) q[4];
tdg q[6];
U(1.9035786366384586, 5.6169327881577145, 5.601719658529434) q[2];
s q[3];
x q[0];
iswap q[0], q[6];
z q[5];
ecr q[3], q[2];
cs q[4], q[1];
rz(2.2131890576861375) q[4];
x q[1];
cp(4.725529537890103) q[3], q[6];
sdg q[2];
cry(1.0469501718400158) q[5], q[0];
