OPENQASM 3.0;
include "stdgates.inc";
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
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
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
qubit[5] q;
cu1(1.154065825025058) q[3], q[2];
cswap q[1], q[4], q[0];
ccx q[3], q[4], q[1];
cu(4.206931770595797, 0.8298898551888333, 1.938965725276288, 5.257753254246144) q[2], q[0];
y q[2];
cu(3.037811645382876, 0.3397539400769405, 5.663634176828611, 4.236856895047137) q[1], q[0];
ccz q[4], q[2], q[1];
ch q[3], q[0];
u2(5.085541146351046, 0.11323396373010079) q[3];
cy q[2], q[0];
dcx q[1], q[4];
cu(4.233714289409678, 3.0341642398263526, 0.5044144656842452, 4.492881640765164) q[1], q[3];
rzx(1.216478290511166) q[2], q[4];
cy q[1], q[0];
rccx q[3], q[4], q[2];
ccz q[4], q[2], q[1];
sx q[1];
rccx q[2], q[0], q[3];
ccz q[2], q[1], q[4];
cp(4.516285445750012) q[0], q[3];
ccz q[1], q[3], q[4];
cs q[2], q[0];
ccx q[2], q[4], q[3];
cy q[0], q[1];
xx_plus_yy(0.40489047232771314, 2.2117900677813265) q[2], q[0];
ccx q[4], q[3], q[1];
ccx q[4], q[2], q[1];
rzz(5.362803894807717) q[0], q[3];
cswap q[0], q[1], q[2];
cu3(2.213180949457752, 3.5155504751283524, 5.364433881194503) q[3], q[4];
