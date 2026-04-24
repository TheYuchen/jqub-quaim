OPENQASM 3.0;
include "stdgates.inc";
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
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
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
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
qubit[7] q;
crx(4.383090154660795) q[5], q[2];
rzz(1.945553409400839) q[1], q[6];
csdg q[3], q[4];
sdg q[0];
ccx q[6], q[3], q[5];
cu1(1.1846969061203685) q[1], q[2];
y q[4];
u1(1.3263156626040642) q[0];
x q[5];
s q[1];
dcx q[3], q[2];
xx_plus_yy(4.789032300843523, 5.507074677596226) q[0], q[4];
ccz q[0], q[4], q[6];
u3(0.3543179472686305, 2.813098325502678, 3.468208510557191) q[1];
rccx q[5], q[2], q[3];
xx_plus_yy(2.6353549089660158, 6.0065889259492655) q[1], q[6];
csx q[3], q[5];
cy q[4], q[2];
rz(4.946629804191303) q[0];
cs q[2], q[6];
id q[1];
x q[0];
cry(4.963943685654748) q[5], q[4];
ch q[4], q[3];
cz q[1], q[2];
sx q[6];
xx_plus_yy(1.7956748654982193, 3.6111129475976393) q[0], q[5];
cu1(0.9157790940426199) q[1], q[0];
dcx q[3], q[2];
csdg q[6], q[5];
