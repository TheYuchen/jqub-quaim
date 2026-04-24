OPENQASM 3.0;
include "stdgates.inc";
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
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
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
qubit[6] q;
cy q[5], q[2];
cu(4.4695092344774805, 4.780897526276566, 0.2777950353018132, 2.4530625252037663) q[1], q[3];
rxx(2.14571997718574) q[0], q[4];
ch q[0], q[3];
ch q[2], q[1];
cy q[4], q[5];
cp(4.489667635461505) q[0], q[5];
cx q[2], q[3];
dcx q[1], q[4];
cs q[3], q[0];
sdg q[5];
cz q[4], q[1];
sx q[2];
rzz(3.7139002494897935) q[2], q[5];
id q[4];
cry(3.2503073244892846) q[0], q[3];
ch q[2], q[0];
rzz(4.631531585424594) q[5], q[3];
cx q[4], q[1];
r(5.76802224796423, 4.762790138878321) q[4];
cp(4.299409521675379) q[3], q[2];
ecr q[1], q[5];
rz(0.12352696073459397) q[0];
iswap q[0], q[5];
ecr q[1], q[4];
csdg q[3], q[2];
dcx q[1], q[5];
cu1(2.2669829029688313) q[3], q[4];
iswap q[0], q[2];
swap q[0], q[5];
rz(5.588500216222862) q[2];
ryy(3.6604689318867534) q[4], q[1];
r(3.847068145892653, 1.5232294843777106) q[3];
