OPENQASM 3.0;
include "stdgates.inc";
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
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
qubit[5] q;
rzx(3.2551277855409806) q[1], q[3];
crz(2.3728826863138366) q[2], q[0];
id q[4];
cu(1.5389371321904133, 0.24995283124288736, 2.7658402421413237, 6.141896457155065) q[0], q[2];
ch q[1], q[4];
crz(5.264566313850752) q[4], q[3];
swap q[2], q[0];
ry(0.4395236641507615) q[1];
cx q[4], q[1];
cs q[3], q[0];
rz(5.845046774730672) q[2];
swap q[0], q[2];
cu1(4.0609097588511105) q[1], q[4];
p(0.2420768458429029) q[3];
rzz(0.4393829808228756) q[2], q[1];
cx q[0], q[3];
cx q[4], q[3];
u3(0.2493151029515998, 0.8039117396762829, 2.769028682307945) q[0];
csx q[2], q[1];
xx_minus_yy(2.02069321344178, 6.055999292892152) q[2], q[3];
iswap q[1], q[4];
cz q[2], q[0];
rxx(1.9783300730172493) q[1], q[4];
dcx q[3], q[1];
cry(2.0381944816832993) q[2], q[0];
cry(4.312741455187095) q[2], q[4];
ecr q[3], q[1];
tdg q[0];
cu(0.5006738763846226, 2.4862976863816684, 3.0062648281181112, 5.411424022350298) q[4], q[1];
x q[2];
cy q[3], q[0];
cu1(3.2363291124273523) q[4], q[0];
rxx(0.6808011060512239) q[2], q[1];
rzx(1.811583489355633) q[3], q[2];
swap q[1], q[0];
t q[2];
rx(3.7482274987631174) q[4];
rxx(4.370431673658871) q[1], q[0];
r(3.9974628510926604, 5.741504156406713) q[3];
