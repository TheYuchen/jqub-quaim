OPENQASM 3.0;
include "stdgates.inc";
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
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
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
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
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[7] q;
cz q[1], q[6];
ccx q[4], q[0], q[5];
U(5.115531080729645, 3.847286543471923, 4.460508652028506) q[2];
id q[3];
rz(1.7528206881399666) q[2];
r(2.7911923538668746, 3.2556908817880394) q[5];
rccx q[0], q[3], q[6];
iswap q[1], q[4];
u3(0.11617843091879874, 5.9156545645389595, 2.8865617460953166) q[1];
p(5.591358258623468) q[6];
rzz(3.734913358859947) q[4], q[5];
ch q[3], q[0];
sdg q[2];
ecr q[3], q[2];
ryy(5.958953079225335) q[1], q[6];
s q[4];
rzx(0.41773836259471936) q[5], q[0];
cy q[2], q[1];
rx(4.579014081223961) q[3];
u1(5.328779861138096) q[6];
t q[5];
p(6.180617600784155) q[4];
cswap q[2], q[3], q[6];
u2(5.732554439260232, 0.15640644287001415) q[4];
sdg q[0];
csx q[5], q[1];
id q[4];
ry(3.6531488743491822) q[5];
sdg q[0];
sxdg q[1];
U(3.555494785529278, 5.99595034388874, 5.4329278998866535) q[3];
h q[2];
sxdg q[6];
ch q[4], q[2];
U(2.8674771112332653, 2.791899292546501, 4.21070124968177) q[5];
ccx q[0], q[1], q[3];
